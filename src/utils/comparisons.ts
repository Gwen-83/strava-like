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
      return s + (Number.isFinite(a.distance_m) ? a.distance_m : 0);
    }, 0);
    const elevation = activities.reduce((s, a) => {
      return s + (Number.isFinite(a.elevation_m as any) ? (a.elevation_m as number) : 0);
    }, 0);

    const l=0.92;
    const REST_HR = 48;
    const REF_SPEEDS_KMH: Record<string, number> = {
      Walk: 5,
      Ride: 25,
      Run: 10,
    };
    const N_EXP = 2.5;

    const load = activities.reduce((s, a) => {
      // duration in hours
      const durS = Number.isFinite(a.duration_s) ? a.duration_s : NaN;
      if (!Number.isFinite(durS) || durS <= 0) return s;
      const durationHours = durS / 3600;

      // attempt K-based computation
      const avgH = Number.isFinite((a as any).avg_hrt) ? (a as any).avg_hrt : NaN;
      const maxH = Number.isFinite((a as any).max_hrt) ? (a as any).max_hrt : NaN;
      const denom = Number.isFinite(maxH) ? (maxH - REST_HR) : NaN;
      let actLoad: number | null = null;

      if (Number.isFinite(avgH) && Number.isFinite(denom) && denom !== 0) {
        const K = (avgH - REST_HR) / denom;
        if (Number.isFinite(K)) {
          actLoad = durationHours * (K * Math.exp(l * K));
        }
      }

      // fallback: duration * (speed / ref_speed)^N_EXP
      if (actLoad === null) {
        const distM = Number.isFinite(a.distance_m) ? a.distance_m : NaN;
        const speedKmh = Number.isFinite(distM) && durS > 0 ? (distM / durS) * 3.6 : NaN;
        const ref = a.sport && REF_SPEEDS_KMH[a.sport] ? REF_SPEEDS_KMH[a.sport] : NaN;
        if (Number.isFinite(speedKmh) && Number.isFinite(ref) && ref > 0) {
          const ratio = speedKmh / ref;
          actLoad = durationHours * Math.pow(ratio, N_EXP);
        } else {
          actLoad = 0;
        }
      }

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
  return activities.filter(a => a.startDate >= start && a.startDate < end);
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