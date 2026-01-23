import { useMemo } from "react"
import { useUser } from "../contexts/UserContext"
import type { ActivitySummary } from "../types/Activity"
import { predictPerformance } from "../utils/guess"
import {
  computeRefSpeeds,
  calculateActivityTrainingLoad,
} from "../utils/activityAnalytics"
import { useBanisterModel } from "../hooks/useBanisterModel"
import { getFormStatus } from "../utils/banisterModel"
import type { Activity } from "../types/BanisterModel"
import "../styles/main.css"

function formatDuration(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtKm(m: number) {
  return `${(m / 1000).toFixed(1)} km`
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function dayKey(d: Date) {
  const x = startOfDay(new Date(d))
  // Use local date, not UTC, to avoid timezone offset issues
  const year = x.getFullYear()
  const month = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function MainPage({
  activities,
  onImport,
}: {
  activities: ActivitySummary[]
  onImport: () => void
}) {
  // const [helpOpen, setHelpOpen] = useState(false)
  const { objectives } = useUser()
  const today = startOfDay(new Date())

  const byDay = useMemo(() => {
    const map = new Map<string, ActivitySummary[]>()
    activities.forEach((a) => {
      const key = dayKey(new Date(a.startDate))
      const arr = map.get(key) ?? []
      arr.push(a)
      map.set(key, arr)
    })
    return map
  }, [activities])

  // compute ref speeds once for consistent load calculation
  const REF_SPEEDS_KMH = useMemo(() => computeRefSpeeds(activities), [activities])

  const totals = useMemo(() => {
    const now = new Date()
    const dayMs = 24 * 60 * 60 * 1000
    const cutoff30 = new Date(now.getTime() - 29 * dayMs) // include today (30 days)
    const cutoff28 = new Date(now.getTime() - 27 * dayMs) // 28 days window (including today)
    const cutoff7 = new Date(now.getTime() - 6 * dayMs) // 7 days window

    const in30 = activities.filter((a) => new Date(a.startDate) >= startOfDay(cutoff30))
    const in28 = activities.filter((a) => new Date(a.startDate) >= startOfDay(cutoff28))
    const in7 = activities.filter((a) => new Date(a.startDate) >= startOfDay(cutoff7))

    const sum = (arr: ActivitySummary[], cb: (a: ActivitySummary) => number) =>
      arr.reduce((s, a) => s + (cb(a) ?? 0), 0)

    const distance30 = sum(in30, (a) => a.distance_m ?? 0)
    const elev30 = sum(in30, (a) => a.elevation_m ?? 0)
    const time30s = sum(in30, (a) => a.duration_s ?? 0)
    const count30 = in30.length

    // Use calculateActivityTrainingLoad for consistent load calculation across pages
    const load30 = sum(in30, (a) => calculateActivityTrainingLoad(a, REF_SPEEDS_KMH))
    const load7 = sum(in7, (a) => calculateActivityTrainingLoad(a, REF_SPEEDS_KMH))
    const load28 = sum(in28, (a) => calculateActivityTrainingLoad(a, REF_SPEEDS_KMH))

    // variation over 30 days: compare latter half (last 15 days) vs first half (previous 15 days)
    const half = 15
    const start30 = startOfDay(cutoff30)
    const mid = new Date(start30.getTime() + half * dayMs)
    const firstHalf = activities.filter((a) => {
      const d = startOfDay(new Date(a.startDate))
      return d >= start30 && d < mid
    })
    const secondHalf = activities.filter((a) => {
      const d = startOfDay(new Date(a.startDate))
      return d >= mid && d <= startOfDay(now)
    })
    const loadFirst = sum(firstHalf, (a) => calculateActivityTrainingLoad(a, REF_SPEEDS_KMH))
    const loadSecond = sum(secondHalf, (a) => calculateActivityTrainingLoad(a, REF_SPEEDS_KMH))
    const variation30Pct =
      loadFirst === 0 ? (loadSecond === 0 ? 0 : 100) : ((loadSecond - loadFirst) / Math.abs(loadFirst)) * 100

    return {
      distance30,
      elev30,
      time30s,
      count30,
      load30,
      load7,
      load28,
      variation30Pct,
    }
  }, [activities, REF_SPEEDS_KMH])

  const last5 = useMemo(() => {
    return [...activities]
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 5)
  }, [activities])

  const performance = useMemo(() => {
    try {
      return predictPerformance(activities, totals.load28, totals.load7)
    } catch {
      return { running: null, cycling: null, confidence: { running: "medium", cycling: "medium" } }
    }
  }, [activities, totals.load28, totals.load7])

  // calendar for current month
  const calendar = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const daysInMonth = last.getDate()
    const startWeekday = first.getDay() // 0 Sunday .. 6 Saturday
    const weeks: (number | null)[][] = []
    let week: (number | null)[] = []
    for (let i = 0; i < startWeekday; i++) week.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d)
      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null)
      weeks.push(week)
    }
    return { year, month, weeks }
  }, [today])

  // --- ADD: monthly records computation ---
  const monthlyRecords = useMemo(() => {
    if (activities.length === 0) {
      return {
        longestStreak: { count: 0, startDate: null, endDate: null },
        maxDistance: { value: 0, month: null, year: null, monthName: "" },
        maxElevation: { value: 0, month: null, year: null, monthName: "" },
        maxTime: { value: 0, month: null, year: null, monthName: "" },
        maxLoad: { value: 0, month: null, year: null, monthName: "" },
      }
    }

    // Group activities by month
    const byMonth = new Map<string, ActivitySummary[]>()
    activities.forEach((a) => {
      const d = new Date(a.startDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const arr = byMonth.get(key) ?? []
      arr.push(a)
      byMonth.set(key, arr)
    })

    let maxDistanceMonth = { value: 0, key: "", distance: 0 }
    let maxElevationMonth = { value: 0, key: "", elevation: 0 }
    let maxTimeMonth = { value: 0, key: "", time: 0 }
    let maxLoadMonth = { value: 0, key: "", load: 0 }

    byMonth.forEach((activitiesInMonth, key) => {
      const dist = activitiesInMonth.reduce((s, a) => s + (a.distance_m ?? 0), 0)
      const elev = activitiesInMonth.reduce((s, a) => s + (a.elevation_m ?? 0), 0)
      const time = activitiesInMonth.reduce((s, a) => s + (a.duration_s ?? 0), 0)
      const load = activitiesInMonth.reduce((s, a) => s + calculateActivityTrainingLoad(a, REF_SPEEDS_KMH), 0)

      if (dist > maxDistanceMonth.value) {
        maxDistanceMonth = { value: dist, key, distance: dist }
      }
      if (elev > maxElevationMonth.value) {
        maxElevationMonth = { value: elev, key, elevation: elev }
      }
      if (time > maxTimeMonth.value) {
        maxTimeMonth = { value: time, key, time }
      }
      if (load > maxLoadMonth.value) {
        maxLoadMonth = { value: load, key, load }
      }
    })

    // Compute longest consecutive days with activity
    const sortedActivities = [...activities].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    const daysWithActivity = new Set(sortedActivities.map((a) => dayKey(new Date(a.startDate))))
    let longestStreak = { count: 0, startDate: null as Date | null, endDate: null as Date | null }
    let currentStreak = { count: 0, startDate: null as Date | null }

    const dayMs = 24 * 60 * 60 * 1000
    let checkDate = sortedActivities.length > 0 ? startOfDay(new Date(sortedActivities[0].startDate)) : new Date()
    const endDate = startOfDay(new Date())

    while (checkDate <= endDate) {
      if (daysWithActivity.has(dayKey(checkDate))) {
        if (currentStreak.count === 0) {
          currentStreak.startDate = new Date(checkDate)
        }
        currentStreak.count++
      } else {
        if (currentStreak.count > longestStreak.count) {
          longestStreak = {
            count: currentStreak.count,
            startDate: currentStreak.startDate,
            endDate: new Date(checkDate.getTime() - dayMs),
          }
        }
        currentStreak = { count: 0, startDate: null }
      }
      checkDate = new Date(checkDate.getTime() + dayMs)
    }
    if (currentStreak.count > longestStreak.count) {
      longestStreak = {
        count: currentStreak.count,
        startDate: currentStreak.startDate,
        endDate: new Date(endDate),
      }
    }

    const parseMonthKey = (key: string) => {
      const [year, month] = key.split("-")
      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
      return { year: parseInt(year), month: parseInt(month) - 1, monthName: monthNames[parseInt(month) - 1] }
    }

    return {
      longestStreak,
      maxDistance: maxDistanceMonth.key ? { value: maxDistanceMonth.distance, ...parseMonthKey(maxDistanceMonth.key) } : { value: 0, year: null, month: null, monthName: "" },
      maxElevation: maxElevationMonth.key ? { value: maxElevationMonth.elevation, ...parseMonthKey(maxElevationMonth.key) } : { value: 0, year: null, month: null, monthName: "" },
      maxTime: maxTimeMonth.key ? { value: maxTimeMonth.time, ...parseMonthKey(maxTimeMonth.key) } : { value: 0, year: null, month: null, monthName: "" },
      maxLoad: maxLoadMonth.key ? { value: maxLoadMonth.load, ...parseMonthKey(maxLoadMonth.key) } : { value: 0, year: null, month: null, monthName: "" },
    }
  }, [activities, REF_SPEEDS_KMH])
  // --- END ADD ---

  const monthHasActivity = (day: number) => {
    const date = new Date(calendar.year, calendar.month, day)
    return byDay.has(dayKey(date))
  }

  // helper: compute start/end of current period (aligned to calendar)
  function periodRange(period?: "week" | "month" | "year") {
    const now = new Date()
    if (!period) return { start: new Date(0), end: new Date(8640000000000000) }
    if (period === "week") {
      const d = new Date(now)
      const day = d.getDay() // 0..6, week starts Sunday
      const start = startOfDay(new Date(d.getTime() - day * 24 * 3600 * 1000))
      const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000 - 1)
      return { start, end }
    }
    if (period === "month") {
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
      const end = startOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 1))
      end.setMilliseconds(end.getMilliseconds() - 1)
      return { start, end }
    }
    // year
    const start = startOfDay(new Date(now.getFullYear(), 0, 1))
    const end = startOfDay(new Date(now.getFullYear() + 1, 0, 1))
    end.setMilliseconds(end.getMilliseconds() - 1)
    return { start, end }
  }

  function sumActivitiesForObjective(o: any) {
    const { start, end } = o.period ? periodRange(o.period) : { start: new Date(0), end: new Date(8640000000000000) }
    const filtered = activities.filter((a) => {
      const d = new Date(a.startDate)
      if (d < start || d > end) return false
      if (o.sport && a.sport !== o.sport) return false
      return true
    })
    if (o.kind === "sessions") return filtered.length
    if (o.kind === "hours" || o.kind === "totalHours") {
      const secs = filtered.reduce((s, a) => s + (Number(a.duration_s) || 0), 0)
      return secs / 3600
    }
    if (o.kind === "distance") {
      const meters = filtered.reduce((s, a) => s + (Number(a.distance_m) || 0), 0)
      if (o.unit === "mi") return (meters / 1000) * 0.621371
      return meters / 1000
    }

    if (o.kind === "elevation") {
      const meters = filtered.reduce((s, a) => s + ( Number(a.elevation_m) || 0), 0)
      if (o.unit === "ft") return meters * 3.28084
      return meters
    }
    return 0
  }

  function elapsedFraction(o: any) {
    if (!o.period) return 1
    const { start, end } = periodRange(o.period)
    const now = Date.now()
    if (now <= start.getTime()) return 0
    if (now >= end.getTime()) return 1
    return (now - start.getTime()) / (end.getTime() - start.getTime())
  }

  // ============================================================================
  // BANISTER TRAINING ADVICE
  // ============================================================================
  
  // Prepare activities in Banister format
  const banisterActivities = useMemo((): Activity[] => {
    return activities.map((a) => ({
      date: dayKey(new Date(a.startDate)),
      trainingLoad: calculateActivityTrainingLoad(a, REF_SPEEDS_KMH),
    }))
  }, [activities, REF_SPEEDS_KMH])

  // Get Banister model
  const banisterData = useBanisterModel(banisterActivities)
  const current = banisterData.currentPoint

  // Get training advice based on TSB
  const getTrainingAdvice = (tsb: number) => {
    const formStatus = getFormStatus(tsb)

    const zones: Record<string, { zone: string; icon: string; meaning: string; color: string }> = {
      peaking: {
        zone: "PEAKING",
        icon: "🎯",
        meaning: "Excellent état de forme ! C'est le moment de chercher des performances.",
        color: "#4caf50",
      },
      balanced: {
        zone: "BALANCED",
        icon: "⚖️",
        meaning: "État d'équilibre parfait. Continuez l'entraînement structuré.",
        color: "#2196f3",
      },
      accumulating: {
        zone: "ACCUMULATING",
        icon: "📚",
        meaning: "Phase de charge. Augmentez progressivement le volume.",
        color: "#ff9800",
      },
      recovering: {
        zone: "RECOVERING",
        icon: "🏥",
        meaning: "Phase de récupération. Réduisez le volume d'entraînement.",
        color: "#ff9800",
      },
      overreaching: {
        zone: "OVERREACHING",
        icon: "🚨",
        meaning: "Attention ! Vous êtes surmenés. Réduisez drastiquement.",
        color: "#f44336",
      },
    }

    return zones[formStatus] || zones.balanced
  }

  const advice = current ? getTrainingAdvice(current.TSB) : null

  return (
    <section style={{ display: "flex", gap: 24 }} className="section-mainPage">
      <div style={{ width: 260 }}>
          {/* BANISTER TRAINING ADVICE */}
          {current && advice && (
            <div style={{ display: "grid", gap: 8, border: `2px solid ${advice.color}`, padding: 12, borderRadius: 8, background: `${advice.color}15` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24 }}>{advice.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>État de forme : {advice.zone}</div>
                  <div style={{ fontSize: 14, color: "#ffffffdd" }}>{advice.meaning}</div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${advice.color}80`, paddingTop: 8, marginTop: 8 }}>
                <div style={{ fontSize: 12, color: "#ffffffb9", marginBottom: 4 }}>
                  <strong>CTL (Fitness):</strong> {current.CTL.toFixed(1)} | 
                  <strong style={{ marginLeft: 12 }}>ATL (Fatigue):</strong> {current.ATL.toFixed(1)} | 
                  <strong style={{ marginLeft: 12 }}>TSB (État):</strong> {current.TSB.toFixed(1)}
                </div>
              </div>
            </div>
          )}
          <br></br>

        <div style={{ display: "grid", gap: 8, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <h3>Résumé (30 derniers jours)</h3>
          <div>
            <strong>Total distance:</strong> {fmtKm(totals.distance30)}
          </div>
          <div>
            <strong>Dénivelé:</strong> {Math.round(totals.elev30)} m
          </div>
          <div>
            <strong>Temps d'entraînement:</strong> {formatDuration(totals.time30s)}
          </div>
          <div>
            <strong>Charge entr. (30j):</strong> {Math.round(totals.load30)}
          </div>
          <div>
            <strong>Variation charge (30j):</strong>{" "}
            {totals.variation30Pct >= 0 ? "+" : ""}
            {totals.variation30Pct.toFixed(0)}%
          </div>
          <div style={{marginTop:16}}>
            <strong>Activités (30j):</strong> {totals.count30}
          </div>
        </div>

        {/* Monthly records */}
        <div style={{ marginTop: 20, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>Records mensuels</h3>
          <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
            <div>
              <strong>Plus longue série:</strong> {monthlyRecords.longestStreak.count} jour(s)
              {monthlyRecords.longestStreak.startDate && monthlyRecords.longestStreak.endDate && (
                <span style={{ fontSize: 12, color: "#666" }}>
                  {" "}
                  ({monthlyRecords.longestStreak.startDate.toLocaleDateString()} - {monthlyRecords.longestStreak.endDate.toLocaleDateString()})
                </span>
              )}
            </div>
            <div>
              <strong>Plus grande distance:</strong> {fmtKm(monthlyRecords.maxDistance.value)}
              {monthlyRecords.maxDistance.year && (
                <span style={{ fontSize: 12, color: "#666" }}>
                  {" "}
                  ({monthlyRecords.maxDistance.monthName} {monthlyRecords.maxDistance.year})
                </span>
              )}
            </div>
            <div>
              <strong>Plus gros dénivelé:</strong> {Math.round(monthlyRecords.maxElevation.value)} m
              {monthlyRecords.maxElevation.year && (
                <span style={{ fontSize: 12, color: "#666" }}>
                  {" "}
                  ({monthlyRecords.maxElevation.monthName} {monthlyRecords.maxElevation.year})
                </span>
              )}
            </div>
            <div>
              <strong>Plus long temps:</strong> {formatDuration(monthlyRecords.maxTime.value)}
              {monthlyRecords.maxTime.year && (
                <span style={{ fontSize: 12, color: "#666" }}>
                  {" "}
                  ({monthlyRecords.maxTime.monthName} {monthlyRecords.maxTime.year})
                </span>
              )}
            </div>
            <div>
              <strong>Plus grosse charge:</strong> {Math.round(monthlyRecords.maxLoad.value)}
              {monthlyRecords.maxLoad.year && (
                <span style={{ fontSize: 12, color: "#666" }}>
                  {" "}
                  ({monthlyRecords.maxLoad.monthName} {monthlyRecords.maxLoad.year})
                </span>
              )}
            </div>
          </div>
        </div>

        {totals.load7 > totals.load28 && (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: 12,
              background: "#ffe6e6",
              border: "1px solid #ff8c8c",
              borderRadius: 6,
            }}
          >
            Attention — la charge sur 7 jours ({Math.round(totals.load7)}) est supérieure à la charge sur
            28 jours ({Math.round(totals.load28)}).
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Calendrier — {new Date().toLocaleString(undefined, { month: "long", year: "numeric" })}</h3>
            <button onClick={onImport} aria-label="Importer depuis Strava">
              Importer Strava
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginTop: 8 }}>
            {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 12, color: "#666" }}>
                {d}
              </div>
            ))}

            {calendar.weeks.map((week, wi) =>
              week.map((day, di) => {
                if (day == null) {
                  return <div key={`${wi}-${di}`} />
                }
                const has = monthHasActivity(day)
                const isToday =
                  day === new Date().getDate() &&
                  calendar.month === new Date().getMonth() &&
                  calendar.year === new Date().getFullYear()
                return (
                  <div
                    key={`${wi}-${di}`}
                    style={{
                      minHeight: 64,
                      borderRadius: 8,
                      padding: 6,
                      background: isToday ? "#f0f8ff" : undefined,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#333" }}>{day}</div>
                    <div style={{ flex: 1 }} />
                    {has && (
                      <div
                        aria-hidden
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 10,
                          background: "#1976d2",
                          marginTop: 6,
                          marginLeft: 2,
                        }}
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <h4>Dernières 5 activités</h4>
            <ul style={{ paddingLeft: 16 }}>
              {last5.map((a) => (
                <li key={a.id ?? `${a.startDate}-${a.distance_m}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <strong>{new Date(a.startDate).toLocaleDateString()}</strong> — {a.sport}
                    </div>
                    <div style={{ color: "#444" }}>
                      {fmtKm(a.distance_m ?? 0)} • {formatDuration(a.duration_s ?? 0)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Predictions and Objectives panel - stacked vertically */}
        <div style={{ display: "flex", flexDirection: "column", width: 300, gap: 24 }}>
          {/* Objectives panel */}
          <aside>
            <h3>Objectifs</h3>
            {objectives && objectives.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {objectives.map((o) => {
                  const actual = sumActivitiesForObjective(o)
                  const target = Number(o.value) || 0
                  const pct = target > 0 ? Math.round((actual / target) * 100) : 0
                  const clampedPct = Math.max(0, Math.min(100, pct))
                  const elapsed = elapsedFraction(o)
                  const expectedSoFar = target * elapsed
                  const behind = o.kind !== "totalHours" && actual < expectedSoFar - 1e-6
                  const label =
                    o.kind === "sessions" ? `${actual}/${target} séances` :
                    o.kind === "hours" || o.kind === "totalHours" ? `${actual.toFixed(1)}h / ${target}h` :
                    o.kind === "distance" ? `${actual.toFixed(1)} ${o.unit || "km"} / ${target} ${o.unit || "km"}` :
                    o.kind === "elevation" ? `${actual.toFixed(0)} ${o.unit || "m"} / ${target} ${o.unit || "m"}` :
                    ""
                  return (
                    <div key={o.id} style={{ border: "1px solid #eee", padding: 10, borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                        {o.sport ? <div style={{ fontSize: 12, color: "#666" }}>{o.sport}</div> : null}
                      </div>
                      <div style={{ height: 8, background: "#f0f0f0", borderRadius: 6, marginTop: 8, overflow: "hidden" }}>
                        <div style={{ width: `${clampedPct}%`, height: "100%", background: "#1976d2" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                        <div>{clampedPct}%</div>
                        <div style={{ color: behind ? "#d9534f" : "#2e7d32" }}>{o.kind === "totalHours" ? "" : (behind ? "En retard" : "On track")}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="small-muted">Aucun objectif défini.</div>
            )}
          </aside>

          {/* Predictions panel */}
          <div style={{ border: "1px solid #eee", padding: 10, borderRadius: 6 }}>
            <h3>Prédictions</h3>
            
            {/* Course */}
            {performance.running ? (
              <div style={{ marginBottom: 15, paddingBottom: 12, borderBottom: "1px solid #f0f0f0" }}>
                <strong>Course à pied</strong>
                <div style={{ fontSize: 13 }}>
                  <div>VMA estimée: <span style={{ fontWeight: 600 }}>{((performance.running as Record<string, number>).vma || 0).toFixed(2)} km/h</span></div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                    (Vitesse Maximale Aérobie)
                  </div>
                  <div style={{ fontSize: 11, display: "flex", gap: 12, marginBottom: 8, color: "#888" }}>
                    <span>
                      Confiance: <span style={{ color: "#888" }}>
                        {((performance.running as Record<string, string | number>).vmaConfidence || "medium")}
                      </span>
                    </span>
                    <span>
                      Incertitude: <strong>±{((performance.running as Record<string, number>).vmaUncertainty || 15).toFixed(0)}%</strong>
                    </span>
                  </div>
                  <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 8, marginBottom: 8 }} />
                  <div>5 km: {formatDuration((performance.running as Record<string, number>)["5km"])}</div>
                  <div>10 km: {formatDuration((performance.running as Record<string, number>)["10km"])}</div>
                  <div>21.1 km: {formatDuration((performance.running as Record<string, number>)["21.1km"])}</div>
                  <div>Marathon: {formatDuration((performance.running as Record<string, number>)["42.2km"])}</div>
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>Confiance: {performance.confidence.running}</div>
              </div>
            ) : (
              <div className="small-muted">Pas assez de données pour prédictions course.</div>
            )}

            {/* Cyclisme */}
            {performance.cycling ? (
              <div style={{ marginTop: 10 }}>
                <strong>Cyclisme</strong>
                <div style={{ fontSize: 13 }}>
                  <div>FTP estimé: <span style={{ fontWeight: 600 }}>{(performance.cycling as any).ftp} W</span></div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    ({(performance.cycling as any).ftp_wkg} W/kg)
                    (Incertitude : {(performance.cycling as any).ftp_uncertainty} %)
                  </div>
                  <div style={{ marginTop: 6 }}>Puissance 20 min: <span style={{ fontWeight: 600 }}>{(performance.cycling as any).power20min} W</span></div>
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>Confiance: {performance.confidence.cycling}</div>
              </div>
            ) : (
              <div className="small-muted" style={{ marginTop: 10 }}>Pas assez de données pour prédictions cyclisme.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}