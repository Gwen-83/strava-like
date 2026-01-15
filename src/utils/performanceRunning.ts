/**
 * Prédictions de performance pour la course à pied
 * Basé sur l'analyse des efforts récents normalisés au dénivelé
 */

import type { ActivitySummary } from "../types/Activity"

const clamp = (x: number, a: number, b: number) =>
  Math.max(a, Math.min(b, x))

/**
 * Calcule le temps de course normalisé par rapport au dénivelé
 */
function flatRunningTime(a: ActivitySummary): number | null {
  if (a.distance_m < 3000) return null

  const v = a.distance_m / a.duration_s
  const dPlus = a.elevation_m ?? 0

  // Facteur d'ajustement pour le dénivelé (3% de pénalité par 1000m)
  const vFlat = v * (1 - 0.03 * (dPlus / 1000))
  if (vFlat <= 0) return null

  return a.distance_m / vFlat
}

interface RunningEffort {
  distanceKm: number
  timeS: number
  score: number
}

/**
 * Sélectionne le meilleur effort de course en fonction du score
 * Score = vitesse normalisée * sqrt(distance) (favorise les efforts longs)
 */
function selectBestRunningEffort(acts: ActivitySummary[]): RunningEffort | null {
  const scored = acts
    .map((a) => {
      const tFlat = flatRunningTime(a)
      if (!tFlat) return null

      const dKm = a.distance_m / 1000
      const vFlat = dKm / (tFlat / 3600)

      return {
        distanceKm: dKm,
        timeS: tFlat,
        score: vFlat * Math.sqrt(dKm),
      }
    })
    .filter(Boolean) as RunningEffort[]

  if (scored.length === 0) return null
  return scored.reduce((best, cur) =>
    cur.score > best.score ? cur : best
  )
}

/**
 * Estime l'exposant de Riegel (relation distance-temps)
 * Valeur typique: 1.06
 */
function estimateRiegelExponent(refs: RunningEffort[]): number {
  if (refs.length < 2) return 1.06

  const [a, b] = refs.slice(0, 2)

  const k =
    Math.log(b.timeS / a.timeS) / Math.log(b.distanceKm / a.distanceKm)

  return clamp(k, 1.04, 1.10)
}

/**
 * Prédit les temps de course à différentes distances
 * Utilise la formule de Riegel ajustée par la forme du jour
 */
function predictRunningTimes(
  ref: RunningEffort,
  k: number,
  formDelta: number
): Record<string, number> {
  const targets = [5, 10, 21.1, 42.2]
  const alpha = 0.5

  const adj = 1 - alpha * formDelta

  const res: Record<string, number> = {}
  for (const d of targets) {
    res[`${d}km`] =
      ref.timeS * Math.pow(d / ref.distanceKm, k) * adj
  }
  return res
}

/**
 * Calcule le delta de forme (changement relatif de fitness)
 * CTL = charge chronique, ATL = charge aiguë
 */
function computeFormDelta(ctl: number, atl: number): number {
  if (ctl <= 0) return 0
  return clamp((ctl - atl) / ctl, -0.05, 0.05)
}

/**
 * Prédit les performances de course à pied
 */
export function predictRunningPerformance(
  activities: ActivitySummary[],
  ctl: number,
  atl: number
): Record<string, number> | null {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 42)

  const recent = activities.filter((a) => new Date(a.startDate) >= cutoff)
  const runActs = recent.filter((a) => a.sport === "Course")

  if (runActs.length === 0) return null

  let refRun = selectBestRunningEffort(runActs)

  // Fallback: meilleure perf brute si pas de normalisation dénivelé
  if (!refRun) {
    const scoredAny = runActs
      .map((a) => {
        const dKm = (a.distance_m || 0) / 1000
        if (!dKm || !a.duration_s) return null
        const v = dKm / (a.duration_s / 3600)
        return {
          distanceKm: dKm,
          timeS: a.duration_s,
          score: v * Math.sqrt(dKm),
        }
      })
      .filter(Boolean) as RunningEffort[]

    if (scoredAny.length === 0) return null
    refRun = scoredAny.reduce((best, cur) =>
      cur.score > best.score ? cur : best
    )
  }

  const formDelta = computeFormDelta(ctl, atl)
  const k = estimateRiegelExponent([refRun])
  return predictRunningTimes(refRun, k, formDelta)
}

/**
 * Retourne le niveau de confiance en fonction du nombre d'efforts
 */
export function getRunningConfidence(runActs: ActivitySummary[]): string {
  if (runActs.length >= 6) return "high"
  if (runActs.length > 0) return "low"
  return "medium"
}
