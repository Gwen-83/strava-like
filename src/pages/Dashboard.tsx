import { useEffect, useState } from "react"
import { auth, db } from "../firebase"
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore"
import type { ActivitySummary } from "../types/Activity"
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ResponsiveContainer } from "recharts";
import {groupByWeek, groupElevationByMonth, trainingLoad} from "../utils/aggregates";
import { compareWeeks } from "../utils/comparisons";
import AccordionSection from "../components/AccordionSection";
import "../styles/dashboard.css";
import "../styles/global.css";
import { useNavigate } from "react-router-dom";

// Calcul simple de stats (tolérant sur données manquantes)
function calculateStats(activities: ActivitySummary[]) {
  const validActivities = activities.filter(a => {
    if (a.isSuspicious) {
      console.warn("STATS_IGNORE_SUSPICIOUS_ACTIVITY", {
        id: a.id,
        distance: a.distance_m,
        duration: a.duration_s,
      })
      return false
    }
    return true
  })

  const totalDistance = validActivities.reduce(
    (sum, a) => sum + (Number.isFinite(a.distance_m) ? a.distance_m : 0),
    0
  )

  const totalDuration = validActivities.reduce(
    (sum, a) => sum + (Number.isFinite(a.duration_s) ? a.duration_s : 0),
    0
  )

  const averageSpeed = totalDuration ? totalDistance / totalDuration : NaN

  const elevationValues = validActivities
    .map(a => (Number.isFinite(a.elevation_m as any) ? a.elevation_m as number : NaN))
    .filter(v => Number.isFinite(v))

  const totalElevation = elevationValues.length
    ? elevationValues.reduce((s, v) => s + v, 0)
    : NaN

  return {
    totalDistance,
    averageSpeed,
    totalElevation,
    hasElevation: elevationValues.length > 0,
  }
}

function Dashboard() {
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [selected, setSelected] = useState<ActivitySummary | null>(null)
  const [sportFilter, setSportFilter] = useState<"All" | "Ride" | "Run" | "Walk">("All")
  const filteredActivities = activities.filter(a => sportFilter === "All" || a.sport === sportFilter)
  const filteredStats = calculateStats(filteredActivities)
  const distanceByWeek = groupByWeek(filteredActivities);
  const elevationByMonth = groupElevationByMonth(filteredActivities);
  const trainingLoadData = trainingLoad(filteredActivities);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return

    const q = query(
      collection(db, "activities"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("startDate", "desc")
    )

    const unsubscribe = onSnapshot(q, snapshot => {
      console.info("[ACTIVITIES] total docs from Firestore:", snapshot.docs.length)
      const acts = snapshot.docs.map(doc => {
        try {
          const data = doc.data()

          return {
            id: doc.id,
            ...data,
            startDate: data.startDate.toDate(),
            createdAt: data.createdAt.toDate(),
          }
        } catch (e) {
          console.error("ACTIVITY_PARSE_ERROR", {
            id: doc.id,
            error: e,
          })
          return null
        }
      }).filter(Boolean) as ActivitySummary[]
      console.group("Firestore snapshot")
      console.log("Total docs in snapshot:", snapshot.size)
      console.log("Parsed activities count:", acts.length)
      console.log("IDs:", acts.map(a => a.id))
      console.groupEnd()
      
      setActivities(acts)
    })

    return () => unsubscribe()
  }, [])

  const weekComparison = compareWeeks(filteredActivities);

  function delta(current: number, previous: number) {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

function handleStravaImport() {
  const clientId = "163923";
  const redirectUri = encodeURIComponent(
    "https://strava-like-six.vercel.app/strava-callback"
  );
  const scope = "read,activity:read_all";

  const stravaAuthUrl =
    `https://www.strava.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${redirectUri}` +
    `&approval_prompt=force` +
    `&scope=${scope}`;

  window.location.href = stravaAuthUrl;
}

  return (
    <div className="dashboard">
      <div className="dashboard-inner">
        <header className="dashboard-header" style={{display: "flex", alignItems: "center", gap: 12}}>
          <h2 className="header-title">Dashboard</h2>
        </header>

        <div className="dashboard-actions" role="group" aria-label="Filtres et import">
          <label style={{display:"none"}} htmlFor="sport-filter">Filtrer sport</label>
          <select
            id="sport-filter"
            className="sort"
            value={sportFilter}
            onChange={e => setSportFilter(e.target.value as any)}
            aria-label="Filtrer par sport"
          >
            <option value="All">Tous</option>
            <option value="Ride">Ride</option>
            <option value="Run">Run</option>
            <option value="Walk">Walk</option>
          </select>
          <button
            className="import"
            onClick={handleStravaImport}
            aria-label="Importer depuis Strava"
            title="Importer activités depuis Strava"
          >
            Importer Strava
          </button>
        </div>

        <main className="dashboard-grid">
          <AccordionSection title="Graphiques">
           <section className="charts-grid">
             <div className="chart-card">
               <h3>Distance par semaine (km)</h3>
               <ResponsiveContainer width="100%" height={220}>
                 <LineChart data={distanceByWeek}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis dataKey="week" />
                   <YAxis />
                   <Tooltip />
                   <Line type="monotone" dataKey="distance" stroke="#8884d8" />
                 </LineChart>
               </ResponsiveContainer>
             </div>
             <div className="chart-card">
               <h3>Dénivelé par mois (m)</h3>
               <ResponsiveContainer width="100%" height={220}>
                 <BarChart data={elevationByMonth}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis dataKey="month" />
                   <YAxis />
                   <Tooltip />
                   <Bar dataKey="elevation" fill="#82ca9d" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
             <div className="chart-card">
               <h3>Charge d'entraînement</h3>
               <ResponsiveContainer width="100%" height={220}>
                 <LineChart data={trainingLoadData}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis dataKey="date" />
                   <YAxis />
                   <Tooltip />
                   <Line type="monotone" dataKey="value" stroke="#ffc658" />
                 </LineChart>
               </ResponsiveContainer>
             </div>
           </section>
          </AccordionSection>

          <AccordionSection title="stats">
           <section className="stats-section">
             <div className="stat-card">
               <span>Distance</span>
               <strong>{(filteredStats.totalDistance / 1000).toFixed(1)} km</strong>
             </div>
 
             <div className="stat-card">
               <span>Vitesse moy.</span>
               <strong>{(filteredStats.averageSpeed * 3.6).toFixed(1)} km/h</strong>
             </div>
 
             <div className="stat-card">
               <span>D+</span>
               <strong>
                 {filteredStats.hasElevation
                   ? `${Math.round(filteredStats.totalElevation)} m`
                   : "non mesuré"}
               </strong>
             </div>
           </section>
          </AccordionSection>
 
          <AccordionSection title="Comparaisons hebdomadaires" defaultOpen>
           <div className="comparison-grid">
             <div className="comparison-card">
               <span>Distance </span>
               <strong>
                 {(weekComparison.current.distance / 1000).toFixed(1)} km
               </strong>
               <small>
                 {delta(
                   weekComparison.current.distance,
                   weekComparison.previous.distance
                 ).toFixed(1)} %
               </small>
             </div>
 
             <div className="comparison-card">
               <span>D+ </span>
               <strong>{weekComparison.current.elevation.toFixed(0)} m</strong>
               <small>
                 {delta(
                   weekComparison.current.elevation,
                   weekComparison.previous.elevation
                 ).toFixed(1)} %
               </small>
             </div>
 
             <div className="comparison-card">
               <span>Charge </span>
               <strong>{weekComparison.current.load.toFixed(1)}</strong>
               <small>
                 {delta(
                   weekComparison.current.load,
                   weekComparison.previous.load
                 ).toFixed(1)} %
               </small>
             </div>
           </div>
          </AccordionSection>
 
          <AccordionSection title={`Activités (${filteredActivities.length})`}>
           <ul className="activities-list">
             {filteredActivities.map(a => (
               <li
                 key={a.id}
                 className="activity-card"
                 onClick={() => setSelected(a)}
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
          </AccordionSection>
        </main>

        {selected && (
           <div className="activity-detail-overlay" onClick={() => setSelected(null)}>
             <div
               className="activity-detail-card"
               onClick={e => e.stopPropagation()}
             >
               <h4>Détail activité</h4>
 
               <p><strong>Type :</strong> {selected.sport}</p>
               <p><strong>Date :</strong> {selected.startDate.toLocaleString()}</p>
               <p><strong>Distance :</strong> {(selected.distance_m / 1000).toFixed(1)} km</p>
               <p><strong>Durée :</strong> {(selected.duration_s / 60).toFixed(1)} min</p>
               <p><strong>D+ :</strong> {Number.isFinite(selected.elevation_m as any) ? `${selected.elevation_m} m` : "non mesuré"}</p>
               <p>
                <button onClick={() => navigate(`/activity/${selected.id}`)}>
                  Voir en détail
                </button>
               </p>

               <button onClick={() => setSelected(null)}>Fermer</button>
             </div>
           </div>
         )}
       </div>
     </div>
   )
 }
 
 export default Dashboard