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

  // Crée un path SVG simple à partir d'une polyline ou de start/end
  const MiniMap = ({ polyline, startLatLng, endLatLng }: { polyline?: string | null, startLatLng?: [number,number] | null, endLatLng?: [number,number] | null }) => {
    const width = 340, height = 220, pad = 8

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
      const x = pad + ((lng - minLng) / lngRangeNonZero) * (width - pad * 2)
      const y = pad + (1 - (lat - minLat) / latRangeNonZero) * (height - pad * 2)
      return [x, y]
    })

    const d = coords.map((p, i) => (i === 0 ? `M ${p[0].toFixed(2)} ${p[1].toFixed(2)}` : `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`)).join(" ")

    return (
      <div
        className="mini-map card"
        style={{
          width,
          height,
          padding: 8,
          position: "relative",
          overflow: "hidden",
          borderRadius: 10,
          background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))"
        }}
      >
        {/* Semi-transparent overlay to increase contrast with SVG */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.12))" }} />
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" style={{ position: "relative", display: "block" }}>
          <rect x="0" y="0" width={width} height={height} fill="transparent" rx="8" />
          <path d={d} stroke="#60a5fa" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {/* start / end markers */}
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

          <p><strong>Distance :</strong> {(activity.distance_m / 1000).toFixed(2)} km</p>
          <p><strong>Durée :</strong> {formatDuration(activity.duration_s)}</p>
          <p><strong>D+ :</strong> {activity.elevation_m} m</p>

          <p><strong>Vitesse moyenne :</strong> {activity.avg_speed_ms != null ? (activity.avg_speed_ms * 3.6).toFixed(2) : "-"} km/h</p>
          <p><strong>Puissance moyenne :</strong> {activity.avg_watts !== null ? activity.avg_watts : "-"} W</p>
          <p><strong>Énergie :</strong> {activity.energy_kj !== null ? activity.energy_kj : "-"} kJ</p>

          <div style={{ marginTop: 12 }}>
            <strong>Localisation</strong>
            <p className="small">{startCity ? `Départ : ${startCity}` : "Départ : —"}</p>
            <p className="small">{endCity ? `Arrivée : ${endCity}` : "Arrivée : —"}</p>
          </div>

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
            <div style={{ marginTop:10, display:"flex", justifyContent:"space-between" }}>
              <div>
                <div className="small">Vitesse moyenne</div>
                <strong>{activity.avg_speed_ms != null ? (activity.avg_speed_ms*3.6).toFixed(1) : "-" } km/h</strong>
              </div>
              <div>
                <div className="small">Puissance</div>
                <strong>{activity.avg_watts ?? "-" } W</strong>
              </div>
              <div>
                <div className="small">Énergie</div>
                <strong>{activity.energy_kj ?? "-"} kJ</strong>
              </div>
            </div>
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