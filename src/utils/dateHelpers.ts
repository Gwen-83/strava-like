/**
 * Helpers pour manipuler les dates de manière centralisée
 * Utilisés dans les agrégations et comparaisons
 */

/**
 * Retourne le début de la semaine (lundi) pour une date donnée
 */
export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Retourne le début du jour (minuit) pour une date donnée
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Retourne la clé ISO (yyyy-mm-dd) pour une date
 */
export function dateKey(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10)
}

/**
 * Retourne le début du mois pour une date donnée
 */
export function startOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Retourne le début de l'année pour une date donnée
 */
export function startOfYear(date: Date): Date {
  const d = new Date(date)
  d.setMonth(0)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Type pour les périodes
 */
export type PeriodType = "day" | "week" | "month" | "year"

/**
 * Retourne la plage de dates pour une période donnée
 */
export function getPeriodRange(
  period: PeriodType,
  baseDate: Date = new Date(),
  offset = 0
): { start: Date; end: Date } {
  const base = new Date(baseDate)

  if (period === "day") {
    const start = startOfDay(base)
    start.setDate(start.getDate() + offset)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { start, end }
  }

  if (period === "week") {
    const start = startOfWeek(base)
    start.setDate(start.getDate() + 7 * offset)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { start, end }
  }

  if (period === "month") {
    const year = base.getFullYear()
    const month = base.getMonth() + offset
    const start = new Date(year, month, 1, 0, 0, 0, 0)
    const end = new Date(year, month + 1, 1, 0, 0, 0, 0)
    return { start, end }
  }

  // year
  const y = base.getFullYear() + offset
  const start = new Date(y, 0, 1, 0, 0, 0, 0)
  const end = new Date(y + 1, 0, 1, 0, 0, 0, 0)
  return { start, end }
}
