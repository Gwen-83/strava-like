export type SportType = "Ride" | "Run" | "Walk" |"Other"
export type ActivitySource = "strava" | "garmin" | "gpx" | "fit" | "manual"

export type ActivitySummary = {
  id?: string
  userId: string

  externalId?: string
  source: ActivitySource

  sport: SportType

  startDate: Date
  duration_s: number

  distance_m: number
  // D+ peut être absent → ne pas mentir avec 0
  elevation_m?: number | null
  max_elevation?:number | null
  min_elevation?:number | null

  avg_speed_ms?: number | null
  max_speed_ms?: number | null
  avg_watts?: number | null
  energy_kj?: number | null
  avg_hrt?: number | null
  max_hrt?: number | null
  load?: number | null

  has_gps: boolean
  has_streams: boolean
  has_power: boolean

  createdAt: Date
  isSuspicious?: boolean
}

export type ActivityStream = {
  time_s: number[]
  distance_m?: number[]
  velocity_ms?: number[]
  altitude_m?: number[]
  grade_pct?: number[]
}

export interface ActivityDetails extends ActivitySummary {
  id:string
  // 🗺️ Données GPS / carte
  polyline?: string | null
  startLatLng?: [number, number] | null
  endLatLng?: [number, number] | null

  // 📈 Streams détaillés
  streams?: Record<string, number[]> | null
}