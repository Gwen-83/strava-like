// utils/aggregates.ts
import type { ActivitySummary } from "../types/Activity"

function isValidNumber(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function groupByWeek(activities: ActivitySummary[]) {
  try {
    const map = new Map<string, number>()

    for (const a of activities) {
      if (!a || !(a.startDate instanceof Date)) continue
      // ignorer activités invalides
      if (!isValidNumber(a.distance_m)) continue // if (!isFinite(a.distance_m)) return acc

      const wkStart = startOfWeek(a.startDate)
      const key = wkStart.toISOString().slice(0, 10)
      map.set(key, (map.get(key) || 0) + a.distance_m)
    }

    const result = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, dist_m]) => ({ week, distance: dist_m / 1000 })) // km

    return result
  } catch {
    return []
  }
}

export function groupElevationByMonth(activities: ActivitySummary[]) {
  try {
    const map = new Map<string, number>()

    for (const a of activities) {
      if (!a || !(a.startDate instanceof Date)) continue
      if (!isValidNumber(a.elevation_m)) continue

      const d = a.startDate
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      map.set(key, (map.get(key) || 0) + a.elevation_m)
    }

    const result = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, elevation]) => ({ month, elevation }))

    return result
  } catch {
    return []
  }
}

export function trainingLoad(activities: ActivitySummary[]) {
  try {
    const map = new Map<string, number>()

    for (const a of activities) {
      if (!a || !(a.startDate instanceof Date)) continue
      if (!isValidNumber(a.distance_m) || !isValidNumber(a.duration_s)) continue

      // charge simple : (km) * (h)
      const km = a.distance_m / 1000
      const hours = a.duration_s / 3600
      const value = km * hours

      const key = a.startDate.toISOString().slice(0, 10)
      map.set(key, (map.get(key) || 0) + value)
    }

    const result = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value }))

    return result
  } catch {
    return []
  }
}