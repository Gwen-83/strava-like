import type { ActivitySummary, ActivityDetails } from "../types/Activity"
import { useState } from "react"
import { saveAs } from 'file-saver';
import { FileImportDialog } from "../components/FileImportDialog"

export default function ActivitiesPage({ 
  activities, 
  onSelect,
  userId,
  onFileImport
}: { 
  activities: ActivitySummary[], 
  onSelect: (a: ActivitySummary) => void,
  userId?: string,
  onFileImport?: (activity: ActivityDetails) => Promise<void>
}) {
  const [sportFilter, setSportFilter] = useState<"All" | "Cyclisme" | "Course" | "Marche" | "Randonnée">("All")
  const [minDPlus, setMinDPlus] = useState<number | "">("")
  const [minDistance, setMinDistance] = useState<number | "">("")
  const [maxDistance, setMaxDistance] = useState<number | "">("")
  const [dateFilter, setDateFilter] = useState<string>("")

  const filteredActivities = activities.filter(a => {
    return (sportFilter === "All" || a.sport === sportFilter) &&
           (minDPlus === "" || (a.elevation_m ??0)>= minDPlus) &&
           (minDistance === "" || (a.distance_m / 1000) >= minDistance) &&
           (maxDistance === "" || (a.distance_m / 1000) <= maxDistance) &&
           (dateFilter === "" || a.startDate.toISOString().startsWith(dateFilter));
  });

  const exportCSV = () => {
    const headers = ["ID", "Sport", "Distance (km)", "Duration (min)", "D+"];
    const rows = activities.map(a => [
      a.id,
      a.sport,
      (a.distance_m / 1000).toFixed(2),
      (a.duration_s / 60).toFixed(0),
      a.elevation_m ?? "non mesuré"
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'activities.csv');
  }

  return (
    <section className="section-activities" title={`Activités (${activities.length})`}>
      <div className="dashboard-actions" role="group" aria-label="Filtres" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={exportCSV} style={{ padding: '8px', backgroundColor: '#60a5fa', color: '#fff', borderRadius: '4px' }}>Exporter CSV</button>
          {userId && onFileImport && (
            <FileImportDialog 
              userId={userId} 
              onImportSuccess={onFileImport}
            />
          )}
        </div>
        <label style={{display:"none"}} htmlFor="sport-filter">Filtrer sport</label>
        <select
          id="sport-filter"
          className="sort"
          value={sportFilter}
          onChange={e => setSportFilter(e.target.value as any)}
          aria-label="Filtrer par sport"
          style={{ padding: '8px' }} // Amélioration du style
        >
          <option value="All">Tous</option>
          <option value="Cyclisme">Cyclisme</option>
          <option value="Course">Course</option>
          <option value="Marche">Marche</option>
          <option value="Randonnée">Randonnée</option>
        </select>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="number" placeholder="D+ min" value={minDPlus} onChange={e => setMinDPlus(Number(e.target.value) || "")} style={{ padding: '8px' }} />
          <input type="number" placeholder="Distance min (km)" value={minDistance} onChange={e => setMinDistance(Number(e.target.value) || "")} style={{ padding: '8px' }} />
          <input type="number" placeholder="Distance max (km)" value={maxDistance} onChange={e => setMaxDistance(Number(e.target.value) || "")} style={{ padding: '8px' }} />
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px' }} />
        </div>
      </div>
      <ul className="activities-list">
        {filteredActivities.map(a => (
          <li
            key={a.id}
            className="activity-card"
            onClick={() => onSelect(a)}
          >
            <div>
              <strong>
                {a.sport}
                {a.manualSportOverride && <span style={{ fontSize: "12px", color: "#888", marginLeft: "4px" }}>(import manuel)</span>}
              </strong>
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
