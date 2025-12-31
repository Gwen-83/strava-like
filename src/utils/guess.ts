import type { ActivitySummary } from "../types/Activity";

function load(activities: ActivitySummary[]) {
  try {
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

    return { load };
  } catch {
    return { load: 0 };
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayKey(d: Date) {
  return startOfDay(new Date(d)).toISOString().slice(0, 10);
}

// simplified training load for one activity (compatible with MainPage logic)
function trainingLoadForActivity(a: ActivitySummary, refSpeeds: Record<string, number>) {
  const DEFAULT_REF_SPEEDS: Record<string, number> = { Marche: 5, Cyclisme: 25, Course: 10, Randonnée: 4 };
  const K_GRADE = 0.005;
  const N_EXP_BY_SPORT: Record<string, number> = {
    Marche: 1.8,
    Course: 2.6,
    Cyclisme: 2.4,
    Randonnée: 2.2,
  };
  const DEFAULT_N_EXP = 2.5;
  const VAR_ALPHA = 0.5;

  const durS = Number(a.duration_s);
  if (!Number.isFinite(durS) || durS <= 0) return 0;
  const durationHours = durS / 3600;

  const distM = Number(a.distance_m);
  const speedKmh = Number.isFinite(distM) && durS > 0 ? (distM / durS) * 3.6 : NaN;

  const elev = Number(a.elevation_m) || 0;
  const distKm = distM > 0 ? distM / 1000 : NaN;
  const rawGrade = Number.isFinite(distKm) && distKm > 0 ? elev / distKm : NaN;
  const gradeFactor = Number.isFinite(rawGrade) ? 1 + K_GRADE * Math.min(rawGrade, 150) : 1;
  const adjSpeed = Number.isFinite(speedKmh) ? speedKmh * gradeFactor : NaN;

  const sport = a.sport || "Autre";
  const ref = sport in refSpeeds ? refSpeeds[sport] : sport in DEFAULT_REF_SPEEDS ? DEFAULT_REF_SPEEDS[sport] : NaN;

  let actLoad = 0;
  if (Number.isFinite(adjSpeed) && Number.isFinite(ref) && ref > 0) {
    const ratio = adjSpeed / ref;
    const nExp = sport in N_EXP_BY_SPORT ? N_EXP_BY_SPORT[sport] : DEFAULT_N_EXP;
    actLoad = 100 * durationHours * Math.pow(ratio, nExp);
  } else {
    actLoad = 0;
  }

  const maxSpeedKmh = Number.isFinite(Number(a.max_speed_ms)) ? Number(a.max_speed_ms) * 3.6 : NaN;
  const variability = Number.isFinite(maxSpeedKmh) && Number.isFinite(speedKmh) && speedKmh > 0
    ? maxSpeedKmh / speedKmh
    : 1;
  const variabilityFactor = 1 + VAR_ALPHA * Math.max(0, variability - 1);
  actLoad *= variabilityFactor;

  return Number.isFinite(actLoad) ? actLoad : 0;
}

/**
 * computeCoherence:
 * - activities: list of ActivitySummary
 * - refSpeeds: per-sport reference speeds (km/h) — if not provided, defaults are used inside trainingLoadForActivity
 *
 * Returns: { coherenceScore (0-100), weeklyTotals: number[3], wkMean, wkStd }
 */
export function computeCoherence(
  activities: ActivitySummary[],
  refSpeeds: Record<string, number> = {}
) {
  try {
    const now = startOfDay(new Date());
    const dayMs = 24 * 60 * 60 * 1000;

    // build daily loads map (sum of trainingLoadForActivity per day)
    const dailyLoads = new Map<string, number>();
    activities.forEach((a) => {
      const key = dayKey(new Date(a.startDate));
      const prev = dailyLoads.get(key) ?? 0;
      dailyLoads.set(key, prev + trainingLoadForActivity(a, refSpeeds));
    });

    function get7DayArray(endOffsetDays: number) {
      const arr: number[] = [];
      for (let i = endOffsetDays + 6; i >= endOffsetDays; i--) {
        const d = new Date(now.getTime() - i * dayMs);
        const v = dailyLoads.get(dayKey(d)) ?? 0;
        arr.push(v);
      }
      return arr;
    }

    const sumArr = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

    const weeklyTotals = [
      sumArr(get7DayArray(0)),  // last 7 days
      sumArr(get7DayArray(7)),  // previous 7 days
      sumArr(get7DayArray(14)), // previous-previous 7 days
    ];

    const wkMean = weeklyTotals.reduce((s, x) => s + x, 0) / weeklyTotals.length;
    const wkStd =
      weeklyTotals.length > 0
        ? Math.sqrt(weeklyTotals.reduce((s, v) => s + Math.pow(v - wkMean, 2), 0) / weeklyTotals.length)
        : 0;

    let coherenceScore = 0;
    if (wkMean > 1e-6) {
      const rawC = 1 - wkStd / wkMean;
      const clamped = Math.max(0, Math.min(1, rawC));
      coherenceScore = Math.round(clamped * 100);
    } else {
      coherenceScore = 0;
    }

    return { coherenceScore, weeklyTotals, wkMean, wkStd };
  } catch {
    return { coherenceScore: 0, weeklyTotals: [0, 0, 0], wkMean: 0, wkStd: 0 };
  }
}

const clamp = (x: number, a: number, b: number) =>
  Math.max(a, Math.min(b, x));

const daysBetween = (d1: Date, d2: Date) =>
  Math.abs((d1.getTime() - d2.getTime()) / (1000 * 3600 * 24));

//normalisation dénivelé
function flatRunningTime(a: ActivitySummary): number | null {
  if (a.distance_m < 3000) return null;

  const v = a.distance_m / a.duration_s;
  const dPlus = a.elevation_m ?? 0;

  const vFlat = v * (1 - 0.03 * (dPlus / 1000));
  if (vFlat <= 0) return null;

  return a.distance_m / vFlat;
}

//Sélection de la performance de référence
function selectBestRunningEffort(acts: ActivitySummary[]) {
  const scored = acts
    .map(a => {
      const tFlat = flatRunningTime(a);
      if (!tFlat) return null;

      const dKm = a.distance_m / 1000;
      const vFlat = dKm / (tFlat / 3600);

      return {
        distanceKm: dKm,
        timeS: tFlat,
        score: vFlat * Math.sqrt(dKm)
      };
    })
    .filter(Boolean) as any[];

  if (scored.length === 0) return null;

  return scored.reduce((best, cur) =>
    cur.score > best.score ? cur : best
  );
}

function estimateRiegelExponent(refs: { distanceKm: number; timeS: number }[]) {
  if (refs.length < 2) return 1.06;

  const [a, b] = refs.slice(0, 2);

  const k = Math.log(b.timeS / a.timeS) /
            Math.log(b.distanceKm / a.distanceKm);

  return clamp(k, 1.04, 1.10);
}

function predictRunningTimes(
  ref: { distanceKm: number; timeS: number },
  k: number,
  formDelta: number
) {
  const targets = [5, 10, 21.1, 42.2];
  const alpha = 0.5;

  const adj = 1 - alpha * formDelta;

  const res: Record<string, number> = {};
  for (const d of targets) {
    res[`${d}km`] =
      ref.timeS * Math.pow(d / ref.distanceKm, k) * adj;
  }
  return res;
}

function extractPowerEfforts(acts: ActivitySummary[]) {
  return acts
    .filter(a =>
      a.avg_watts != null &&
      Number.isFinite(a.avg_watts) &&
      a.duration_s >= 12 * 60 &&
      a.duration_s <= 60 * 60
    )
    .map(a => ({
      t: a.duration_s,
      p: a.avg_watts!
    }));
}

function estimateCP(efforts: { t: number; p: number }[]) {
  if (efforts.length < 2) return null;

  // linéarisation : P = CP + W'/t
  const xs = efforts.map(e => 1 / e.t);
  const ys = efforts.map(e => e.p);

  const n = xs.length;
  const xMean = xs.reduce((s, x) => s + x, 0) / n;
  const yMean = ys.reduce((s, y) => s + y, 0) / n;

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += Math.pow(xs[i] - xMean, 2);
  }

  const Wp = num / den;
  const CP = yMean - Wp * xMean;

  return CP > 0 ? CP : null;
}

function predictCyclingPerformance(CP: number, formDelta: number) {
  const alpha = 0.5;
  const adj = 1 + alpha * formDelta;

  const ftp = CP * adj;
  const p20 = (ftp / 0.95);

  return { ftp, p20 };
}

function computeFormDelta(
  ctl: number,
  atl: number
) {
  if (ctl <= 0) return 0;
  return clamp((ctl - atl) / ctl, -0.05, 0.05);
}

export function predictPerformance(activities: ActivitySummary[], ctl: number, atl: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 42);

  const recent = activities.filter(
    a => new Date(a.startDate) >= cutoff
  );

  const formDelta = computeFormDelta(ctl, atl);

  // COURSE
  const runActs = recent.filter(a => a.sport === "Course");
  let refRun = selectBestRunningEffort(runActs);

  // fallback: if no "flat" effort (>=3km) found, pick the best available run (any distance)
  if (!refRun && runActs.length > 0) {
    const scoredAny = runActs
      .map(a => {
        const dKm = (a.distance_m || 0) / 1000;
        if (!dKm || !a.duration_s) return null;
        const v = dKm / (a.duration_s / 3600);
        return { distanceKm: dKm, timeS: a.duration_s, score: v * Math.sqrt(dKm) };
      })
      .filter(Boolean) as { distanceKm: number; timeS: number; score: number }[];

    if (scoredAny.length > 0) {
      refRun = scoredAny.reduce((best, cur) => (cur.score > best.score ? cur : best));
    }
  }

  const running = refRun
    ? predictRunningTimes(
        refRun,
        estimateRiegelExponent([refRun]),
        formDelta
      )
    : null;

  // CYCLISME
  const bikeActs = recent.filter(a => a.sport === "Cyclisme");
  const efforts = extractPowerEfforts(bikeActs);
  const CP = estimateCP(efforts);
  let cycling: { ftp: number; p20: number } | null = null;
  let cpValue = CP;

  // fallback: if we have at least one effort, use its max power as a crude CP estimate
  if (!cpValue && efforts.length === 1) {
    cpValue = efforts[0].p;
  }

  // fallback: if no filtered efforts but some bike activities contain avg_watts, try to use their avg
  const watts = bikeActs
    .filter(a => a.duration_s >= 15 * 60)
    .map(a => a.avg_watts!)


  if (cpValue) {
    cycling = predictCyclingPerformance(cpValue, formDelta);
  } else {
    cycling = null;
  }

  return {
    running,
    cycling,
    confidence: {
      running: runActs.length >= 6 ? "high" : runActs.length > 0 ? "low" : "medium",
      cycling: efforts.length >= 4 ? "high" : efforts.length >= 1 ? "low" : bikeActs.length >= 1 ? "low" : "medium"
    }
  };
}