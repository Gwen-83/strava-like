/**
 * API Routes for Banister Simulation
 * Provides REST endpoints for simulation functionality
 *
 * Usage:
 * POST /api/simulate-banister
 * Body: {
 *   initialCTL: number,
 *   initialATL: number,
 *   startDate: string (ISO),
 *   fictionalSessions: FictionalSession[],
 *   config?: SimulationConfig
 * }
 */

import {
  simulateBanisterImpact,
  type FictionalSession,
  type SimulationConfig,
  type SimulationResult,
} from "../utils/banisterSimulation";

/**
 * Request body for simulation endpoint
 */
export interface SimulationRequest {
  initialCTL: number;
  initialATL: number;
  startDate: string;
  fictionalSessions: FictionalSession[];
  config?: SimulationConfig;
}

/**
 * Response from simulation endpoint
 */
export interface SimulationResponse {
  success: boolean;
  result?: SimulationResult;
  error?: string;
  timestamp: string;
}

/**
 * Validates a simulation request
 *
 * @param req - Request to validate
 * @returns Validation result with error messages if invalid
 */
export function validateSimulationRequest(req: Partial<SimulationRequest>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof req.initialCTL !== "number" || req.initialCTL < 0) {
    errors.push("initialCTL must be a non-negative number");
  }

  if (typeof req.initialATL !== "number" || req.initialATL < 0) {
    errors.push("initialATL must be a non-negative number");
  }

  if (typeof req.startDate !== "string") {
    errors.push("startDate must be an ISO format string");
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(req.startDate)) {
      errors.push("startDate must be in YYYY-MM-DD format");
    }
  }

  if (!Array.isArray(req.fictionalSessions)) {
    errors.push("fictionalSessions must be an array");
  } else {
    for (const [idx, session] of req.fictionalSessions.entries()) {
      if (typeof session.dayOffset !== "number" || session.dayOffset < 0) {
        errors.push(`Session ${idx}: dayOffset must be a non-negative number`);
      }
      if (!["cyclisme", "course", "autre"].includes(session.sport)) {
        errors.push(`Session ${idx}: sport must be one of: cyclisme, course, autre`);
      }
      if (
        !["recuperation", "endurance", "seuil", "vo2max", "longue_distance"].includes(
          session.type
        )
      ) {
        errors.push(
          `Session ${idx}: type must be one of: recuperation, endurance, seuil, vo2max, longue_distance`
        );
      }
      if (typeof session.trainingLoad !== "number" || session.trainingLoad <= 0) {
        errors.push(`Session ${idx}: trainingLoad must be a positive number`);
      }
    }
  }

  if (req.config?.horizonDays !== undefined) {
    if (
      typeof req.config.horizonDays !== "number" ||
      req.config.horizonDays < 1 ||
      req.config.horizonDays > 365
    ) {
      errors.push("config.horizonDays must be between 1 and 365");
    }
  }

  if (req.config?.tauCTL !== undefined) {
    if (typeof req.config.tauCTL !== "number" || req.config.tauCTL <= 0) {
      errors.push("config.tauCTL must be a positive number");
    }
  }

  if (req.config?.tauATL !== undefined) {
    if (typeof req.config.tauATL !== "number" || req.config.tauATL <= 0) {
      errors.push("config.tauATL must be a positive number");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Handles simulation request
 *
 * @param req - Simulation request
 * @returns Response with result or error
 */
export function handleSimulationRequest(req: SimulationRequest): SimulationResponse {
  const validation = validateSimulationRequest(req);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join("; "),
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const result = simulateBanisterImpact(req);

    return {
      success: true,
      result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Example: Integration with Express.js
 *
 * ```typescript
 * import express from 'express';
 * import { handleSimulationRequest, validateSimulationRequest } from './api-routes';
 *
 * const app = express();
 * app.use(express.json());
 *
 * app.post('/api/simulate-banister', (req, res) => {
 *   const response = handleSimulationRequest(req.body);
 *   res.status(response.success ? 200 : 400).json(response);
 * });
 *
 * app.listen(3000, () => console.log('Running on :3000'));
 * ```
 */

/**
 * Example: Integration with Next.js API Route
 *
 * ```typescript
 * // pages/api/simulate-banister.ts
 * import type { NextApiRequest, NextApiResponse } from 'next';
 * import { handleSimulationRequest } from '@/utils/api-routes';
 *
 * export default function handler(
 *   req: NextApiRequest,
 *   res: NextApiResponse
 * ) {
 *   if (req.method !== 'POST') {
 *     return res.status(405).json({ error: 'Method not allowed' });
 *   }
 *
 *   const response = handleSimulationRequest(req.body);
 *   res.status(response.success ? 200 : 400).json(response);
 * }
 * ```
 */
