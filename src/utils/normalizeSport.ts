import type { SportType } from "../types/Activity"

export function normalizeSport(type: string): SportType {
  if (!type) return "Autre"
  if (type.includes("Ride")) return "Cyclisme"
  if (type.includes("Run")) return "Course"
  if (type.includes("Walk")) return "Marche"
  if (type.includes("Hike")) return "Randonnée"
  return "Autre"
}