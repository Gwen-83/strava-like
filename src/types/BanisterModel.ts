/**
 * Banister Fitness/Fatigue/Form Model
 * Based on CTL (Chronic Training Load), ATL (Acute Training Load), TSB (Training Stress Balance)
 *
 * Reference: Banister E.W. (1991) - Modeling elite athletic performance
 */

/**
 * Represents a single activity with its training stress
 */
export type Activity = {
  date: string; // ISO format: YYYY-MM-DD
  trainingLoad: number; // Positive real number (TRIMP, power-based, or custom metric)
};

/**
 * Aggregated daily training load
 * Multiple activities on the same day are summed
 */
export type DailyLoad = {
  date: string; // ISO format: YYYY-MM-DD
  trainingLoad: number; // Sum of all activities' training loads for the day
};

/**
 * Banister model metrics for a given day
 * Represents the current physiological state
 */
export type BanisterPoint = {
  date: string; // ISO format: YYYY-MM-DD

  // Daily aggregated training load
  dailyTrainingLoad: number;

  // Chronic Training Load: Long-term training accumulation (42-day exponential average)
  // High CTL → Good aerobic base, high fitness
  // τ_CTL = 42 days (approximately 6 weeks)
  CTL: number;

  // Acute Training Load: Recent training stress (7-day exponential average)
  // High ATL → High recent fatigue
  // τ_ATL = 7 days (approximately 1 week)
  ATL: number;

  // Training Stress Balance: CTL - ATL
  // TSB > +10: Peak form, ready to compete
  // -10 < TSB < +10: Balanced state
  // TSB < -20: Overreaching, risk of overtraining
  TSB: number;

  // Flag indicating if CTL/ATL have stabilized
  // True after ~42 days (model warm-up period)
  // Before that, values are less reliable
  isStabilized: boolean;
};

/**
 * Performance form classification based on TSB
 */
export type FormStatus =
  | "overreaching" // TSB < -20: High fatigue
  | "recovering" // -20 <= TSB < -10
  | "accumulating" // -10 <= TSB < 0
  | "balanced" // 0 <= TSB <= 10
  | "peaking"; // TSB > 10: Peak form

/**
 * Training load warnings based on physiological state
 */
export type TrainingLoadWarning = {
  status: FormStatus;
  TSB: number;
  recommendation: string;
};

/**
 * Configuration for Banister model calculation
 */
export type BanisterConfig = {
  // Time constant for CTL (days) - default 42
  // Represents 63.2% decay time for chronic training load
  tauCTL?: number;

  // Time constant for ATL (days) - default 7
  // Represents 63.2% decay time for acute training load
  tauATL?: number;

  // Number of days required for model stabilization
  // Typically = tauCTL (default 42)
  stabilizationDays?: number;

  // Initial CTL/ATL value (for warm-up phase)
  // If not provided, uses average of first 30 days
  initialLoad?: number;
};
