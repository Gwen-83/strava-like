/**
 * Component for creating fictional training sessions
 * Allows users to input sessions and simulate their impact
 * Supports automatic TL estimation for Cyclisme and Course
 */

import { useState } from "react";
import type { FictionalSession } from "../utils/banisterSimulation";
import {
  estimateFictitioussSessionTrainingLoad,
  isAutoEstimatableSport,
  type FictitioussSessionInput,
  type FictitioussSessionEstimate,
} from "../utils/fictitiousSessionTrainingLoad";
import type { ActivitySummary } from "../types/Activity";

interface SimulationInputProps {
  onSessionsChange: (sessions: FictionalSession[]) => void;
  activities?: ActivitySummary[]; // Optional: activities for TL estimation
}

export function SimulationInput({ onSessionsChange, activities = [] }: SimulationInputProps) {
  const [sessions, setSessions] = useState<FictionalSession[]>([]);
  const [showForm, setShowForm] = useState(false);

  // State for TL estimation (manual vs auto)
  const [estimationMode, setEstimationMode] = useState<"manual" | "auto">("manual");
  const [tlEstimate, setTlEstimate] = useState<FictitioussSessionEstimate | null>(null);

  // Form state for new session
  const [newSession, setNewSession] = useState<Partial<FictionalSession>>({
    dayOffset: 0,
    sport: "cyclisme",
    type: "endurance",
    trainingLoad: 100,
  });

  // Form state for auto-estimation (distance, duration, elevation)
  const [autoEstimationInput, setAutoEstimationInput] = useState({
    distanceKm: 30,
    durationMin: 90,
    elevationGainM: 500,
  });

  const handleAddSession = () => {
    if (
      newSession.dayOffset !== undefined &&
      newSession.sport &&
      newSession.type &&
      newSession.trainingLoad !== undefined &&
      newSession.trainingLoad > 0
    ) {
      const session: FictionalSession = {
        dayOffset: newSession.dayOffset,
        sport: newSession.sport as "cyclisme" | "course" | "autre",
        type: newSession.type as any,
        trainingLoad: newSession.trainingLoad,
        description: newSession.description,
      };

      const updatedSessions = [...sessions, session];
      setSessions(updatedSessions);
      onSessionsChange(updatedSessions);

      // Reset form
      setNewSession({
        dayOffset: 0,
        sport: "cyclisme",
        type: "endurance",
        trainingLoad: 100,
      });
      setEstimationMode("manual");
      setTlEstimate(null);
    }
  };

  // Auto-estimate TL from distance, duration, elevation
  const handleEstimateTL = () => {
    if (newSession.sport !== "cyclisme" && newSession.sport !== "course") {
      return;
    }

    try {
      const estimate = estimateFictitioussSessionTrainingLoad(
        {
          sport: newSession.sport === "cyclisme" ? "Cyclisme" : "Course",
          distanceKm: autoEstimationInput.distanceKm,
          durationMin: autoEstimationInput.durationMin,
          elevationGainM: autoEstimationInput.elevationGainM,
        } as FictitioussSessionInput,
        activities
      );

      setTlEstimate(estimate);
      setNewSession({
        ...newSession,
        trainingLoad: Math.round(estimate.estimatedTL),
      });
    } catch (error) {
      console.error("Erreur lors de l'estimation du TL:", error);
    }
  };

  const handleRemoveSession = (index: number) => {
    const updatedSessions = sessions.filter((_, i) => i !== index);
    setSessions(updatedSessions);
    onSessionsChange(updatedSessions);
  };

  const handleClearAll = () => {
    setSessions([]);
    onSessionsChange([]);
  };

  const sportEmoji = (sport: string) => {
    switch (sport) {
      case "cyclisme":
        return "🚴";
      case "course":
        return "🏃";
      default:
        return "⚽";
    }
  };

  const typeColor = (type: string) => {
    const colors: Record<string, string> = {
      recuperation: "#4caf50",
      endurance: "#2196f3",
      seuil: "#ff9800",
      vo2max: "#f44336",
      longue_distance: "#9c27b0",
    };
    return colors[type] || "#999";
  };

  return (
    <div className="simulation-input">
      <div style={{ marginBottom: "16px" }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "12px 16px",
            background: "#2196f3",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          {showForm ? "▼ Masquer formulaire" : "▶ Ajouter une séance fictive"}
        </button>
      </div>

      {showForm && (
        <div
          style={{
            background: "#0f1726",
            padding: "16px",
            borderRadius: "6px",
            marginBottom: "16px",
            border: "1px solid #ddd",
          }}
        >
          {/* Mode selector: Manual vs Auto */}
          <div style={{ marginBottom: "16px", display: "flex", gap: "12px" }}>
            <button
              onClick={() => {
                setEstimationMode("manual");
                setTlEstimate(null);
              }}
              style={{
                flex: 1,
                padding: "10px",
                background: estimationMode === "manual" ? "#2196f3" : "#333",
                color: "white",
                border: "1px solid #555",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              📊 Saisir le TL manuellement
            </button>
            <button
              onClick={() => {
                setEstimationMode("auto");
                setTlEstimate(null);
              }}
              disabled={newSession.sport !== "cyclisme" && newSession.sport !== "course"}
              style={{
                flex: 1,
                padding: "10px",
                background:
                  estimationMode === "auto" && (newSession.sport === "cyclisme" || newSession.sport === "course")
                    ? "#4caf50"
                    : "#333",
                color: "white",
                border: "1px solid #555",
                borderRadius: "4px",
                cursor: newSession.sport === "cyclisme" || newSession.sport === "course" ? "pointer" : "not-allowed",
                fontSize: "13px",
                fontWeight: "600",
                opacity: newSession.sport === "cyclisme" || newSession.sport === "course" ? 1 : 0.5,
              }}
            >
              🤖 Estimer automatiquement
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            {/* Day Offset */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color:"#ffffffc6" }}>
                Dans combien de jours ?
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={newSession.dayOffset ?? 0}
                onChange={(e) =>
                  setNewSession({
                    ...newSession,
                    dayOffset: parseInt(e.target.value),
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              />
            </div>

            {/* Sport */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color:"#ffffffc6" }}>
                Sport
              </label>
              <select
                value={newSession.sport ?? "cyclisme"}
                onChange={(e) => {
                  const sport = e.target.value as "cyclisme" | "course" | "autre";
                  setNewSession({
                    ...newSession,
                    sport,
                  });
                  if (!isAutoEstimatableSport(sport === "cyclisme" ? "Cyclisme" : sport === "course" ? "Course" : "Autre")) {
                    setEstimationMode("manual");
                    setTlEstimate(null);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              >
                <option value="cyclisme">🚴 Cyclisme</option>
                <option value="course">🏃 Course</option>
                <option value="autre">⚽ Autre</option>
              </select>
            </div>

            {/* Type */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color:"#ffffffc6" }}>
                Type d'entraînement
              </label>
              <select
                value={newSession.type ?? "endurance"}
                onChange={(e) =>
                  setNewSession({
                    ...newSession,
                    type: e.target.value as any,
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              >
                <option value="recuperation">🟢 Récupération</option>
                <option value="endurance">🔵 Endurance</option>
                <option value="seuil">🟠 Seuil</option>
                <option value="vo2max">🔴 VO2max</option>
                <option value="longue_distance">🟣 Longue distance</option>
              </select>
            </div>

            {/* Training Load - Manual or Auto */}
            {estimationMode === "manual" ? (
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color:"#ffffffc6" }}>
                  Training Load
                </label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={newSession.trainingLoad ?? 100}
                  onChange={(e) =>
                    setNewSession({
                      ...newSession,
                      trainingLoad: parseInt(e.target.value),
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>
            ) : (
              <>
                {/* Auto-estimation fields: Distance */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color:"#ffffffc6" }}>
                    Distance (km)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={autoEstimationInput.distanceKm}
                    onChange={(e) =>
                      setAutoEstimationInput({
                        ...autoEstimationInput,
                        distanceKm: parseFloat(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>

                {/* Duration */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color:"#ffffffc6" }}>
                    Durée (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={autoEstimationInput.durationMin}
                    onChange={(e) =>
                      setAutoEstimationInput({
                        ...autoEstimationInput,
                        durationMin: parseInt(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>

                {/* Elevation */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color:"#ffffffc6" }}>
                    Dénivelé (m)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={autoEstimationInput.elevationGainM}
                    onChange={(e) =>
                      setAutoEstimationInput({
                        ...autoEstimationInput,
                        elevationGainM: parseInt(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color:"#ffffffc6" }}>
              Description (optionnel)
            </label>
            <input
              type="text"
              placeholder="Ex: Séance de seuil au lac..."
              value={newSession.description ?? ""}
              onChange={(e) =>
                setNewSession({
                  ...newSession,
                  description: e.target.value,
                })
              }
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>

          {/* TL Estimation Result */}
          {estimationMode === "auto" && tlEstimate && (
            <div
              style={{
                background: "rgba(33, 150, 243, 0.1)",
                border: "1px solid #2196f3",
                borderRadius: "6px",
                padding: "12px",
                marginBottom: "16px",
              }}
            >
              <div style={{ fontSize: "13px", marginBottom: "8px" }}>
                <strong>📊 Estimation du Training Load</strong>
              </div>
              <div style={{ fontSize: "14px", fontWeight: "bold", color: "#2196f3", marginBottom: "8px" }}>
                TL estimé : {tlEstimate.estimatedTL.toFixed(0)}
              </div>
              <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "8px" }}>
                Confiance: <strong>{tlEstimate.confidenceLevel}</strong>
                {tlEstimate.confidenceLevel === "LOW" && (
                  <span style={{ color: "#ff9800", marginLeft: "8px" }}>
                    ⚠️ Peu de données, coefficients par défaut utilisés
                  </span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "#999" }}>
                <div>Distance: {tlEstimate.contributions.distance.toFixed(1)}</div>
                <div>Durée: {tlEstimate.contributions.duration.toFixed(1)}</div>
                <div>Dénivelé: {tlEstimate.contributions.elevation.toFixed(1)}</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "12px" }}>
            {estimationMode === "auto" && (
              <button
                onClick={handleEstimateTL}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "#ff9800",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                🤖 Estimer le TL
              </button>
            )}

            {/* Submit Button */}
            <button
              onClick={handleAddSession}
              disabled={!newSession.trainingLoad || newSession.trainingLoad <= 0}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: newSession.trainingLoad && newSession.trainingLoad > 0 ? "#4caf50" : "#999",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: newSession.trainingLoad && newSession.trainingLoad > 0 ? "pointer" : "not-allowed",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              ✅ Ajouter la séance
            </button>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {sessions.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h4 style={{ margin: 0 }}>
              📋 Séances programmées ({sessions.length})
            </h4>
            <button
              onClick={handleClearAll}
              style={{
                padding: "6px 12px",
                background: "#f44336",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Tout effacer
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "12px",
            }}
          >
            {sessions.map((session, index) => (
              <div
                key={index}
                style={{
                  background: "rgb(24, 40, 70)",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  padding: "12px",
                  position: "relative",
                }}
              >
                <button
                  onClick={() => handleRemoveSession(index)}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  ✕
                </button>

                <div style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#ffffffc6" }}>
                    Jour {session.dayOffset}
                  </span>
                </div>

                <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>{sportEmoji(session.sport)}</span>
                  <span
                    style={{
                      background: typeColor(session.type),
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    {session.type}
                  </span>
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "#2196f3" }}>
                    TL: {session.trainingLoad}
                  </span>
                </div>

                {session.description && (
                  <div style={{ fontSize: "12px", color: "#999", fontStyle: "italic" }}>
                    {session.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
