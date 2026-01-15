import { useState } from "react"
import type { ActivitySummary } from "../types/Activity"
import { filterByPeriod } from "../utils/comparisons"
import { enrichActivitiesWithGeoPoints } from "../utils/geoUtils"
import { useActivityDetails } from "../hooks/useActivityDetails"
import { HeatmapViewer } from "../components/HeatmapViewer"
import "../styles/heatmap.css"

function fmtRangeLabel(start?: Date, end?: Date) {
  if (!start || !end) return ""
  const s = start.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
  const e = new Date(end.getTime() - 1).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
  return `${s} - ${e}`
}

export default function HeatmapPage({ activities }: { activities: ActivitySummary[] }) {
  const [sportFilter, setSportFilter] = useState<"All" | "Cyclisme" | "Course" | "Marche" | "Randonnée">("All")
  const [periodType, setPeriodType] = useState<"week" | "month" | "year">("month")
  const todayIso = new Date().toISOString().slice(0, 10)
  const [baseDate, setBaseDate] = useState<string>(todayIso)
  const [applyPeriodFilter, setApplyPeriodFilter] = useState<boolean>(true)

  // Charger les détails des activités
  const { enrichedActivities } = useActivityDetails(activities)

  // Enrichir avec geoPoints
  const enrichedActivitiesWithGeo = enrichActivitiesWithGeoPoints(enrichedActivities)
  
  const filteredActivities = enrichedActivitiesWithGeo.filter(a => sportFilter === "All" || a.sport === sportFilter)

  const periodResult = filterByPeriod(filteredActivities, periodType, new Date(baseDate), 0)
  const heatmapActivities = applyPeriodFilter ? periodResult.activities : filteredActivities

  const scopeLabel = (() => {
    if (applyPeriodFilter) {
      const label = `${periodType === "week" ? "Semaine" : periodType === "month" ? "Mois" : "Année"} (${fmtRangeLabel(periodResult.start, periodResult.end)})`
      return sportFilter !== "All" ? `${sportFilter}, ${label}` : label
    }
    return sportFilter !== "All" ? `${sportFilter}, toutes périodes` : "Toutes activités"
  })()

  return (
    <div className="heatmap-page">
      <header className="controls-header" role="region" aria-label="Filtres heatmap">
        <div className="controls-row">
          <div>
            <h2 className="controls-title">Filtres Heatmap</h2>
            <div className="filters">
              <div className="filter-item">
                <label htmlFor="sport-filter">Sport</label>
                <select
                  id="sport-filter"
                  value={sportFilter}
                  onChange={e => setSportFilter(e.target.value as any)}
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
                <select value={periodType} onChange={e => setPeriodType(e.target.value as any)}>
                  <option value="week">Semaine</option>
                  <option value="month">Mois</option>
                  <option value="year">Année</option>
                </select>
              </div>

              <div className="filter-item">
                <label>Date base</label>
                <input type="date" value={baseDate} onChange={e => setBaseDate(e.target.value)} />
              </div>

              <div className="filter-item checkbox-item">
                <label>
                  <input
                    type="checkbox"
                    checked={applyPeriodFilter}
                    onChange={e => setApplyPeriodFilter(e.target.checked)}
                  />
                  Appliquer la période
                </label>
              </div>
            </div>
          </div>

          <div className="range-panel">
            <div className="badge scope">{scopeLabel}</div>
            <div className="badge">{heatmapActivities.length} activités</div>
          </div>
        </div>
      </header>

      <main>
        <HeatmapViewer activities={heatmapActivities} height="100%" />
      </main>
    </div>
  )
}
