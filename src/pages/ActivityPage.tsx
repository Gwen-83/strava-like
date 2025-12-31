import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { doc, getDoc } from "firebase/firestore"
import { db } from "../firebase"
import type { ActivityDetails } from "../types/Activity"
import { reverseGeocode } from "../services/geocoding"
import exportImage from "../services/exportImage"

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

  // ajout : helpers d'export
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1))
    return Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1)/7)
  }

  const computeDerived = (act: ActivityDetails) => {
    const distance_km = act.distance_m != null ? act.distance_m / 1000 : null
    const avg_speed_kmh = act.avg_speed_ms != null ? +(act.avg_speed_ms * 3.6).toFixed(2) : null
    const elevation_per_km = (act.elevation_m != null && distance_km && distance_km > 0) ? +(act.elevation_m / distance_km).toFixed(2) : null
    const load_per_hour = (act.load != null && act.duration_s && act.duration_s > 0) ? +(act.load / (act.duration_s/3600)).toFixed(2) : null

    let coherence_score = 0
    if (act.avg_speed_ms != null && act.max_speed_ms != null && act.max_speed_ms > 0) {
      coherence_score = Math.round(Math.min(100, (act.avg_speed_ms / act.max_speed_ms) * 100))
    } else {
      const checks = [
        !!act.has_gps,
        !!act.has_power,
        !!act.avg_hrt
      ]
      coherence_score = Math.round((checks.filter(Boolean).length / checks.length) * 100)
    }

    return { distance_km, avg_speed_kmh, elevation_per_km, load_per_hour, coherence_score }
  }

  const escapeCsv = (v: any) => {
    if (v == null) return ""
    const s = String(v)
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const exportCSV = (act: ActivityDetails) => {
    const d = computeDerived(act)
    const date = act.startDate instanceof Date ? act.startDate : new Date(act.startDate)
    const week = getWeekNumber(date)
    const month = date.getMonth() + 1
    const year = date.getFullYear()

    const headers = [
      "date (ISO)", "sport", "distance_km (km)", "dplus_m (m)",
      "duration_s (s)", "training_load", "week", "month", "year",
      "avg_speed_kmh (km/h)", "elevation_per_km (m/km)", "load_per_hour", "coherence_score"
    ]

    const row = [
      date.toISOString(),
      act.sport ?? "",
      d.distance_km != null ? d.distance_km.toFixed(3) : "",
      act.elevation_m ?? "",
      act.duration_s ?? "",
      act.load ?? "",
      week,
      month,
      year,
      d.avg_speed_kmh != null ? d.avg_speed_kmh.toFixed(2) : "",
      d.elevation_per_km != null ? d.elevation_per_km : "",
      d.load_per_hour != null ? d.load_per_hour : "",
      d.coherence_score
    ]

    const csv = headers.join(",") + "\n" + row.map(escapeCsv).join(",") + "\n"
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    downloadBlob(blob, `activity-${act.id ?? "export"}.csv`)
  }

  const exportJSON = (act: ActivityDetails) => {
    // export complet (optionnel) — sans polyline si présentes instructions, mais on propose tout
    const payload = { ...act }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    downloadBlob(blob, `activity-${act.id ?? "export"}.json`)
  }

  // remplacement : exportImage vertical révisé (fit-to-box + max 2 colonnes + centrage vertical)
  const FIELD_OPTIONS: { [k: string]: (act: ActivityDetails) => string } = {
    distance: (a) => {
      const d = computeDerived(a).distance_km
      return d != null ? `${d.toFixed(2)} km` : "—"
    },
    duration: (a) => a.duration_s != null ? formatDuration(a.duration_s) : "—",
    dplus: (a) => a.elevation_m != null ? `${a.elevation_m} m` : "—",
    load: (a) => a.load != null ? `${a.load}` : "—",
    avg_speed: (a) => {
      const s = computeDerived(a).avg_speed_kmh
      return s != null ? `${s.toFixed(1)} km/h` : "—"
    },
    coherence: (a) => `${computeDerived(a).coherence_score}/100`,
  }

  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  const drawCard = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r = 20,
    bg = "#ffffff"
  ) => {
    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.15)"
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 10
    ctx.fillStyle = bg
    roundRect(ctx, x, y, w, h, r)
    ctx.fill()
    ctx.restore()
  }

  // remplacement : handleExport demande ordre et transmet à exportImage
  const handleExport = async () => {
    if (!activity) return
    const choice = (window.prompt("Format d'export: tapez csv / image / json", "csv") || "").trim().toLowerCase()
    if (choice === "csv") {
      exportCSV(activity)
    } else if (choice === "image") {
      // show available fields and allow user to provide ordered, comma-separated keys
      const available = Object.keys(FIELD_OPTIONS).join(", ")
      const input = (window.prompt(`Champs à inclure et ordre (séparés par des virgules). Options: ${available}\nEx: distance,duration,avg_speed`, "distance,duration,avg_speed") || "").trim()
      const requested = input.split(",").map(s => s.trim()).filter(Boolean)
      const valid = requested.filter(r => FIELD_OPTIONS[r])
      const fields = valid.length > 0 ? valid : undefined
      const themeChoice = (window.prompt("Thème: light / dark", "light") || "light").trim().toLowerCase()
      await exportImage(activity, { theme: themeChoice === "dark" ? "dark" : "light", fields })
    } else if (choice === "json") {
      exportJSON(activity)
    } else {
      // cancel / invalid
    }
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
              <button className="secondary" onClick={handleExport}>Exporter</button>
              <button style={{ marginLeft:8 }} onClick={() => alert("Partage à venir")}>Partager</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default ActivityPage