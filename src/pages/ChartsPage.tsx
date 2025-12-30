import type { ActivitySummary } from "../types/Activity"
import { useState, useEffect } from "react";
import { XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import "../styles/charts.css";

export default function ChartsPage({ activities }: { activities: ActivitySummary[] }) {
  const [period, setPeriod] = useState<"week" | "month" | "year">("week");
  const [rangeFilter, setRangeFilter] = useState<"all" | "last7" | "last31" | "last12months">("all");
  const [openHelpFor, setOpenHelpFor] = useState<string | null>(null);
  
  // helper: UTC-normalized ISO yyyy-mm-dd for a Date at midnight UTC
  const isoDateUTC = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0,10);
  
  // compute forced range (startIso,endIso) and displayPeriod when rangeFilter != 'all'
  const baseForcedRange = (() => {
    if (rangeFilter === "all") return null;
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (rangeFilter === "last7") {
      const start = new Date(todayUtc.getTime() - (7 - 1) * 24 * 3600 * 1000); // last 7 days inclusive
      return { startIso: isoDateUTC(start), endIso: isoDateUTC(todayUtc), displayPeriod: "day" as const };
    }
    if (rangeFilter === "last31") {
      const start = new Date(todayUtc.getTime() - (31 - 1) * 24 * 3600 * 1000);
      return { startIso: isoDateUTC(start), endIso: isoDateUTC(todayUtc), displayPeriod: "day" as const };
    }
    // last12months: 12 monthly buckets (including current month)
    const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const endMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { startIso: isoDateUTC(startMonth), endIso: isoDateUTC(endMonth), displayPeriod: "month" as const };
  })();

  // detect mobile (<=900px) to alter only mobile UI/behaviour
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== "undefined" ? window.matchMedia("(max-width:900px)").matches : false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width:900px)");
    const handler = (ev: MediaQueryListEvent) => setIsMobile(ev.matches);
    // modern browsers support addEventListener on MediaQueryList, fallback to addListener
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", handler);
    else mq.addListener(handler);
    setIsMobile(mq.matches);
    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  // mobile forced range: last 6 weeks (6 weekly buckets, including current week)
  const mobileForcedRange = (() => {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const curWeekStartIso = startOfWeekISO(todayUtc);
    const startDate = new Date(curWeekStartIso + "T00:00:00Z");
    // go back 5 additional weeks to have 6 total (current + previous 5)
    startDate.setUTCDate(startDate.getUTCDate() - (6 - 1) * 7);
    return { startIso: isoDateUTC(startDate), endIso: curWeekStartIso, displayPeriod: "week" as const };
  })();

  const forcedRange = isMobile ? mobileForcedRange : baseForcedRange;

  // activities filtered by time cutoff (used for data shown). When forcedRange present we still filter to that window.
  const filteredByRange = (() => {
    if (!forcedRange) return activities;
    const start = new Date(forcedRange.startIso + "T00:00:00Z");
    const end = new Date(forcedRange.endIso + "T00:00:00Z");
    // for month range endIso currently is first-of-month; include that month -> advance end to next bucket
    let endInclusive = new Date(end);
    if (forcedRange.displayPeriod === "month") {
      endInclusive = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1));
      endInclusive.setUTCDate(endInclusive.getUTCDate() - 1); // include the month
    } else {
      endInclusive = new Date(end.getTime()); // it's already that day's 00:00
    }
    // include entire end day: set to next day 00:00 for comparison consistent with existing code (start <= date < nextDay)
    const endExclusive = new Date(Date.UTC(endInclusive.getUTCFullYear(), endInclusive.getUTCMonth(), endInclusive.getUTCDate() + 1));
    return activities.filter(a => {
      const d = new Date(a.startDate);
      return d >= start && d < endExclusive;
    });
  })();

  // period start helpers (return ISO yyyy-mm-dd) — UTC-safe
  function startOfWeekISO(d: Date) {
    const date = new Date(d);
    const day = date.getUTCDay() || 7;
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + 1));
    utc.setUTCHours(0,0,0,0);
    return utc.toISOString().slice(0,10);
  }
  function startOfMonthISO(d: Date) {
    const date = new Date(d);
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    utc.setUTCHours(0,0,0,0);
    return utc.toISOString().slice(0,10);
  }
  function startOfYearISO(d: Date) {
    const date = new Date(d);
    const utc = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    utc.setUTCHours(0,0,0,0);
    return utc.toISOString().slice(0,10);
  }

  // helpers to step periods (ISO yyyy-mm-dd) — works in UTC. now supports 'day'
  function addPeriodISO(iso: string, p: "day" | "week" | "month" | "year") {
    const d = new Date(iso + "T00:00:00Z");
    if (p === "day") d.setUTCDate(d.getUTCDate() + 1);
    else if (p === "week") d.setUTCDate(d.getUTCDate() + 7);
    else if (p === "month") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString().slice(0,10);
  }
  function generatePeriodRange(startIso: string, endIso: string, p: "day" | "week" | "month" | "year") {
    const keys: string[] = [];
    let cur = startIso;
    while (cur <= endIso) {
      keys.push(cur);
      cur = addPeriodISO(cur, p);
    }
    return keys;
  }

  // Build stacked series for a given key function and value extractor
  function buildStacked(acts: ActivitySummary[], keyFn: (d: Date) => string, valueFn: (a: ActivitySummary) => number, p: "day" | "week" | "month" | "year" = period, forceRange?: { startIso: string; endIso: string }) {
    const map = new Map<string, Record<string, any>>();
    const sports = new Set<string>();
    for (const a of acts) {
      const k = keyFn(new Date(a.startDate));
      const sport = a.sport || "other";
      sports.add(sport);
      if (!map.has(k)) map.set(k, { key: k, __date: new Date(k + "T00:00:00Z") });
      const entry = map.get(k)!;
      entry[sport] = (entry[sport] || 0) + valueFn(a);
    }

    // ensure we include empty periods between first and last
    const fullKeys = (() => {
      if (forceRange) return generatePeriodRange(forceRange.startIso, forceRange.endIso, p);
      if (map.size > 0) {
        const keysSorted = Array.from(map.keys()).sort();
        return generatePeriodRange(keysSorted[0], keysSorted[keysSorted.length - 1], p);
      }
      return [];
    })();

    for (const fk of fullKeys) {
      if (!map.has(fk)) map.set(fk, { key: fk, __date: new Date(fk + "T00:00:00Z") });
    }

    // ensure every sport property exists (0 when absent)
    for (const entry of map.values()) {
      for (const s of sports) {
        if (!(s in entry)) entry[s] = 0;
      }
    }

    // sort by period start date
    const arr = Array.from(map.values()).sort((a,b) => (a.__date as Date).getTime() - (b.__date as Date).getTime());
    return { data: arr.map(({__date, ...rest}) => rest), sports: Array.from(sports) };
  }

  // Build simple aggregate (not stacked) for a period, filling missing periods with value 0
  function buildAggregate(acts: ActivitySummary[], keyFn: (d: Date) => string, valueFn: (a: ActivitySummary) => number, p: "day" | "week" | "month" | "year" = period, forceRange?: { startIso: string; endIso: string }) {
    const map = new Map<string, { key: string; __date: Date; value: number }>();
    for (const a of acts) {
      const k = keyFn(new Date(a.startDate));
      if (!map.has(k)) map.set(k, { key: k, __date: new Date(k + "T00:00:00Z"), value: 0 });
      const entry = map.get(k)!;
      entry.value += valueFn(a);
    }

    if (map.size > 0) {
      const fullKeys = forceRange
        ? generatePeriodRange(forceRange.startIso, forceRange.endIso, p)
        : generatePeriodRange(Array.from(map.keys()).sort()[0], Array.from(map.keys()).sort()[Array.from(map.keys()).length - 1], p);
      for (const fk of fullKeys) {
        if (!map.has(fk)) map.set(fk, { key: fk, __date: new Date(fk + "T00:00:00Z"), value: 0 });
      }
    }

    return Array.from(map.values()).sort((a,b) => a.__date.getTime() - b.__date.getTime()).map(({__date, ...rest}) => rest);
  }

  // value functions
  const kmFn = (a: ActivitySummary) => (a.distance_m || 0) / 1000;
  const elevationFn = (a: ActivitySummary) => a.elevation_m || 0;

  // helper median
  function median(values: number[]) {
    if (!values.length) return NaN;
    const s = values.slice().sort((a,b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  // compute reference speeds (km/h) per sport from activities (use durations > 5400s)
  const DEFAULT_REF_SPEEDS: Record<string, number> = { Marche: 5, Cyclisme: 25, Course: 10, Randonnée: 4 };
  const SPORTS = Object.keys(DEFAULT_REF_SPEEDS);
  const REF_SPEEDS_KMH: Record<string, number> = SPORTS.reduce((acc, sp) => {
    const speeds = activities
      .filter(a => a.sport === sp && Number(a.duration_s) > 1800 && Number(a.distance_m) > 0)
      .map(a => (Number(a.distance_m) / Number(a.duration_s)) * 3.6);
    const m = median(speeds);
    acc[sp] = Number.isFinite(m) ? m : DEFAULT_REF_SPEEDS[sp];
    return acc;
  }, {} as Record<string, number>);

  const K_GRADE = 0.005; // k for grade factor
  const N_EXP_BY_SPORT: Record<string, number> = {
    Marche: 1.8,
    Course: 2.6,
    Cyclisme: 2.4,
    Randonnée: 2.2,
  };
  const DEFAULT_N_EXP = 2.5;
  const VAR_ALPHA = 0.5; // variability weighting

  // remplacé : fonction qui calcule la charge pour une activité (avec ajustement pour le dénivelé et exposants par sport)
  const trainingLoadFn = (a: ActivitySummary) => {
    const durS = Number(a.duration_s);
    if (!Number.isFinite(durS) || durS <= 0) return 0;
    const durationHours = durS / 3600;

    const distM = Number(a.distance_m);
    const speedKmh = Number.isFinite(distM) && durS > 0 ? (distM / durS) * 3.6 : NaN;

    // gradeFactor using elevation (guard distance)
    const elev = Number(a.elevation_m) || 0;
    const distKm = distM > 0 ? distM / 1000 : NaN;
    // rawGrade in m/km, cap at 150
    const rawGrade = Number.isFinite(distKm) && distKm > 0 ? elev / distKm : NaN;
    const gradeFactor = Number.isFinite(rawGrade) ? 1 + K_GRADE * Math.min(rawGrade, 150) : 1;
    const adjSpeed = Number.isFinite(speedKmh) ? speedKmh * gradeFactor : NaN;

    const sport = a.sport || "Autre";
    const ref = sport in REF_SPEEDS_KMH ? REF_SPEEDS_KMH[sport] : NaN;

    let actLoad = 0;
    if (Number.isFinite(adjSpeed) && Number.isFinite(ref) && ref > 0) {
      const ratio = adjSpeed / ref;
      const nExp = sport in N_EXP_BY_SPORT ? N_EXP_BY_SPORT[sport] : DEFAULT_N_EXP;
      actLoad = 100 * durationHours * Math.pow(ratio, nExp);
    } else {
      actLoad = 0;
    }

    // variability factor based on reported max speed (fallback 1)
    const variability = Number.isFinite(Number(a.max_speed_ms)*3.6) && Number.isFinite(speedKmh) && speedKmh > 0
      ? Number(a.max_speed_ms)*3.6 / speedKmh
      : 1;
    const variabilityFactor = 1 + VAR_ALPHA * Math.max(0, variability - 1);
    actLoad *= variabilityFactor;

    return Number.isFinite(actLoad) ? actLoad : 0;
  };
  
  // keyFn/day helper for daily buckets
  const keyFnDay = (d: Date) => d.toISOString().slice(0,10);
  // tick renderer adapts to mobile (no rotation, smaller font)
  const tickRenderer = (props: any) => {
    const { x, y, payload } = props;
    const label = tickFormatter(payload.value);
    if (isMobile) {
      return <text x={x} y={y} textAnchor="middle" fontSize={11} fill="var(--text)">{label}</text>;
    }
    return (<text x={x} y={y} textAnchor="end" transform={`rotate(-45, ${x}, ${y})`} fontSize={12} fill="var(--text)">{label}</text>);
  };

  // determine displayPeriod/keyFn and forceRange for bucket generation
  const displayPeriod: "day" | "week" | "month" | "year" = forcedRange ? forcedRange.displayPeriod : period;
  // Use explicit period-start functions (don't rely on keyFnForPeriod which reads `period` state)
  const effectiveKeyFn = (d: Date) => {
    if (displayPeriod === "day") return keyFnDay(d);
    if (displayPeriod === "week") return startOfWeekISO(d);
    if (displayPeriod === "month") return startOfMonthISO(d);
    return startOfYearISO(d);
  };
  const forceRangeParam = forcedRange ? { startIso: forcedRange.startIso, endIso: forcedRange.endIso } : undefined;
 
  const distanceStacked = buildStacked(filteredByRange, effectiveKeyFn, kmFn, displayPeriod as any, forceRangeParam);
  const elevationStacked = buildStacked(filteredByRange, effectiveKeyFn, elevationFn, displayPeriod as any, forceRangeParam);
  const trainingLoadData = buildAggregate(filteredByRange, effectiveKeyFn, trainingLoadFn, displayPeriod as any, forceRangeParam);
 
  // tick/tooltip formatters based on period (UTC-safe)
  const intlMonthYear = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
  const intlMonthLongYear = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const intlDateUTC = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

  const tickFormatter = (k: string) => {
    try {
      const d = new Date(k + "T00:00:00Z");
      if (displayPeriod === "day") return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", timeZone: "UTC" });
      if (displayPeriod === "week") return d.getUTCDate() <= 7 ? intlMonthYear.format(d) : "";
      if (displayPeriod === "month") return intlMonthYear.format(d);
      return String(d.getUTCFullYear());
    } catch { return k; }
  };

  const tooltipLabel = (v: any) => {
    try {
      const d = new Date(String(v) + "T00:00:00Z");
      if (displayPeriod === "day" || displayPeriod === "week") return intlDateUTC.format(d);
      if (displayPeriod === "month") return intlMonthLongYear.format(d);
      return String(d.getUTCFullYear());
    } catch {
      return String(v);
    }
  };

  // simple color palette
  const colors = ["#60a5fa", "#f59e0b", "#34d399", "#fb7185", "#a78bfa", "#f97316"];

  return (
       <section className="charts-grid">
        {!isMobile && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
           <strong style={{ marginRight: 8 }}>Période :</strong>
           <button onClick={() => setPeriod("week")} aria-pressed={period==="week"}>Semaine</button>
           <button onClick={() => setPeriod("month")} aria-pressed={period==="month"}>Mois</button>
           <button onClick={() => setPeriod("year")} aria-pressed={period==="year"}>Année</button>
           <div style={{ width: 12 }} />
           <label style={{ marginRight: 6 }}>Plage :</label>
           <select value={rangeFilter} onChange={e => setRangeFilter(e.target.value as any)} aria-label="Filtrer la plage de dates">
             <option value="all">Tous</option>
             <option value="last7">Derniers 7 jours</option>
             <option value="last31">Derniers 31 jours</option>
             <option value="last12months">Derniers 12 mois (par mois)</option>
           </select>
          </div>
        )}
 
        {isMobile && (
          <div style={{ marginBottom: 8, color: "var(--muted)", fontSize: 13 }}>
            Affichage mobile — dernières 6 semaines - Plus de détails sur ordinateur
          </div>
        )}
 
         <div className="chart-card" style={{ position: "relative" }}>
           <button className="chart-help-button" onClick={() => setOpenHelpFor("distance")} aria-label="Aide distance">?</button>
           {openHelpFor === "distance" && (
             <div className="chart-help-overlay" role="dialog" aria-modal="true">
               <div className="chart-help-content">
                 <button className="chart-help-close" onClick={() => setOpenHelpFor(null)} aria-label="Fermer">×</button>
                 <div style={{ paddingTop: 6 }}>
                   {/* Placeholder: contenu d'aide pour Distance — remplacer plus tard */}
                   <strong>Distance — Aide</strong>
                   <p style={{ marginTop: 8 }}>Ici vous pouvez ajouter des informations sur le graphique de distance.</p>
                 </div>
               </div>
             </div>
           )}
           <h3>Distance par période (km)</h3>
           <ResponsiveContainer width="100%" height={220}>
             <BarChart data={distanceStacked.data} barCategoryGap="10%">
               <CartesianGrid strokeDasharray="3 3" vertical={displayPeriod !== "week"} />
               <XAxis dataKey="key" tick={tickRenderer} height={isMobile ? 40 : 60} interval={0} />
               <YAxis />
               <Tooltip labelFormatter={tooltipLabel} />
               <Legend verticalAlign="top" height={28} />
               {distanceStacked.sports.map((s, i) => (
                 <Bar key={s} dataKey={s} stackId="a" fill={colors[i % colors.length]} isAnimationActive={false} />
               ))}
             </BarChart>
           </ResponsiveContainer>
         </div>
 
         <div className="chart-card" style={{ position: "relative" }}>
           <button className="chart-help-button" onClick={() => setOpenHelpFor("elevation")} aria-label="Aide dénivelé">?</button>
           {openHelpFor === "elevation" && (
             <div className="chart-help-overlay" role="dialog" aria-modal="true">
               <div className="chart-help-content">
                 <button className="chart-help-close" onClick={() => setOpenHelpFor(null)} aria-label="Fermer">×</button>
                 <div style={{ paddingTop: 6 }}>
                   {/* Placeholder: contenu d'aide pour Dénivelé */}
                   <strong>Dénivelé — Aide</strong>
                   <p style={{ marginTop: 8 }}>Ici vous pouvez ajouter des informations sur le graphique de dénivelé.</p>
                 </div>
               </div>
             </div>
           )}
           <h3>Dénivelé par période (m)</h3>
           <ResponsiveContainer width="100%" height={180}>
             <BarChart data={elevationStacked.data} barCategoryGap="10%">
               <CartesianGrid strokeDasharray="3 3" vertical={displayPeriod !== "week"} />
               <XAxis dataKey="key" tick={tickRenderer} height={isMobile ? 40 : 60} interval={0} />
               <YAxis />
               <Tooltip labelFormatter={tooltipLabel} />
               <Legend verticalAlign="top" height={28} />
               {elevationStacked.sports.map((s, i) => (
                 <Bar key={s} dataKey={s} stackId="a" fill={colors[i % colors.length]} isAnimationActive={false} />
               ))}
             </BarChart>
           </ResponsiveContainer>
         </div>
 
         <div className="chart-card" style={{ position: "relative" }}>
           <button className="chart-help-button" onClick={() => setOpenHelpFor("training")} aria-label="Aide charge d'entraînement">?</button>
           {openHelpFor === "training" && (
             <div className="chart-help-overlay" role="dialog" aria-modal="true">
               <div className="chart-help-content">
                 <button className="chart-help-close" onClick={() => setOpenHelpFor(null)} aria-label="Fermer">×</button>
                 <div style={{ paddingTop: 6 }}>
                   <strong>Charge d’entraînement</strong>
 
                   <h4 style={{ marginTop: 12 }}>À quoi sert ce graphique ?</h4>
                   <p>
                     Ce graphique montre la charge globale de vos entraînements dans le temps.
                     Il permet de visualiser l’intensité et le volume cumulés, afin d’identifier
                     les périodes de fatigue, de surcharge ou de récupération.
                   </p>
 
                   <h4>Comment est-elle calculée ?</h4>
                   <p>
                     La charge combine trois éléments :
                   </p>
                   <ul>
                     <li>la durée de l’activité</li>
                     <li>l’intensité estimée à partir de la vitesse</li>
                     <li>le dénivelé positif</li>
                   </ul>
                   <p>
                     L’intensité augmente de façon non linéaire : une séance rapide compte
                     proportionnellement plus qu’une séance facile.
                   </p>
 
                   <h4>Personnalisation</h4>
                   <p>
                     La vitesse de référence est calculée automatiquement à partir de vos sorties
                     passées pour chaque sport. La charge est donc adaptée à votre niveau et
                     évolue avec votre forme.
                   </p>
 
                   <h4>Comment interpréter les valeurs ?</h4>
                   <p>
                     La charge est une valeur relative (sans unité). En ordre de grandeur :
                   </p>
                   <ul>
                     <li>≈ 100 : ~1 h d’endurance</li>
                     <li>200–300 : séance soutenue</li>
                     <li>350+ : charge élevée</li>
                   </ul>
                   <p>
                     L’important est la comparaison dans le temps, pas la valeur absolue.
                   </p>
 
                   <h4>Limites</h4>
                   <p>
                     Cette estimation ne remplace pas des mesures physiologiques (fréquence
                     cardiaque, puissance) et ne détecte pas finement les intervalles.
                   </p>
                 </div>
               </div>
             </div>
           )}
           <h3>Charge d'entraînement</h3>
           <ResponsiveContainer width="100%" height={150}>
             <AreaChart data={trainingLoadData}>
               <CartesianGrid strokeDasharray="3 3" vertical={displayPeriod !== "week"} />
               <XAxis dataKey="key" tick={tickRenderer} height={isMobile ? 40 : 60} interval={0} />
               <YAxis />
               <Tooltip labelFormatter={tooltipLabel} />
               <Area type="monotone" dataKey="value" stroke="#ffc658" fill="#fff1cc" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} />
             </AreaChart>
           </ResponsiveContainer>
         </div>
       </section>
   )
 }