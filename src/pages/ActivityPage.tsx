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
  const [loadMethod, setLoadMethod] = useState<string | null>(null) // 'hr' | 'speed' | 'none'

  // Détermine la méthode de calcul de la charge pour une activité donnée
  const determineLoadMethod = (act: any) => {
    const REST_HR = 48
    const REF_SPEEDS_KMH: Record<string, number> = { Walk: 5, Ride: 25, Run: 10 }

    const avgH = Number.isFinite(act.avg_hrt) ? act.avg_hrt : NaN
    const maxH = Number.isFinite(act.max_hrt) ? act.max_hrt : NaN
    if (Number.isFinite(avgH) && Number.isFinite(maxH) && (maxH - REST_HR) !== 0) {
      return "hr"
    }

    const durS = Number.isFinite(act.duration_s) ? act.duration_s : NaN
    const distM = Number.isFinite(act.distance_m) ? act.distance_m : NaN
    const speedKmh = Number.isFinite(distM) && Number.isFinite(durS) && durS > 0 ? (distM / durS) * 3.6 : NaN
    const ref = act.sport && REF_SPEEDS_KMH[act.sport] ? REF_SPEEDS_KMH[act.sport] : NaN
    if (Number.isFinite(speedKmh) && Number.isFinite(ref) && ref > 0) {
      return "speed"
    }

    return "none"
  }

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

      const actObj = {
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
        // ajoutés :
        max_elevation: d.max_elevation ?? null,
        min_elevation: d.min_elevation ?? null,
        avg_hrt: d.avg_hrt ?? null,
        max_hrt: d.max_hrt ?? null,

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
      }

      setActivity(actObj)
      setLoadMethod(determineLoadMethod(actObj))
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

  // Decodeur polyline (Google-style) — renvoie [[lat,lng],...]
  const decodePolyline = (str: string) => {
    const coordinates: [number, number][] = []
    let index = 0, lat = 0, lng = 0

    while (index < str.length) {
      let result = 0, shift = 0, b
      do {
        b = str.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1)
      lat += deltaLat

      result = 0; shift = 0
      do {
        b = str.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1)
      lng += deltaLng

      coordinates.push([lat / 1e5, lng / 1e5])
    }

    return coordinates
  }

  const MiniMap = ({ polyline, startLatLng, endLatLng }: { polyline?: string | null, startLatLng?: [number,number] | null, endLatLng?: [number,number] | null }) => {
    const maxWidth = 340
    const height = 220
    const pad = 8

    let points: [number, number][] = []
    if (polyline) {
      try { points = decodePolyline(polyline) } catch { points = [] }
    } else if (startLatLng && endLatLng) {
      points = [startLatLng, endLatLng]
    } else if (startLatLng) {
      points = [startLatLng]
    }

    if (points.length === 0) {
      return <div className="mini-map empty card" style={{ height }}>{/* placeholder */}Aucune trace</div>
    }

    const lats = points.map(p => p[0])
    const lngs = points.map(p => p[1])
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)

    const latRangeNonZero = (maxLat - minLat) || 0.0001
    const lngRangeNonZero = (maxLng - minLng) || 0.0001

    const coords = points.map(([lat, lng]) => {
      const x = pad + ((lng - minLng) / lngRangeNonZero) * (maxWidth - pad * 2)
      const y = pad + (1 - (lat - minLat) / latRangeNonZero) * (height - pad * 2)
      return [x, y]
    })

    const d = coords.map((p, i) => (i === 0 ? `M ${p[0].toFixed(2)} ${p[1].toFixed(2)}` : `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`)).join(" ")

    return (
      <div
        className="mini-map card"
        style={{
          width: "100%",
          maxWidth,
          height,
          padding: 8,
          position: "relative",
          overflow: "hidden",
          borderRadius: 10,
          background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))"
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.12))" }} />
        <svg width="100%" height="100%" viewBox={`0 0 ${maxWidth} ${height}`} xmlns="http://www.w3.org/2000/svg" style={{ position: "relative", display: "block" }}>
          <rect x="0" y="0" width={maxWidth} height={height} fill="transparent" rx="8" />
          <path d={d} stroke="#60a5fa" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {coords[0] && <circle cx={coords[0][0]} cy={coords[0][1]} r={4} fill="#10b981" stroke="#00000055" strokeWidth={1} />}
          {coords.length > 1 && <circle cx={coords[coords.length-1][0]} cy={coords[coords.length-1][1]} r={4} fill="#f59e0b" stroke="#00000055" strokeWidth={1} />}
        </svg>
      </div>
    )
  }

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
    <div className="container activity-page" style={{ gap: 18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <h2>Détails de l'activité</h2>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => navigate(-1)} className="secondary">← Retour</button>
          <button onClick={() => window.print()}>Imprimer</button>
        </div>
      </div>

      <div className="activity-grid">
        <div className="card main-content">
          <h3 style={{ marginTop: 0 }}>{activity.sport} — {activity.startDate.toLocaleDateString()}</h3>

          {/* Distance et durée (gardés visibles si présents) */}
          {activity.distance_m != null && <p><strong>Distance :</strong> {(activity.distance_m / 1000).toFixed(2)} km</p>}
          {activity.duration_s != null && <p><strong>Durée :</strong> {formatDuration(activity.duration_s)}</p>}

          {/* Élévations / altitudes : afficher seulement si chaque valeur existe */}
          {activity.elevation_m != null && <p><strong>D+ :</strong> {activity.elevation_m} m</p>}
          {activity.max_elevation != null && <p><strong>Altitude maximale :</strong> {activity.max_elevation} m</p>}
          {activity.min_elevation != null && <p><strong>Altitude minimale :</strong> {activity.min_elevation} m</p>}

          {/* Vitesses / puissance / énergie / FC : afficher seulement si valeurs présentes */}
          {activity.avg_speed_ms != null && <p><strong>Vitesse moyenne :</strong> {(activity.avg_speed_ms * 3.6).toFixed(2)} km/h</p>}
          {activity.max_speed_ms != null && <p><strong>Vitesse maximale :</strong> {(activity.max_speed_ms * 3.6).toFixed(2)} km/h</p>}
          {activity.avg_watts != null && <p><strong>Puissance moyenne :</strong> {activity.avg_watts} W</p>}
          {activity.energy_kj != null && <p><strong>Énergie :</strong> {activity.energy_kj} kJ</p>}
          {activity.avg_hrt != null && <p><strong>FC moyenne :</strong> {activity.avg_hrt} bpm</p>}
          {activity.max_hrt != null && <p><strong>FC maximale :</strong> {activity.max_hrt} bpm</p>}
          {loadMethod != null && (
            <p>
              <strong>Méthode de calcul (charge) :</strong>{" "}
              {loadMethod === "hr" ? "FC (K)" : loadMethod === "speed" ? "Vitesse (fallback)" : "Indisponible"}
            </p>
          )}

          {/* Localisation : n'afficher la section que si au moins une ville existe */}
          {(startCity || endCity) && (
            <div style={{ marginTop: 12 }}>
              <strong>Localisation</strong>
              {startCity && <p className="small">Départ : {startCity}</p>}
              {endCity && <p className="small">Arrivée : {endCity}</p>}
            </div>
          )}

          {activity.polyline && (
            <div style={{ marginTop: 12 }}>
              <strong>Trace GPS</strong>
              <p className="small">Disponible — aperçu ci-contre</p>
            </div>
          )}
        </div>

        <aside className="sidebar">
          <div className="card" style={{ padding:12 }}>
            <MiniMap polyline={activity.polyline ?? null} startLatLng={activity.startLatLng ?? null} endLatLng={activity.endLatLng ?? null} />

            {/* Sidebar metrics : n'afficher la rangée que si au moins une métrique existe */}
            {(activity.avg_speed_ms != null || activity.avg_watts != null || activity.energy_kj != null) && (
              <div style={{ marginTop:10, display:"flex", justifyContent:"space-between" }}>
                {activity.avg_speed_ms != null && (
                  <div>
                    <div className="small">Vitesse moyenne</div>
                    <strong>{(activity.avg_speed_ms*3.6).toFixed(1)} km/h</strong>
                  </div>
                )}
                {activity.avg_watts != null && (
                  <div>
                    <div className="small">Puissance</div>
                    <strong>{activity.avg_watts} W</strong>
                  </div>
                )}
                {activity.energy_kj != null && (
                  <div>
                    <div className="small">Énergie</div>
                    <strong>{activity.energy_kj} kJ</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card" style={{ padding:12 }}>
            <h4 style={{ margin: 0 }}>Méta</h4>
            <p className="small">Source: {activity.source}</p>
            <p className="small">Importée le: {activity.createdAt.toLocaleString()}</p>
            <p className="small">GPS: {activity.has_gps ? "Oui" : "Non"} · Streams: {activity.has_streams ? "Oui" : "Non"}</p>
            <div style={{ marginTop:8 }}>
              <button className="secondary" onClick={() => alert("Fonctionnalité à venir")}>Exporter</button>
              <button style={{ marginLeft:8 }} onClick={() => alert("Partage à venir")}>Partager</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default ActivityPage