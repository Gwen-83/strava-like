import { useMemo } from "react"
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

export default function MainPage({
  activities,
  onImport,
}: {
  activities: ActivitySummary[]
  onImport: () => void
}) {
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
    const load30 = sum(in30, (a) => a.load ?? 0)

    const load7 = sum(in7, (a) => a.load ?? 0)
    const load28 = sum(in28, (a) => a.load ?? 0)

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
    const loadFirst = sum(firstHalf, (a) => a.load ?? 0)
    const loadSecond = sum(secondHalf, (a) => a.load ?? 0)
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
  }, [activities])

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

  return (
    <section style={{ display: "flex", gap: 24 }}>
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
    </section>
  )
}