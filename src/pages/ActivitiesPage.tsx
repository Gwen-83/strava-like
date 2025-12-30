import type { ActivitySummary } from "../types/Activity"
import { useState } from "react"

export default function ActivitiesPage({ activities, onSelect }: { activities: ActivitySummary[], onSelect: (a: ActivitySummary) => void }) {
  const [sportFilter, setSportFilter] = useState<"All" | "Cyclisme" | "Course" | "Marche" | "Randonnée">("All")
  const filteredActivities = activities.filter(a =>sportFilter === "All" || a.sport === sportFilter)
  return (
    <section className="section-activities" title={`Activités (${activities.length})`}>
      <div className="dashboard-actions" role="group" aria-label="Filtres">
        <label style={{display:"none"}} htmlFor="sport-filter">Filtrer sport</label>
        <select
          id="sport-filter"
          className="sort"
          value={sportFilter}
          onChange={e => setSportFilter(e.target.value as any)}
          aria-label="Filtrer par sport"
        >
          <option value="All">Tous</option>
          <option value="Cyclisme">Cyclisme</option>
          <option value="Course">Course</option>
          <option value="Marche">Marche</option>
          <option value="Randonnée">Randonnée</option>
        </select>
      </div>
      <ul className="activities-list">
        {filteredActivities.map(a => (
          <li
            key={a.id}
            className="activity-card"
            onClick={() => onSelect(a)}
          >
            <div>
              <strong>{a.sport}</strong>
              <span>
                {(a.distance_m / 1000).toFixed(1)} km •{" "}
                {(a.duration_s / 60).toFixed(0)} min
              </span>
            </div>
            <small>
              {a.startDate.toLocaleDateString()} •{" "}
              {Number.isFinite(a.elevation_m as any) ? `${a.elevation_m} m D+` : "non mesuré"}
            </small>
          </li>
        ))}
      </ul>
    </section>
  )
}
