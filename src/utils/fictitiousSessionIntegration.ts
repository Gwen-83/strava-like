/**
 * Intégration du module d'estimation de TL avec Firebase et les services existants
 * Montre comment l'utiliser dans un contexte réel d'application
 */

import { estimateFictitioussSessionTrainingLoad, isAutoEstimatableSport, type FictitioussSessionInput } from "./fictitiousSessionTrainingLoad"
import type { ActivitySummary } from "../types/Activity"

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

/**
 * Résultat de la création d'une séance fictive
 */
export interface CreateFictitioussSessionResult {
  success: boolean
  sessionId?: string
  trainingLoad?: number
  confidenceLevel?: "HIGH" | "MEDIUM" | "LOW"
  error?: string
}

/**
 * Données d'une séance fictive à sauvegarder
 */
export interface FictitioussSessionData extends FictitioussSessionInput {
  userId: string
  trainingLoad: number
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
  createdAt: Date
  startDate?: Date
  name?: string
  notes?: string
  isFictitious: true
}

// ============================================================================
// SERVICE D'INTÉGRATION
// ============================================================================

/**
 * Service pour gérer les séances fictives avec estimation de TL
 *
 * À utiliser dans les pages/composants pour créer des séances fictives
 * avec TL automatiquement estimé
 */
export class FictitioussSessionService {
  /**
   * Crée une séance fictive avec estimation automatique du TL
   *
   * @param input - Paramètres de la séance (sport, distance, durée, dénivelé)
   * @param userId - ID de l'utilisateur
   * @param userActivities - Historique des activités de l'utilisateur
   * @param saveFn - Fonction pour sauvegarder la séance (ex: Firebase)
   * @returns Résultat avec TL estimé et ID de la session
   */
  static async createFictitioussSession(
    input: FictitioussSessionInput,
    userId: string,
    userActivities: ActivitySummary[],
    saveFn?: (session: FictitioussSessionData) => Promise<string>
  ): Promise<CreateFictitioussSessionResult> {
    try {
      // Valider que le sport est supporté
      if (!isAutoEstimatableSport(input.sport)) {
        return {
          success: false,
          error: `Sport "${input.sport}" n'est pas supporté pour l'estimation automatique. Veuillez entrer le TL manuellement.`,
        }
      }

      // Estimer le TL
      const estimate = estimateFictitioussSessionTrainingLoad(input, userActivities)

      // Préparer les données de la séance
      const sessionData: FictitioussSessionData = {
        ...input,
        userId,
        trainingLoad: estimate.estimatedTL,
        confidenceLevel: estimate.confidenceLevel,
        createdAt: new Date(),
        startDate: new Date(),
        isFictitious: true,
      }

      // Sauvegarder si une fonction est fournie
      let sessionId: string | undefined
      if (saveFn) {
        sessionId = await saveFn(sessionData)
      }

      return {
        success: true,
        sessionId,
        trainingLoad: estimate.estimatedTL,
        confidenceLevel: estimate.confidenceLevel,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erreur inconnue lors de la création de la séance",
      }
    }
  }

  /**
   * Estime le TL pour plusieurs séances fictives en batch
   */
  static estimateBatch(
    sessions: FictitioussSessionInput[],
    userActivities: ActivitySummary[]
  ) {
    return sessions.map((session) => {
      try {
        const estimate = estimateFictitioussSessionTrainingLoad(session, userActivities)
        return {
          session,
          trainingLoad: estimate.estimatedTL,
          confidenceLevel: estimate.confidenceLevel,
          error: null,
        }
      } catch (error) {
        return {
          session,
          trainingLoad: null,
          confidenceLevel: null,
          error: error instanceof Error ? error.message : "Erreur d'estimation",
        }
      }
    })
  }

  /**
   * Valide les paramètres d'entrée d'une séance fictive
   */
  static validateInput(input: Partial<FictitioussSessionInput>): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!input.sport) {
      errors.push("Sport est requis")
    } else if (!isAutoEstimatableSport(input.sport)) {
      errors.push(`Sport "${input.sport}" n'est pas supporté`)
    }

    if (!input.distanceKm || input.distanceKm <= 0) {
      errors.push("Distance doit être > 0")
    }

    if (!input.durationMin || input.durationMin <= 0) {
      errors.push("Durée doit être > 0")
    }

    if (input.elevationGainM === undefined || input.elevationGainM < 0) {
      errors.push("Dénivelé doit être >= 0")
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

// ============================================================================
// UTILITAIRES POUR LES PAGES/COMPOSANTS
// ============================================================================

/**
 * Hook ou fonction utilitaire pour formatter le résultat d'estimation
 * pour l'affichage à l'utilisateur
 */
export function formatEstimationResult(
  trainingLoad: number,
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
): string {
  const confidenceEmoji = {
    HIGH: "✅",
    MEDIUM: "⚠️",
    LOW: "❓",
  }

  const confidenceText = {
    HIGH: "Haute",
    MEDIUM: "Moyenne",
    LOW: "Basse",
  }

  return `${confidenceEmoji[confidenceLevel]} TL estimé: ${trainingLoad.toFixed(0)} (Confiance: ${confidenceText[confidenceLevel]})`
}

/**
 * Suggestion de message pour l'utilisateur selon la confiance
 */
export function getConfidenceMessage(confidenceLevel: "HIGH" | "MEDIUM" | "LOW"): string {
  switch (confidenceLevel) {
    case "HIGH":
      return "Estimation basée sur suffisamment de données. Hautement fiable."
    case "MEDIUM":
      return "Estimation raisonnée. Collectez plus de données pour améliorer la précision."
    case "LOW":
      return "Estimation basée sur peu de données. À interpréter avec prudence. Coefficients par défaut utilisés."
  }
}

// ============================================================================
// EXEMPLE D'INTÉGRATION DANS UN COMPOSANT
// ============================================================================

/**
 * Exemple d'utilisation dans un composant React
 *
 * @example
 * import { FictitioussSessionService } from "../services/fictitiousSessionIntegration"
 *
 * export function MySimulationPage() {
 *   const { activities } = useUserActivities()
 *   const { user } = useAuth()
 *   const [isCreating, setIsCreating] = useState(false)
 *
 *   const handleCreateSession = async (formData) => {
 *     setIsCreating(true)
 *     try {
 *       const result = await FictitioussSessionService.createFictitioussSession(
 *         {
 *           sport: formData.sport,
 *           distanceKm: formData.distance,
 *           durationMin: formData.duration,
 *           elevationGainM: formData.elevation,
 *         },
 *         user.id,
 *         activities,
 *         async (session) => {
 *           // Utiliser le service Firebase existant
 *           return saveFictitiousSessionToFirebase(session)
 *         }
 *       )
 *
 *       if (result.success) {
 *         showNotification(
 *           `✅ Séance créée: TL = ${result.trainingLoad?.toFixed(0)}`
 *         )
 *       } else {
 *         showNotification(`❌ ${result.error}`, "error")
 *       }
 *     } finally {
 *       setIsCreating(false)
 *     }
 *   }
 *
 *   return (
 *     <div>
 *       <SimulateSessionForm
 *         activities={activities}
 *         onSubmit={handleCreateSession}
 *         isLoading={isCreating}
 *       />
 *     </div>
 *   )
 * }
 */

// ============================================================================
// STATISTIQUES SUR LES SÉANCES FICTIVES
// ============================================================================

/**
 * Calcule les statistiques sur les séances fictives
 */
export function calculateFictitioussSessionsStats(sessions: FictitioussSessionData[]) {
  if (sessions.length === 0) {
    return {
      count: 0,
      totalTL: 0,
      averageTL: 0,
      totalDistance: 0,
      totalDuration: 0,
      totalElevation: 0,
      byConfidenceLevel: { HIGH: 0, MEDIUM: 0, LOW: 0 },
    }
  }

  const totalTL = sessions.reduce((sum, s) => sum + s.trainingLoad, 0)
  const totalDistance = sessions.reduce((sum, s) => sum + s.distanceKm, 0)
  const totalDuration = sessions.reduce((sum, s) => sum + s.durationMin, 0)
  const totalElevation = sessions.reduce((sum, s) => sum + s.elevationGainM, 0)

  const byConfidenceLevel = {
    HIGH: sessions.filter((s) => s.confidenceLevel === "HIGH").length,
    MEDIUM: sessions.filter((s) => s.confidenceLevel === "MEDIUM").length,
    LOW: sessions.filter((s) => s.confidenceLevel === "LOW").length,
  }

  return {
    count: sessions.length,
    totalTL,
    averageTL: totalTL / sessions.length,
    totalDistance,
    totalDuration,
    totalElevation,
    byConfidenceLevel,
  }
}

// ============================================================================
// CONVERSION: SÉANCE FICTIVE → ACTIVITÉ
// ============================================================================

/**
 * Convertit une séance fictive en activité pour l'historique
 * Utile pour mélanger les activités réelles et fictives
 */
export function convertFictitioussSessionToActivity(
  session: FictitioussSessionData
): ActivitySummary {
  return {
    userId: session.userId,
    sport: session.sport,
    startDate: session.startDate || new Date(),
    duration_s: Math.round(session.durationMin * 60),
    distance_m: Math.round(session.distanceKm * 1000),
    elevation_m: session.elevationGainM,
    load: session.trainingLoad,
    source: "fictitious",
    has_gps: false,
    has_streams: false,
    has_power: false,
    createdAt: session.createdAt,
  }
}

/**
 * Filtre les activités pour exclure les séances fictives
 */
export function filterRealActivitiesOnly(activities: ActivitySummary[]): ActivitySummary[] {
  return activities.filter((a) => a.source !== "fictitious")
}

/**
 * Filtre les activités pour exclure les séances fictives lors du calcul des coefficients
 * (optionnel - selon la stratégie souhaitée)
 */
export function shouldIncludeInCoefficientCalculation(
  activity: ActivitySummary,
  useFictitioussActivities: boolean = false
): boolean {
  if (!useFictitioussActivities && activity.source === "fictitious") {
    return false
  }
  return true
}
