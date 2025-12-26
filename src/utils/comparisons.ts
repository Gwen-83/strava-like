import type { ActivitySummary } from "../types/Activity";

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 7);
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
    const load = activities.reduce((s, a) => {
      const validDist = Number.isFinite(a.distance_m);
      const validDur = Number.isFinite(a.duration_s);
      if (!validDist || !validDur) return s;
      return s + (a.distance_m / 1000) * (a.duration_s / 3600);
    }, 0);

    return { distance, elevation, load };
  } catch {
    return { distance: 0, elevation: 0, load: 0 };
  }
}

export function compareWeeks(activities: ActivitySummary[]) {
  const now = new Date();

  const currentStart = startOfWeek(now);
  const currentEnd = endOfWeek(now);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 7);
  const previousEnd = new Date(currentEnd);
  previousEnd.setDate(previousEnd.getDate() - 7);

  const current = activities.filter(
    a => a.startDate >= currentStart && a.startDate < currentEnd
  );

  const previous = activities.filter(
    a => a.startDate >= previousStart && a.startDate < previousEnd
  );

  return {
    current: computeMetrics(current),
    previous: computeMetrics(previous),
  };
}