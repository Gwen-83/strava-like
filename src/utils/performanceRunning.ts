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
 * Calcule la VMA (Vitesse Maximale Aérobie) en km/h
 * VMA ≈ (distance / temps) × 3.6
 * Basé sur le meilleur effort de course
 */
export function calculateVMA(ref: RunningEffort): number {
  // ref.timeS est en secondes, ref.distanceKm est en km
  // Vitesse en m/s = distanceKm * 1000 / timeS
  // Vitesse en km/h = (distanceKm / (timeS / 3600)) = (distanceKm * 3600) / timeS
  const speedKmh = (ref.distanceKm * 3600) / ref.timeS
  
  // VMA est généralement estimée comme la vitesse correspondant à VO2max
  // Pour un effort de qualité (> 5km), on peut utiliser directement cette vitesse
  // ou appliquer un facteur correctif selon la distance
  // Pour les efforts longs (> 10km), la VMA est légèrement inférieure à la vitesse moyenne
  // Facteur correctif : efforts longs favorisent les efforts en zone aérobie pure
  const correctionFactor = ref.distanceKm > 10 ? 0.98 : 1.0
  
  return speedKmh * correctionFactor
}

/**
 * Calcule l'incertitude de la VMA (en %)
 * Basée sur :
 * - La distance de l'effort (plus long = plus précis)
 * - Le nombre d'efforts disponibles (plus d'efforts = plus précis)
 */
export function calculateVMAUncertainty(ref: RunningEffort, effortCount: number): number {
  // Base: 15% d'incertitude
  let uncertainty = 15

  // Ajustement selon la distance : efforts plus longs sont plus fiables
  // < 5km : +5%, 5-10km : 0%, > 10km : -3%
  if (ref.distanceKm < 5) {
    uncertainty += 5
  } else if (ref.distanceKm > 10) {
    uncertainty -= 3
  }

  // Ajustement selon le nombre d'efforts
  // 1 effort: +8%, 2-3 efforts: +4%, 4-5 efforts: 0%, 6+ efforts: -3%
  if (effortCount === 1) {
    uncertainty += 8
  } else if (effortCount === 2 || effortCount === 3) {
    uncertainty += 4
  } else if (effortCount >= 6) {
    uncertainty -= 3
  }

  return Math.max(8, Math.min(25, uncertainty))
}

/**
 * Calcule le niveau de confiance de la VMA (high, medium, low)
 * Basé sur :
 * - Le nombre d'efforts récents
 * - La cohérence des vitesses
 */
export function calculateVMAConfidence(
  runActs: ActivitySummary[],
  _ref: RunningEffort
): "high" | "medium" | "low" {
  if (runActs.length === 0) return "low"

  // Calcul de la cohérence des vitesses
  const efforts = runActs
    .map((a) => {
      const tFlat = flatRunningTime(a)
      if (!tFlat) return null
      const dKm = a.distance_m / 1000
      const vFlat = dKm / (tFlat / 3600)
      return vFlat
    })
    .filter(Boolean) as number[]

  if (efforts.length < 2) {
    // Très peu d'efforts : confiance faible
    return runActs.length >= 3 ? "medium" : "low"
  }

  // Calcul de l'écart-type normalisé (coefficient de variation)
  const meanSpeed = efforts.reduce((a, b) => a + b) / efforts.length
  const variance = efforts.reduce((sum, v) => sum + Math.pow(v - meanSpeed, 2), 0) / efforts.length
  const stdDev = Math.sqrt(variance)
  const coeffVar = stdDev / meanSpeed // 0 = parfait, > 0.1 = assez dispersé

  // Grille de confiance
  if (runActs.length >= 6 && coeffVar < 0.08) {
    return "high" // Beaucoup d'efforts, cohérence excellente
  } else if (runActs.length >= 4 && coeffVar < 0.12) {
    return "high" // Assez d'efforts, bonne cohérence
  } else if (runActs.length >= 3 || coeffVar < 0.1) {
    return "medium" // Quelques efforts ou cohérence decent
  } else {
    return "low" // Peu d'efforts ou très dispersés
  }
}

/**
 * Prédit les performances de course à pied, incluant la VMA avec confiance et incertitude
 */
export function predictRunningPerformance(
  activities: ActivitySummary[],
  ctl: number,
  atl: number
): (Record<string, number | string> & { vma?: number; vmaConfidence?: "high" | "medium" | "low"; vmaUncertainty?: number }) | null {
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
  const predictions = predictRunningTimes(refRun, k, formDelta)
  
  // Calcul de la VMA avec confiance et incertitude
  const vma = calculateVMA(refRun)
  const vmaConfidence = calculateVMAConfidence(runActs, refRun)
  const vmaUncertainty = calculateVMAUncertainty(refRun, runActs.length)
  
  return { ...predictions, vma, vmaConfidence, vmaUncertainty }
}

/**
 * Retourne le niveau de confiance en fonction du nombre d'efforts
 */
export function getRunningConfidence(runActs: ActivitySummary[]): string {
  if (runActs.length >= 6) return "high"
  if (runActs.length > 0) return "low"
  return "medium"
}
