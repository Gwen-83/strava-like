import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  Timestamp,
  deleteDoc
} from "firebase/firestore"
import { db } from "../firebase"
import type { ActivitySummary } from "../types/Activity"
import { analyzeActivitySuspicion, type UserBaseline } from "../types/suspicion"

const activitiesRef = collection(db, "activities")

function buildActivityId(source: string, externalId: string) {
  return `activity_${source}_${externalId}`
}

export async function upsertActivitySummary(
  activity: ActivitySummary
): Promise<string> {
  if (!activity.userId) throw new Error("userId is required")
  if (!activity.source) throw new Error("source is required")
  if (!activity.externalId) throw new Error("externalId is required")

  const id = buildActivityId(activity.source, activity.externalId)
  const ref = doc(activitiesRef, id)

  const existing = await getDoc(ref)

  const createdAt = existing.exists()
    ? existing.data().createdAt
    : Timestamp.fromDate(activity.createdAt)

  await setDoc(
    ref,
    {
      userId: activity.userId,
      externalId: activity.externalId,
      source: activity.source,

      sport: activity.sport,
      startDate: Timestamp.fromDate(activity.startDate),

      distance_m: activity.distance_m,
      duration_s: activity.duration_s,
      elevation_m: activity.elevation_m,

      avg_speed_ms: activity.avg_speed_ms ?? null,
      max_speed_ms: activity.max_speed_ms ?? null,
      avg_watts: activity.avg_watts ?? null,
      energy_kj: activity.energy_kj ?? null,

      has_gps: activity.has_gps,
      has_streams: activity.has_streams,
      has_power: activity.has_power,

      load: activity.load ?? null,

      createdAt,
      updatedAt: Timestamp.fromDate(new Date())
    },
    { merge: true }
  )

  return id
}

// Nouvelle fonction : recherche de doublons potentiels avec score de similarité
export async function findSimilarActivities(
  userId: string,
  activity: ActivitySummary,
  options: { timeWindowSec?: number } = {}
): Promise<{ id: string; score: number; activity: ActivitySummary }[]> {
  const timeWindowSec = options.timeWindowSec ?? 120 // recherche ±2min par défaut
  const start = activity.startDate
  const startMinus = new Date(start.getTime() - timeWindowSec * 1000)
  const startPlus = new Date(start.getTime() + timeWindowSec * 1000)

  // Limiter la recherche via une requête sur startDate
  const q = query(
    activitiesRef,
    where("userId", "==", userId),
    where("startDate", ">=", Timestamp.fromDate(startMinus)),
    where("startDate", "<=", Timestamp.fromDate(startPlus))
  )

  const snap = await getDocs(q)
  const candidates: { id: string; score: number; activity: ActivitySummary }[] = []

  for (const d of snap.docs) {
    const data = d.data()

    // Construire un ActivitySummary minimal depuis Firestore
    const existing: ActivitySummary = {
      id: d.id,
      userId: data.userId,
      externalId: data.externalId,
      source: data.source,
      sport: data.sport,
      startDate: data.startDate.toDate(),
      duration_s: data.duration_s,
      distance_m: data.distance_m,
      elevation_m: data.elevation_m,
      avg_speed_ms: data.avg_speed_ms ?? undefined,
      max_speed_ms: data.max_speed_ms ?? undefined,
      avg_watts: data.avg_watts ?? undefined,
      energy_kj: data.energy_kj ?? undefined,
      has_gps: data.has_gps,
      has_streams: data.has_streams,
      has_power: data.has_power,
      load: data.load ?? undefined,
      createdAt: data.createdAt.toDate()
    }

    // Calcul des écarts
    const dateDiffSec = Math.abs((existing.startDate.getTime() - activity.startDate.getTime()) / 1000)
    // distance relative (use average to avoid division by zero)
    const avgDist = (Math.abs(existing.distance_m) + Math.abs(activity.distance_m)) / 2 || 1
    const distRel = Math.abs(existing.distance_m - activity.distance_m) / avgDist
    const durAvg = (Math.abs(existing.duration_s) + Math.abs(activity.duration_s)) / 2 || 1
    const durRel = Math.abs(existing.duration_s - activity.duration_s) / durAvg
    const typeMatch = existing.sport === activity.sport ? 1 : 0

    // Convertir écarts en score [0..1] (1 = identique)
    const dateScore = dateDiffSec <= 120 ? 1 - dateDiffSec / 120 : 0 // linéaire sur ±2min
    const distScore = distRel <= 0.01 ? 1 - distRel / 0.01 : 0 // 1% seuil
    const durScore = durRel <= 0.01 ? 1 - durRel / 0.01 : 0 // 1% seuil

    // Poids (ajustables) : date 40%, distance 30%, durée 20%, type 10%
    const score =
      dateScore * 0.4 +
      distScore * 0.3 +
      durScore * 0.2 +
      typeMatch * 0.1

    candidates.push({ id: d.id, score, activity: existing })
  }

  // Trier décroissant par score
  candidates.sort((a, b) => b.score - a.score)
  return candidates
}

export async function getUserActivitySummaries(
  userId: string
): Promise<ActivitySummary[]> {
  const q = query(activitiesRef, where("userId", "==", userId))
  const snap = await getDocs(q)

  return snap.docs.map(d => {
    const data = d.data()

    return {
      id: d.id,
      userId: data.userId,
      externalId: data.externalId,
      source: data.source,

      sport: data.sport,
      startDate: data.startDate.toDate(),

      distance_m: data.distance_m,
      duration_s: data.duration_s,
      elevation_m: data.elevation_m,

      avg_speed_ms: data.avg_speed_ms ?? undefined,
      max_speed_ms: data.max_speed_ms ?? undefined,
      avg_watts: data.avg_watts ?? undefined,
      energy_kj: data.energy_kj ?? undefined,

      has_gps: data.has_gps,
      has_streams: data.has_streams,
      has_power: data.has_power,

      load: data.load ?? undefined,
      createdAt: data.createdAt.toDate()
    }
  })
}

// Supprimer une activité par ID (tolérant)
export async function deleteActivityById(id: string): Promise<void> {
  try {
    const ref = doc(activitiesRef, id)
    await deleteDoc(ref)
  } catch (e) {
    console.warn("deleteActivityById failed", e)
  }
}

// Purge : scanne les activités d'un user et supprime celles marquées suspicious par l'algorithme
export async function purgeSuspiciousActivities(
  userId: string,
  baseline?: UserBaseline
): Promise<{ deleted: string[]; kept: string[] }> {
  const deleted: string[] = []
  const kept: string[] = []
  try {
    const activities = await getUserActivitySummaries(userId)
    for (const a of activities) {
      try {
        const input = {
          sport: a.sport,
          distance_m: a.distance_m,
          duration_s: a.duration_s,
          elevation_m: (a.elevation_m ?? 0) as number,
          avg_speed_ms: a.avg_speed_ms ?? null,
          has_gps: a.has_gps,
          has_streams: a.has_streams,
          polyline: (a as any).polyline ?? null,
          streams: (a as any).streams ?? null
        }

        const result = analyzeActivitySuspicion(input, baseline)
        if (result.isSuspicious) {
          if (a.id) {
            await deleteActivityById(a.id)
            deleted.push(a.id)
          }
        } else {
          if (a.id) kept.push(a.id)
        }
      } catch (inner) {
        console.warn("purgeSuspiciousActivities: item check failed", inner)
        if (a.id) kept.push(a.id)
      }
    }
  } catch (e) {
    console.warn("purgeSuspiciousActivities failed", e)
  }
  return { deleted, kept }
}
