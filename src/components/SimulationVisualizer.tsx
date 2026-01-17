/**
 * Component for displaying Banister impact simulation results
 * Shows baseline vs simulated scenarios with detailed analysis
 */

import { useState } from "react";
import type { SimulationResult, FictionalSession } from "../utils/banisterSimulation";
import "../styles/banisterSimulation.css";

interface SimulationVisualizerProps {
  result: SimulationResult;
  fictionalSessions: FictionalSession[];
}

export function SimulationVisualizer({
  result,
  fictionalSessions,
}: SimulationVisualizerProps) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("fr-FR", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getFatigueColor = (fatigueLevel: string) => {
    const colors: Record<string, string> = {
      FRESH: "#4caf50",
      OPTIMAL: "#2196f3",
      PRODUCTIVE: "#ff9800",
      FATIGUED: "#ff7043",
      OVERREACH: "#f44336",
    };
    return colors[fatigueLevel] || "#999";
  };

  const getRiskColor = (riskLevel: string) => {
    const colors: Record<string, string> = {
      LOW: "#4caf50",
      MODERATE: "#ff9800",
      HIGH: "#f44336",
    };
    return colors[riskLevel] || "#999";
  };

  const sessionsByDay = new Map<number, FictionalSession[]>();
  for (const session of fictionalSessions) {
    if (!sessionsByDay.has(session.dayOffset)) {
      sessionsByDay.set(session.dayOffset, []);
    }
    sessionsByDay.get(session.dayOffset)!.push(session);
  }

  return (
    <div className="simulation-visualizer">
      {/* Main Comparison Card */}
      <div className="comparison-section">
        <h3>🔍 Comparaison Scénarios</h3>

        <div className="comparison-grid">
          {/* Baseline Card */}
          <div className="scenario-card baseline">
            <div className="scenario-title">
                <h4 style={{ color: "#2196f3"}}>Scénario Baseline</h4>
            </div>
            <div className="scenario-title-secondary">
              (sans séances fictives)
            </div>

            <div className="metric-row">
              <span className="metric-label">TSB minimum:</span>
              <span className="metric-value">
                {result.baselineSummary.minTSB.toFixed(1)}
              </span>
              <span className="metric-unit">jour {result.baselineSummary.minTSBDay}</span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Δ CTL:</span>
              <span className="metric-value">
                {result.baselineSummary.deltaCTL > 0 ? "+" : ""}
                {result.baselineSummary.deltaCTL.toFixed(1)}
              </span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Δ ATL:</span>
              <span className="metric-value">
                {result.baselineSummary.deltaATL > 0 ? "+" : ""}
                {result.baselineSummary.deltaATL.toFixed(1)}
              </span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Risque:</span>
              <span
                className="metric-badge"
                style={{
                  background: getRiskColor(result.baselineSummary.riskLevel),
                }}
              >
                {result.baselineSummary.riskLevel}
              </span>
            </div>

            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{
                  width: `${result.baselineSummary.confidenceScore * 100}%`,
                }}
              />
              <span className="confidence-text">
                Confiance: {(result.baselineSummary.confidenceScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Simulated Card */}
          <div className="scenario-card simulated">
            <div className="scenario-title">
                <h4 style={{color:"#ff9800"}}>Scénario Simulé</h4>
            </div>
            <div className="scenario-title-secondary">
              (avec {fictionalSessions.length} séance{fictionalSessions.length > 1 ? "s" : ""})
            </div>

            <div className="metric-row">
              <span className="metric-label">TSB minimum:</span>
              <span className="metric-value">
                {result.simulatedSummary.minTSB.toFixed(1)}
              </span>
              <span className="metric-unit">jour {result.simulatedSummary.minTSBDay}</span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Δ CTL:</span>
              <span className="metric-value">
                {result.simulatedSummary.deltaCTL > 0 ? "+" : ""}
                {result.simulatedSummary.deltaCTL.toFixed(1)}
              </span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Δ ATL:</span>
              <span className="metric-value">
                {result.simulatedSummary.deltaATL > 0 ? "+" : ""}
                {result.simulatedSummary.deltaATL.toFixed(1)}
              </span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Risque:</span>
              <span
                className="metric-badge"
                style={{
                  background: getRiskColor(result.simulatedSummary.riskLevel),
                }}
              >
                {result.simulatedSummary.riskLevel}
              </span>
            </div>

            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{
                  width: `${result.simulatedSummary.confidenceScore * 100}%`,
                }}
              />
              <span className="confidence-text">
                Confiance: {(result.simulatedSummary.confidenceScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Difference Card */}
          <div className="scenario-card difference">
            <div className="scenario-title">
                <h4 style={{color:"#9c27b0"}}>⚡ Impact</h4>
            </div>
            <div className="metric-row">
              <span className="metric-label">Δ TSB min:</span>
              <span
                className="metric-value"
                style={{
                  color:
                    result.comparison.minTSBDifference < -2
                      ? "#f44336"
                      : result.comparison.minTSBDifference > 2
                        ? "#4caf50"
                        : "#ff9800",
                }}
              >
                {result.comparison.minTSBDifference > 0 ? "+" : ""}
                {result.comparison.minTSBDifference.toFixed(1)}
              </span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Δ TSB final:</span>
              <span
                className="metric-value"
                style={{
                  color:
                    result.comparison.finalTSBDifference < -2
                      ? "#f44336"
                      : result.comparison.finalTSBDifference > 2
                        ? "#4caf50"
                        : "#ff9800",
                }}
              >
                {result.comparison.finalTSBDifference > 0 ? "+" : ""}
                {result.comparison.finalTSBDifference.toFixed(1)}
              </span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Jours TSB ↓:</span>
              <span className="metric-value">{result.comparison.daysWithLowerTSB}</span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Risque ↑:</span>
              <span
                className="metric-badge"
                style={{
                  background: result.comparison.riskIncrease ? "#f44336" : "#4caf50",
                }}
              >
                {result.comparison.riskIncrease ? "⚠️ OUI" : "✅ NON"}
              </span>
            </div>
          </div>
        </div>

        {/* Main Insight */}
        <div className="insight-box">
          <div className="insight-content">{result.comparison.insight}</div>
        </div>
      </div>

      {/* Daily Timeline */}
      <div className="timeline-section">
        <h3>📅 Évolution Jour par Jour</h3>

        <div className="timeline-table">
          <div className="timeline-header">
            <div className="col-day1">Jour</div>
            <div className="col-date1">Date</div>
            <div className="col-load1">Charge</div>
            <div className="col-metrics1">CTL / ATL / TSB</div>
            <div className="col-fatigue1">Fatigue</div>
            <div className="col-compare1">Vs Baseline</div>
          </div>

          {result.simulated.map((day, idx) => {
            const baselineDay = result.baseline[idx];
            const sessions = sessionsByDay.get(day.day) || [];
            const isExpanded = expandedDay === day.day;

            return (
              <div key={day.day}>
                <div
                  className="timeline-row"
                  onClick={() =>
                    setExpandedDay(isExpanded ? null : day.day)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <div className="col-day">{day.day}</div>
                  <div className="col-date">{formatDate(day.date)}</div>
                  <div className="col-load">
                    {day.trainingLoad > 0 ? day.trainingLoad.toFixed(0) : "—"}
                  </div>
                  <div className="col-metrics">
                    {day.ctl.toFixed(1)} / {day.atl.toFixed(1)} /{" "}
                    <span style={{ color: getFatigueColor(day.fatigueLevel) }}>
                      {day.tsb.toFixed(1)}
                    </span>
                  </div>
                  <div className="col-fatigue">
                    <span
                      className="fatigue-badge"
                      style={{
                        background: getFatigueColor(day.fatigueLevel),
                      }}
                    >
                      {day.fatigueLevel}
                    </span>
                  </div>
                  <div className="col-compare">
                    <span
                      style={{
                        color:
                          day.tsb < baselineDay.tsb ? "#f44336" : "#4caf50",
                      }}
                    >
                      {(day.tsb - baselineDay.tsb > 0 ? "+" : "")}
                      {(day.tsb - baselineDay.tsb).toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Expanded details for sessions on this day */}
                {isExpanded && sessions.length > 0 && (
                  <div className="timeline-expanded">
                    <div className="session-details">
                      {sessions.map((session, sIdx) => (
                        <div key={sIdx} className="session-item">
                          <span className="session-sport">
                            {session.sport === "cyclisme"
                              ? "🚴"
                              : session.sport === "course"
                                ? "🏃"
                                : "⚽"}
                          </span>
                          <span className="session-type">{session.type}</span>
                          <span className="session-load">TL: {session.trainingLoad}</span>
                          {session.description && (
                            <span className="session-description">
                              {session.description}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Fatigue Distribution */}
      <div className="fatigue-distribution">
        <h3>📊 Distribution de Fatigue</h3>

        <div className="distribution-grid">
          <div className="distribution-card">
            <div className="dist-title">Baseline</div>
            <div className="dist-bar">
              <div
                className="dist-segment fresh"
                style={{
                  width: `${(result.baselineSummary.freshDays / result.baseline.length) * 100}%`,
                }}
                title={`FRESH: ${result.baselineSummary.freshDays} j`}
              />
              <div
                className="dist-segment optimal"
                style={{
                  width: `${(result.baselineSummary.optimalDays / result.baseline.length) * 100}%`,
                }}
                title={`OPTIMAL: ${result.baselineSummary.optimalDays} j`}
              />
              <div
                className="dist-segment productive"
                style={{
                  width: `${(result.baselineSummary.productiveDays / result.baseline.length) * 100}%`,
                }}
                title={`PRODUCTIVE: ${result.baselineSummary.productiveDays} j`}
              />
              <div
                className="dist-segment fatigued"
                style={{
                  width: `${(result.baselineSummary.fatiguedDays / result.baseline.length) * 100}%`,
                }}
                title={`FATIGUED: ${result.baselineSummary.fatiguedDays} j`}
              />
              <div
                className="dist-segment overreach"
                style={{
                  width: `${(result.baselineSummary.overreachDays / result.baseline.length) * 100}%`,
                }}
                title={`OVERREACH: ${result.baselineSummary.overreachDays} j`}
              />
            </div>
          </div>

          <div className="distribution-card">
            <div className="dist-title">Simulé</div>
            <div className="dist-bar">
              <div
                className="dist-segment fresh"
                style={{
                  width: `${(result.simulatedSummary.freshDays / result.simulated.length) * 100}%`,
                }}
                title={`FRESH: ${result.simulatedSummary.freshDays} j`}
              />
              <div
                className="dist-segment optimal"
                style={{
                  width: `${(result.simulatedSummary.optimalDays / result.simulated.length) * 100}%`,
                }}
                title={`OPTIMAL: ${result.simulatedSummary.optimalDays} j`}
              />
              <div
                className="dist-segment productive"
                style={{
                  width: `${(result.simulatedSummary.productiveDays / result.simulated.length) * 100}%`,
                }}
                title={`PRODUCTIVE: ${result.simulatedSummary.productiveDays} j`}
              />
              <div
                className="dist-segment fatigued"
                style={{
                  width: `${(result.simulatedSummary.fatiguedDays / result.simulated.length) * 100}%`,
                }}
                title={`FATIGUED: ${result.simulatedSummary.fatiguedDays} j`}
              />
              <div
                className="dist-segment overreach"
                style={{
                  width: `${(result.simulatedSummary.overreachDays / result.simulated.length) * 100}%`,
                }}
                title={`OVERREACH: ${result.simulatedSummary.overreachDays} j`}
              />
            </div>
          </div>
        </div>

        <div className="distribution-legend">
          <span className="legend-item">
            <span className="legend-box fresh" /> FRESH
          </span>
          <span className="legend-item">
            <span className="legend-box optimal" /> OPTIMAL
          </span>
          <span className="legend-item">
            <span className="legend-box productive" /> PRODUCTIVE
          </span>
          <span className="legend-item">
            <span className="legend-box fatigued" /> FATIGUED
          </span>
          <span className="legend-item">
            <span className="legend-box overreach" /> OVERREACH
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}
