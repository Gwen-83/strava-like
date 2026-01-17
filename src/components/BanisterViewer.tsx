/**
 * Banister Model Viewer Component
 * Displays CTL, ATL, TSB metrics and analysis
 */

import React from "react";
import { useBanisterModel } from "../hooks/useBanisterModel";
import type {
  Activity,
  BanisterConfig,
  FormStatus,
} from "../types/BanisterModel";

interface BanisterViewerProps {
  activities: Activity[];
  config?: BanisterConfig;
  showWarnings?: boolean;
  showStatistics?: boolean;
}

/**
 * Component to display Banister model results
 * Shows current metrics, warnings, and analysis
 */
export function BanisterViewer({
  activities,
  config,
  showWarnings = true,
  showStatistics = true,
}: BanisterViewerProps): React.ReactNode {
  const {
    currentPoint,
    warnings,
    overreachingPeriods,
    peakPeriods,
    statistics,
    stabilizedPoints,
  } = useBanisterModel(activities, config);

  if (!currentPoint) {
    return (
      <div className="banister-viewer empty">
        <p>No training data available</p>
      </div>
    );
  }

  const getFormStatusColor = (status: FormStatus): string => {
    switch (status) {
      case "peaking":
        return "#4CAF50"; // Green
      case "balanced":
        return "#2196F3"; // Blue
      case "accumulating":
        return "#FF9800"; // Orange
      case "recovering":
        return "#FF6F00"; // Dark Orange
      case "overreaching":
        return "#F44336"; // Red
      default:
        return "#9E9E9E"; // Grey
    }
  };

  return (
    <div className="banister-viewer">
      {/* Current State Card */}
      <div className="banister-card current-state">
        <h2>Current Fitness State</h2>
        <div className="metrics-grid">
          <div className="metric">
            <label>Chronic Training Load (CTL)</label>
            <div className="value">{currentPoint.CTL.toFixed(1)}</div>
            <div className="description">
              Aerobic fitness base (42-day average)
            </div>
          </div>

          <div className="metric">
            <label>Acute Training Load (ATL)</label>
            <div className="value">{currentPoint.ATL.toFixed(1)}</div>
            <div className="description">Recent fatigue (7-day average)</div>
          </div>

          <div className="metric">
            <label>Training Stress Balance (TSB)</label>
            <div
              className="value"
              style={{
                color: getFormStatusColor(warnings[0]?.status),
              }}
            >
              {currentPoint.TSB.toFixed(1)}
            </div>
            <div className="description">Form indicator (CTL - ATL)</div>
          </div>

          <div className="metric">
            <label>Form Status</label>
            <div
              className="status-badge"
              style={{
                backgroundColor: getFormStatusColor(warnings[0]?.status),
              }}
            >
              {warnings[0]?.status.toUpperCase()}
            </div>
          </div>
        </div>

        {!currentPoint.isStabilized && (
          <div className="warning-banner">
            ⚠️ Model warm-up phase - data may be less reliable until day 42
          </div>
        )}
      </div>

      {/* Warnings */}
      {showWarnings && warnings.length > 0 && (
        <div className="banister-card warnings">
          <h3>Training Status & Recommendations</h3>
          <div className="warning-list">
            {warnings.map((warning, idx) => (
              <div key={idx} className="warning-item">
                <div className="recommendation">{warning.recommendation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics */}
      {showStatistics && (
        <div className="banister-card statistics">
          <h2>Statistics</h2>
          <div className="stats-grid">
            <div className="stat-group">
              <h4>CTL (Chronic Load)</h4>
              <div>
                Avg: <strong>{statistics.avgCTL.toFixed(1)}</strong>
              </div>
              <div>
                Max: <strong>{statistics.maxCTL.toFixed(1)}</strong>
              </div>
              <div>
                Min: <strong>{statistics.minCTL.toFixed(1)}</strong>
              </div>
            </div>

            <div className="stat-group">
              <h4>ATL (Acute Load)</h4>
              <div>
                Avg: <strong>{statistics.avgATL.toFixed(1)}</strong>
              </div>
              <div>
                Max: <strong>{statistics.maxATL.toFixed(1)}</strong>
              </div>
              <div>
                Min: <strong>{statistics.minATL.toFixed(1)}</strong>
              </div>
            </div>

            <div className="stat-group">
              <h4>TSB (Form)</h4>
              <div>
                Avg: <strong>{statistics.avgTSB.toFixed(1)}</strong>
              </div>
              <div>
                Max: <strong>{statistics.maxTSB.toFixed(1)}</strong>
              </div>
              <div>
                Min: <strong>{statistics.minTSB.toFixed(1)}</strong>
              </div>
            </div>

            <div className="stat-group">
              <h4>Daily Load</h4>
              <div>
                Avg: <strong>{statistics.avgDailyLoad.toFixed(1)}</strong>
              </div>
              <div>
                Total: <strong>{statistics.totalLoad.toFixed(0)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overreaching Periods */}
      {overreachingPeriods.length > 0 && (
        <div className="banister-card alerts overreaching">
          <h3>🛑 Overreaching Periods (TSB &lt; -20)</h3>
          <div className="periods-list">
            {overreachingPeriods.map((period, idx) => (
              <div key={idx} className="period-item">
                <div className="period-dates">
                  {period.startDate} → {period.endDate}
                </div>
                <div className="period-details">
                  Duration: {period.days} days | Min TSB: {period.minTSB.toFixed(1)}
                </div>
                <div className="period-recommendation">
                  Risk of overtraining - prioritize recovery
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peak Periods */}
      {peakPeriods.length > 0 && (
        <div className="banister-card alerts peaking">
          <h3>🎯 Peak Form Periods (TSB &gt; +10)</h3>
          <div className="periods-list">
            {peakPeriods.map((period, idx) => (
              <div key={idx} className="period-item">
                <div className="period-dates">
                  {period.startDate} → {period.endDate}
                </div>
                <div className="period-details">
                  Duration: {period.days} days | Max TSB: {period.maxTSB.toFixed(1)}
                </div>
                <div className="period-recommendation">
                  Ideal window for high-intensity efforts and competition
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Summary */}
      <div className="banister-card data-summary">
        <h3>Data Coverage</h3>
        <div className="summary-stats">
          <div>
            <strong>Total days:</strong> {stabilizedPoints.length}
          </div>
          <div>
            <strong>Stabilized days:</strong> {stabilizedPoints.length}
          </div>
          <div>
            <strong>Date range:</strong> {currentPoint.date}
          </div>
        </div>
      </div>
    </div>
  );
}
