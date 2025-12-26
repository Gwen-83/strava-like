// src/mappers/StravaMappers.ts
import type { ActivitySummary, ActivityDetails } from "../types/Activity"
import { normalizeSport } from "../utils/normalizeSport"

export function mapStravaToSummary(
  raw: any,
  userId: string
): ActivitySummary {
  return {
    userId,
    externalId: raw.id.toString(),
    source: "strava",

    sport: normalizeSport(raw.type),

    startDate: new Date(raw.start_date),
    duration_s: raw.moving_time ?? 0,

    distance_m: raw.distance ?? 0,
    // si absent, undefined plutôt que 0
    elevation_m: raw.total_elevation_gain ?? undefined,

    avg_speed_ms: raw.average_speed ?? undefined,
    max_speed_ms: raw.max_speed ?? undefined,
    avg_watts: raw.average_watts ?? undefined,
    energy_kj: raw.kilojoules ?? undefined,

    has_gps: !!raw.map?.summary_polyline,
    has_streams: false,
    has_power: !!raw.average_watts,

    createdAt: new Date(),
  }
}

export function mapStravaToDetails(
  raw: any,
  userId: string,
  activityId: string
): ActivityDetails {
  return {
    id: activityId,
    userId,
    source: "strava",
    externalId: String(raw.id),

    sport: normalizeSport(raw.type),
    startDate: new Date(raw.start_date),

    distance_m: raw.distance ?? 0,
    duration_s: raw.moving_time ?? 0,
    elevation_m: raw.total_elevation_gain ?? undefined,

    avg_speed_ms: raw.average_speed ?? undefined,
    max_speed_ms: raw.max_speed ?? undefined,
    avg_watts: raw.average_watts ?? undefined,
    energy_kj: raw.kilojoules ?? undefined,

    has_gps: !!raw.map?.summary_polyline,
    has_streams: false,
    has_power: !!raw.average_watts,

    polyline: raw.map?.summary_polyline ?? null,
    startLatLng: raw.start_latlng ?? null,
    endLatLng: raw.end_latlng ?? null,
    streams: undefined,

    createdAt: new Date(),
  }
}