/**
 * Agrégation des activités par période (semaine, mois, etc.)
 * Utilisé pour les graphiques et statistiques
 */

import type { ActivitySummary } from "../types/Activity"
import { isValidNumber } from "./trainingLoadCalculator"
import { startOfWeek, dateKey } from "./dateHelpers"

/**
 * Regroupe les activités par semaine et somme les distances
 * @returns Array de {week: ISO date du lundi, distance: en km}
 */
export function groupByWeek(activities: ActivitySummary[]) {
  try {
    const map = new Map<string, number>()

    for (const a of activities) {
      if (!a || !(a.startDate instanceof Date)) continue
      if (!isValidNumber(a.distance_m)) continue

      const wkStart = startOfWeek(a.startDate)
      const key = wkStart.toISOString().slice(0, 10)
      map.set(key, (map.get(key) || 0) + a.distance_m)
    }

    const result = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, dist_m]) => ({ week, distance: dist_m / 1000 }))

    return result
  } catch {
    return []
  }
}

/**
 * Regroupe les activités par mois et somme les dénivelés
 * @returns Array de {month: yyyy-mm, elevation: en m}
 */
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

/**
 * Calcule la charge d'entraînement par jour (km * h simplifié)
 * @returns Array de {date: yyyy-mm-dd, value: charge}
 */
export function trainingLoad(activities: ActivitySummary[]) {
  try {
    const map = new Map<string, number>()

    for (const a of activities) {
      if (!a || !(a.startDate instanceof Date)) continue
      if (!isValidNumber(a.distance_m) || !isValidNumber(a.duration_s)) continue

      const km = a.distance_m / 1000
      const hours = a.duration_s / 3600
      const value = km * hours

      const key = dateKey(a.startDate)
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