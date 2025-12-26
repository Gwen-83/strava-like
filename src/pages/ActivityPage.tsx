import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { doc, getDoc } from "firebase/firestore"
import { db } from "../firebase"
import type { ActivityDetails } from "../types/Activity"
import { reverseGeocode } from "../services/geocoding"

function ActivityPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [activity, setActivity] = useState<ActivityDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [startCity, setStartCity] = useState<string | null>(null)
  const [endCity, setEndCity] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const fetchActivity = async () => {
      setLoading(true)

      const activityRef = doc(db, "activities", id)
      const detailsRef = doc(db, "activityDetails", id)

      const [activitySnap, detailsSnap] = await Promise.all([
        getDoc(activityRef),
        getDoc(detailsRef),
      ])

      if (!activitySnap.exists()) {
        setLoading(false)
        return
      }

      const a = activitySnap.data()
      const d = detailsSnap.exists() ? detailsSnap.data() : {}

      setActivity({
        id,
        userId: a.userId,
        source: a.source,
        externalId: a.externalId,
        sport: a.sport,
        startDate: a.startDate.toDate(),
        createdAt: a.createdAt.toDate(),

        distance_m: a.distance_m,
        duration_s: a.duration_s,
        elevation_m: a.elevation_m,
        avg_speed_ms: a.avg_speed_ms ?? null,
        max_speed_ms: a.max_speed_ms ?? null,
        avg_watts: a.avg_watts ?? null,
        energy_kj: a.energy_kj ?? null,
        load: a.load ?? null,

        has_gps: a.has_gps,
        has_streams: a.has_streams,
        has_power: a.has_power,

        polyline: d.polyline ?? null,
        startLatLng: d.startLatLng ?? null,
        endLatLng: d.endLatLng ?? null,
        streams: d.streams ?? null,
      })

      setLoading(false)
    }

    fetchActivity()
  }, [id])

  useEffect(() => {
    if (!activity || !activity.startLatLng || !activity.endLatLng) return

    const loadCities = async () => {
        const [startLat, startLng] = activity.startLatLng as [number, number]
        const [endLat, endLng] = activity.endLatLng as [number, number]

        const [start, end] = await Promise.all([
        reverseGeocode(startLat, startLng),
        reverseGeocode(endLat, endLng),
        ])

        setStartCity(start)
        setEndCity(end)
    }

    loadCities()
  }, [activity?.startLatLng, activity?.endLatLng])

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${h} h ${m.toString().padStart(2, "0")} min${s > 0 ? ` ${s}s` : ""}`
    }
    if (m > 0) return `${m} min${s > 0 ? ` ${s}s` : ""}`
    return `${s} s`
  }

  if (loading) return <p>Chargement de l'activité…</p>
  if (!activity) return <p>Activité introuvable</p>

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => navigate(-1)}>← Retour</button>

      <h2>Détails de l'activité</h2>

      <p><strong>Type :</strong> {activity.sport}</p>
      <p><strong>Date :</strong> {activity.startDate.toLocaleString()}</p>
      {startCity && (<p><strong>Départ :</strong> {startCity}</p>)}
      {endCity && (<p><strong>Arrivée :</strong> {endCity}</p>)}

      <p>
        <strong>Distance :</strong>{" "}
        {(activity.distance_m / 1000).toFixed(2)} km
      </p>

      <p> 
        <strong>Durée :</strong>
        {" "} {formatDuration(activity.duration_s)} 
      </p>

      <p><strong>D+ :</strong> {activity.elevation_m} m</p>

      <p> 
        <strong>Vitesse moyenne :</strong>
        {" "} {activity.avg_speed_ms != null ? (activity.avg_speed_ms * 3.6).toFixed(2) : "-"}{" "} km/h 
      </p>

      <p>
        <strong>Puissance moyenne :</strong>{" "}
        {activity.avg_watts !== null ? activity.avg_watts : "-"} W
      </p>

      <p>
        <strong>Énergie :</strong>{" "}
        {activity.energy_kj !== null ? activity.energy_kj : "-"} kJ
      </p>

      <p><strong>GPS :</strong> {activity.has_gps ? "Oui" : "Non"}</p>
      <p><strong>Streams :</strong> {activity.has_streams ? "Oui" : "Non"}</p>
      <p><strong>Puissance :</strong> {activity.has_power ? "Oui" : "Non"}</p>

      {activity.polyline && (
        <p><strong>Trace GPS :</strong> disponible</p>
      )}
    </div>
  )
}

export default ActivityPage