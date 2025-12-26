import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyA4cY9Z9UwB37Nvp7rPW_6ocgFH3QSH8fg",
  authDomain: "strava-like-88e1b.firebaseapp.com",
  projectId: "strava-like-88e1b",
  storageBucket: "strava-like-88e1b.firebasestorage.app",
  messagingSenderId: "458970048872",
  appId: "1:458970048872:web:d6525a6dcade6170af8edd",
  measurementId: "G-SXWMZGY8BQ"
};

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

// Offline-first
enableIndexedDbPersistence(db).catch(() => {
  console.warn("Persistence Firestore non activée (multi-tabs ?)")
})
