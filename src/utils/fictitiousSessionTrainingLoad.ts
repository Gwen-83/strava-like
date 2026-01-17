/**
 * Module d'estimation automatique du Training Load (TL)
 * pour les séances fictives de cyclisme et course à pied
 *
 * Fonctionnement :
 * - Analyse les activités passées filtrées par sport
 * - Calcule les coefficients empiriques (distance, durée, dénivelé)
 * - Estime le TL de la séance fictive
 * - Fournit un niveau de confiance
 *
 * Formule : TL ≈ a*distance_km + b*duration_min + c*elevation_m + d
 */

import type { ActivitySummary } from "../types/Activity"

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

/**
 * Types de sports supportés pour l'estimation automatique du TL
 */
export type AutoEstimatableSport = "Cyclisme" | "Course"

/**
 * Paramètres d'une séance fictive à estimer
 */
export interface FictitioussSessionInput {
  sport: AutoEstimatableSport
  distanceKm: number
  durationMin: number
  elevationGainM: number
}

/**
 * Coefficients empiriques du modèle linéaire TL
 */
export interface TrainingLoadCoefficients {
  sport: AutoEstimatableSport
  a: number // Coefficient distance (TL par km)
  b: number // Coefficient durée (TL par minute)
  c: number // Coefficient dénivelé (TL par mètre de D+)
  d: number // Terme constant
  sampleCount: number // Nombre d'activités utilisées
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
  averageTL: number // TL moyen du sport
}

/**
 * Résultat d'estimation du TL pour une séance fictive
 */
export interface FictitioussSessionEstimate {
  estimatedTL: number
  contributions: {
    distance: number
    duration: number
    elevation: number
    constant: number
  }
  coefficients: TrainingLoadCoefficients
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
  debug?: {
    message: string
    samplesUsed: number
  }
}

// ============================================================================
// COEFFICIENTS PAR DÉFAUT (si historique insuffisant)
// ============================================================================

const DEFAULT_COEFFICIENTS: Record<AutoEstimatableSport, Omit<TrainingLoadCoefficients, "sampleCount" | "confidenceLevel" | "averageTL">> = {
  Cyclisme: {
    sport: "Cyclisme",
    a: 3.0, // TL par km en cyclisme (~3 TL/km)
    b: 0.25, // TL par minute en cyclisme (~0.25 TL/min)
    c: 0.02, // TL par mètre de D+ en cyclisme (~0.02 TL/m)
    d: 5.0, // Terme constant
  },
  Course: {
    sport: "Course",
    a: 8.0, // TL par km en course (~8 TL/km) - plus élevé que cyclisme
    b: 0.4, // TL par minute en course (~0.4 TL/min)
    c: 0.04, // TL par mètre de D+ en course (~0.04 TL/m)
    d: 10.0, // Terme constant
  },
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Vérifie qu'un nombre est valide et fini
 */
function isValidNumber(value: any): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

/**
 * Détecte les outliers en utilisant la méthode IQR (Interquartile Range)
 * Retourne true si la valeur est un outlier
 */
function isOutlier(value: number, values: number[], iqrMultiplier: number = 1.5): boolean {
  if (values.length < 4) return false

  const sorted = values.slice().sort((a, b) => a - b)
  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]
  const iqr = q3 - q1

  if (iqr === 0) return false

  const lowerBound = q1 - iqrMultiplier * iqr
  const upperBound = q3 + iqrMultiplier * iqr

  return value < lowerBound || value > upperBound
}

/**
 * Calcule le poids exponentiel basé sur la date
 * Les activités récentes ont un poids plus élevé
 */
function calculateDateWeight(activityDate: Date, now: Date): number {
  const daysDiff = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24)
  // Demi-vie de 90 jours : exp(-ln(2) * days / 90)
  const halfLife = 90
  return Math.exp(-(Math.LN2 * daysDiff) / halfLife)
}

/**
 * Extrait les valeurs d'une activité pour calculs
 */
function extractActivityValues(activity: ActivitySummary): {
  distanceKm: number
  durationMin: number
  elevationM: number
  tl: number
} | null {
  // Conversion des unités
  const distanceKm = isValidNumber(activity.distance_m) ? activity.distance_m / 1000 : NaN
  const durationMin = isValidNumber(activity.duration_s) ? activity.duration_s / 60 : NaN
  const elevationM = isValidNumber(activity.elevation_m as any) ? (activity.elevation_m as number) : 0

  // Validation : au moins distance et durée doivent être valides
  if (!Number.isFinite(distanceKm) || !Number.isFinite(durationMin)) {
    return null
  }

  // Si TL n'est pas disponible, le calculer à partir de formules par défaut
  let tl = isValidNumber(activity.load as any) ? (activity.load as number) : NaN
  
  if (!Number.isFinite(tl)) {
    // Calculer le TL par défaut en fonction du sport
    // Formule approximative : TL = a*distance + b*duration + c*elevation + d
    const sportType = activity.sport === "Cyclisme" ? "Cyclisme" : activity.sport === "Course" ? "Course" : null
    
    if (sportType === "Cyclisme") {
      // Coefficients par défaut pour cyclisme
      const a = 3.0, b = 0.5, c = 0.02, d = 20
      tl = a * distanceKm + b * durationMin + c * elevationM + d
    } else if (sportType === "Course") {
      // Coefficients par défaut pour course
      const a = 4.5, b = 0.8, c = 0.04, d = 15
      tl = a * distanceKm + b * durationMin + c * elevationM + d
    } else {
      // Sport non supporté, estimer avec une formule générique
      const a = 2.5, b = 0.6, c = 0.015, d = 10
      tl = a * distanceKm + b * durationMin + c * elevationM + d
    }
  }

  // Validation finale : distance > 0, durée > 0
  if (distanceKm <= 0 || durationMin <= 0) {
    return null
  }

  return { distanceKm, durationMin, elevationM, tl }
}

// ============================================================================
// CALCUL DES COEFFICIENTS
// ============================================================================

/**
 * Calcule les coefficients empiriques d'un sport à partir de l'historique
 *
 * Utilise la régression linéaire pondérée (poids exponentiels par date)
 * pour déduire les paramètres a, b, c, d du modèle :
 * TL = a*distance + b*duration + c*elevation + d
 */
export function calculateCoefficientsBySport(
  activities: ActivitySummary[],
  sport: AutoEstimatableSport,
  now: Date = new Date()
): TrainingLoadCoefficients {
  // Filtrer par sport
  const sportActivities = activities.filter((a) => a.sport === sport && !a.isSuspicious)

  if (sportActivities.length === 0) {
    return {
      ...DEFAULT_COEFFICIENTS[sport],
      sampleCount: 0,
      confidenceLevel: "LOW",
      averageTL: 0,
    }
  }

  // Extraire les données valides
  const validActivities = sportActivities
    .map((a) => ({ activity: a, values: extractActivityValues(a) }))
    .filter((item) => item.values !== null)
    .map((item) => ({ activity: item.activity!, values: item.values! }))

  if (validActivities.length === 0) {
    return {
      ...DEFAULT_COEFFICIENTS[sport],
      sampleCount: 0,
      confidenceLevel: "LOW",
      averageTL: 0,
    }
  }

  // Détection d'outliers sur le TL
  const tlValues = validActivities.map((item) => item.values.tl)
  const activitiesFiltered = validActivities.filter(
    (item) => !isOutlier(item.values.tl, tlValues, 1.5)
  )

  const finalActivities = activitiesFiltered.length >= 3 ? activitiesFiltered : validActivities

  // Calcul des poids exponentiels par date
  const weights = finalActivities.map((item) =>
    calculateDateWeight(item.activity.startDate, now)
  )
  const totalWeight = weights.reduce((s, w) => s + w, 0)
  const normalizedWeights = weights.map((w) => w / totalWeight)

  // Construction des matrices pour régression linéaire pondérée
  // Résoudre : [distance, duration, elevation, 1] · [a, b, c, d]^T = TL
  const n = finalActivities.length

  // Accumulation pondérée
  let sumWeighted_d2 = 0, sumWeighted_du2 = 0, sumWeighted_e2 = 0
  let sumWeighted_d_du = 0, sumWeighted_d_e = 0, sumWeighted_du_e = 0
  let sumWeighted_d = 0, sumWeighted_du = 0, sumWeighted_e = 0, sumWeighted_1 = 0
  let sumWeighted_d_tl = 0, sumWeighted_du_tl = 0, sumWeighted_e_tl = 0, sumWeighted_tl = 0

  for (let i = 0; i < n; i++) {
    const w = normalizedWeights[i]
    const { distanceKm: d, durationMin: du, elevationM: e, tl } = finalActivities[i].values

    sumWeighted_d2 += w * d * d
    sumWeighted_du2 += w * du * du
    sumWeighted_e2 += w * e * e
    sumWeighted_d_du += w * d * du
    sumWeighted_d_e += w * d * e
    sumWeighted_du_e += w * du * e
    sumWeighted_d += w * d
    sumWeighted_du += w * du
    sumWeighted_e += w * e
    sumWeighted_1 += w
    sumWeighted_d_tl += w * d * tl
    sumWeighted_du_tl += w * du * tl
    sumWeighted_e_tl += w * e * tl
    sumWeighted_tl += w * tl
  }

  // Matrice normale X^T * W * X
  const X_TWX = [
    [sumWeighted_d2, sumWeighted_d_du, sumWeighted_d_e, sumWeighted_d],
    [sumWeighted_d_du, sumWeighted_du2, sumWeighted_du_e, sumWeighted_du],
    [sumWeighted_d_e, sumWeighted_du_e, sumWeighted_e2, sumWeighted_e],
    [sumWeighted_d, sumWeighted_du, sumWeighted_e, sumWeighted_1],
  ]

  // Vecteur X^T * W * y
  const X_TWy = [sumWeighted_d_tl, sumWeighted_du_tl, sumWeighted_e_tl, sumWeighted_tl]

  // Résolution du système linéaire par Gauss-Jordan (4x4)
  const coefficients = solveLinearSystem4x4(X_TWX, X_TWy)

  // Si la résolution échoue, utiliser les coefficients par défaut
  if (coefficients === null) {
    return {
      ...DEFAULT_COEFFICIENTS[sport],
      sampleCount: finalActivities.length,
      confidenceLevel: "LOW",
      averageTL: sumWeighted_tl,
    }
  }

  const [a, b, c, d] = coefficients
  const averageTL = sumWeighted_tl

  // Déterminer le niveau de confiance
  let confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
  if (finalActivities.length >= 10) {
    confidenceLevel = "HIGH"
  } else if (finalActivities.length >= 5) {
    confidenceLevel = "MEDIUM"
  } else {
    confidenceLevel = "LOW"
  }

  return {
    sport,
    a: Number.isFinite(a) ? a : DEFAULT_COEFFICIENTS[sport].a,
    b: Number.isFinite(b) ? b : DEFAULT_COEFFICIENTS[sport].b,
    c: Number.isFinite(c) ? c : DEFAULT_COEFFICIENTS[sport].c,
    d: Number.isFinite(d) ? d : DEFAULT_COEFFICIENTS[sport].d,
    sampleCount: finalActivities.length,
    confidenceLevel,
    averageTL,
  }
}

/**
 * Résout un système linéaire 4x4 par élimination de Gauss-Jordan
 */
function solveLinearSystem4x4(
  A: number[][],
  b: number[]
): number[] | null {
  // Copie les matrices pour ne pas les modifier
  const matrix = A.map((row) => [...row])
  const augmented = b.slice()

  // Élimination avant
  for (let i = 0; i < 4; i++) {
    // Pivot
    let maxRow = i
    for (let k = i + 1; k < 4; k++) {
      if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) {
        maxRow = k
      }
    }

    // Échange les lignes
    ;[matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]]
    ;[augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]

    // Vérification du pivot
    if (Math.abs(matrix[i][i]) < 1e-10) {
      return null
    }

    // Élimination
    for (let k = i + 1; k < 4; k++) {
      const factor = matrix[k][i] / matrix[i][i]
      for (let j = i; j < 4; j++) {
        matrix[k][j] -= factor * matrix[i][j]
      }
      augmented[k] -= factor * augmented[i]
    }
  }

  // Substitution arrière
  const x = [0, 0, 0, 0]
  for (let i = 3; i >= 0; i--) {
    let sum = augmented[i]
    for (let j = i + 1; j < 4; j++) {
      sum -= matrix[i][j] * x[j]
    }
    x[i] = sum / matrix[i][i]
  }

  return x
}

// ============================================================================
// ESTIMATION DU TL POUR UNE SÉANCE FICTIVE
// ============================================================================

/**
 * Estime le TL d'une séance fictive à partir des coefficients
 */
function estimateTrainingLoadFromCoefficients(
  session: FictitioussSessionInput,
  coefficients: TrainingLoadCoefficients
): FictitioussSessionEstimate {
  const { distanceKm, durationMin, elevationGainM } = session
  const { a, b, c, d } = coefficients

  // Calcul du TL
  const tlDistance = a * distanceKm
  const tlDuration = b * durationMin
  const tlElevation = c * elevationGainM
  const tlConstant = d

  const estimatedTL = tlDistance + tlDuration + tlElevation + tlConstant

  return {
    estimatedTL: Math.max(0, estimatedTL), // TL ne peut pas être négatif
    contributions: {
      distance: tlDistance,
      duration: tlDuration,
      elevation: tlElevation,
      constant: tlConstant,
    },
    coefficients,
    confidenceLevel: coefficients.confidenceLevel,
    debug: {
      message: `Estimation basée sur ${coefficients.sampleCount} activités (confiance: ${coefficients.confidenceLevel})`,
      samplesUsed: coefficients.sampleCount,
    },
  }
}

/**
 * Estime le TL d'une séance fictive
 *
 * Fonction principale du module.
 * Calcule les coefficients à partir de l'historique puis estime le TL.
 */
export function estimateFictitioussSessionTrainingLoad(
  session: FictitioussSessionInput,
  activities: ActivitySummary[],
  now: Date = new Date()
): FictitioussSessionEstimate {
  // Vérification des entrées
  if (!isValidNumber(session.distanceKm) || session.distanceKm <= 0) {
    throw new Error("Distance doit être > 0")
  }
  if (!isValidNumber(session.durationMin) || session.durationMin <= 0) {
    throw new Error("Durée doit être > 0")
  }
  if (!isValidNumber(session.elevationGainM) || session.elevationGainM < 0) {
    throw new Error("Dénivelé doit être >= 0")
  }

  // Calcul des coefficients pour le sport
  const coefficients = calculateCoefficientsBySport(activities, session.sport, now)

  // Estimation du TL
  return estimateTrainingLoadFromCoefficients(session, coefficients)
}

/**
 * Estime le TL pour plusieurs séances fictives
 */
export function estimateBatchFictitioussSessionsTrainingLoad(
  sessions: FictitioussSessionInput[],
  activities: ActivitySummary[],
  now: Date = new Date()
): FictitioussSessionEstimate[] {
  return sessions.map((session) =>
    estimateFictitioussSessionTrainingLoad(session, activities, now)
  )
}

// ============================================================================
// UTILITAIRES D'ANALYSE
// ============================================================================

/**
 * Génère un rapport d'analyse des coefficients estimés
 */
export function analyzeCoefficientsForSport(
  activities: ActivitySummary[],
  sport: AutoEstimatableSport
): {
  coefficients: TrainingLoadCoefficients
  summary: string
} {
  const coefficients = calculateCoefficientsBySport(activities, sport)

  const summary = `
Analyse Training Load - ${sport}
=================================
Nombre d'activités: ${coefficients.sampleCount}
TL moyen: ${coefficients.averageTL.toFixed(1)}
Confiance: ${coefficients.confidenceLevel}

Modèle: TL = a·distance(km) + b·durée(min) + c·dénivelé(m) + d

Coefficients:
  a (TL/km): ${coefficients.a.toFixed(2)} (contribution distance)
  b (TL/min): ${coefficients.b.toFixed(3)} (contribution durée)
  c (TL/m): ${coefficients.c.toFixed(4)} (contribution dénivelé)
  d (base): ${coefficients.d.toFixed(1)}
`

  return { coefficients, summary }
}

/**
 * Valide qu'un sport est supported pour l'estimation automatique
 */
export function isAutoEstimatableSport(sport: any): sport is AutoEstimatableSport {
  return sport === "Cyclisme" || sport === "Course"
}
