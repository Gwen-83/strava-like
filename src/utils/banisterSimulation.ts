/**
 * Banister Model Simulation
 * Simulates the impact of fictional future training sessions on CTL, ATL, and TSB
 *
 * This module answers the question:
 * "What if I do this training session(s) in X days? How will it affect my fitness, fatigue, and risk?"
 *
 * Key features:
 * - Non-destructive: never modifies real data
 * - Day-by-day simulation with exponential averaging
 * - Baseline vs simulated scenario comparison
 * - Fatigue level classification
 * - Risk assessment
 */

/**
 * Classification of fatigue level based on TSB
 */
export type FatigueLevel = "FRESH" | "OPTIMAL" | "PRODUCTIVE" | "FATIGUED" | "OVERREACH";

/**
 * A fictional training session to be simulated
 */
export type FictionalSession = {
  /** Number of days from now (0 = today, 1 = tomorrow, 7 = in a week) */
  dayOffset: number;

  /** Type of sport */
  sport: "cyclisme" | "course" | "autre";

  /** Type of training session */
  type: "recuperation" | "endurance" | "seuil" | "vo2max" | "longue_distance";

  /** Estimated training load for this session (TRIMP, power-based, or custom metric) */
  trainingLoad: number;

  /** Optional: description of the session */
  description?: string;
};

/**
 * Simulation parameters and configuration
 */
export type SimulationConfig = {
  /** Number of days to simulate (default: 14) */
  horizonDays?: number;

  /** Time constant for CTL (default: 42 days) */
  tauCTL?: number;

  /** Time constant for ATL (default: 7 days) */
  tauATL?: number;

  /** Include confidence score in results (default: true) */
  includeConfidence?: boolean;
};

/**
 * A single day's simulation result
 */
export type SimulationDay = {
  /** Day number in simulation (0 = today) */
  day: number;

  /** ISO date string (YYYY-MM-DD) */
  date: string;

  /** Chronic Training Load (fitness) */
  ctl: number;

  /** Acute Training Load (fatigue) */
  atl: number;

  /** Training Stress Balance (CTL - ATL) */
  tsb: number;

  /** Daily training load applied this day */
  trainingLoad: number;

  /** Fatigue classification */
  fatigueLevel: FatigueLevel;
};

/**
 * Summary statistics for a simulation scenario
 */
export type SimulationSummary = {
  /** Minimum TSB reached during simulation */
  minTSB: number;

  /** Day when minimum TSB is reached */
  minTSBDay: number;

  /** Change in CTL from start to end */
  deltaCTL: number;

  /** Change in ATL from start to end */
  deltaATL: number;

  /** Risk level based on TSB dynamics */
  riskLevel: "LOW" | "MODERATE" | "HIGH";

  /** Number of days in "FRESH" state */
  freshDays: number;

  /** Number of days in "OPTIMAL" state */
  optimalDays: number;

  /** Number of days in "PRODUCTIVE" state */
  productiveDays: number;

  /** Number of days in "FATIGUED" state */
  fatiguedDays: number;

  /** Number of days in "OVERREACH" state */
  overreachDays: number;

  /** Confidence score (0-1): higher if initial values are stabilized */
  confidenceScore: number;
};

/**
 * Complete simulation result with baseline and simulated scenarios
 */
export type SimulationResult = {
  /** Simulation results without fictional sessions (reference scenario) */
  baseline: SimulationDay[];

  /** Simulation results with fictional sessions (what-if scenario) */
  simulated: SimulationDay[];

  /** Summary for baseline scenario */
  baselineSummary: SimulationSummary;

  /** Summary for simulated scenario */
  simulatedSummary: SimulationSummary;

  /** Comparison insights */
  comparison: {
    /** Difference in minimum TSB (simulated - baseline) */
    minTSBDifference: number;

    /** Difference in final TSB (simulated - baseline) */
    finalTSBDifference: number;

    /** Days where simulated TSB is lower than baseline */
    daysWithLowerTSB: number;

    /** Risk increase (high impact if risk level is elevated) */
    riskIncrease: boolean;

    /** Key finding summary */
    insight: string;
  };
};

/**
 * Classifies a TSB value into a fatigue level
 *
 * @param tsb - Training Stress Balance value
 * @returns Fatigue level classification
 *
 * Classification zones:
 * - TSB > +10: FRESH - Peak readiness for competition
 * - +10 ≥ TSB ≥ 0: OPTIMAL - Ideal training state
 * - 0 > TSB ≥ -10: PRODUCTIVE - Normal training accumulation
 * - -10 > TSB ≥ -25: FATIGUED - High fatigue but manageable
 * - TSB < -25: OVERREACH - Severe fatigue, overtraining risk
 */
export function classifyFatigueLevel(tsb: number): FatigueLevel {
  if (tsb > 10) return "FRESH";
  if (tsb >= 0) return "OPTIMAL";
  if (tsb >= -10) return "PRODUCTIVE";
  if (tsb >= -25) return "FATIGUED";
  return "OVERREACH";
}

/**
 * Determines risk level based on minimum TSB reached
 *
 * @param minTSB - Minimum TSB during simulation
 * @returns Risk level classification
 */
function determineRiskLevel(minTSB: number): "LOW" | "MODERATE" | "HIGH" {
  if (minTSB >= -10) return "LOW";
  if (minTSB >= -25) return "MODERATE";
  return "HIGH";
}

/**
 * Aggregates fictional sessions by day offset
 *
 * Allows multiple sessions on the same day (their training loads are summed)
 *
 * @param sessions - Array of fictional sessions
 * @returns Map of day offset → total training load
 */
function aggregateSessionsByDay(
  sessions: FictionalSession[]
): Map<number, number> {
  const byDay = new Map<number, number>();

  for (const session of sessions) {
    const current = byDay.get(session.dayOffset) ?? 0;
    byDay.set(session.dayOffset, current + session.trainingLoad);
  }

  return byDay;
}

/**
 * Calculates confidence score based on initial state
 *
 * Assumes higher confidence when CTL and ATL are stabilized
 * (typical after 42+ days of data)
 *
 * @param initialCTL - Starting CTL value
 * @param initialATL - Starting ATL value
 * @returns Confidence score (0-1)
 */
function calculateConfidenceScore(initialCTL: number, initialATL: number): number {
  // If CTL is too low, confidence is lower (early in training history)
  // Assume good confidence when CTL > 50
  const ctlConfidence = Math.min(initialCTL / 50, 1);

  // If ATL is unreasonable, confidence is lower
  const atlConfidence = Math.min(1, Math.max(0, (100 - Math.abs(initialATL - 50)) / 50));

  return (ctlConfidence + atlConfidence) / 2;
}

/**
 * Builds a summary for a simulation scenario
 *
 * @param days - All simulation days for this scenario
 * @param horizonDays - Total simulation horizon
 * @param confidenceScore - Confidence score of the simulation
 * @returns Summary statistics
 */
function buildSummary(
  days: SimulationDay[],
  _horizonDays: number,
  confidenceScore: number
): SimulationSummary {
  if (days.length === 0) {
    return {
      minTSB: 0,
      minTSBDay: 0,
      deltaCTL: 0,
      deltaATL: 0,
      riskLevel: "LOW",
      freshDays: 0,
      optimalDays: 0,
      productiveDays: 0,
      fatiguedDays: 0,
      overreachDays: 0,
      confidenceScore: 0,
    };
  }

  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  const minTSBDay = days.reduce((min, d) => (d.tsb < min.tsb ? d : min));

  // Count days by fatigue level
  const fatigueCount = {
    FRESH: 0,
    OPTIMAL: 0,
    PRODUCTIVE: 0,
    FATIGUED: 0,
    OVERREACH: 0,
  };

  for (const day of days) {
    fatigueCount[day.fatigueLevel]++;
  }

  return {
    minTSB: minTSBDay.tsb,
    minTSBDay: minTSBDay.day,
    deltaCTL: lastDay.ctl - firstDay.ctl,
    deltaATL: lastDay.atl - firstDay.atl,
    riskLevel: determineRiskLevel(minTSBDay.tsb),
    freshDays: fatigueCount.FRESH,
    optimalDays: fatigueCount.OPTIMAL,
    productiveDays: fatigueCount.PRODUCTIVE,
    fatiguedDays: fatigueCount.FATIGUED,
    overreachDays: fatigueCount.OVERREACH,
    confidenceScore,
  };
}

/**
 * Simulates a single scenario (baseline or with fictional sessions)
 *
 * @param initialCTL - Starting CTL value
 * @param initialATL - Starting ATL value
 * @param sessionsByDay - Map of day offset → training load for that day
 * @param startDate - Simulation start date (ISO format)
 * @param horizonDays - Number of days to simulate
 * @param tauCTL - Time constant for CTL
 * @param tauATL - Time constant for ATL
 * @returns Array of simulation days
 */
function simulateScenario(
  initialCTL: number,
  initialATL: number,
  sessionsByDay: Map<number, number>,
  startDate: string,
  horizonDays: number,
  tauCTL: number,
  tauATL: number
): SimulationDay[] {
  const result: SimulationDay[] = [];

  let ctl = initialCTL;
  let atl = initialATL;

  const start = new Date(startDate + "T00:00:00");

  for (let day = 0; day < horizonDays; day++) {
    // Get training load for this day (0 if no sessions scheduled)
    const trainingLoad = sessionsByDay.get(day) ?? 0;

    // Update CTL: exponential weighted average
    ctl = ctl + (trainingLoad - ctl) / tauCTL;

    // Update ATL: exponential weighted average
    atl = atl + (trainingLoad - atl) / tauATL;

    // Calculate TSB
    const tsb = ctl - atl;

    // Classify fatigue
    const fatigueLevel = classifyFatigueLevel(tsb);

    // Calculate date
    const dayDate = new Date(start);
    dayDate.setDate(dayDate.getDate() + day);
    const dateStr = dayDate.toISOString().split("T")[0];

    result.push({
      day,
      date: dateStr,
      ctl,
      atl,
      tsb,
      trainingLoad,
      fatigueLevel,
    });
  }

  return result;
}

/**
 * Generates a natural language insight comparing two scenarios
 *
 * @param baseline - Baseline scenario summary
 * @param simulated - Simulated scenario summary
 * @param minTSBDifference - Difference in minimum TSB
 * @returns Human-readable insight
 */
function generateInsight(
  baseline: SimulationSummary,
  simulated: SimulationSummary,
  minTSBDifference: number
): string {
  const riskIncreased = simulated.riskLevel !== baseline.riskLevel && 
    (simulated.riskLevel === "HIGH" || simulated.riskLevel === "MODERATE");

  if (minTSBDifference < -5) {
    return `⚠️ Cette séance augmente significativement la fatigue (TSB min: ${simulated.minTSB.toFixed(1)} vs ${baseline.minTSB.toFixed(1)}). ${riskIncreased ? "Le risque passe à " + simulated.riskLevel : "Attention à la récupération."}`;
  }

  if (minTSBDifference > 5) {
    return `✅ Cette séance aurait peu d'impact sur la fatigue. Vous resteriez dans une zone similaire.`;
  }

  if (riskIncreased) {
    return `⚡ Impact modéré : la fatigue augmente légèrement. Risque: ${simulated.riskLevel}. Prévoyez une récupération adéquate.`;
  }

  return `📊 Impact minimal sur votre état de forme. Vous pouvez l'intégrer à votre entraînement.`;
}

/**
 * Simulates the impact of fictional training sessions on Banister metrics
 *
 * Main entry point for simulation functionality.
 *
 * @param params - Simulation parameters
 * @param params.initialCTL - Current CTL value
 * @param params.initialATL - Current ATL value
 * @param params.startDate - Simulation start date (ISO format: YYYY-MM-DD)
 * @param params.fictionalSessions - Array of fictional sessions to simulate
 * @param params.config - Optional simulation configuration
 * @returns Complete simulation result with baseline and simulated scenarios
 *
 * Example:
 * ```typescript
 * const result = simulateBanisterImpact({
 *   initialCTL: 75.5,
 *   initialATL: 45.2,
 *   startDate: "2024-01-16",
 *   fictionalSessions: [
 *     {
 *       dayOffset: 0,
 *       sport: "cyclisme",
 *       type: "vo2max",
 *       trainingLoad: 120,
 *       description: "1h de séance VO2max"
 *     },
 *     {
 *       dayOffset: 2,
 *       sport: "course",
 *       type: "endurance",
 *       trainingLoad: 80
 *     }
 *   ],
 *   config: {
 *     horizonDays: 14,
 *     tauCTL: 42,
 *     tauATL: 7
 *   }
 * });
 * ```
 */
export function simulateBanisterImpact(params: {
  initialCTL: number;
  initialATL: number;
  startDate: string;
  fictionalSessions: FictionalSession[];
  config?: SimulationConfig;
}): SimulationResult {
  const {
    initialCTL,
    initialATL,
    startDate,
    fictionalSessions,
    config = {},
  } = params;

  // Extract configuration with defaults
  const horizonDays = config.horizonDays ?? 14;
  const tauCTL = config.tauCTL ?? 42;
  const tauATL = config.tauATL ?? 7;
  const includeConfidence = config.includeConfidence ?? true;

  // Validate inputs
  if (initialCTL < 0 || initialATL < 0) {
    throw new Error("CTL and ATL must be non-negative");
  }

  if (horizonDays < 1 || horizonDays > 365) {
    throw new Error("Horizon must be between 1 and 365 days");
  }

  // Calculate confidence score once
  const confidenceScore = includeConfidence
    ? calculateConfidenceScore(initialCTL, initialATL)
    : 1;

  // Aggregate fictional sessions by day
  const sessionsByDay = aggregateSessionsByDay(fictionalSessions);

  // Simulate baseline (no fictional sessions)
  const baseline = simulateScenario(
    initialCTL,
    initialATL,
    new Map(), // Empty: no fictional sessions
    startDate,
    horizonDays,
    tauCTL,
    tauATL
  );

  // Simulate with fictional sessions
  const simulated = simulateScenario(
    initialCTL,
    initialATL,
    sessionsByDay, // With fictional sessions
    startDate,
    horizonDays,
    tauCTL,
    tauATL
  );

  // Build summaries
  const baselineSummary = buildSummary(baseline, horizonDays, confidenceScore);
  const simulatedSummary = buildSummary(simulated, horizonDays, confidenceScore);

  // Calculate comparison metrics
  const minTSBDifference =
    simulatedSummary.minTSB - baselineSummary.minTSB;

  const finalTSBDifference =
    simulated[simulated.length - 1].tsb -
    baseline[baseline.length - 1].tsb;

  const daysWithLowerTSB = simulated.filter(
    (sim, idx) => sim.tsb < baseline[idx].tsb
  ).length;

  const riskIncrease =
    simulatedSummary.riskLevel !== baselineSummary.riskLevel &&
    (simulatedSummary.riskLevel === "HIGH" ||
      simulatedSummary.riskLevel === "MODERATE");

  const insight = generateInsight(
    baselineSummary,
    simulatedSummary,
    minTSBDifference
  );

  return {
    baseline,
    simulated,
    baselineSummary,
    simulatedSummary,
    comparison: {
      minTSBDifference,
      finalTSBDifference,
      daysWithLowerTSB,
      riskIncrease,
      insight,
    },
  };
}

/**
 * Helper function to format a simulation result for display
 *
 * Useful for debugging and logging
 *
 * @param result - Simulation result
 * @returns Formatted string summary
 */
export function formatSimulationResult(result: SimulationResult): string {
  const lines: string[] = [
    "═══════════════════════════════════════",
    "📊 SIMULATION BANISTER - RÉSUMÉ COMPLET",
    "═══════════════════════════════════════",
    "",
    "📈 SCÉNARIO BASELINE (sans séances fictives)",
    `   Min TSB: ${result.baselineSummary.minTSB.toFixed(1)} (jour ${result.baselineSummary.minTSBDay})`,
    `   Δ CTL: ${result.baselineSummary.deltaCTL.toFixed(1)} | Δ ATL: ${result.baselineSummary.deltaATL.toFixed(1)}`,
    `   Risque: ${result.baselineSummary.riskLevel}`,
    "",
    "⚡ SCÉNARIO SIMULÉ (avec séances fictives)",
    `   Min TSB: ${result.simulatedSummary.minTSB.toFixed(1)} (jour ${result.simulatedSummary.minTSBDay})`,
    `   Δ CTL: ${result.simulatedSummary.deltaCTL.toFixed(1)} | Δ ATL: ${result.simulatedSummary.deltaATL.toFixed(1)}`,
    `   Risque: ${result.simulatedSummary.riskLevel}`,
    "",
    "🔍 DIFFÉRENCE",
    `   TSB min: ${result.comparison.minTSBDifference > 0 ? "+" : ""}${result.comparison.minTSBDifference.toFixed(1)}`,
    `   TSB final: ${result.comparison.finalTSBDifference > 0 ? "+" : ""}${result.comparison.finalTSBDifference.toFixed(1)}`,
    `   Jours avec TSB plus bas: ${result.comparison.daysWithLowerTSB}`,
    `   Augmentation du risque: ${result.comparison.riskIncrease ? "⚠️ OUI" : "✅ NON"}`,
    "",
    "💡 INSIGHT",
    `   ${result.comparison.insight}`,
    "═══════════════════════════════════════",
  ];

  return lines.join("\n");
}
