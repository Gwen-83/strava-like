import type { ActivitySummary } from "../types/Activity";

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeMetrics(activities: ActivitySummary[]) {
  try {
    const distance = activities.reduce((s, a) => {
      return s + (Number.isFinite(a.distance_m as any) ? (a.distance_m as number) : 0);
    }, 0);
    const elevation = activities.reduce((s, a) => {
      return s + (Number.isFinite(a.elevation_m as any) ? (a.elevation_m as number) : 0);
    }, 0);

    // Defaults and params inspired from ChartsPage.tsx
    const DEFAULT_REF_SPEEDS: Record<string, number> = { Marche: 5, Cyclisme: 25, Course: 10, Randonnée: 4 };
    const N_EXP_BY_SPORT: Record<string, number> = {
      Marche: 1.8,
      Course: 2.6,
      Cyclisme: 2.4,
      Randonnée: 2.2,
    };
    const DEFAULT_N_EXP = 2.5;
    const K_GRADE = 0.005;
    const VAR_ALPHA = 0.5;

    const load = activities.reduce((s, a) => {
      const durS = Number(a.duration_s);
      if (!Number.isFinite(durS) || durS <= 0) return s;
      const durationHours = durS / 3600;

      const distM = Number(a.distance_m);
      const speedKmh = Number.isFinite(distM) && durS > 0 ? (distM / durS) * 3.6 : NaN;

      // grade factor using elevation (guard distance)
      const elev = Number(a.elevation_m) || 0;
      const distKm = distM > 0 ? distM / 1000 : NaN;
      const rawGrade = Number.isFinite(distKm) && distKm > 0 ? elev / distKm : NaN;
      const gradeFactor = Number.isFinite(rawGrade) ? 1 + K_GRADE * Math.min(rawGrade, 150) : 1;
      const adjSpeed = Number.isFinite(speedKmh) ? speedKmh * gradeFactor : NaN;

      const sport = a.sport || "Autre";
      const ref = sport in DEFAULT_REF_SPEEDS ? DEFAULT_REF_SPEEDS[sport] : NaN;

      let actLoad = 0;
      if (Number.isFinite(adjSpeed) && Number.isFinite(ref) && ref > 0) {
        const ratio = adjSpeed / ref;
        const nExp = sport in N_EXP_BY_SPORT ? N_EXP_BY_SPORT[sport] : DEFAULT_N_EXP;
        // scaled similarly to ChartsPage (100 * durationHours * ratio^n)
        actLoad = 100 * durationHours * Math.pow(ratio, nExp);
      } else {
        actLoad = 0;
      }

      // variability factor using reported max speed (fallback 1)
      const maxSpeedKmh = Number.isFinite(Number(a.max_speed_ms)) ? Number(a.max_speed_ms) * 3.6 : NaN;
      const variability = Number.isFinite(maxSpeedKmh) && Number.isFinite(speedKmh) && speedKmh > 0
        ? maxSpeedKmh / speedKmh
        : 1;
      const variabilityFactor = 1 + VAR_ALPHA * Math.max(0, variability - 1);
      actLoad *= variabilityFactor;

      return s + (Number.isFinite(actLoad) ? actLoad : 0);
    }, 0);

    return { distance, elevation, load };
  } catch {
    return { distance: 0, elevation: 0, load: 0 };
  }
}

type PeriodType = "week" | "month" | "year";

function getPeriodRange(period: PeriodType, baseDate: Date, offset = 0) {
  const base = new Date(baseDate);
  if (period === "week") {
    const start = startOfWeek(base);
    start.setDate(start.getDate() + 7 * offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  if (period === "month") {
    const year = base.getFullYear();
    const month = base.getMonth() + offset;
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 1, 0, 0, 0, 0);
    return { start, end };
  }

  // year
  const y = base.getFullYear() + offset;
  const start = new Date(y, 0, 1, 0, 0, 0, 0);
  const end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
  return { start, end };
}

function filterByRange(activities: ActivitySummary[], start: Date, end: Date) {
  // parse activity startDate into Date for robust comparison
  return activities.filter(a => {
    const d = new Date(a.startDate as any);
    return d >= start && d < end;
  });
}

export function comparePeriods(
  activities: ActivitySummary[],
  period: PeriodType,
  baseDate: Date = new Date()
) {
  const currentRange = getPeriodRange(period, baseDate, 0);
  const previousRange = getPeriodRange(period, baseDate, -1);

  const current = filterByRange(activities, currentRange.start, currentRange.end);
  const previous = filterByRange(activities, previousRange.start, previousRange.end);

  return {
    current: computeMetrics(current),
    previous: computeMetrics(previous),
    currentRange,
    previousRange,
  };
}

export function filterByPeriod(
  activities: ActivitySummary[],
  period: PeriodType,
  baseDate: Date = new Date(),
  offset = 0
) {
  const range = getPeriodRange(period, baseDate, offset);
  return {
    activities: filterByRange(activities, range.start, range.end),
    range,
  };
}

export { computeMetrics };