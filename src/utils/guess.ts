/**
 * Prédictions de performance consolidées
 * Façade pour exporter les fonctions de performance (guess = prédictions)
 */

import type { ActivitySummary } from "../types/Activity"
import {
  computeCoherence as _computeCoherence,
  type CoherenceResult,
} from "./performanceCoherence"
import {
  predictRunningPerformance,
  getRunningConfidence,
} from "./performanceRunning"
import {
  estimateCyclingFTP,
  calibrateFTP,
  predictCyclingPerformance,
  getCyclingConfidence,
} from "./performanceCycling"

/**
 * Calcule les cohérences d'entraînement (compatibilité backwards)
 * Utilise la fonction centralisée
 */
export function computeCoherence(
  activities: ActivitySummary[],
  refSpeeds?: Record<string, number>
): CoherenceResult {
  return _computeCoherence(activities, refSpeeds)
}

/**
 * Prédit les performances (course + cyclisme)
 */
export function predictPerformance(
  activities: ActivitySummary[],
  ctl: number,
  atl: number
) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 42)

  const recent = activities.filter(
    (a) => new Date(a.startDate) >= cutoff
  )

  console.log(
    `[predictPerformance] Total: ${activities.length}, recent (42j): ${recent.length}`
  )

  // Prédictions course à pied
  const runActs = recent.filter((a) => a.sport === "Course")
  const running = predictRunningPerformance(activities, ctl, atl)
  const runningConfidence = getRunningConfidence(runActs)

  // Prédictions cyclisme
  const cyclingActs = recent.filter((a) => a.sport === "Cyclisme")
  const estimated = estimateCyclingFTP(cyclingActs, 70)
  const calibration = estimated ? calibrateFTP(estimated.ftp, 248) : undefined // FTP Garmin ref
  const cycling = estimated
    ? predictCyclingPerformance(estimated, (ctl - atl) / Math.max(ctl, 1), calibration)
    : null
  const cyclingConfidence = getCyclingConfidence(cyclingActs)

  return {
    running,
    cycling,
    confidence: {
      running: runningConfidence,
      cycling: cyclingConfidence,
    },
  }
}

// Réexports
export { type CoherenceResult } from "./performanceCoherence"
export type { FTPResult, FTPCalibration } from "./performanceCycling"
export { computeRefSpeeds, calculateActivityTrainingLoad } from "./trainingLoadCalculator"