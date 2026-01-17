/**
 * Composant exemple : Simulateur de séance fictive avec estimation de TL
 * Montre comment intégrer le module d'estimation de TL dans une interface
 */

import { useState } from "react"
import { useFictitioussSessionEstimate, useFictitioussSessionCompaibility } from "../hooks/useFictitioussSessionTrainingLoad"
import { isAutoEstimatableSport, type FictitioussSessionInput } from "../utils/fictitiousSessionTrainingLoad"
import type { ActivitySummary } from "../types/Activity"

interface SimulateSessionFormProps {
  /**
   * Historique des activités de l'utilisateur
   */
  activities: ActivitySummary[]
  /**
   * Callback quand la séance est estimée et validée
   */
  onSessionEstimated?: (estimate: any) => void
  /**
   * Préremplir les champs
   */
  initialValues?: Partial<FictitioussSessionInput>
}

/**
 * Composant de formulaire pour créer une séance fictive
 * avec estimation automatique du TL
 */
export function SimulateSessionForm({
  activities,
  onSessionEstimated,
  initialValues = {},
}: SimulateSessionFormProps) {
  // État du formulaire
  const [formData, setFormData] = useState<FictitioussSessionInput>({
    sport: initialValues.sport || "Cyclisme",
    distanceKm: initialValues.distanceKm || 30,
    durationMin: initialValues.durationMin || 90,
    elevationGainM: initialValues.elevationGainM || 500,
  })

  // État de l'estimation
  const { estimate, error, isLoading, isSupported, estimateTL } =
    useFictitioussSessionEstimate(formData, activities, {
      autoEstimate: true,
    })

  // Vérification de compatibilité
  const { message } = useFictitioussSessionCompaibility(formData.sport)

  // Handlers
  const handleSportChange = (newSport: string) => {
    setFormData((prev) => ({ ...prev, sport: newSport as any }))
  }

  const handleDistanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0
    setFormData((prev) => ({ ...prev, distanceKm: Math.max(0, value) }))
  }

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0
    setFormData((prev) => ({ ...prev, durationMin: Math.max(0, value) }))
  }

  const handleElevationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0
    setFormData((prev) => ({ ...prev, elevationGainM: Math.max(0, value) }))
  }

  const handleValidateAndSave = () => {
    if (!estimate) {
      alert("Veuillez d'abord estimer le TL")
      return
    }

    if (onSessionEstimated) {
      onSessionEstimated({
        ...formData,
        trainingLoad: estimate.estimatedTL,
        confidenceLevel: estimate.confidenceLevel,
      })
    }

    alert(`✅ Séance estimée: TL = ${estimate.estimatedTL.toFixed(0)} (${estimate.confidenceLevel})`)
  }

  return (
    <div style={styles.container}>
      <h2>Créer une séance fictive</h2>

      {/* Sélection du sport */}
      <div style={styles.field}>
        <label htmlFor="sport">Sport :</label>
        <select
          id="sport"
          value={formData.sport}
          onChange={(e) => handleSportChange(e.target.value)}
          style={styles.select}
        >
          <option value="Cyclisme">Cyclisme</option>
          <option value="Course">Course à pied</option>
          <option value="Marche">Marche (TL manuel)</option>
          <option value="Randonnée">Randonnée (TL manuel)</option>
        </select>
        <small style={styles.hint}>{message}</small>
      </div>

      {/* Distance */}
      <div style={styles.field}>
        <label htmlFor="distance">Distance (km) :</label>
        <input
          id="distance"
          type="number"
          min="0"
          step="0.1"
          value={formData.distanceKm}
          onChange={handleDistanceChange}
          style={styles.input}
        />
      </div>

      {/* Durée */}
      <div style={styles.field}>
        <label htmlFor="duration">Durée (minutes) :</label>
        <input
          id="duration"
          type="number"
          min="0"
          step="1"
          value={formData.durationMin}
          onChange={handleDurationChange}
          style={styles.input}
        />
      </div>

      {/* Dénivelé */}
      <div style={styles.field}>
        <label htmlFor="elevation">Dénivelé positif (m) :</label>
        <input
          id="elevation"
          type="number"
          min="0"
          step="10"
          value={formData.elevationGainM}
          onChange={handleElevationChange}
          style={styles.input}
        />
      </div>

      {/* Affichage du statut d'estimation */}
      <div style={styles.estimationStatus}>
        {isLoading && <p style={styles.loading}>📊 Estimation en cours...</p>}

        {error && (
          <div style={styles.errorBox}>
            <p style={styles.error}>❌ Erreur: {error.message}</p>
          </div>
        )}

        {estimate && !error && (
          <div style={styles.resultBox}>
            <div style={styles.tlResult}>
              <h3>Résultat de l'estimation</h3>
              <div style={styles.tlValue}>
                <strong>TL estimé : {estimate.estimatedTL.toFixed(0)}</strong>
              </div>

              <div style={styles.confidenceLevel}>
                Confiance: <strong>{estimate.confidenceLevel}</strong>
                {estimate.debug && (
                  <small> ({estimate.debug.message})</small>
                )}
              </div>

              <div style={styles.contributions}>
                <h4>Contributions :</h4>
                <ul>
                  <li>
                    Distance ({formData.distanceKm} km):{" "}
                    <strong>{estimate.contributions.distance.toFixed(1)}</strong> TL
                  </li>
                  <li>
                    Durée ({formData.durationMin} min):{" "}
                    <strong>{estimate.contributions.duration.toFixed(1)}</strong> TL
                  </li>
                  <li>
                    Dénivelé ({formData.elevationGainM} m):{" "}
                    <strong>{estimate.contributions.elevation.toFixed(1)}</strong> TL
                  </li>
                  <li>
                    Constant: <strong>{estimate.contributions.constant.toFixed(1)}</strong> TL
                  </li>
                </ul>
              </div>

              <div style={styles.coefficients}>
                <h4>Coefficients du modèle :</h4>
                <ul>
                  <li>Distance: {estimate.coefficients.a.toFixed(2)} TL/km</li>
                  <li>Durée: {estimate.coefficients.b.toFixed(3)} TL/min</li>
                  <li>Dénivelé: {estimate.coefficients.c.toFixed(4)} TL/m</li>
                  <li>Constant: {estimate.coefficients.d.toFixed(1)}</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {!isSupported && isAutoEstimatableSport(formData.sport) === false && (
          <div style={styles.warningBox}>
            <p style={styles.warning}>
              ⚠️ Le sport "{formData.sport}" ne supporte pas l'estimation automatique.
              <br />
              Veuillez entrer le TL manuellement.
            </p>
          </div>
        )}
      </div>

      {/* Boutons d'action */}
      <div style={styles.actions}>
        <button
          onClick={() => {
            estimateTL()
          }}
          disabled={isLoading}
          style={styles.button}
        >
          {isLoading ? "Estimation..." : "Estimer TL"}
        </button>

        <button
          onClick={handleValidateAndSave}
          disabled={!estimate || isLoading}
          style={{ ...styles.button, ...styles.primaryButton }}
        >
          Valider et sauvegarder
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    padding: "20px",
    maxWidth: "600px",
    margin: "0 auto",
    fontFamily: "Arial, sans-serif",
  } as React.CSSProperties,

  field: {
    marginBottom: "16px",
  } as React.CSSProperties,

  label: {
    display: "block",
    marginBottom: "4px",
    fontWeight: "bold" as const,
  } as React.CSSProperties,

  input: {
    width: "100%",
    padding: "8px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  select: {
    width: "100%",
    padding: "8px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  hint: {
    display: "block",
    marginTop: "4px",
    fontSize: "12px",
    color: "#666",
  } as React.CSSProperties,

  estimationStatus: {
    marginTop: "24px",
    marginBottom: "16px",
  } as React.CSSProperties,

  loading: {
    textAlign: "center" as const,
    color: "#0066cc",
    fontStyle: "italic" as const,
  } as React.CSSProperties,

  errorBox: {
    padding: "12px",
    backgroundColor: "#ffe6e6",
    border: "1px solid #ff6666",
    borderRadius: "4px",
  } as React.CSSProperties,

  error: {
    color: "#cc0000",
    margin: 0,
  } as React.CSSProperties,

  warningBox: {
    padding: "12px",
    backgroundColor: "#fff3cd",
    border: "1px solid #ffc107",
    borderRadius: "4px",
  } as React.CSSProperties,

  warning: {
    color: "#856404",
    margin: 0,
  } as React.CSSProperties,

  resultBox: {
    padding: "16px",
    backgroundColor: "#e6f2ff",
    border: "1px solid #0066cc",
    borderRadius: "4px",
  } as React.CSSProperties,

  tlResult: {
    marginBottom: "0",
  } as React.CSSProperties,

  tlValue: {
    fontSize: "18px",
    fontWeight: "bold" as const,
    color: "#003d99",
    marginBottom: "8px",
  } as React.CSSProperties,

  confidenceLevel: {
    fontSize: "14px",
    marginBottom: "12px",
  } as React.CSSProperties,

  contributions: {
    marginBottom: "12px",
  } as React.CSSProperties,

  coefficients: {
    marginTop: "12px",
  } as React.CSSProperties,

  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
  } as React.CSSProperties,

  button: {
    padding: "10px 16px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    backgroundColor: "#f5f5f5",
    cursor: "pointer",
    fontWeight: "500" as const,
  } as React.CSSProperties,

  primaryButton: {
    backgroundColor: "#0066cc",
    color: "white",
    border: "none",
  } as React.CSSProperties,
}
