import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "../firebase"
import type { AppLog } from "../types/logs"

export async function logEvent(
  log: Omit<AppLog, "createdAt">
) {
  // Toujours visible en dev
  if (log.level === "ERROR") {
    console.error(log.message, log.payload)
  } else if (log.level === "WARN") {
    console.warn(log.message, log.payload)
  } else {
    console.info(log.message)
  }

  // Persistant (non bloquant)
  try {
    await addDoc(collection(db, "logs"), {
      ...log,
      createdAt: serverTimestamp(),
    })
  } catch (e) {
    console.error("Log persistence failed", e)
  }
}
