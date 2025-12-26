// src/services/users.ts
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore"
import { db } from "../firebase"

/**
 * Récupère la date du dernier import Strava pour un utilisateur
 */
export async function getLastImportDate(userId: string): Promise<Date | null> {
  const userDoc = doc(db, "users", userId)
  const snap = await getDoc(userDoc)
  if (!snap.exists()) return null
  const data = snap.data()
  return data.lastImportedAt?.toDate() ?? null
}

/**
 * Met à jour la date du dernier import Strava pour un utilisateur
 */
export async function updateLastImportDate(userId: string, date: Date) {
  const userDoc = doc(db, "users", userId)
  await setDoc(
    userDoc,
    { lastImportedAt: Timestamp.fromDate(date) },
    { merge: true }
  )
}