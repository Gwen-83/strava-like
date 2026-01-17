import { useState } from "react"
import type { ActivitySummary } from "../types/Activity"
import { comparePeriods, filterByPeriod } from "../utils/comparisons"
import { calculateActivityStats } from "../utils/activityAnalytics"
import { enrichActivitiesWithGeoPoints } from "../utils/geoUtils"
import { useActivityDetails } from "../hooks/useActivityDetails"
import { HeatmapViewer } from "../components/HeatmapViewer"
import "../styles/comparisons.css"

function fmtRangeLabel(start?: Date, end?: Date) {
  if (!start || !end) return ""
  const s = start.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
  const e = new Date(end.getTime() - 1).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
  return `${s} - ${e}`
}

export default function ComparisonsStatsPage({ activities }: { activities: ActivitySummary[] }) {
  const [sportFilter, setSportFilter] = useState<"All" | "Cyclisme" | "Course" | "Marche" | "Randonnée">("All")
  const [periodType, setPeriodType] = useState<"week" | "month" | "year">("week")
  const todayIso = new Date().toISOString().slice(0, 10)
  const [baseDate, setBaseDate] = useState<string>(todayIso)
  const [applyPeriodToStats, setApplyPeriodToStats] = useState<boolean>(false)

  // Charger les détails des activités (polyline, coordinates, etc.)
  const { enrichedActivities } = useActivityDetails(activities)

  // Enrichir avec geoPoints
  const enrichedWithGeo = enrichActivitiesWithGeoPoints(enrichedActivities)
  
  const filteredActivities = enrichedWithGeo.filter(a => sportFilter === "All" || a.sport === sportFilter)

  // Heatmap: appliquer le filtre de période SI cochée
  const heatmapActivities = applyPeriodToStats
    ? filterByPeriod(filteredActivities, periodType, new Date(baseDate), 0).activities
    : filteredActivities

  const statsActivities = applyPeriodToStats
    ? filterByPeriod(filteredActivities, periodType, new Date(baseDate), 0).activities
    : filteredActivities

  const filteredStats = calculateActivityStats(statsActivities)

  const comparison = comparePeriods(filteredActivities, periodType, new Date(baseDate));
  const currentRange = comparison.currentRange
  const previousRange = comparison.previousRange

  function delta(current: number, previous: number) {
    if (!Number.isFinite(previous) || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  const safe = (v: number) => (Number.isFinite(v) ? v : 0)

  const statsScopeLabel = (() => {
    const periodLabel = `Période (${fmtRangeLabel(currentRange.start, currentRange.end)})`
    if (sportFilter !== "All" && applyPeriodToStats) {
      return `Stats: ${sportFilter}, ${periodLabel}`
    }
    if (sportFilter !== "All") {
      return `Stats: ${sportFilter}, toutes périodes`
    }
    if (applyPeriodToStats) {
      return `Stats: ${periodLabel}`
    }
    return "Stats: Toutes activités, toutes périodes"
  })()

  return (
    <div className="comparisons-page">
      <header className="controls-header" role="region" aria-label="Filtres et période">
        <div className="controls-row">
          <div>
            <h2 className="controls-title">Filtres</h2>
            <div className="filters">
              <div className="filter-item">
                <label htmlFor="sport-filter">Sport</label>
                <select
                  id="sport-filter"
                  value={sportFilter}
                  onChange={e => setSportFilter(e.target.value as any)}
                  aria-label="Filtrer par sport"
                >
                  <option value="All">Tous</option>
                  <option value="Cyclisme">Ride</option>
                  <option value="Course">Run</option>
                  <option value="Marche">Walk</option>
                  <option value="Randonnée">Hike</option>
                </select>
              </div>

              <div className="filter-item">
                <label>Période</label>
                <select
                  value={periodType}
                  onChange={e => setPeriodType(e.target.value as any)}
                >
                  <option value="week">Semaine</option>
                  <option value="month">Mois</option>
                  <option value="year">Année</option>
                </select>
              </div>

              <div className="filter-item">
                <label>Date base</label>
                <input
                  type="date"
                  value={baseDate}
                  onChange={e => setBaseDate(e.target.value)}
                />
              </div>

              <div className="filter-item checkbox-item">
                <label>
                  <input
                    type="checkbox"
                    checked={applyPeriodToStats}
                    onChange={e => setApplyPeriodToStats(e.target.checked)}
                  />
                  Appliquer la période aux stats
                </label>
              </div>
            </div>

            <div className="filters-hint" aria-hidden>
              <small>
                La comparaison utilise la période sélectionnée. Cochez <em>Appliquer la période aux stats</em> pour limiter les statistiques à cette période.
              </small>
            </div>
          </div>

          <div className="range-panel" aria-hidden>
            <div className="badge">Comparaison: {fmtRangeLabel(currentRange.start, currentRange.end)}</div>
            <div className="badge muted">Précédent: {fmtRangeLabel(previousRange.start, previousRange.end)}</div>
            <div className="badge scope">{statsScopeLabel}</div>
          </div>
        </div>
      </header>

      <main>
        <section className="stats-section" aria-label="Statistiques">
          <h3 className="section-title">Statistiques</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Distance</div>
              <div className="stat-value">{(filteredStats.totalDistance / 1000).toFixed(2)} km</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Vitesse moy.</div>
              <div className="stat-value">{(Number.isFinite(filteredStats.averageSpeed) ? (filteredStats.averageSpeed * 3.6).toFixed(2) : "0.00")} km/h</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">D+</div>
              <div className="stat-value">
                {filteredStats.hasElevation
                  ? `${Math.round(filteredStats.totalElevation)} m`
                  : "non mesuré"}
              </div>
            </div>
          </div>
        </section>

        <section className="comparison-section" aria-label="Comparaisons">
          <h3 className="section-title">Comparaisons (période courante vs précédente)</h3>
          <div className="comparison-grid">
            <div className="comparison-card">
              <div className="card-label">Distance</div>
              <div className="card-value">{(safe(comparison.current.distance) / 1000).toFixed(2)} km</div>
              <div className="card-meta">
                <span className="meta-small">Précédent: {(safe(comparison.previous.distance) / 1000).toFixed(2)} km</span>
                <span className={"delta " + (delta(comparison.current.distance, comparison.previous.distance) >= 0 ? "pos" : "neg")}>
                  {delta(comparison.current.distance, comparison.previous.distance).toFixed(2)} %
                </span>
              </div>
            </div>

            <div className="comparison-card">
              <div className="card-label">D+</div>
              <div className="card-value">{safe(comparison.current.elevation).toFixed(0)} m</div>
              <div className="card-meta">
                <span className="meta-small">Précédent: {safe(comparison.previous.elevation).toFixed(0)} m</span>
                <span className={"delta " + (delta(comparison.current.elevation, comparison.previous.elevation) >= 0 ? "pos" : "neg")}>
                  {delta(comparison.current.elevation, comparison.previous.elevation).toFixed(2)} %
                </span>
              </div>
            </div>

            <div className="comparison-card">
              <div className="card-label">Charge</div>
              <div className="card-value">{safe(comparison.current.load).toFixed(2)}</div>
              <div className="card-meta">
                <span className="meta-small">Précédent: {safe(comparison.previous.load).toFixed(2)}</span>
                <span className={"delta " + (delta(comparison.current.load, comparison.previous.load) >= 0 ? "pos" : "neg")}>
                  {delta(comparison.current.load, comparison.previous.load).toFixed(2)} %
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="heatmap-section" aria-label="Carte de chaleur">
          <h3 className="section-title">Localisation des activités</h3>
          {heatmapActivities.length === 0 ? (
            <p style={{ color: "#999", padding: "20px" }}>Aucune activité</p>
          ) : (
            <>
              <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "12px" }}>
                {heatmapActivities.filter(a => a.geoPoints?.length > 0).length} / {heatmapActivities.length} activités avec coordonnées GPS
                {heatmapActivities.filter(a => a.geoPoints?.length > 0).length === 0 && (
                  <span style={{ marginLeft: "12px", color: "#ff6b6b", fontWeight: "bold" }}>
                    ⚠️ Aucune coordonnée GPS trouvée dans cette période
                  </span>
                )}
              </p>
              <HeatmapViewer activities={heatmapActivities} height="500px" />
            </>
          )}
        </section>
      </main>
    </div>
  )
}