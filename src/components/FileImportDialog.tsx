import { useState, useRef } from "react"
import { parseGPXFile, parseFITFile } from "../services/fileImportParser"
import type { ActivityDetails, SportType } from "../types/Activity"

interface FileImportProps {
  onImportSuccess: (activity: ActivityDetails) => void
  userId: string
}

export function FileImportDialog({ onImportSuccess, userId }: FileImportProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedActivity, setParsedActivity] = useState<ActivityDetails | null>(null)
  const [selectedSport, setSelectedSport] = useState<SportType | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)

    try {
      const fileExtension = file.name.split(".").pop()?.toLowerCase()

      let activity: ActivityDetails

      if (fileExtension === "gpx") {
        activity = await parseGPXFile(file)
      } else if (fileExtension === "fit") {
        activity = await parseFITFile(file)
      } else {
        throw new Error(
          `Format de fichier non supporté: .${fileExtension}. Utilisez .gpx ou .fit`
        )
      }

      // Ajouter l'ID utilisateur
      activity.userId = userId

      // Vérifier les données minimales
      if (activity.distance_m < 100) {
        throw new Error(
          "L'activité doit contenir au moins 100 mètres de distance"
        )
      }

      if (activity.duration_s < 60) {
        throw new Error(
          "L'activité doit durer au moins 1 minute"
        )
      }

      // Sauvegarder l'activité parsée et afficher le sélecteur de sport
      setParsedActivity(activity)
      setSelectedSport(activity.sport)

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de l'import du fichier"
      setError(message)
      console.error("Erreur d'import:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = () => {
    if (!parsedActivity || !selectedSport) return

    // Marquer que le sport a été choisi manuellement si différent du sport détecté
    const activityToImport: ActivityDetails = {
      ...parsedActivity,
      sport: selectedSport,
      manualSportOverride: selectedSport !== parsedActivity.sport,
    }

    onImportSuccess(activityToImport)
    setParsedActivity(null)
    setSelectedSport(null)
    setIsOpen(false)
  }

  const handleClose = () => {
    setIsOpen(false)
    setParsedActivity(null)
    setSelectedSport(null)
    setError(null)
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: "8px 16px",
          backgroundColor: "#10b981",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "500",
        }}
        disabled={isLoading}
      >
        {isLoading ? "Import en cours..." : "📁 Importer GPX/FIT"}
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={handleClose}
        >
          <div
            style={{
              backgroundColor: "#0f1726",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "500px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {!parsedActivity ? (
              <>
                <h2>Importer une activité</h2>

                <p style={{ color: "#666", marginBottom: "16px" }}>
                  Sélectionnez un fichier GPX ou FIT pour importer votre activité.
                  Elle s'affichera ensuite dans votre liste d'activités.
                </p>

                <div
                  style={{
                    border: "2px dashed #ccc",
                    borderRadius: "8px",
                    padding: "32px",
                    textAlign: "center",
                    marginBottom: "16px",
                    backgroundColor: "#0f1726",
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".gpx,.fit"
                    style={{ display: "none" }}
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "#3b82f6",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      fontSize: "16px",
                      fontWeight: "500",
                      opacity: isLoading ? 0.6 : 1,
                    }}
                    disabled={isLoading}
                  >
                    Choisir un fichier
                  </button>
                  <p style={{ fontSize: "12px", color: "#999", marginTop: "8px" }}>
                    ou glissez-déposez un fichier
                  </p>
                </div>

                {error && (
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "#fee",
                      color: "#c33",
                      borderRadius: "4px",
                      marginBottom: "16px",
                      fontSize: "14px",
                    }}
                  >
                    ❌ {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={handleClose}
                    style={{
                      flex: 1,
                      padding: "8px",
                      backgroundColor: "#e5e7eb",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                    disabled={isLoading}
                  >
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Confirmer la catégorie de l'activité</h2>

                <div style={{ marginBottom: "20px" }}>
                  <p style={{ color: "#666", fontSize: "14px", marginBottom: "8px" }}>
                    <strong>Activité détectée:</strong>
                  </p>
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "#0f1726",
                      borderRadius: "4px",
                      marginBottom: "16px",
                      border:"1px solid rgb(255,255,255)"
                    }}
                  >
                    <p style={{ margin: "0 0 4px 0" }}>
                      <strong>Distance:</strong> {(parsedActivity.distance_m / 1000).toFixed(2)} km
                    </p>
                    <p style={{ margin: "0 0 4px 0" }}>
                      <strong>Durée:</strong> {(parsedActivity.duration_s / 60).toFixed(2)} min
                    </p>
                    <p style={{ margin: "0" }}>
                      <strong>Sport détecté:</strong> {parsedActivity.sport}
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label
                    htmlFor="sport-select"
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "500",
                      color: "#333",
                    }}
                  >
                    Sélectionnez le sport:
                  </label>
                  <select
                    id="sport-select"
                    value={selectedSport || ""}
                    onChange={(e) => setSelectedSport(e.target.value as SportType)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      background:"#0f1726",
                    }}
                  >
                    <option value="">-- Choisir un sport --</option>
                    <option value="Cyclisme">Cyclisme</option>
                    <option value="Course">Course</option>
                    <option value="Marche">Marche</option>
                    <option value="Randonnée">Randonnée</option>
                    <option value="Autre">Autre</option>
                  </select>
                  {selectedSport !== parsedActivity.sport && selectedSport && (
                    <p style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                      ℹ️ Sport différent de la détection automatique
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      setParsedActivity(null)
                      setSelectedSport(null)
                      setError(null)
                    }}
                    style={{
                      flex: 1,
                      padding: "8px",
                      backgroundColor: "#e5e7eb",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Retour
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!selectedSport}
                    style={{
                      flex: 1,
                      padding: "8px",
                      backgroundColor: selectedSport ? "#10b981" : "#ccc",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: selectedSport ? "pointer" : "not-allowed",
                      fontWeight: "500",
                    }}
                  >
                    Confirmer l'import
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
