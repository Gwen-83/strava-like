import type { SportType } from "../types/Activity"

export function normalizeSport(type: string): SportType {
  if (!type) return "Other"
  if (type.includes("Ride")) return "Ride"
  if (type.includes("Run")) return "Run"
  if (type.includes("Walk")) return "Walk"
  return "Other"
}