import type { ActivityDetails } from "../types/Activity"
import { normalizeSport } from "../utils/normalizeSport"

// Utilitaires pour parser GPX
export async function parseGPXFile(file: File): Promise<ActivityDetails> {
  const text = await file.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, "application/xml")

  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Fichier GPX invalide")
  }

  // Extraire les trackpoints
  const trkpts = Array.from(doc.getElementsByTagName("trkpt"))
  if (trkpts.length === 0) {
    throw new Error("Aucun trackpoint trouvé dans le fichier GPX")
  }

  const geoPoints: Array<{ lat: number; lng: number }> = []
  const timestamps: number[] = []
  const elevations: number[] = []
  let startDate: Date | null = null

  for (const trkpt of trkpts) {
    const lat = parseFloat(trkpt.getAttribute("lat") || "0")
    const lng = parseFloat(trkpt.getAttribute("lon") || "0")

    if (!isNaN(lat) && !isNaN(lng)) {
      geoPoints.push({ lat, lng })
    }

    const timeEl = trkpt.getElementsByTagName("time")[0]
    if (timeEl?.textContent) {
      const time = new Date(timeEl.textContent)
      timestamps.push(time.getTime())
      if (!startDate) startDate = new Date(time)
    }

    const eleEl = trkpt.getElementsByTagName("ele")[0]
    if (eleEl?.textContent) {
      const ele = parseFloat(eleEl.textContent)
      if (!isNaN(ele)) elevations.push(ele)
    }
  }

  if (geoPoints.length < 2) {
    throw new Error("Trackpoints insuffisants pour créer une activité")
  }

  if (!startDate) {
    startDate = new Date()
  }

  // Calculer la distance
  let distance = 0
  for (let i = 1; i < geoPoints.length; i++) {
    distance += haversineDistance(
      geoPoints[i - 1].lat,
      geoPoints[i - 1].lng,
      geoPoints[i].lat,
      geoPoints[i].lng
    )
  }

  // Calculer la durée
  let duration = 0
  if (timestamps.length >= 2) {
    duration = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000 // en secondes
  }

  // Calculer le D+ (gain d'altitude)
  let elevation = 0
  if (elevations.length >= 2) {
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1]
      if (diff > 0) elevation += diff
    }
  }

  // Créer les streams
  const distance_m: number[] = []
  let currentDistance = 0
  distance_m.push(0)

  for (let i = 1; i < geoPoints.length; i++) {
    currentDistance += haversineDistance(
      geoPoints[i - 1].lat,
      geoPoints[i - 1].lng,
      geoPoints[i].lat,
      geoPoints[i].lng
    )
    distance_m.push(currentDistance)
  }

  const time_s = timestamps.length > 0
    ? timestamps.map((ts) => (ts - timestamps[0]) / 1000)
    : Array.from({ length: geoPoints.length }, (_, i) => (i * duration) / geoPoints.length)

  // Détecter le sport (simple heuristique basée sur la vitesse)
  const avgSpeed = duration > 0 ? distance / duration : 0
  let sportStr = "Autre"
  if (avgSpeed > 6) {
    sportStr = "Cyclisme" // > 21.6 km/h
  } else if (avgSpeed > 3) {
    sportStr = "Course" // 10.8-21.6 km/h
  } else if (avgSpeed > 1) {
    sportStr = "Marche" // 3.6-10.8 km/h
  } else {
    sportStr = "Randonnée"
  }

  const sport = normalizeSport(sportStr)

  const externalId = `gpx_${Date.now()}_${Math.random().toString(36).substring(7)}`

  const activity: ActivityDetails = {
    id: externalId,
    userId: "", // Will be set by the caller
    externalId,
    source: "gpx",
    sport,
    startDate,
    duration_s: Math.round(duration),
    distance_m: Math.round(currentDistance),
    elevation_m: elevation > 0 ? Math.round(elevation) : null,
    max_elevation: elevations.length > 0 ? Math.round(Math.max(...elevations)) : null,
    min_elevation: elevations.length > 0 ? Math.round(Math.min(...elevations)) : null,
    has_gps: true,
    has_streams: true,
    has_power: false,
    createdAt: new Date(),
    polyline: encodePolyline(geoPoints),
    startLatLng: [geoPoints[0].lat, geoPoints[0].lng],
    endLatLng: [geoPoints[geoPoints.length - 1].lat, geoPoints[geoPoints.length - 1].lng],
    streams: {
      time: time_s,
      distance: distance_m,
      altitude: elevations.slice(0, distance_m.length),
    },
    geoPoints,
  }

  return activity
}

// Parser pour les fichiers FIT (simplifié - nécessite fit-parser)
export async function parseFITFile(_file: File): Promise<ActivityDetails> {
  // Note: Pour parser les fichiers FIT correctement, vous aurez besoin de la librairie 'fit-parser'
  // npm install fit-parser
  // Pour l'instant, on lance une erreur instructive
  throw new Error(
    "L'import de fichiers FIT nécessite l'installation de la librairie 'fit-parser'. " +
    "Exécutez: npm install fit-parser"
  )
}

// Utilitaires

/** Calcule la distance en mètres entre deux points GPS */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Rayon de la Terre en mètres
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/** Encode un polyline au format Google (simplifié) */
function encodePolyline(points: Array<{ lat: number; lng: number }>, precision = 5): string {
  let lastLat = 0
  let lastLng = 0
  let encoded = ""

  const factor = Math.pow(10, precision)

  for (const point of points) {
    const lat = Math.round(point.lat * factor)
    const lng = Math.round(point.lng * factor)

    const dlat = lat - lastLat
    const dlng = lng - lastLng

    lastLat = lat
    lastLng = lng

    encoded += encodeValue(dlat) + encodeValue(dlng)
  }

  return encoded
}

function encodeValue(value: number): string {
  value = value << 1
  if (value < 0) value = ~value
  let encoded = ""
  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63)
    value >>= 5
  }
  encoded += String.fromCharCode(value + 63)
  return encoded
}
