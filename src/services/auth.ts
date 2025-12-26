import { signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "../firebase"

export function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}