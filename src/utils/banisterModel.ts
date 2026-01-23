/**
 * Banister Model Implementation
 * Pure functions for computing CTL, ATL, TSB metrics
 *
 * All functions are framework-agnostic and side-effect free
 */

import type {
  Activity,
  BanisterConfig,
  BanisterPoint,
  DailyLoad,
  FormStatus,
  TrainingLoadWarning,
} from "../types/BanisterModel";

/**
 * Default constants for Banister model
 */
const DEFAULTS = {
  TAU_CTL: 42, // days - Chronic Training Load time constant
  TAU_ATL: 7, // days - Acute Training Load time constant
  STABILIZATION_DAYS: 42, // days - Warm-up period before model stabilizes
  WARM_UP_DAYS: 30, // days - Period used to initialize CTL/ATL if no initial load provided
};

/**
 * Aggregates multiple activities on the same day into daily training loads
 *
 * @param activities - List of activities with individual training loads
 * @param endDate - Optional end date (defaults to today). If provided and after last activity, extends to this date with 0 load
 * @returns List of daily aggregated training loads, sorted chronologically
 *
 * Algorithm:
 * 1. Group activities by date
 * 2. Sum training loads within each day
 * 3. Sort by date
 * 4. Include all days from min to max (filling gaps with 0 load)
 * 5. If endDate is provided, extend to endDate
 */
export function aggregateDailyTrainingLoad(
  activities: Activity[],
  endDate?: Date
): DailyLoad[] {
  if (activities.length === 0) {
    return [];
  }

  // Group activities by date
  const activityByDate = new Map<string, number>();

  for (const activity of activities) {
    const date = normalizeDate(activity.date);
    const current = activityByDate.get(date) || 0;
    activityByDate.set(date, current + activity.trainingLoad);
  }

  // Get date range
  const dates = Array.from(activityByDate.keys()).sort();
  const minDate = parseDate(dates[0]);
  let maxDate = parseDate(dates[dates.length - 1]);

  // If endDate is provided and is after maxDate, extend to endDate
  if (endDate) {
    const endDateNormalized = normalizeDate(dateToISOString(endDate));
    const endDateParsed = parseDate(endDateNormalized);
    if (endDateParsed > maxDate) {
      maxDate = endDateParsed;
    }
  }

  // Generate continuous daily loads (including days with 0 load)
  const dailyLoads: DailyLoad[] = [];
  for (
    let current = new Date(minDate);
    current <= maxDate;
    current.setDate(current.getDate() + 1)
  ) {
    const dateStr = dateToISOString(current);
    const trainingLoad = activityByDate.get(dateStr) || 0;

    dailyLoads.push({
      date: dateStr,
      trainingLoad,
    });
  }

  return dailyLoads;
}

/**
 * Computes the Banister model (CTL, ATL, TSB) for a time series
 *
 * @param dailyLoads - Daily aggregated training loads
 * @param config - Optional configuration (tauCTL, tauATL, stabilizationDays)
 * @returns Array of Banister metrics for each day
 *
 * Mathematical model:
 * CTL_n = CTL_{n-1} + (TL_n - CTL_{n-1}) / τ_CTL
 * ATL_n = ATL_{n-1} + (TL_n - ATL_{n-1}) / τ_ATL
 * TSB_n = CTL_n - ATL_n
 */
export function computeBanisterModel(
  dailyLoads: DailyLoad[],
  config?: BanisterConfig
): BanisterPoint[] {
  if (dailyLoads.length === 0) {
    return [];
  }

  const tauCTL = config?.tauCTL ?? DEFAULTS.TAU_CTL;
  const tauATL = config?.tauATL ?? DEFAULTS.TAU_ATL;
  const stabilizationDays =
    config?.stabilizationDays ?? DEFAULTS.STABILIZATION_DAYS;

  // Initialize CTL and ATL
  let initialCTL: number;
  let initialATL: number;

  if (config?.initialLoad !== undefined) {
    // Use provided initial load
    initialCTL = config.initialLoad;
    initialATL = config.initialLoad;
  } else {
    // Use average of first 30 days (or all available if fewer than 30)
    const warmUpDays = Math.min(DEFAULTS.WARM_UP_DAYS, dailyLoads.length);
    const sum = dailyLoads
      .slice(0, warmUpDays)
      .reduce((acc, load) => acc + load.trainingLoad, 0);
    initialCTL = sum / warmUpDays;
    initialATL = sum / warmUpDays;
  }

  const results: BanisterPoint[] = [];
  let ctl = initialCTL;
  let atl = initialATL;

  for (let i = 0; i < dailyLoads.length; i++) {
    const dailyLoad = dailyLoads[i];

    // Update CTL: exponential weighted average with time constant τ_CTL
    ctl = ctl + (dailyLoad.trainingLoad - ctl) / tauCTL;

    // Update ATL: exponential weighted average with time constant τ_ATL
    atl = atl + (dailyLoad.trainingLoad - atl) / tauATL;

    // Compute TSB (Training Stress Balance)
    const tsb = ctl - atl;

    // Determine stabilization: after stabilizationDays, consider model stabilized
    const isStabilized = i >= stabilizationDays;

    results.push({
      date: dailyLoad.date,
      dailyTrainingLoad: dailyLoad.trainingLoad,
      CTL: ctl,
      ATL: atl,
      TSB: tsb,
      isStabilized,
    });
  }

  return results;
}

/**
 * Determines form status based on TSB value
 *
 * @param tsb - Training Stress Balance
 * @returns Form status classification
 *
 * Zones:
 * - TSB > +10: PEAKING - Ready to compete
 * - 0 to +10: BALANCED - Good form
 * - -10 to 0: ACCUMULATING - Normal training
 * - -20 to -10: RECOVERING - Fatigue building
 * - < -20: OVERREACHING - High fatigue, risk of overtraining
 */
export function getFormStatus(tsb: number): FormStatus {
  if (tsb > 10) return "peaking";
  if (tsb > 0) return "balanced";
  if (tsb > -10) return "accumulating";
  if (tsb > -20) return "recovering";
  return "overreaching";
}

/**
 * Generates training load warnings based on current physiological state
 *
 * @param banisterPoint - Current Banister metrics
 * @returns Training load warning with recommendation
 */
export function generateTrainingWarning(
  banisterPoint: BanisterPoint
): TrainingLoadWarning {
  const status = getFormStatus(banisterPoint.TSB);

  const recommendations: Record<FormStatus, string> = {
    peaking:
      "🎯 Peak form - ideal time for competition or high-intensity efforts",
    balanced:
      "✅ Good balance - continue current training strategy",
    accumulating:
      "📈 Building fitness - progressive training load is working",
    recovering:
      "⚠️ Elevated fatigue - consider adding recovery days soon",
    overreaching:
      "🛑 HIGH FATIGUE - risk of overtraining, reduce volume and prioritize recovery",
  };

  return {
    status,
    TSB: banisterPoint.TSB,
    recommendation: recommendations[status],
  };
}

/**
 * Filters Banister points to only include stabilized data
 *
 * Useful for analysis/visualization that requires reliable metrics
 *
 * @param points - All Banister points
 * @returns Only points where isStabilized = true
 */
export function filterStabilizedData(points: BanisterPoint[]): BanisterPoint[] {
  return points.filter((p) => p.isStabilized);
}

/**
 * Finds overreaching events (TSB < -20)
 *
 * Useful for identifying periods of excessive training load
 *
 * @param points - Banister points
 * @param minConsecutiveDays - Minimum consecutive days to count as overreaching event
 * @returns Array of overreaching periods
 */
export function findOverreachingPeriods(
  points: BanisterPoint[],
  minConsecutiveDays: number = 3
): Array<{ startDate: string; endDate: string; days: number; minTSB: number }> {
  const periods: Array<{
    startDate: string;
    endDate: string;
    days: number;
    minTSB: number;
  }> = [];

  let currentPeriod: {
    startIndex: number;
    minTSB: number;
  } | null = null;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    if (point.TSB < -20) {
      if (!currentPeriod) {
        currentPeriod = { startIndex: i, minTSB: point.TSB };
      } else {
        currentPeriod.minTSB = Math.min(currentPeriod.minTSB, point.TSB);
      }
    } else {
      if (currentPeriod) {
        const days = i - currentPeriod.startIndex;
        if (days >= minConsecutiveDays) {
          periods.push({
            startDate: points[currentPeriod.startIndex].date,
            endDate: points[i - 1].date,
            days,
            minTSB: currentPeriod.minTSB,
          });
        }
        currentPeriod = null;
      }
    }
  }

  // Handle ongoing overreaching at the end
  if (currentPeriod) {
    const days = points.length - currentPeriod.startIndex;
    if (days >= minConsecutiveDays) {
      periods.push({
        startDate: points[currentPeriod.startIndex].date,
        endDate: points[points.length - 1].date,
        days,
        minTSB: currentPeriod.minTSB,
      });
    }
  }

  return periods;
}

/**
 * Finds peak form events (TSB > +10)
 *
 * Useful for identifying optimal racing windows
 *
 * @param points - Banister points
 * @param minConsecutiveDays - Minimum consecutive days to count as peak event
 * @returns Array of peak periods
 */
export function findPeakPeriods(
  points: BanisterPoint[],
  minConsecutiveDays: number = 2
): Array<{ startDate: string; endDate: string; days: number; maxTSB: number }> {
  const periods: Array<{
    startDate: string;
    endDate: string;
    days: number;
    maxTSB: number;
  }> = [];

  let currentPeriod: {
    startIndex: number;
    maxTSB: number;
  } | null = null;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    if (point.TSB > 10) {
      if (!currentPeriod) {
        currentPeriod = { startIndex: i, maxTSB: point.TSB };
      } else {
        currentPeriod.maxTSB = Math.max(currentPeriod.maxTSB, point.TSB);
      }
    } else {
      if (currentPeriod) {
        const days = i - currentPeriod.startIndex;
        if (days >= minConsecutiveDays) {
          periods.push({
            startDate: points[currentPeriod.startIndex].date,
            endDate: points[i - 1].date,
            days,
            maxTSB: currentPeriod.maxTSB,
          });
        }
        currentPeriod = null;
      }
    }
  }

  // Handle ongoing peak at the end
  if (currentPeriod) {
    const days = points.length - currentPeriod.startIndex;
    if (days >= minConsecutiveDays) {
      periods.push({
        startDate: points[currentPeriod.startIndex].date,
        endDate: points[points.length - 1].date,
        days,
        maxTSB: currentPeriod.maxTSB,
      });
    }
  }

  return periods;
}

/**
 * Gets summary statistics for a time period
 *
 * @param points - Banister points
 * @returns Summary statistics
 */
export function getBanisterStatistics(
  points: BanisterPoint[]
): {
  avgCTL: number;
  maxCTL: number;
  minCTL: number;
  avgATL: number;
  maxATL: number;
  minATL: number;
  avgTSB: number;
  maxTSB: number;
  minTSB: number;
  avgDailyLoad: number;
  totalLoad: number;
} {
  if (points.length === 0) {
    return {
      avgCTL: 0,
      maxCTL: 0,
      minCTL: 0,
      avgATL: 0,
      maxATL: 0,
      minATL: 0,
      avgTSB: 0,
      maxTSB: 0,
      minTSB: 0,
      avgDailyLoad: 0,
      totalLoad: 0,
    };
  }

  const ctlValues = points.map((p) => p.CTL);
  const atlValues = points.map((p) => p.ATL);
  const tsbValues = points.map((p) => p.TSB);
  const dailyLoads = points.map((p) => p.dailyTrainingLoad);

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => sum(arr) / arr.length;
  const max = (arr: number[]) => Math.max(...arr);
  const min = (arr: number[]) => Math.min(...arr);

  return {
    avgCTL: avg(ctlValues),
    maxCTL: max(ctlValues),
    minCTL: min(ctlValues),
    avgATL: avg(atlValues),
    maxATL: max(atlValues),
    minATL: min(atlValues),
    avgTSB: avg(tsbValues),
    maxTSB: max(tsbValues),
    minTSB: min(tsbValues),
    avgDailyLoad: avg(dailyLoads),
    totalLoad: sum(dailyLoads),
  };
}

// ============================================================================
// Helper functions - Date utilities
// ============================================================================

/**
 * Normalizes date string to YYYY-MM-DD format
 */
function normalizeDate(date: string): string {
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  return dateToISOString(parsed);
}

/**
 * Converts Date to ISO string (YYYY-MM-DD) using local time, not UTC
 */
function dateToISOString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parses ISO date string to Date (local time, not UTC)
 */
function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}
