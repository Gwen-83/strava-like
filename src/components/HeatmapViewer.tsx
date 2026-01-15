import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet.heat"

interface HeatmapViewerProps {
  activities: any[]
  height?: string
}

export function HeatmapViewer({ activities, height = "400px" }: HeatmapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const heatLayerRef = useRef<any>(null)
  const [initialized, setInitialized] = useState(false)

  // Extraire les points depuis geoPoints
  const points = activities
    .flatMap(a => {
      if (a.geoPoints && Array.isArray(a.geoPoints) && a.geoPoints.length > 0) {
        return a.geoPoints.map((p: any) => [p.lat, p.lng, 0.5] as [number, number, number])
      }
      return []
    })
    .filter(p => p[0] !== undefined && p[1] !== undefined && isFinite(p[0]) && isFinite(p[1]))

  // Initialiser
  useEffect(() => {
    if (initialized || !containerRef.current) return

    try {
      const map = L.map(containerRef.current).setView([45.5, 4.8], 10)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map
      setInitialized(true)

      setTimeout(() => map.invalidateSize(), 100)
    } catch (e) {
      console.error("❌ Map init failed:", e)
    }
  }, [initialized])

  // Mettre à jour heatmap
  useEffect(() => {
    if (!mapRef.current || !initialized) return

    // Nettoyer l'ancienne heatmap
    if (heatLayerRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current)
      heatLayerRef.current = null
    }

    if (points.length === 0) {
      console.warn("⚠️ Aucun point GPS valide disponible")
      return
    }

    try {
      console.log("🔥 Création heatmap avec", points.length, "points")
      
      const heatLayer = (L as any).heatLayer(points, {
        radius: 20,
        blur: 12,
        maxZoom: 17,
        minOpacity: 0.3,
      }).addTo(mapRef.current)

      heatLayerRef.current = heatLayer

      const bounds = L.latLngBounds(
        points.map((p: any) => [p[0], p[1]] as [number, number])
      )
      mapRef.current.fitBounds(bounds, { padding: [50, 50] })
      console.log("✅ Heatmap affichée avec succès")
    } catch (e) {
      console.error("❌ Heatmap failed:", e)
    }
  }, [points, initialized])

  return (
    <div style={{ width: "100%" }}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height,
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          backgroundColor: "#f0f0f0",
        }}
      />
      {points.length === 0 && activities.length > 0 && (
        <div style={{
          padding: "12px",
          backgroundColor: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: "4px",
          marginTop: "12px",
          fontSize: "0.875rem",
          color: "#856404",
        }}>
          <strong>⚠️ Aucune coordonnée GPS valide trouvée</strong>
          <p style={{ marginTop: "8px", fontSize: "0.75rem" }}>
            💡 Les activités doivent avoir `polyline` ou `startLatLng` populés.
          </p>
        </div>
      )}
    </div>
  )
}
