import { useMemo, useState } from "react"
import type { ActivitySummary } from "../types/Activity"
import {
  computeRefSpeeds,
  calculateActivityTrainingLoad,
} from "../utils/activityAnalytics"
import { useBanisterModel } from "../hooks/useBanisterModel"
import type { Activity } from "../types/BanisterModel"
import { aggregateDailyTrainingLoad, getFormStatus } from "../utils/banisterModel"
import { useSimulateBanisterImpact } from "../hooks/useSimulateBanisterImpact"
import { SimulationVisualizer } from "../components/SimulationVisualizer"
import { SimulationInput } from "../components/SimulationInput"
import type { FictionalSession } from "../utils/banisterSimulation"
import "../styles/banister.css"
import "../styles/banisterSimulation.css"

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function dayKey(d: Date) {
  const x = startOfDay(new Date(d))
  // Use local date, not UTC, to avoid timezone offset issues
  const year = x.getFullYear()
  const month = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("fr-FR", { weekday: "short", month: "short", day: "numeric" })
}

export default function BanisterPage({
  activities,
}: {
  activities: ActivitySummary[]
}) {
  const [expandedSection, setExpandedSection] = useState<"overview" | "metrics" | "advice" | "history" | "simulation">(
    "overview"
  )

  // State for fictional sessions simulation
  const [fictionalSessions, setFictionalSessions] = useState<FictionalSession[]>([])

  // Compute ref speeds for consistent calculation
  const REF_SPEEDS_KMH = useMemo(() => computeRefSpeeds(activities), [activities])

  // Prepare activities in Banister format
  const banisterActivities = useMemo((): Activity[] => {
    return activities.map((a) => ({
      date: dayKey(new Date(a.startDate)),
      trainingLoad: calculateActivityTrainingLoad(a, REF_SPEEDS_KMH),
    }))
  }, [activities, REF_SPEEDS_KMH])

  // Get full Banister model data
  const banisterData = useBanisterModel(banisterActivities)
  const dailyLoads = useMemo(() => aggregateDailyTrainingLoad(banisterActivities, new Date()), [banisterActivities])

  // Get current date for simulation
  const today = new Date().toISOString().split("T")[0]

  // Simulate Banister impact if fictional sessions are defined
  const simulationResult = useSimulateBanisterImpact(
    banisterData.currentPoint?.CTL ?? 50,
    banisterData.currentPoint?.ATL ?? 30,
    today,
    fictionalSessions,
    { horizonDays: 14, includeConfidence: true }
  )

  // Helper: Get recommendations based on TSB
  const getAdvice = (tsb: number, ctl: number, atl: number) => {
    const formStatus = getFormStatus(tsb)

    const zones = {
      peaking: {
        zone: "🎯 PEAKING (TSB > +10)",
        meaning: "Vous êtes en excellent état de forme après une période de récupération.",
        why: `Votre TSB est ${tsb.toFixed(1)} (CTL=${ctl.toFixed(1)}, ATL=${atl.toFixed(1)}). L'ATL (fatigue) a diminué rapidement tandis que le CTL (fitness) s'est maintenu, créant une fenêtre de performance optimale.`,
        todo: [
          "✅ C'est le moment d'aller chercher des performances (course rapide, long effort, compétition)",
          "⏰ Cette fenêtre dure généralement 1-2 semaines",
          "🚨 Ne pas la gâcher : maintenir la qualité de l'entraînement",
          "⚠️ Ensuite, il faudra accumuler du volume pour progresser",
        ],
      },
      balanced: {
        zone: "⚖️ BALANCED (0 < TSB ≤ +10)",
        meaning: "État d'équilibre entre fitness et fatigue. Bon pour l'entraînement régulier.",
        why: `Votre TSB est ${tsb.toFixed(1)} (CTL=${ctl.toFixed(1)}, ATL=${atl.toFixed(1)}). Vous avez une fitness solide et une fatigue modérée, ce qui permet un entraînement productif.`,
        todo: [
          "💪 Continuez l'entraînement structuré (mélange de volume et d'intensité)",
          "📈 C'est une bonne zone pour progresser progressivement",
          "🎯 Testez des efforts modérés à soutenus",
          "⏱️ Attention : si la fatigue augmente trop, passez en récupération",
        ],
      },
      accumulating: {
        zone: "📚 ACCUMULATING (-10 < TSB ≤ 0)",
        meaning: "Phase d'accumulation : vous faites du volume mais construisez aussi de la fatigue.",
        why: `Votre TSB est ${tsb.toFixed(1)} (CTL=${ctl.toFixed(1)}, ATL=${atl.toFixed(1)}). Votre ATL augmente proche ou égal à votre CTL, ce qui est typique d'une phase de charge.`,
        todo: [
          "📚 Vous êtes dans la phase d'accumulation (bonne pour bâtir la fitness de base)",
          "⏰ Continuez à augmenter le volume progressivement",
          "⚠️ Gardez au moins 1-2 jours faciles par semaine",
          "🎯 À la fin de cette phase, réduisez le volume pour laisser ATL diminuer et TSB remonter",
        ],
      },
      recovering: {
        zone: "🏥 RECOVERING (-20 < TSB ≤ -10)",
        meaning: "Phase de récupération : vous êtes fatigué mais poursuivez l'entraînement.",
        why: `Votre TSB est ${tsb.toFixed(1)} (CTL=${ctl.toFixed(1)}, ATL=${atl.toFixed(1)}). Votre fatigue (ATL) dépasse votre fitness (CTL), ce qui signifie que l'entraînement récent a été intense ou très volumineux.`,
        todo: [
          "🏥 Vous êtes en récupération : réduisez le volume",
          "🚴 Faites des entraînements faciles et courts",
          "⏰ Visez 3-5 jours de volume réduit (40-60% de votre normal)",
          "📈 Après récupération, votre ATL diminuera et TSB remontera (peaking naturel)",
        ],
      },
      overreaching: {
        zone: "🚨 OVERREACHING (TSB ≤ -20)",
        meaning: "Surmenage : vous êtes gravement fatigué. Attention à la surcharge et la blessure.",
        why: `Votre TSB est ${tsb.toFixed(1)} (CTL=${ctl.toFixed(1)}, ATL=${atl.toFixed(1)}). Votre fatigue est très élevée par rapport à votre fitness. Cela peut indiquer un sur-entraînement ou une récupération insuffisante.`,
        todo: [
          "🚨 URGENT : réduisez drastiquement le volume (50% ou moins de votre normal)",
          "🏥 Priorité à la récupération active (repos, sommeil, nutrition)",
          "⚠️ Risque de blessure et maladie : soyez prudent",
          "📅 Planifiez 1-2 semaines de récupération complète",
          "⏰ Puis reprendre progressivement une semaine de volume modéré",
        ],
      },
    }

    return zones[formStatus] || zones.balanced
  }

  // Helper: What to do to improve
  const getImprovementPath = (tsb: number) => {
    const targetTSB = -5 // Target: between 0 and -10, ideally around -5

    if (tsb > targetTSB + 10) {
      // Too high, need more volume
      return {
        direction: "📈 Augmenter le volume",
        action: "Vous avez trop peu de fatigue. Pour progresser, augmentez progressivement le volume d'entraînement (5-10% par semaine).",
        steps: [
          "Ajoutez 1 jour d'entraînement supplémentaire",
          "Ou augmentez la durée des entraînements existants de 10-15%",
          "Maintenez 1-2 jours de repos complet",
          "Réaugmentez le volume graduellement pour éviter les blessures",
        ],
      }
    } else if (tsb < targetTSB - 10) {
      // Too low, need recovery
      return {
        direction: "🏥 Réduire le volume (récupération)",
        action: "Vous êtes surmenés. Réduisez le volume pour laisser ATL diminuer et TSB remonter.",
        steps: [
          "Réduisez le volume d'entraînement de 40-50%",
          "Faites des entraînements courts et faciles (zones aérobies basses)",
          "Maintenez au moins 2-3 jours de repos complet par semaine",
          "Donnez la priorité au sommeil et à la nutrition",
          "Après 1-2 semaines, vous devriez vous sentir mieux",
        ],
      }
    } else {
      // In target zone
      return {
        direction: "✅ Vous êtes dans la zone optimale !",
        action: "Votre TSB est dans la zone idéale (0 à -10). Maintenez ce cycle d'accumulation/récupération.",
        steps: [
          "Continuez le cycle actuel : 2-3 semaines d'accumulation, puis 1 semaine de récupération",
          "Après récupération, vous devriez atteindre une zone de performance (TSB > 0)",
          "Écoutez votre corps : si vous vous sentez mal, réduisez le volume",
          "Testez régulièrement votre fitness pour ajuster",
        ],
      }
    }
  }

  const current = banisterData.currentPoint
  const advice = current ? getAdvice(current.TSB, current.CTL, current.ATL) : null
  const improvementPath = current ? getImprovementPath(current.TSB) : null

  // Get recent history (last 20 points)
  const recentHistory = useMemo(() => {
    return banisterData.banisterPoints.slice(-20)
  }, [banisterData.banisterPoints])

  return (
    <div className="banister-page">
      <h1>📊 Analyse Banister - État de Forme Détaillé</h1>

      {!current ? (
        <div
          style={{
            padding: "20px",
            background: "#0f1726",
            border: "1px solid #ffc107",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          ⏳ <strong>Données insuffisantes</strong> — Veuillez attendre d'avoir au moins 42 jours de données d'entraînement
          pour que le modèle se stabilise. Pour l'instant, les résultats sont approximatifs.
        </div>
      ) : (
        <>
          {/* OVERVIEW SECTION */}
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              marginBottom: "20px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() =>
                setExpandedSection(expandedSection === "overview" ? "metrics" : "overview")
              }
              style={{
                width: "100%",
                padding: "16px",
                background: "#0f1726",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                textAlign: "left",
              }}
            >
              {expandedSection === "overview" ? "▼" : "▶"} Vue d'ensemble
            </button>

            {expandedSection === "overview" && (
              <div style={{ padding: "20px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "16px",
                    marginBottom: "20px",
                  }}
                >
                  {/* CTL Card */}
                  <div
                    style={{
                      background: "#e3f2fd",
                      border: "2px solid #2196f3",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#0d47a1", marginBottom: "8px" }}>
                      💪 CTL (Fitness / Charge Chronique)
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: "700", color: "#1976d2" }}>
                      {current.CTL.toFixed(1)}
                    </div>
                    <div style={{ fontSize: "12px", color: "#555", marginTop: "8px" }}>
                      Votre fitness globale mesurée sur 42 jours.
                    </div>
                  </div>

                  {/* ATL Card */}
                  <div
                    style={{
                      background: "#fff3e0",
                      border: "2px solid #ff9800",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#e65100", marginBottom: "8px" }}>
                      ⚡ ATL (Fatigue / Charge Aiguë)
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: "700", color: "#f57c00" }}>
                      {current.ATL.toFixed(1)}
                    </div>
                    <div style={{ fontSize: "12px", color: "#555", marginTop: "8px" }}>
                      Votre fatigue récente mesurée sur 7 jours.
                    </div>
                  </div>

                  {/* TSB Card */}
                  <div
                    style={{
                      background:
                        current.TSB > 10
                          ? "#c8e6c9"
                          : current.TSB > 0
                            ? "#bbdefb"
                            : current.TSB > -10
                              ? "#ffe0b2"
                              : current.TSB > -20
                                ? "#ffccbc"
                                : "#ffcdd2",
                      border: `2px solid ${
                        current.TSB > 10
                          ? "#4caf50"
                          : current.TSB > 0
                            ? "#2196f3"
                            : current.TSB > -10
                              ? "#ff9800"
                              : current.TSB > -20
                                ? "#ff7043"
                                : "#f44336"
                      }`,
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color:
                          current.TSB > 10
                            ? "#1b5e20"
                            : current.TSB > 0
                              ? "#0d47a1"
                              : current.TSB > -10
                                ? "#e65100"
                                : current.TSB > -20
                                  ? "#bf360c"
                                  : "#b71c1c",
                        marginBottom: "8px",
                      }}
                    >
                      ⚖️ TSB (Bilan de Stress / Forme)
                    </div>
                    <div
                      style={{
                        fontSize: "28px",
                        fontWeight: "700",
                        color:
                          current.TSB > 10
                            ? "#2e7d32"
                            : current.TSB > 0
                              ? "#1976d2"
                              : current.TSB > -10
                                ? "#f57c00"
                                : current.TSB > -20
                                  ? "#d84315"
                                  : "#c62828",
                      }}
                    >
                      {current.TSB.toFixed(1)}
                    </div>
                    <div style={{ fontSize: "12px", color: "#555", marginTop: "8px" }}>
                      <strong>Formule :</strong> CTL - ATL = {current.CTL.toFixed(1)} - {current.ATL.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div style={{ background: "#0f1726", border: "1px solid #e0e0e0", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>
                  <strong>État actuel :</strong> {advice?.zone}
                </div>

                <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#ffffffd8" }}>
                  {advice?.meaning}
                </p>
              </div>
            )}
          </div>

          {/* DETAILED EXPLANATION SECTION */}
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              marginBottom: "20px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() =>
                setExpandedSection(expandedSection === "metrics" ? "advice" : "metrics")
              }
              style={{
                width: "100%",
                padding: "16px",
                background: "#0f1726",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                textAlign: "left",
              }}
            >
              {expandedSection === "metrics" ? "▼" : "▶"} Pourquoi ces valeurs ?
            </button>

            {expandedSection === "metrics" && (
              <div style={{ padding: "20px" }}>
                <h3>📈 Qu'est-ce que chaque métrique ?</h3>

                <div style={{ marginBottom: "16px", padding: "12px", background: "#e3f2fd", borderRadius: "6px" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#0d47a1" }}>💪 CTL (Charge Chronique - Fitness)</h4>
                  <p style={{ margin: 0, fontSize: "14px", color: "#444" }}>
                    <strong>Définition :</strong> Mesure de votre fitness globale et endurance base. Calculée comme une moyenne pondérée
                    exponentielle de vos charges d'entraînement des <strong>42 derniers jours</strong>.
                  </p>
                  <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#666" }}>
                    <strong>Pourquoi 42 jours ?</strong> C'est la durée approximative que votre corps adapte à un entraînement
                    régulier. C'est le "temps de constante" biologique pour les adaptations aérobies.
                  </p>
                  <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#666", fontStyle: "italic" }}>
                    <strong>Votre CTL actuel : {current.CTL.toFixed(1)}</strong> — {current.CTL < 50
                      ? "Vous débutez"
                      : current.CTL < 100
                        ? "Fitness modérée"
                        : current.CTL < 150
                          ? "Bonne fitness"
                          : "Très haute fitness"}
                  </p>
                </div>

                <div style={{ marginBottom: "16px", padding: "12px", background: "#fff3e0", borderRadius: "6px" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#e65100" }}>⚡ ATL (Charge Aiguë - Fatigue)</h4>
                  <p style={{ margin: 0, fontSize: "14px", color: "#444" }}>
                    <strong>Définition :</strong> Mesure de votre fatigue <strong>récente</strong>. Calculée comme une moyenne
                    pondérée exponentielle de vos charges d'entraînement des <strong>7 derniers jours</strong>.
                  </p>
                  <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#666" }}>
                    <strong>Pourquoi 7 jours ?</strong> C'est la durée de la fatigue musculaire et neurologique après l'entraînement.
                    Elle disparaît rapidement avec la récupération.
                  </p>
                  <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#666", fontStyle: "italic" }}>
                    <strong>Votre ATL actuel : {current.ATL.toFixed(1)}</strong> — {current.ATL < 50
                      ? "Peu de fatigue récente"
                      : current.ATL < 100
                        ? "Fatigue modérée"
                        : "Très fatigué"}
                  </p>
                </div>

                <div
                  style={{
                    marginBottom: "16px",
                    padding: "12px",
                    background:
                      current.TSB > 10
                        ? "#c8e6c9"
                        : current.TSB > 0
                          ? "#bbdefb"
                          : current.TSB > -10
                            ? "#ffe0b2"
                            : "#ffccbc",
                    borderRadius: "6px",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 8px 0",
                      color:
                        current.TSB > 10
                          ? "#1b5e20"
                          : current.TSB > 0
                            ? "#0d47a1"
                            : current.TSB > -10
                              ? "#e65100"
                              : "#bf360c",
                    }}
                  >
                    ⚖️ TSB (Bilan de Stress - Forme)
                  </h4>
                  <p style={{ margin: 0, fontSize: "14px", color: "#444" }}>
                    <strong>Définition :</strong> Différence entre votre fitness (CTL) et votre fatigue (ATL). C'est l'indicateur
                    principal de votre "état de forme".
                  </p>
                  <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#666" }}>
                    <strong>Formule :</strong> TSB = CTL - ATL
                  </p>
                  <div style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#666" }}>
                    <strong>Interprétation :</strong>
                    <ul style={{ margin: "4px 0 0 16px", paddingLeft: 0 }}>
                      <li>
                        <strong>TSB &gt; +10 (🎯 PEAKING)</strong> : Vous êtes en excellent état, c'est le moment de
                        performer
                      </li>
                      <li>
                        <strong>0 &lt; TSB ≤ +10 (⚖️ BALANCED)</strong> : Équilibre fitness/fatigue, bon pour l'entraînement
                      </li>
                      <li>
                        <strong>-10 &lt; TSB ≤ 0 (📚 ACCUMULATING)</strong> : Phase d'accumulation, vous bâtissez votre fitness
                      </li>
                      <li>
                        <strong>-20 &lt; TSB ≤ -10 (🏥 RECOVERING)</strong> : Vous êtes fatigué, réduisez le volume
                      </li>
                      <li>
                        <strong>TSB ≤ -20 (🚨 OVERREACHING)</strong> : Danger ! Vous êtes sur-entraîné
                      </li>
                    </ul>
                  </div>
                  <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#666", fontStyle: "italic" }}>
                    <strong>Votre TSB actuel : {current.TSB.toFixed(1)}</strong> — Vous êtes dans la zone "{advice?.zone}"
                  </p>
                </div>

                <h3>🔍 Calcul des charges d'entraînement</h3>
                <p style={{ fontSize: "14px", color: "#ffffffc6", marginBottom: "12px" }}>
                  Chaque activité a une <strong>charge d'entraînement</strong> calculée à partir de :
                </p>
                <ul style={{ fontSize: "14px", color: "#ffffffc6", marginBottom: "12px", paddingLeft: "20px" }}>
                  <li>
                    <strong>Distance</strong> : Plus vous courez/pédalez, plus c'est chargé
                  </li>
                  <li>
                    <strong>Intensité</strong> : Courir vite = plus chargé que courir lentement
                  </li>
                  <li>
                    <strong>Dénivelé</strong> : Monter coûte cher en énergie
                  </li>
                  <li>
                    <strong>Type d'activité</strong> : Course / cyclisme / rando = calculs différents
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* ADVICE SECTION */}
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              marginBottom: "20px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() =>
                setExpandedSection(expandedSection === "advice" ? "history" : "advice")
              }
              style={{
                width: "100%",
                padding: "16px",
                background: "#0f1726",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                textAlign: "left",
              }}
            >
              {expandedSection === "advice" ? "▼" : "▶"} Que faire pour revenir entre 0 et -10 ?
            </button>

            {expandedSection === "advice" && advice && improvementPath && (
              <div style={{ padding: "20px" }}>
                <h3>{advice.zone}</h3>
                <p style={{ fontSize: "15px", color: "#ffffffc6", marginBottom: "16px" }}>
                  {advice.why}
                </p>

                <div style={{ marginBottom: "20px", padding: "12px", background: "#f0f4ff", borderRadius: "6px" }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#0d47a1" }}>Que faire maintenant ?</h4>
                  <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "#333" }}>
                    {advice.todo.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: "8px" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <h3 style={{ marginTop: "24px" }}>{improvementPath.direction}</h3>
                <p style={{ fontSize: "14px", color: "#ffffffc6", marginBottom: "12px" }}>
                  {improvementPath.action}
                </p>

                <div style={{ padding: "12px", background: "#f9f9f9", borderRadius: "6px" }}>
                  <strong style={{ fontSize: "14px", color: "#333" }}>📋 Étapes à suivre :</strong>
                  <ol style={{ margin: "8px 0 0 0", paddingLeft: "20px", fontSize: "13px", color: "#555" }}>
                    {improvementPath.steps.map((step, idx) => (
                      <li key={idx} style={{ marginBottom: "6px" }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                <div style={{ marginTop: "16px", padding: "12px", background: "#e8f5e9", borderRadius: "6px" }}>
                  <strong style={{ color: "#1b5e20" }}>💡 Objectif :</strong>
                  <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#33691e" }}>
                    Maintenir un TSB entre <strong>0 et -10</strong> est optimal pour :
                  </p>
                  <ul style={{ margin: "8px 0 0 16px", paddingLeft: "0px", fontSize: "13px", color: "#33691e" }}>
                    <li>🏋️ Progresser régulièrement en fitness</li>
                    <li>🎯 Avoir des fenêtres de performance régulières (quand ATL baisse)</li>
                    <li>🛡️ Éviter le surmenage et les blessures</li>
                    <li>📈 Créer un cycle sustainable : accumulation → récupération → peaking</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* HISTORY SECTION */}
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              marginBottom: "20px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() =>
                setExpandedSection(expandedSection === "history" ? "overview" : "history")
              }
              style={{
                width: "100%",
                padding: "16px",
                background: "#0f1726",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                textAlign: "left",
              }}
            >
              {expandedSection === "history" ? "▼" : "▶"} Historique (20 derniers jours)
            </button>

            {expandedSection === "history" && (
              <div style={{ padding: "20px", overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "13px",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "2px solid #ddd" }}>
                      <th style={{ textAlign: "left", padding: "8px", fontWeight: "600" }}>Date</th>
                      <th style={{ textAlign: "right", padding: "8px", fontWeight: "600" }}>Charge du jour</th>
                      <th style={{ textAlign: "right", padding: "8px", fontWeight: "600" }}>CTL</th>
                      <th style={{ textAlign: "right", padding: "8px", fontWeight: "600" }}>ATL</th>
                      <th style={{ textAlign: "right", padding: "8px", fontWeight: "600" }}>TSB</th>
                      <th style={{ textAlign: "left", padding: "8px", fontWeight: "600" }}>État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentHistory.map((point, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "8px", fontWeight: "500" }}>
                          {formatDate(point.date)}
                        </td>
                        <td style={{ textAlign: "right", padding: "8px" }}>
                          {(dailyLoads.find((d) => d.date === point.date)?.trainingLoad ?? 0).toFixed(0)}
                        </td>
                        <td style={{ textAlign: "right", padding: "8px" }}>
                          {point.CTL.toFixed(1)}
                        </td>
                        <td style={{ textAlign: "right", padding: "8px" }}>
                          {point.ATL.toFixed(1)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "8px",
                            fontWeight: "600",
                            color:
                              point.TSB > 10
                                ? "#2e7d32"
                                : point.TSB > 0
                                  ? "#1976d2"
                                  : point.TSB > -10
                                    ? "#f57c00"
                                    : "#d84315",
                          }}
                        >
                          {point.TSB.toFixed(1)}
                        </td>
                        <td style={{ padding: "8px" }}>
                          {point.TSB > 10
                            ? "🎯 Peaking"
                            : point.TSB > 0
                              ? "⚖️ Balanced"
                              : point.TSB > -10
                                ? "📚 Accumul."
                                : point.TSB > -20
                                  ? "🏥 Recover."
                                  : "🚨 Overreach."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SIMULATION SECTION */}
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              marginBottom: "20px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() =>
                setExpandedSection(expandedSection === "simulation" ? "overview" : "simulation")
              }
              style={{
                width: "100%",
                padding: "16px",
                background: "#0f1726",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                textAlign: "left",
              }}
            >
              {expandedSection === "simulation" ? "▼" : "▶"} Simulateur de Séances Fictives
            </button>

            {expandedSection === "simulation" && (
              <div style={{ padding: "20px" }}>
                <p style={{ fontSize: "14px", color: "#ffffffd5", marginBottom: "20px" }}>
                  ⚡ Testez l'impact de séances fictives sur votre fatigue et votre forme avant de les planifier.
                </p>

                <SimulationInput 
                  onSessionsChange={setFictionalSessions}
                  activities={activities}
                />

                {simulationResult && fictionalSessions.length > 0 && (
                  <div style={{ marginTop: "24px" }}>
                    <SimulationVisualizer
                      result={simulationResult}
                      fictionalSessions={fictionalSessions}
                    />
                  </div>
                )}

                {fictionalSessions.length === 0 && (
                  <div
                    style={{
                      background: "#0f1726",
                      padding: "20px",
                      borderRadius: "8px",
                      textAlign: "center",
                      color: "#999",
                      marginTop: "20px",
                    }}
                  >
                    Ajoutez une ou plusieurs séances fictives pour voir leur impact
                  </div>
                )}
              </div>
            )}
          </div>

          {/* EDUCATIONAL SECTION */}
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              marginBottom: "20px",
              padding: "20px",
              background: "#0f1726",
            }}
          >
            <h3>📚 Pour en savoir plus</h3>
            <p style={{ fontSize: "14px", color: "#ffffffc6", marginBottom: "12px" }}>
              <strong>Le modèle Banister</strong> est un modèle scientifique de planification de l'entraînement développé par le
              chercheur Eric Banister. Il est utilisé par les plus grands entraîneurs du monde pour :
            </p>
            <ul style={{ fontSize: "14px", color: "#ffffffc6", paddingLeft: "20px", marginBottom: "12px" }}>
              <li>Optimiser les périodes d'entraînement intensif et de récupération</li>
              <li>Prédire les pics de performance</li>
              <li>Éviter le surmenage et les blessures</li>
              <li>Planifier les périodes de compétition</li>
            </ul>
            <p style={{ fontSize: "14px", color: "#ffffffc6" }}>
              <strong>Cycle optimal :</strong> Environ 3 semaines d'accumulation suivi d'1 semaine de récupération crée un cycle
              de 4 semaines qui produit naturellement un pic de performance (peaking) au début de la récupération.
            </p>
          </div>
        </>
      )}
    </div>
  )
}