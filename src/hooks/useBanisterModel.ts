/**
 * React Hook for Banister Model computation
 * Wraps the pure functions in a hook for easy integration in React components
 */

import { useMemo } from "react";
import {
  aggregateDailyTrainingLoad,
  computeBanisterModel,
  generateTrainingWarning,
  findOverreachingPeriods,
  findPeakPeriods,
  getBanisterStatistics,
  filterStabilizedData,
} from "../utils/banisterModel";
import type {
  Activity,
  BanisterConfig,
  BanisterPoint,
  TrainingLoadWarning,
} from "../types/BanisterModel";

/**
 * Return type for useBanisterModel hook
 */
export type UseBanisterModelReturn = {
  // Raw results
  banisterPoints: BanisterPoint[];
  stabilizedPoints: BanisterPoint[];

  // Current state
  currentPoint: BanisterPoint | null;

  // Analysis
  warnings: TrainingLoadWarning[];
  overreachingPeriods: ReturnType<typeof findOverreachingPeriods>;
  peakPeriods: ReturnType<typeof findPeakPeriods>;

  // Statistics
  statistics: ReturnType<typeof getBanisterStatistics>;

  // Metadata
  isLoading: boolean;
};

/**
 * Hook for computing Banister model from activities
 *
 * Automatically aggregates daily training loads and computes CTL/ATL/TSB
 * Memoized to prevent unnecessary recalculations
 *
 * @param activities - List of activities
 * @param config - Optional Banister configuration
 * @returns Computed Banister metrics and analysis
 *
 * Example:
 * ```
 * const { banisterPoints, currentPoint, warnings } = useBanisterModel(activities);
 * ```
 */
export function useBanisterModel(
  activities: Activity[],
  config?: BanisterConfig
): UseBanisterModelReturn {
  const result = useMemo(() => {
    if (!activities || activities.length === 0) {
      return {
        banisterPoints: [],
        stabilizedPoints: [],
        currentPoint: null,
        warnings: [],
        overreachingPeriods: [],
        peakPeriods: [],
        statistics: {
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
        },
        isLoading: false,
      };
    }

    // Step 1: Aggregate daily training loads (extend to today)
    const dailyLoads = aggregateDailyTrainingLoad(activities, new Date());

    // Step 2: Compute Banister model
    const banisterPoints = computeBanisterModel(dailyLoads, config);

    if (banisterPoints.length === 0) {
      return {
        banisterPoints: [],
        stabilizedPoints: [],
        currentPoint: null,
        warnings: [],
        overreachingPeriods: [],
        peakPeriods: [],
        statistics: {
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
        },
        isLoading: false,
      };
    }

    // Step 3: Filter stabilized data
    const stabilizedPoints = filterStabilizedData(banisterPoints);

    // Step 4: Get current state
    const currentPoint = banisterPoints[banisterPoints.length - 1];

    // Step 5: Generate warnings
    const warnings = [generateTrainingWarning(currentPoint)];

    // Step 6: Find periods
    const overreachingPeriods = findOverreachingPeriods(banisterPoints);
    const peakPeriods = findPeakPeriods(banisterPoints);

    // Step 7: Compute statistics
    const statistics = getBanisterStatistics(banisterPoints);

    return {
      banisterPoints,
      stabilizedPoints,
      currentPoint,
      warnings,
      overreachingPeriods,
      peakPeriods,
      statistics,
      isLoading: false,
    };
  }, [activities, config?.tauCTL, config?.tauATL, config?.stabilizationDays]);

  return result;
}
