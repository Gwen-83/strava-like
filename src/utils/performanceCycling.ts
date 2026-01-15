/**
 * Estimation du FTP (Functional Threshold Power) pour le cyclisme
 * Basé sur la puissance moyenne rapportée par Strava
 */

import type { ActivitySummary } from "../types/Activity"
import { FTP_MIN_WKG, FTP_MAX_WKG, FTP_MIN_EFFORT_S, FTP_MAX_EFFORT_S } from "./constants"

export interface FTPResult {
  ftp: number // en watts
  ftp_wkg: number // en watts/kg
  confidence: "low" | "medium" | "high"
  method: string
}

export interface FTPCalibration {
  scaleFactor: number // ratio = known_ftp / estimated_ftp
  referenceFTP: number // FTP de référence en watts
  date: string
}

/**
 * Estime le FTP à partir des efforts cyclistes récents
 * Utilise la puissance moyenne avec correction de durée
 */
export function estimateCyclingFTP(
  activities: ActivitySummary[],
  riderWeightKg: number
): FTPResult | null {
  // 1. Filtrer les activités utilisables (20 min - 3h avec puissance)
  const valid = activities.filter(
    (a) =>
      (a.avg_watts ?? 0) > 0 &&
      a.duration_s >= FTP_MIN_EFFORT_S &&
      a.duration_s <= FTP_MAX_EFFORT_S
  )

  if (valid.length < 3) return null

  // 2. Transformer en efforts pondérés avec corrections
  const efforts = valid.map((a) => {
    const durationMin = a.duration_s / 60
    const avgPower = a.avg_watts || 0

    // Facteur de correction pour durée (plus long = puissance diluée)
    let durationFactor: number
    if (durationMin < 40) durationFactor = 1.15
    else if (durationMin < 70) durationFactor = 1.22
    else if (durationMin < 120) durationFactor = 1.30
    else durationFactor = 1.35

    // Facteur de validité cardiaque (si données disponibles)
    const hrRatio = a.avg_hrt && a.max_hrt ? a.avg_hrt / a.max_hrt : 0.85
    const hrValidity =
      hrRatio >= 0.8 ? 1.0 : hrRatio >= 0.75 ? 0.95 : 0.9

    const estimatedFTP = avgPower * durationFactor * hrValidity

    // Pondération: privilégie les efforts de 50-100 min
    const weight =
      durationMin >= 50 && durationMin <= 100 ? 1.5 : 1.0

    return { estimatedFTP, weight }
  })

  // 3. Moyenne pondérée
  const ftpRaw =
    efforts.reduce((s, e) => s + e.estimatedFTP * e.weight, 0) /
    efforts.reduce((s, e) => s + e.weight, 0)

  // 4. Bornes physiologiques
  const ftpWkg = ftpRaw / riderWeightKg
  let ftpClamped = ftpRaw

  if (ftpWkg < FTP_MIN_WKG) ftpClamped = FTP_MIN_WKG * riderWeightKg
  if (ftpWkg > FTP_MAX_WKG) ftpClamped = FTP_MAX_WKG * riderWeightKg

  // 5. Déterminer le niveau de confiance
  const confidence: FTPResult["confidence"] =
    efforts.length >= 8 ? "high" : efforts.length >= 5 ? "medium" : "low"

  return {
    ftp: Math.round(ftpClamped),
    ftp_wkg: Math.round((ftpClamped / riderWeightKg) * 100) / 100,
    confidence,
    method: "Power mean duration-corrected",
  }
}

/**
 * Crée une calibration FTP en comparant l'estimation et une valeur de référence
 */
export function calibrateFTP(
  estimatedFTP: number,
  referenceFTP: number
): FTPCalibration {
  return {
    scaleFactor: referenceFTP / estimatedFTP,
    referenceFTP,
    date: new Date().toISOString(),
  }
}

/**
 * Applique une calibration FTP à une valeur estimée
 */
export function applyFTPCalibration(
  ftp: number,
  calibration: FTPCalibration
): number {
  return Math.round(ftp * calibration.scaleFactor)
}

/**
 * Prédit les performances cyclistes avec le FTP estimé
 */
export function predictCyclingPerformance(
  ftpResult: FTPResult,
  formDelta: number,
  calibration?: FTPCalibration
): Record<string, number> {
  const baseFTP = calibration
    ? applyFTPCalibration(ftpResult.ftp, calibration)
    : ftpResult.ftp

  const adj = 1 - 0.5 * formDelta
  const ftpFinal = Math.round(baseFTP * adj)

  // Incertitude relative selon la confiance
  const relativeUncertainty =
    ftpResult.confidence === "high"
      ? 0.05
      : ftpResult.confidence === "medium"
        ? 0.1
        : 0.15

  // Incertitude estimée
  const numEfforts =
    ftpResult.confidence === "high" ? 8 : ftpResult.confidence === "medium" ? 5 : 3

  const ftp_uncertainty = Math.round(
    ftpFinal * relativeUncertainty * Math.sqrt(5 / numEfforts)
  )

  return {
    ftp: ftpFinal,
    ftp_wkg: Math.round(
      (ftpFinal / (ftpResult.ftp / ftpResult.ftp_wkg)) * 100
    ) / 100,
    power20min: Math.round(ftpFinal / 0.95),
    ftp_uncertainty,
  }
}

/**
 * Retourne le niveau de confiance en fonction du nombre d'efforts
 */
export function getCyclingConfidence(cyclingActs: ActivitySummary[]): string {
  if (cyclingActs.length >= 8) return "high"
  if (cyclingActs.length >= 4) return "medium"
  if (cyclingActs.length > 0) return "low"
  return "medium"
}
