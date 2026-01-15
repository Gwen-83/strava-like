/**
 * Comparaison des activités par période
 * Utilisé pour analyser les progrès et tendances
 */

import type { ActivitySummary } from "../types/Activity"
import { getPeriodRange, type PeriodType } from "./dateHelpers"
import { computeActivityMetrics } from "./trainingLoadCalculator"
import { computeRefSpeeds } from "./trainingLoadCalculator"

export interface PeriodMetrics {
  distance: number
  elevation: number
  load: number
}

export interface ComparisonResult {
  current: PeriodMetrics
  previous: PeriodMetrics
  currentRange: { start: Date; end: Date }
  previousRange: { start: Date; end: Date }
}

export interface FilteredPeriod {
  activities: ActivitySummary[]
  range: { start: Date; end: Date }
}

/**
 * Filtre les activités dans une plage de dates
 */
function filterByRange(activities: ActivitySummary[], start: Date, end: Date): ActivitySummary[] {
  return activities.filter((a) => {
    const d = new Date(a.startDate as any)
    return d >= start && d < end
  })
}

/**
 * Compare les métriques pour deux périodes (actuelle vs précédente)
 */
export function comparePeriods(
  activities: ActivitySummary[],
  period: PeriodType,
  baseDate: Date = new Date()
): ComparisonResult {
  const refSpeeds = computeRefSpeeds(activities)

  const currentRange = getPeriodRange(period, baseDate, 0)
  const previousRange = getPeriodRange(period, baseDate, -1)

  const current = filterByRange(activities, currentRange.start, currentRange.end)
  const previous = filterByRange(activities, previousRange.start, previousRange.end)

  return {
    current: computeActivityMetrics(current, refSpeeds),
    previous: computeActivityMetrics(previous, refSpeeds),
    currentRange,
    previousRange,
  }
}

/**
 * Filtre et retourne les activités pour une période donnée
 */
export function filterByPeriod(
  activities: ActivitySummary[],
  period: PeriodType,
  baseDate: Date = new Date(),
  offset = 0
): FilteredPeriod {
  const range = getPeriodRange(period, baseDate, offset)
  return {
    activities: filterByRange(activities, range.start, range.end),
    range,
  }
}