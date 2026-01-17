/**
 * Exemples et tests d'utilisation du module d'estimation de Training Load
 * pour les séances fictives
 */

import {
  estimateFictitioussSessionTrainingLoad,
  estimateBatchFictitioussSessionsTrainingLoad,
  calculateCoefficientsBySport,
  analyzeCoefficientsForSport,
  isAutoEstimatableSport,
  type FictitioussSessionInput,
} from "./fictitiousSessionTrainingLoad"
import type { ActivitySummary } from "../types/Activity"

// ============================================================================
// EXEMPLES D'UTILISATION
// ============================================================================

/**
 * Exemple 1 : Estimation simple pour une seule séance fictive
 */
export function example1_estimateSingleSession() {
  // Historique fictif d'activités
  const mockActivities: ActivitySummary[] = [
    {
      userId: "user1",
      sport: "Cyclisme",
      startDate: new Date("2025-12-01"),
      duration_s: 3600, // 1h
      distance_m: 30000, // 30 km
      elevation_m: 500,
      load: 180,
      source: "manual",
      has_gps: false,
      has_streams: false,
      has_power: false,
      createdAt: new Date(),
    },
    {
      userId: "user1",
      sport: "Cyclisme",
      startDate: new Date("2025-12-05"),
      duration_s: 5400, // 1.5h
      distance_m: 45000, // 45 km
      elevation_m: 800,
      load: 310,
      source: "manual",
      has_gps: false,
      has_streams: false,
      has_power: false,
      createdAt: new Date(),
    },
    {
      userId: "user1",
      sport: "Cyclisme",
      startDate: new Date("2025-12-10"),
      duration_s: 2700, // 45 min
      distance_m: 20000, // 20 km
      elevation_m: 200,
      load: 120,
      source: "manual",
      has_gps: false,
      has_streams: false,
      has_power: false,
      createdAt: new Date(),
    },
  ]

  // Séance fictive à estimer
  const session: FictitioussSessionInput = {
    sport: "Cyclisme",
    distanceKm: 35,
    durationMin: 90,
    elevationGainM: 600,
  }

  // Estimation
  const estimate = estimateFictitioussSessionTrainingLoad(session, mockActivities)

  console.log("✅ Estimation pour une séance fictive de cyclisme :")
  console.log(`   Distance: ${session.distanceKm} km`)
  console.log(`   Durée: ${session.durationMin} min`)
  console.log(`   Dénivelé: ${session.elevationGainM} m`)
  console.log(`   TL estimé: ${estimate.estimatedTL.toFixed(1)}`)
  console.log(`   Confiance: ${estimate.confidenceLevel}`)
  console.log(`   Contributions:`)
  console.log(`     - Distance: ${estimate.contributions.distance.toFixed(1)}`)
  console.log(`     - Durée: ${estimate.contributions.duration.toFixed(1)}`)
  console.log(`     - Dénivelé: ${estimate.contributions.elevation.toFixed(1)}`)
  console.log(`     - Constant: ${estimate.contributions.constant.toFixed(1)}`)

  return estimate
}

/**
 * Exemple 2 : Estimation par batch (plusieurs séances)
 */
export function example2_estimateBatchSessions() {
  const mockActivities: ActivitySummary[] = [
    {
      userId: "user1",
      sport: "Course",
      startDate: new Date("2025-12-01"),
      duration_s: 1800, // 30 min
      distance_m: 5000, // 5 km
      elevation_m: 100,
      load: 60,
      source: "manual",
      has_gps: false,
      has_streams: false,
      has_power: false,
      createdAt: new Date(),
    },
    {
      userId: "user1",
      sport: "Course",
      startDate: new Date("2025-12-05"),
      duration_s: 2700, // 45 min
      distance_m: 7500, // 7.5 km
      elevation_m: 150,
      load: 100,
      source: "manual",
      has_gps: false,
      has_streams: false,
      has_power: false,
      createdAt: new Date(),
    },
  ]

  const sessions: FictitioussSessionInput[] = [
    { sport: "Course", distanceKm: 6, durationMin: 35, elevationGainM: 120 },
    { sport: "Course", distanceKm: 10, durationMin: 60, elevationGainM: 200 },
  ]

  const estimates = estimateBatchFictitioussSessionsTrainingLoad(sessions, mockActivities)

  console.log("✅ Estimation pour plusieurs séances fictives de course :")
  estimates.forEach((est, idx) => {
    console.log(`\n   Séance ${idx + 1}:`)
    console.log(`     TL estimé: ${est.estimatedTL.toFixed(1)}`)
    console.log(`     Confiance: ${est.confidenceLevel}`)
  })

  return estimates
}

/**
 * Exemple 3 : Analyse des coefficients pour un sport
 */
export function example3_analyzeCoefficients() {
  const mockActivities: ActivitySummary[] = [
    {
      userId: "user1",
      sport: "Cyclisme",
      startDate: new Date("2025-11-20"),
      duration_s: 3600,
      distance_m: 32000,
      elevation_m: 480,
      load: 200,
      source: "manual",
      has_gps: false,
      has_streams: false,
      has_power: false,
      createdAt: new Date(),
    },
    {
      userId: "user1",
      sport: "Cyclisme",
      startDate: new Date("2025-11-25"),
      duration_s: 5400,
      distance_m: 48000,
      elevation_m: 720,
      load: 320,
      source: "manual",
      has_gps: false,
      has_streams: false,
      has_power: false,
      createdAt: new Date(),
    },
    {
      userId: "user1",
      sport: "Cyclisme",
      startDate: new Date("2025-12-01"),
      duration_s: 4200,
      distance_m: 35000,
      elevation_m: 500,
      load: 240,
      source: "manual",
      has_gps: false,
      has_streams: false,
      has_power: false,
      createdAt: new Date(),
    },
    {
      userId: "user1",
      sport: "Cyclisme",
      startDate: new Date("2025-12-06"),
      duration_s: 2700,
      distance_m: 25000,
      elevation_m: 350,
      load: 180,
      source: "manual",
      has_gps: false,
      has_streams: false,
      has_power: false,
      createdAt: new Date(),
    },
    {
      userId: "user1",
      sport: "Cyclisme",
      startDate: new Date("2025-12-10"),
      duration_s: 3300,
      distance_m: 30000,
      elevation_m: 400,
      load: 210,
      source: "manual",
      has_gps: false,
      has_streams: false,
      has_power: false,
      createdAt: new Date(),
    },
  ]

  const analysis = analyzeCoefficientsForSport(mockActivities, "Cyclisme")

  console.log("✅ Analyse des coefficients:")
  console.log(analysis.summary)

  return analysis
}

/**
 * Exemple 4 : Vérification du type de sport
 */
export function example4_checkSportType() {
  console.log("✅ Vérification des types de sport :")
  console.log(`   "Cyclisme" autorisé: ${isAutoEstimatableSport("Cyclisme")}`)
  console.log(`   "Course" autorisé: ${isAutoEstimatableSport("Course")}`)
  console.log(`   "Marche" autorisé: ${isAutoEstimatableSport("Marche")}`)
  console.log(`   "Randonnée" autorisé: ${isAutoEstimatableSport("Randonnée")}`)
}

/**
 * Exemple 5 : Cas d'erreur - historique insuffisant
 */
export function example5_lowConfidenceCase() {
  const mockActivities: ActivitySummary[] = [
    {
      userId: "user1",
      sport: "Cyclisme",
      startDate: new Date("2025-12-10"),
      duration_s: 3600,
      distance_m: 30000,
      elevation_m: 500,
      load: 180,
      source: "manual",
      has_gps: false,
      has_streams: false,
      has_power: false,
      createdAt: new Date(),
    },
  ]

  const session: FictitioussSessionInput = {
    sport: "Cyclisme",
    distanceKm: 25,
    durationMin: 75,
    elevationGainM: 400,
  }

  const estimate = estimateFictitioussSessionTrainingLoad(session, mockActivities)

  console.log("✅ Cas avec historique insuffisant :")
  console.log(`   Nombre d'activités: ${estimate.coefficients.sampleCount}`)
  console.log(`   Confiance: ${estimate.confidenceLevel} (LOW attendu)`)
  console.log(`   TL estimé: ${estimate.estimatedTL.toFixed(1)} (utilise coefficients par défaut)`)

  return estimate
}

/**
 * Exemple 6 : Comparaison Cyclisme vs Course
 */
export function example6_compareCyclismeVsCourse() {
  const mockActivitiesCyclisme: ActivitySummary[] = Array.from({ length: 8 }, (_, i) => ({
    userId: "user1",
    sport: "Cyclisme",
    startDate: new Date(2025, 10, 1 + i * 3),
    duration_s: 3600 + Math.random() * 1800,
    distance_m: 30000 + Math.random() * 20000,
    elevation_m: 300 + Math.random() * 500,
    load: 180 + Math.random() * 150,
    source: "manual" as const,
    has_gps: false,
    has_streams: false,
    has_power: false,
    createdAt: new Date(),
  }))

  const mockActivitiesCourse: ActivitySummary[] = Array.from({ length: 8 }, (_, i) => ({
    userId: "user1",
    sport: "Course",
    startDate: new Date(2025, 10, 1 + i * 3),
    duration_s: 1800 + Math.random() * 1800,
    distance_m: 7000 + Math.random() * 5000,
    elevation_m: 50 + Math.random() * 200,
    load: 80 + Math.random() * 80,
    source: "manual" as const,
    has_gps: false,
    has_streams: false,
    has_power: false,
    createdAt: new Date(),
  }))

  const allActivities = [...mockActivitiesCyclisme, ...mockActivitiesCourse]

  const coeffsCyclisme = calculateCoefficientsBySport(allActivities, "Cyclisme")
  const coeffsCourse = calculateCoefficientsBySport(allActivities, "Course")

  console.log("✅ Comparaison des coefficients Cyclisme vs Course :")
  console.log(`\n   Cyclisme:`)
  console.log(`     a (TL/km): ${coeffsCyclisme.a.toFixed(2)}`)
  console.log(`     b (TL/min): ${coeffsCyclisme.b.toFixed(3)}`)
  console.log(`     c (TL/m D+): ${coeffsCyclisme.c.toFixed(4)}`)
  console.log(`\n   Course:`)
  console.log(`     a (TL/km): ${coeffsCourse.a.toFixed(2)}`)
  console.log(`     b (TL/min): ${coeffsCourse.b.toFixed(3)}`)
  console.log(`     c (TL/m D+): ${coeffsCourse.c.toFixed(4)}`)
  console.log(`\n   Note: Course généralement plus "gourmande" que cyclisme (coeff. a plus élevé)`)
}

// ============================================================================
// TESTS UNITAIRES
// ============================================================================

export function runAllTests() {
  console.log("🧪 Exécution des exemples d'utilisation du module\n")

  try {
    example1_estimateSingleSession()
    console.log("\n" + "=".repeat(70) + "\n")

    example2_estimateBatchSessions()
    console.log("\n" + "=".repeat(70) + "\n")

    example3_analyzeCoefficients()
    console.log("\n" + "=".repeat(70) + "\n")

    example4_checkSportType()
    console.log("\n" + "=".repeat(70) + "\n")

    example5_lowConfidenceCase()
    console.log("\n" + "=".repeat(70) + "\n")

    example6_compareCyclismeVsCourse()
    console.log("\n" + "=".repeat(70) + "\n")

    console.log("✅ Tous les exemples se sont exécutés avec succès !")
  } catch (error) {
    console.error("❌ Erreur lors de l'exécution :", error)
  }
}
