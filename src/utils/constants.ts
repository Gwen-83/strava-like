/**
 * Constants pour les calculs d'analyses d'activités
 * Centralisé pour éviter la duplication
 */

// Vitesses de référence par sport (km/h)
export const DEFAULT_REF_SPEEDS: Record<string, number> = {
  Marche: 5,
  Cyclisme: 25,
  Course: 10,
  Randonnée: 4,
}

// Exposants pour calcul de charge d'entraînement
export const N_EXP_BY_SPORT: Record<string, number> = {
  Marche: 1.8,
  Course: 2.6,
  Cyclisme: 2.4,
  Randonnée: 2.2,
}

export const DEFAULT_N_EXP = 2.5

// Facteurs de calcul
export const K_GRADE = 0.005       // Facteur dénivelé
export const VAR_ALPHA = 0.5       // Facteur variabilité
export const TRAINING_LOAD_SCALE = 100 // Échelle de charge

// Seuils de durée minimale
export const MIN_ACTIVITY_DURATION_S = 1800 // 30 minutes
export const MIN_ACTIVITY_DISTANCE_M = 0

// Seuils FTP estimation (puissance en W/kg)
export const FTP_MIN_WKG = 2.5
export const FTP_MAX_WKG = 6.0

// Durées pour FTP estimation
export const FTP_MIN_EFFORT_S = 20 * 60      // 20 minutes
export const FTP_MAX_EFFORT_S = 3 * 3600     // 3 heures
