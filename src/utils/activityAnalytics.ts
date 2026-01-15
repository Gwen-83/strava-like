/**
 * Ré-exporte les fonctions depuis trainingLoadCalculator pour compatibilité backwards
 */
export {
  computeRefSpeeds,
  calculateActivityTrainingLoad,
  calculateActivityStats,
  calculateTotalTrainingLoad,
  computeActivityMetrics,
  median,
  isValidNumber,
  type ActivityMetrics,
} from "./trainingLoadCalculator"

export { DEFAULT_REF_SPEEDS, N_EXP_BY_SPORT, K_GRADE, VAR_ALPHA, DEFAULT_N_EXP } from "./constants"
