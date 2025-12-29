import {
  doc,
  setDoc,
  getDoc,
  Timestamp
} from "firebase/firestore"
import { db } from "../firebase"
import type { ActivityDetails } from "../types/Activity"

const detailsRef = (id: string) =>
  doc(db, "activityDetails", id)

export async function upsertActivityDetails(
  details: ActivityDetails
) {
  const ref = detailsRef(details.id)

  await setDoc(
    ref,
    {
      userId: details.userId,
      source: details.source,
      externalId: details.externalId,

      sport: details.sport,
      startDate: Timestamp.fromDate(details.startDate),

      distance_m: details.distance_m,
      duration_s: details.duration_s,
      elevation_m: details.elevation_m ?? null,
      max_elevation: details.max_elevation ?? null,
      min_elevation: details.min_elevation ?? null,

      avg_speed_ms: details.avg_speed_ms ?? null,
      max_speed_ms: details.max_speed_ms ?? null,
      avg_watts: details.avg_watts ?? null,
      energy_kj: details.energy_kj ?? null,
      avg_hrt: details.avg_hrt ?? null,
      max_hrt: details.max_hrt ?? null,

      has_gps: details.has_gps,
      has_streams: details.has_streams,
      has_power: details.has_power,

      polyline: details.polyline ?? null,
      startLatLng: details.startLatLng ?? null,
      endLatLng: details.endLatLng ?? null,
      streams: details.streams ?? null,

      createdAt: Timestamp.fromDate(details.createdAt),
      updatedAt: Timestamp.fromDate(new Date())
    },
    { merge: true }
  )
}

export async function getActivityDetails(
  id: string
): Promise<ActivityDetails | null> {
  const snap = await getDoc(detailsRef(id))
  if (!snap.exists()) return null

  const data = snap.data()

return {
  id,
  userId: data.userId,
  source: data.source,
  externalId: data.externalId,

  sport: data.sport,
  startDate: data.startDate.toDate(),

  distance_m: data.distance_m,
  duration_s: data.duration_s,
  // elevation_m peut être absent dans la base
  elevation_m: data.elevation_m ?? undefined,
  max_elevation: data.elev_high ?? undefined,
  min_elevation: data.elev_low ?? undefined,

  avg_speed_ms: data.avg_speed_ms ?? undefined,
  max_speed_ms: data.max_speed_ms ?? undefined,
  avg_watts: data.avg_watts ?? undefined,
  energy_kj: data.energy_kj ?? undefined,
  avg_hrt: data.average_heartrate ?? undefined,
  max_hrt: data.max_heartrate ?? undefined,

  has_gps: data.has_gps,
  has_streams: data.has_streams,
  has_power: data.has_power,

  polyline: data.polyline ?? null,
  startLatLng: data.startLatLng ?? null,
  endLatLng: data.endLatLng ?? null,
  streams: data.streams ?? null,

  createdAt: data.createdAt.toDate(),
}
}