/**
 * Hook React pour estimer le Training Load des séances fictives
 * Simplifie l'intégration du module dans les composants React
 */

import { useState, useCallback, useEffect } from "react"
import {
  estimateFictitioussSessionTrainingLoad,
  isAutoEstimatableSport,
  type FictitioussSessionInput,
  type FictitioussSessionEstimate,
} from "../utils/fictitiousSessionTrainingLoad"
import type { ActivitySummary } from "../types/Activity"

/**
 * État du hook
 */
export interface UseFictitioussSessionEstimateState {
  estimate: FictitioussSessionEstimate | null
  isLoading: boolean
  error: Error | null
  isSupported: boolean
}

/**
 * Options du hook
 */
export interface UseFictitioussSessionEstimateOptions {
  /**
   * Si true, déclenche l'estimation automatiquement
   * quand input ou activities changent
   */
  autoEstimate?: boolean
  /**
   * Date de référence pour la pondération temporelle
   * Défaut: new Date()
   */
  referenceDate?: Date
}

/**
 * Hook pour estimer le TL d'une séance fictive
 *
 * Cas d'utilisation:
 * - Formulaire de création de séance fictive
 * - Affichage du TL estimé en temps réel
 * - Validation du TL avant sauvegarde
 *
 * @param sessionInput - Paramètres de la séance fictive
 * @param activities - Historique des activités de l'utilisateur
 * @param options - Options du hook
 * @returns État et fonctions d'interaction
 *
 * @example
 * const { estimate, error, isSupported, estimateTL } = useFictitioussSessionEstimate(
 *   { sport: "Cyclisme", distanceKm: 35, durationMin: 90, elevationGainM: 600 },
 *   activities,
 *   { autoEstimate: true }
 * )
 *
 * if (!isSupported) return <p>TL manuel requis pour ce sport</p>
 * if (error) return <p>Erreur: {error.message}</p>
 * if (estimate) return <p>TL estimé: {estimate.estimatedTL}</p>
 */
export function useFictitioussSessionEstimate(
  sessionInput: FictitioussSessionInput | null,
  activities: ActivitySummary[],
  options: UseFictitioussSessionEstimateOptions = {}
): UseFictitioussSessionEstimateState & {
  estimateTL: () => Promise<FictitioussSessionEstimate>
  reset: () => void
} {
  const { autoEstimate = false, referenceDate = new Date() } = options

  const [state, setState] = useState<UseFictitioussSessionEstimateState>({
    estimate: null,
    isLoading: false,
    error: null,
    isSupported: sessionInput ? isAutoEstimatableSport(sessionInput.sport) : false,
  })

  // Fonction d'estimation
  const estimateTL = useCallback(async () => {
    if (!sessionInput) {
      const error = new Error("Session input is null")
      setState((s) => ({ ...s, error, isLoading: false }))
      throw error
    }

    if (!isAutoEstimatableSport(sessionInput.sport)) {
      const error = new Error(
        `Sport "${sessionInput.sport}" n'est pas supporté pour l'estimation automatique`
      )
      setState((s) => ({ ...s, error, isLoading: false, isSupported: false }))
      throw error
    }

    setState((s) => ({ ...s, isLoading: true, error: null }))

    try {
      const estimate = estimateFictitioussSessionTrainingLoad(
        sessionInput,
        activities,
        referenceDate
      )

      setState((s) => ({
        ...s,
        estimate,
        isLoading: false,
        error: null,
        isSupported: true,
      }))

      return estimate
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setState((s) => ({ ...s, error, isLoading: false }))
      throw error
    }
  }, [sessionInput, activities, referenceDate])

  // Fonction de réinitialisation
  const reset = useCallback(() => {
    setState({
      estimate: null,
      isLoading: false,
      error: null,
      isSupported: sessionInput ? isAutoEstimatableSport(sessionInput.sport) : false,
    })
  }, [sessionInput])

  // Auto-estimation si demandé
  useEffect(() => {
    if (autoEstimate && sessionInput && isAutoEstimatableSport(sessionInput.sport)) {
      estimateTL()
    }
  }, [autoEstimate, sessionInput, estimateTL])

  return { ...state, estimateTL, reset }
}

/**
 * Hook simplifié pour juste vérifier la compatibilité d'un sport
 * et obtenir une estimation basique
 *
 * @example
 * const { isSupported, getTLinfo } = useFictitioussSessionCompaibility("Cyclisme")
 *
 * if (!isSupported) return <p>Sport non supporté</p>
 */
export function useFictitioussSessionCompaibility(sport: string | null) {
  const isSupported = sport ? isAutoEstimatableSport(sport) : false

  return {
    isSupported,
    message: isSupported
      ? "Estimation automatique du TL"
      : "TL doit être fourni manuellement",
    getTLinfo: () => ({
      isSupported,
      sport: sport || "unknown",
    }),
  }
}
