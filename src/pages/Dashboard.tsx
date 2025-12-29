import { useEffect, useState } from "react"
import { auth, db } from "../firebase"
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore"
import type { ActivitySummary } from "../types/Activity"
import "../styles/dashboard.css";
import "../styles/global.css";
import { useNavigate } from "react-router-dom";
import MainPage from "./MainPage";
import ChartsPage from "./ChartsPage";
import ComparisonsStatsPage from "./ComparisonsStatsPage";
import ActivitiesPage from "./ActivitiesPage";
import ProfilePage from "./ProfilePage";
import { useUser } from "../contexts/UserContext";

function Dashboard() {
  const { username } = useUser();
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [selected, setSelected] = useState<ActivitySummary | null>(null)
  const [activeTab, setActiveTab] = useState<"Accueil" | "Analyse" | "Entrainement" | "Profil">("Accueil")
  const [analysisSubTab, setAnalysisSubTab] = useState<"Graphiques" | "Stats">("Graphiques")
  const [showAnalyseMenu, setShowAnalyseMenu] = useState(false)
  const [showEntrainementMenu, setShowEntrainementMenu] = useState(false)
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

  function handleStravaImport() {
    if (typeof window === "undefined") return;

    const clientId = "163923";
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/strava-callback`
    );
    const scope = "read,activity:read_all";

    window.location.href =
      `https://www.strava.com/oauth/authorize` +
      `?client_id=${clientId}` +
      `&response_type=code` +
      `&redirect_uri=${redirectUri}` +
      `&approval_prompt=force` +
      `&scope=${scope}`;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-inner">
        <header className="dashboard-header" style={{display: "flex", alignItems: "center", gap: 12}}>
          <h2 className="header-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Dashboard</span>
            {username ? <span style={{ color: "#666", fontSize: 14 }}>({username})</span> : null}
          </h2>
          <nav className="tabs" role="tablist" aria-label="Navigation principale" style={{marginLeft: 12}}>
            <button 
              className="tab-dropdown-toggle tab-button" 
              role="tab" 
              aria-selected={activeTab === "Accueil"} 
              onClick={() => { setActiveTab("Accueil"); setShowAnalyseMenu(false); setShowEntrainementMenu(false); }}
            >
              Accueil
            </button>

            {/* Analyse dropdown (open on hover; click on items changes content) */}
            <div
              className="tab-dropdown"
              onMouseEnter={() => setShowAnalyseMenu(true)}
              onMouseLeave={() => setShowAnalyseMenu(false)}
              style={{ display: "inline-block", position: "relative", marginRight: 12 }}
            >
              <button
                className="tab-dropdown-toggle"
                role="button"
                aria-haspopup="menu"
                aria-expanded={showAnalyseMenu}
                aria-selected={activeTab === "Analyse"}
              >
                Analyse ▾
              </button>
              {showAnalyseMenu && (
                <div className="tab-dropdown-menu" role="menu">
                  <button role="menuitem" onClick={() => { setAnalysisSubTab("Graphiques"); setActiveTab("Analyse"); setShowAnalyseMenu(false); }}>Graphiques</button>
                  <button role="menuitem" onClick={() => { setAnalysisSubTab("Stats"); setActiveTab("Analyse"); setShowAnalyseMenu(false); }}>Comparaisons & Stats</button>
                </div>
              )}
            </div>

            {/* Entrainement dropdown (pour l'instant un seul item) */}
            <div
              className="tab-dropdown"
              onMouseEnter={() => setShowEntrainementMenu(true)}
              onMouseLeave={() => setShowEntrainementMenu(false)}
              style={{ display: "inline-block", position: "relative", marginRight: 12 }}
            >
              <button className="tab-dropdown-toggle" role="button" aria-haspopup="menu" aria-expanded={showEntrainementMenu} aria-selected={activeTab === "Entrainement"}>
                Entrainement ▾
              </button>
              {showEntrainementMenu && (
                <div className="tab-dropdown-menu" role="menu">
                  <button role="menuitem" onClick={() => { setActiveTab("Entrainement"); setShowEntrainementMenu(false); }}>Activités</button>
                </div>
              )}
            </div>

            <button 
              className="tab-dropdown-toggle tab-button" 
              role="tab" 
              aria-selected={activeTab === "Profil"} 
              onClick={() => { setActiveTab("Profil"); setShowAnalyseMenu(false); setShowEntrainementMenu(false); }}
            >
              Profil
            </button>
          </nav>
        </header>

        <main className="dashboard-grid" aria-live="polite">
          {activeTab === "Accueil" && (
            <MainPage activities={activities} onImport={handleStravaImport} />
          )}
          {activeTab === "Analyse" && analysisSubTab === "Graphiques" && (
            <ChartsPage activities={activities} />
          )}
          {activeTab === "Analyse" && analysisSubTab === "Stats" && (
            <ComparisonsStatsPage activities={activities} />
          )}
          {activeTab === "Entrainement" && (
            <ActivitiesPage activities={activities} onSelect={setSelected} />
          )}
          {activeTab === "Profil" && (
            <ProfilePage />
          )}
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