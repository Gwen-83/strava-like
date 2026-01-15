/**
 * Analyse de cohérence de l'entraînement
 * Calcule la consistance de la charge d'entraînement sur les semaines
 */

import type { ActivitySummary } from "../types/Activity"
import { startOfDay, dateKey } from "./dateHelpers"
import { calculateActivityTrainingLoad, computeRefSpeeds } from "./trainingLoadCalculator"

/**
 * Résultat de l'analyse de cohérence
 */
export interface CoherenceResult {
  coherenceScore: number // 0-100
  weeklyTotals: number[] // [current, previous, previous-2]
  wkMean: number
  wkStd: number
}

/**
 * Calcule la cohérence/consistance de l'entraînement sur 3 semaines
 * Mesure la stabilité de la charge d'entraînement
 */
export function computeCoherence(
  activities: ActivitySummary[],
  refSpeeds?: Record<string, number>
): CoherenceResult {
  try {
    const speeds = refSpeeds || computeRefSpeeds(activities)
    const now = startOfDay(new Date())
    const dayMs = 24 * 60 * 60 * 1000

    // Construire une map des charges par jour
    const dailyLoads = new Map<string, number>()
    activities.forEach((a) => {
      const key = dateKey(a.startDate)
      const prev = dailyLoads.get(key) ?? 0
      dailyLoads.set(key, prev + calculateActivityTrainingLoad(a, speeds))
    })

    /**
     * Retourne la somme des charges pour 7 jours à partir d'un offset
     */
    function get7DayArray(endOffsetDays: number): number[] {
      const arr: number[] = []
      for (let i = endOffsetDays + 6; i >= endOffsetDays; i--) {
        const d = new Date(now.getTime() - i * dayMs)
        const v = dailyLoads.get(dateKey(d)) ?? 0
        arr.push(v)
      }
      return arr
    }

    const sumArr = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

    // Calcul des totaux sur 3 semaines glissantes
    const weeklyTotals = [
      sumArr(get7DayArray(0)),  // 7 derniers jours
      sumArr(get7DayArray(7)),  // 7 jours précédents
      sumArr(get7DayArray(14)), // 7 jours avant ça
    ]

    const wkMean =
      weeklyTotals.reduce((s, x) => s + x, 0) / weeklyTotals.length
    const wkStd =
      weeklyTotals.length > 0
        ? Math.sqrt(
            weeklyTotals.reduce(
              (s, v) => s + Math.pow(v - wkMean, 2),
              0
            ) / weeklyTotals.length
          )
        : 0

    // Score de cohérence (0-100): ratio stabilité
    let coherenceScore = 0
    if (wkMean > 1e-6) {
      const rawC = 1 - wkStd / wkMean
      const clamped = Math.max(0, Math.min(1, rawC))
      coherenceScore = Math.round(clamped * 100)
    }

    return { coherenceScore, weeklyTotals, wkMean, wkStd }
  } catch {
    return { coherenceScore: 0, weeklyTotals: [0, 0, 0], wkMean: 0, wkStd: 0 }
  }
}
