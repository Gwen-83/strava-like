/**
 * React Hook for Banister Impact Simulation
 * Provides memoized simulation with type safety
 */

import { useMemo } from "react";
import {
  simulateBanisterImpact,
  type FictionalSession,
  type SimulationConfig,
  type SimulationResult,
} from "../utils/banisterSimulation";

/**
 * Hook to simulate Banister impact of fictional training sessions
 *
 * Memoizes the simulation to prevent unnecessary recalculations
 *
 * @param initialCTL - Current CTL value
 * @param initialATL - Current ATL value
 * @param startDate - Simulation start date (ISO format)
 * @param fictionalSessions - Array of fictional sessions to simulate
 * @param config - Optional simulation configuration
 * @returns Simulation result with baseline and simulated scenarios
 *
 * Example:
 * ```typescript
 * const result = useSimulateBanisterImpact(
 *   75.5,
 *   45.2,
 *   "2024-01-16",
 *   sessions,
 *   { horizonDays: 14 }
 * );
 * ```
 */
export function useSimulateBanisterImpact(
  initialCTL: number,
  initialATL: number,
  startDate: string,
  fictionalSessions: FictionalSession[],
  config?: SimulationConfig
): SimulationResult | null {
  return useMemo(() => {
    try {
      return simulateBanisterImpact({
        initialCTL,
        initialATL,
        startDate,
        fictionalSessions,
        config,
      });
    } catch (error) {
      console.error("Simulation error:", error);
      return null;
    }
  }, [initialCTL, initialATL, startDate, fictionalSessions, config]);
}
