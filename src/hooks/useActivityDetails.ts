import { useEffect, useState } from "react"
import type { ActivitySummary, ActivityDetails } from "../types/Activity"
import { getActivityDetails } from "../services/activityDetails"

/**
 * Hook pour charger les détails des activités avec GPS
 * Récupère polyline, startLatLng, endLatLng depuis activityDetails
 */
export function useActivityDetails(activities: ActivitySummary[]) {
  const [enrichedActivities, setEnrichedActivities] = useState<ActivityDetails[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activities || activities.length === 0) {
      setEnrichedActivities([])
      return
    }

    setLoading(true)

    const loadDetails = async () => {
      try {
        const enriched: ActivityDetails[] = await Promise.all(
          activities.map(async (activity) => {
            if (!activity.id) {
              // Pas d'ID, retourner telle quelle
              return activity as ActivityDetails
            }

            try {
              // Charger les détails depuis activityDetails
              const details = await getActivityDetails(activity.id)
              
              if (details) {
                // Fusionner les détails avec le résumé
                return {
                  ...activity,
                  ...details,
                } as ActivityDetails
              }
            } catch (error) {
              console.warn(`Erreur chargement détails pour ${activity.id}:`, error)
            }

            // Si erreur ou pas de détails, retourner le résumé enrichi
            return activity as ActivityDetails
          })
        )

        setEnrichedActivities(enriched)
        console.log(`✅ Chargement détails: ${enriched.filter(a => (a as any).polyline).length}/${enriched.length} avec polyline`)
      } catch (error) {
        console.error("Erreur critique chargement détails activités:", error)
        setEnrichedActivities(activities as ActivityDetails[])
      } finally {
        setLoading(false)
      }
    }

    loadDetails()
  }, [activities])

  return { enrichedActivities, loading }
}
