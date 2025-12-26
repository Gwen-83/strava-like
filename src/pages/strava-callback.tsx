import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { upsertActivitySummary, findSimilarActivities } from "../services/activitiesSummary"
import { analyzeActivitySuspicion } from "../types/suspicion"
import { auth } from "../firebase"
import { getLastImportDate, updateLastImportDate } from "../services/users"
import { mapStravaToSummary, mapStravaToDetails } from "../mappers/StravaMappers"
import { upsertActivityDetails } from "../services/activityDetails"

function StravaCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    if (!code) return

    async function importActivities() {
      const res = await fetch(`/api/strava-oauth?code=${code}`)
      const data = await res.json()

      if (!res.ok || !data.activities || !auth.currentUser) return

      const userId = auth.currentUser.uid
      const lastImport = await getLastImportDate(userId)

      const potentialDuplicates: { imported: any; candidates: any[] }[] = []
      const potentialSuspects: { raw: any; summary: any; reasons: string[] }[] = []

      for (const raw of data.activities) {
        const startDate = new Date(raw.start_date)

        if (lastImport && startDate <= lastImport) continue

        const summary = mapStravaToSummary(raw, userId)

        // Vérifier suspicion avant insertion
        try {
          const suspectRes = analyzeActivitySuspicion({
            sport: summary.sport,
            distance_m: summary.distance_m,
            duration_s: summary.duration_s,
            elevation_m: summary.elevation_m ?? 0,
            avg_speed_ms: summary.avg_speed_ms ?? null,
            has_gps: summary.has_gps,
            has_streams: summary.has_streams,
            polyline: raw.map?.summary_polyline ?? null,
            streams: undefined
          })

          if (suspectRes.isSuspicious) {
            potentialSuspects.push({ raw, summary, reasons: suspectRes.suspicionReasons })
            continue // skip automatic insert
          }
        } catch (e) {
          console.warn("suspicion check failed for imported activity", e)
          // fallthrough -> try insert
        }

        // 1) recherche de doublons potentiels multi-niveaux
        const candidates = await findSimilarActivities(userId, summary)
        const top = candidates[0]
        const THRESHOLD = 0.7
        if (top && top.score >= THRESHOLD) {
          potentialDuplicates.push({
            imported: { raw, summary },
            candidates: candidates.slice(0, 5).map(c => ({ id: c.id, score: c.score }))
          })
          continue
        }

        const activityId = await upsertActivitySummary(summary)

        const details = mapStravaToDetails(raw, userId, activityId)
        await upsertActivityDetails(details)
      }

      // Exposer suspects au frontend pour confirmation/suppression manuelle
      if (potentialSuspects.length > 0) {
        try {
          sessionStorage.setItem("importSuspects", JSON.stringify(potentialSuspects))
          navigate("/dashboard?suspects=1")
          return
        } catch (e) {
          console.warn("Impossible de stocker les suspects en sessionStorage", e)
        }
      }

      // Si doublons détectés, les exposer au frontend pour permettre fusion via l'UI
      if (potentialDuplicates.length > 0) {
        try {
          sessionStorage.setItem("importDuplicates", JSON.stringify(potentialDuplicates))
          // flag pour indiquer à l'UI d'afficher la proposition de fusion
          navigate("/dashboard?duplicates=1")
          return
        } catch (e) {
          console.warn("Impossible de stocker les doublons en sessionStorage", e)
        }
      }

      if (data.activities.length > 0) {
        const newest = new Date(
          Math.max(...data.activities.map((a: any) =>
            new Date(a.start_date).getTime()
          ))
        )
        await updateLastImportDate(userId, newest)
      }

      navigate("/dashboard")
    }

    importActivities().catch(console.error)
  }, [])

  return <p>Import des activités Strava en cours…</p>
}

export default StravaCallback
