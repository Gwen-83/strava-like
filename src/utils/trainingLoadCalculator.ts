/**
 * Calculs centralisés pour la charge d'entraînement et les statistiques
 * Regroupe toute la logique de training load pour éviter la duplication
 */

import type { ActivitySummary } from "../types/Activity"
import {
  DEFAULT_REF_SPEEDS,
  N_EXP_BY_SPORT,
  DEFAULT_N_EXP,
  K_GRADE,
  VAR_ALPHA,
  TRAINING_LOAD_SCALE,
} from "./constants"

/**
 * Vérifie si une valeur est un nombre fini valide
 */
export function isValidNumber(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

/**
 * Calcule la médiane d'un tableau de nombres
 */
export function median(values: number[]): number {
  if (!values.length) return NaN
  const s = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Calcule les vitesses de référence par sport à partir des activités
 * Utilise la médiane des vitesses pour chaque sport (activités > 30 min et > 0 m)
 */
export function computeRefSpeeds(
  activities: ActivitySummary[]
): Record<string, number> {
  const SPORTS = Object.keys(DEFAULT_REF_SPEEDS)
  return SPORTS.reduce(
    (acc, sp) => {
      const speeds = activities
        .filter(
          (a) =>
            a.sport === sp &&
            Number(a.duration_s) > 1800 &&
            Number(a.distance_m) > 0
        )
        .map((a) => (Number(a.distance_m) / Number(a.duration_s)) * 3.6)
      const m = median(speeds)
      acc[sp] = Number.isFinite(m) ? m : DEFAULT_REF_SPEEDS[sp]
      return acc
    },
    {} as Record<string, number>
  )
}

/**
 * Calcule la charge d'entraînement pour une activité unique
 * Formule: 100 * durée(h) * (vitesse_ajustée / vitesse_référence)^n * facteur_variabilité
 */
export function calculateActivityTrainingLoad(
  activity: ActivitySummary,
  refSpeeds: Record<string, number>
): number {
  const durS = Number(activity.duration_s)
  if (!Number.isFinite(durS) || durS <= 0) return 0

  const durationHours = durS / 3600
  const distM = Number(activity.distance_m)
  const speedKmh =
    Number.isFinite(distM) && durS > 0 ? (distM / durS) * 3.6 : NaN

  // Facteur de dénivelé
  const elev = Number(activity.elevation_m) || 0
  const distKm = distM > 0 ? distM / 1000 : NaN
  const rawGrade =
    Number.isFinite(distKm) && distKm > 0 ? elev / distKm : NaN
  const gradeFactor = Number.isFinite(rawGrade)
    ? 1 + K_GRADE * Math.min(rawGrade, 150)
    : 1
  const adjSpeed = Number.isFinite(speedKmh) ? speedKmh * gradeFactor : NaN

  const sport = activity.sport || "Autre"
  const ref = sport in refSpeeds ? refSpeeds[sport] : NaN

  let actLoad = 0
  if (Number.isFinite(adjSpeed) && Number.isFinite(ref) && ref > 0) {
    const ratio = adjSpeed / ref
    const nExp =
      sport in N_EXP_BY_SPORT ? N_EXP_BY_SPORT[sport] : DEFAULT_N_EXP
    actLoad = TRAINING_LOAD_SCALE * durationHours * Math.pow(ratio, nExp)
  }

  // Facteur de variabilité basé sur la vitesse max
  const maxSpeedKmh = Number.isFinite(Number(activity.max_speed_ms))
    ? Number(activity.max_speed_ms) * 3.6
    : NaN
  const variability =
    Number.isFinite(maxSpeedKmh) && Number.isFinite(speedKmh) && speedKmh > 0
      ? maxSpeedKmh / speedKmh
      : 1
  const variabilityFactor = 1 + VAR_ALPHA * Math.max(0, variability - 1)
  actLoad *= variabilityFactor

  return Number.isFinite(actLoad) ? actLoad : 0
}

/**
 * Calcule la charge d'entraînement totale pour un ensemble d'activités
 */
export function calculateTotalTrainingLoad(
  activities: ActivitySummary[],
  refSpeeds: Record<string, number>
): number {
  return activities.reduce((sum, a) => sum + calculateActivityTrainingLoad(a, refSpeeds), 0)
}

/**
 * Métriques simples pour un ensemble d'activités
 */
export interface ActivityMetrics {
  distance: number
  elevation: number
  load: number
}

/**
 * Calcule les métriques pour un ensemble d'activités
 */
export function computeActivityMetrics(
  activities: ActivitySummary[],
  refSpeeds: Record<string, number>
): ActivityMetrics {
  try {
    const distance = activities.reduce((s, a) => {
      return s +
        (isValidNumber(a.distance_m as any) ? (a.distance_m as number) : 0)
    }, 0)

    const elevation = activities.reduce((s, a) => {
      return s +
        (isValidNumber(a.elevation_m as any) ? (a.elevation_m as number) : 0)
    }, 0)

    const load = calculateTotalTrainingLoad(activities, refSpeeds)

    return { distance, elevation, load }
  } catch {
    return { distance: 0, elevation: 0, load: 0 }
  }
}

/**
 * Calcule les statistiques d'activité (distance, durée, dénivelé, vitesse moyenne)
 */
export function calculateActivityStats(activities: ActivitySummary[]) {
  const validActivities = activities.filter((a) => !a.isSuspicious)

  const totalDistance = validActivities.reduce(
    (sum, a) => sum + (Number.isFinite(a.distance_m) ? a.distance_m : 0),
    0
  )

  const totalDuration = validActivities.reduce(
    (sum, a) => sum + (Number.isFinite(a.duration_s) ? a.duration_s : 0),
    0
  )

  const averageSpeed = totalDuration ? totalDistance / totalDuration : NaN

  const elevationValues = validActivities
    .map((a) =>
      isValidNumber(a.elevation_m as any) ? (a.elevation_m as number) : NaN
    )
    .filter((v) => Number.isFinite(v))

  const totalElevation = elevationValues.length
    ? elevationValues.reduce((s, v) => s + v, 0)
    : NaN

  return {
    totalDistance,
    averageSpeed,
    totalElevation,
    hasElevation: elevationValues.length > 0,
  }
}
