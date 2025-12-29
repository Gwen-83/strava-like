import { useMemo } from "react"
import { useUser } from "../contexts/UserContext"
import type { ActivitySummary } from "../types/Activity"

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
  return x.toISOString().slice(0, 10)
}

// --- ADD: constants / helpers to compute training load (copié et adapté depuis ChartsPage) ---
const DEFAULT_REF_SPEEDS: Record<string, number> = { Marche: 5, Cyclisme: 25, Course: 10, Randonnée: 4 }
const K_GRADE = 0.005
const N_EXP_BY_SPORT: Record<string, number> = {
  Marche: 1.8,
  Course: 2.6,
  Cyclisme: 2.4,
  Randonnée: 2.2,
}
const DEFAULT_N_EXP = 2.5
const VAR_ALPHA = 0.5

function median(values: number[]) {
  if (!values.length) return NaN
  const s = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// compute per-sport reference speeds from the activities (durations > 1800s, distance>0)
function computeRefSpeeds(activities: ActivitySummary[]) {
  const SPORTS = Object.keys(DEFAULT_REF_SPEEDS)
  return SPORTS.reduce((acc, sp) => {
    const speeds = activities
      .filter((a) => a.sport === sp && Number(a.duration_s) > 1800 && Number(a.distance_m) > 0)
      .map((a) => (Number(a.distance_m) / Number(a.duration_s)) * 3.6)
    const m = median(speeds)
    acc[sp] = Number.isFinite(m) ? m : DEFAULT_REF_SPEEDS[sp]
    return acc
  }, {} as Record<string, number>)
}

function trainingLoadFn(a: ActivitySummary, refSpeeds: Record<string, number>) {
  const durS = Number(a.duration_s)
  if (!Number.isFinite(durS) || durS <= 0) return 0
  const durationHours = durS / 3600
  const distM = Number(a.distance_m)
  const speedKmh = Number.isFinite(distM) && durS > 0 ? (distM / durS) * 3.6 : NaN
  const elev = Number(a.elevation_m) || 0
  const distKm = distM > 0 ? distM / 1000 : NaN
  const rawGrade = Number.isFinite(distKm) && distKm > 0 ? elev / distKm : NaN
  const gradeFactor = Number.isFinite(rawGrade) ? 1 + K_GRADE * Math.min(rawGrade, 150) : 1
  const adjSpeed = Number.isFinite(speedKmh) ? speedKmh * gradeFactor : NaN
  const sport = a.sport || "Autre"
  const ref = sport in refSpeeds ? refSpeeds[sport] : NaN

  let actLoad = 0
  if (Number.isFinite(adjSpeed) && Number.isFinite(ref) && ref > 0) {
    const ratio = adjSpeed / ref
    const nExp = sport in N_EXP_BY_SPORT ? N_EXP_BY_SPORT[sport] : DEFAULT_N_EXP
    actLoad = 100 * durationHours * Math.pow(ratio, nExp)
  } else {
    actLoad = 0
  }

  const variability =
    Number.isFinite(Number(a.max_speed_ms) * 3.6) && Number.isFinite(speedKmh) && speedKmh > 0
      ? Number(a.max_speed_ms) * 3.6 / speedKmh
      : 1
  const variabilityFactor = 1 + VAR_ALPHA * Math.max(0, variability - 1)
  actLoad *= variabilityFactor

  return Number.isFinite(actLoad) ? actLoad : 0
}
// --- END ADD ---

export default function MainPage({
  activities,
  onImport,
}: {
  activities: ActivitySummary[]
  onImport: () => void
}) {
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

    // Use trainingLoadFn when computing loads to match ChartsPage values
    const load30 = sum(in30, (a) => trainingLoadFn(a, REF_SPEEDS_KMH))
    const load7 = sum(in7, (a) => trainingLoadFn(a, REF_SPEEDS_KMH))
    const load28 = sum(in28, (a) => trainingLoadFn(a, REF_SPEEDS_KMH))

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
    const loadFirst = sum(firstHalf, (a) => trainingLoadFn(a, REF_SPEEDS_KMH))
    const loadSecond = sum(secondHalf, (a) => trainingLoadFn(a, REF_SPEEDS_KMH))
    const variation30Pct =
      loadFirst === 0 ? (loadSecond === 0 ? 0 : 100) : ((loadSecond - loadFirst) / Math.abs(loadFirst)) * 100

    return {
      distance30,
      elev30,
      time30s,
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
    // new: handle elevation objectives (sum elevation_m, convert to ft if needed)
    if (o.kind === "elevation") {
      const meters = filtered.reduce((s, a) => s + (Number(a.elevation_m) || 0), 0)
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

  return (
    <section style={{ display: "flex", gap: 24 }} className="section-mainPage">
      <div style={{ width: 260 }}>
        <h3>Résumé (30 derniers jours)</h3>
        <div style={{ display: "grid", gap: 8 }}>
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
            <strong>Total activités:</strong> {activities.length}
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

        {/* Objectives panel */}
        <aside style={{ width: 300 }}>
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
      </div>
    </section>
  )
}