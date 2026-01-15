/**
 * Décoder une polyline encodée (format Google)
 */
export function decodePolyline(encoded: string): Array<[number, number]> {
  const points: Array<[number, number]> = []
  let index = 0,
    lat = 0,
    lng = 0

  while (index < encoded.length) {
    let result = 0,
      shift = 0
    let byte

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    lat += (result & 1) ? ~(result >> 1) : result >> 1

    result = 0
    shift = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    lng += (result & 1) ? ~(result >> 1) : result >> 1

    points.push([lat / 1e5, lng / 1e5])
  }

  return points
}

/**
 * Enrichir une activité avec geoPoints depuis polyline ou startLatLng
 */
export function enrichActivityWithGeoPoints(activity: any) {
  if (!activity) return activity

  // Déjà enrichie
  if (activity.geoPoints && Array.isArray(activity.geoPoints) && activity.geoPoints.length > 0) {
    return activity
  }

  // Essayer depuis polyline
  if (activity.polyline && typeof activity.polyline === "string" && activity.polyline.length > 0) {
    try {
      const decoded = decodePolyline(activity.polyline)
      if (decoded.length > 0) {
        console.log(`✅ ${activity.id}: polyline décodée (${decoded.length} points)`)
        return {
          ...activity,
          geoPoints: decoded.map(([lat, lng]) => ({ lat, lng })),
        }
      }
    } catch (e) {
      console.warn(`⚠️ ${activity.id}: erreur décodage polyline`, e)
    }
  }

  // Essayer depuis startLatLng
  if (
    activity.startLatLng &&
    Array.isArray(activity.startLatLng) &&
    activity.startLatLng.length === 2 &&
    typeof activity.startLatLng[0] === "number" &&
    typeof activity.startLatLng[1] === "number"
  ) {
    console.log(`✅ ${activity.id}: startLatLng utilisé`)
    return {
      ...activity,
      geoPoints: [
        {
          lat: activity.startLatLng[0],
          lng: activity.startLatLng[1],
        },
      ],
    }
  }

  // Log si aucune donnée
  if (!activity.polyline && !activity.startLatLng) {
    console.warn(`❌ ${activity.id}: aucune donnée GPS (polyline ni startLatLng)`)
  }

  return activity
}

/**
 * Enrichir toutes les activités
 */
export function enrichActivitiesWithGeoPoints(activities: any[]) {
  const enriched = activities.map(enrichActivityWithGeoPoints)
  const withGeo = enriched.filter(a => a.geoPoints?.length > 0).length
  console.log(`📍 Enrichissement: ${withGeo}/${activities.length} activités avec geoPoints`)
  return enriched
}
