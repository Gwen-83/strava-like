// types/suspicion.ts
import type { SportType } from "./Activity"

export interface ActivityInput {
  sport: SportType
  distance_m: number
  duration_s: number
  elevation_m: number
  avg_speed_ms?: number | null
  has_gps: boolean
  has_streams: boolean
  polyline?: string | null
  streams?: Record<string, number[]> | null
}

export interface UserBaseline {
  medianDistance_m: number
  medianDuration_s: number
  avgSpeed_ms: number
}

export interface SuspicionResult {
  isSuspicious?: boolean
  suspicionScore: number
  suspicionReasons: string[]
}

const MAX_REALISTIC_SPEED_KMH: Record<SportType, number> = {
  Run: 25,
  Ride: 90,
  Walk: 10,
  Other: 50,
}

function addScore(
  score: number,
  reasons: string[],
  value: number,
  reason: string
): number {
  if (value <= 0) return score
  reasons.push(reason)
  return score + value
}

export function analyzeActivitySuspicion(
  activity: ActivityInput,
  baseline?: UserBaseline
): SuspicionResult {
  let score = 0
  const reasons: string[] = []

  const distance_km = activity.distance_m / 1000
  const duration_h = activity.duration_s / 3600
  const avgSpeed_kmh =
    activity.avg_speed_ms !== null && activity.avg_speed_ms !== undefined
      ? activity.avg_speed_ms * 3.6
      : activity.duration_s > 0
        ? distance_km / duration_h
        : 0

  /* -------------------------------------------------
   * A. ANOMALIES PHYSIQUES (zéro faux positifs)
   * ------------------------------------------------- */

  if (activity.distance_m <= 0 && activity.duration_s > 0) {
    score = addScore(score, reasons, 80, "distance_zero_with_duration")
  }

  if (activity.duration_s <= 0) {
    score = addScore(score, reasons, 100, "invalid_duration")
  }

  if (!Number.isFinite(avgSpeed_kmh)) {
    score = addScore(score, reasons, 100, "non_finite_speed")
  }

  if (activity.elevation_m < 0) {
    score = addScore(score, reasons, 40, "negative_elevation")
  }

  /* -------------------------------------------------
   * B. DISTANCE & DURÉE ABSOLUES
   * ------------------------------------------------- */

  if (distance_km > 200) score = addScore(score, reasons, 20, "distance_above_200km")
  if (distance_km > 400) score = addScore(score, reasons, 40, "distance_above_400km")
  if (distance_km > 800) score = addScore(score, reasons, 70, "distance_above_800km")

  if (duration_h > 12) score = addScore(score, reasons, 15, "duration_above_12h")
  if (duration_h > 24) score = addScore(score, reasons, 35, "duration_above_24h")
  if (duration_h > 48) score = addScore(score, reasons, 60, "duration_above_48h")

  /* -------------------------------------------------
   * C. VITESSE MOYENNE (sport-aware)
   * ------------------------------------------------- */

  const maxSpeed = MAX_REALISTIC_SPEED_KMH[activity.sport]

  if (avgSpeed_kmh > maxSpeed) {
    score = addScore(
      score,
      reasons,
      60,
      `avg_speed_above_physiological_limit_${activity.sport.toLowerCase()}`
    )
  } else if (avgSpeed_kmh > maxSpeed * 0.85) {
    score = addScore(
      score,
      reasons,
      30,
      `avg_speed_near_physiological_limit_${activity.sport.toLowerCase()}`
    )
  }

  /* -------------------------------------------------
   * D. COHÉRENCE DISTANCE / DURÉE
   * ------------------------------------------------- */

  if (distance_km > 100 && duration_h < 2) {
    score = addScore(score, reasons, 50, "distance_duration_incoherent_fast")
  }

  if (distance_km < 1 && duration_h > 2) {
    score = addScore(score, reasons, 40, "distance_duration_incoherent_slow")
  }

  /* -------------------------------------------------
   * E. DONNÉES GPS / STREAMS
   * ------------------------------------------------- */

  if (activity.has_gps && !activity.polyline) {
    score = addScore(score, reasons, 30, "gps_flag_without_polyline")
  }

  if (activity.has_streams && !activity.streams) {
    score = addScore(score, reasons, 20, "streams_flag_without_data")
  }

  /* -------------------------------------------------
   * F. COMPARAISON AU PROFIL UTILISATEUR
   * ------------------------------------------------- */

  if (baseline) {
    if (distance_km > (baseline.medianDistance_m / 1000) * 3) {
      score = addScore(score, reasons, 30, "distance_far_above_user_habit")
    }

    if (avgSpeed_kmh > baseline.avgSpeed_ms * 3.6 * 2) {
      score = addScore(score, reasons, 40, "speed_far_above_user_habit")
    }

    if (duration_h > (baseline.medianDuration_s / 3600) * 3) {
      score = addScore(score, reasons, 20, "duration_far_above_user_habit")
    }
  }

  /* -------------------------------------------------
   * G. DÉCISION FINALE
   * ------------------------------------------------- */

  return {
    suspicionScore: score,
    isSuspicious: score >= 70,
    suspicionReasons: reasons,
  }
}