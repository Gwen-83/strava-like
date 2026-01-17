/**
 * Banister Model - Central Export
 * Point d'entrée unique pour tous les exports du modèle Banister
 *
 * Usage:
 * import { useBanisterModel, BanisterViewer } from "@/utils/banister";
 */

// Types
export type {
  Activity,
  DailyLoad,
  BanisterPoint,
  FormStatus,
  TrainingLoadWarning,
  BanisterConfig,
} from "../types/BanisterModel";

// Functions
export {
  aggregateDailyTrainingLoad,
  computeBanisterModel,
  getFormStatus,
  generateTrainingWarning,
  filterStabilizedData,
  findOverreachingPeriods,
  findPeakPeriods,
  getBanisterStatistics,
} from "./banisterModel";

// React
export { useBanisterModel } from "../hooks/useBanisterModel";
export type { UseBanisterModelReturn } from "../hooks/useBanisterModel";

// Component
export { BanisterViewer } from "../components/BanisterViewer";

// Styles (import automatically or explicitly)
// Note: Make sure banister.css is imported in your app
// import "@/styles/banister.css";
