import type { ActivitySummary } from "../types/Activity"
import { useState } from "react";
import { XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import "../styles/charts.css";

export default function ChartsPage({ activities }: { activities: ActivitySummary[] }) {
  const [period, setPeriod] = useState<"week" | "month" | "year">("week");

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

  const keyFnForPeriod = (d: Date) => {
    if (period === "week") return startOfWeekISO(d);
    if (period === "month") return startOfMonthISO(d);
    return startOfYearISO(d);
  }

  // helpers to step periods (ISO yyyy-mm-dd) — works in UTC
  function addPeriodISO(iso: string, p: "week" | "month" | "year") {
    const d = new Date(iso + "T00:00:00Z");
    if (p === "week") d.setUTCDate(d.getUTCDate() + 7);
    else if (p === "month") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString().slice(0,10);
  }
  function generatePeriodRange(startIso: string, endIso: string, p: "week" | "month" | "year") {
    const keys: string[] = [];
    let cur = startIso;
    while (cur <= endIso) {
      keys.push(cur);
      cur = addPeriodISO(cur, p);
    }
    return keys;
  }

  // Build stacked series for a given key function and value extractor
  function buildStacked(acts: ActivitySummary[], keyFn: (d: Date) => string, valueFn: (a: ActivitySummary) => number) {
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
    if (map.size > 0) {
      const keysSorted = Array.from(map.keys()).sort();
      const startIso = keysSorted[0];
      const endIso = keysSorted[keysSorted.length - 1];
      const fullKeys = generatePeriodRange(startIso, endIso, period);
      for (const fk of fullKeys) {
        if (!map.has(fk)) map.set(fk, { key: fk, __date: new Date(fk + "T00:00:00Z") });
      }
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
  function buildAggregate(acts: ActivitySummary[], keyFn: (d: Date) => string, valueFn: (a: ActivitySummary) => number) {
    const map = new Map<string, { key: string; __date: Date; value: number }>();
    for (const a of acts) {
      const k = keyFn(new Date(a.startDate));
      if (!map.has(k)) map.set(k, { key: k, __date: new Date(k + "T00:00:00Z"), value: 0 });
      const entry = map.get(k)!;
      entry.value += valueFn(a);
    }

    if (map.size > 0) {
      const keysSorted = Array.from(map.keys()).sort();
      const startIso = keysSorted[0];
      const endIso = keysSorted[keysSorted.length - 1];
      const fullKeys = generatePeriodRange(startIso, endIso, period);
      for (const fk of fullKeys) {
        if (!map.has(fk)) map.set(fk, { key: fk, __date: new Date(fk + "T00:00:00Z"), value: 0 });
      }
    }

    return Array.from(map.values()).sort((a,b) => a.__date.getTime() - b.__date.getTime()).map(({__date, ...rest}) => rest);
  }

  // value functions
  const kmFn = (a: ActivitySummary) => (a.distance_m || 0) / 1000;
  const elevationFn = (a: ActivitySummary) => a.elevation_m || 0;
  const trainingLoadFn = (a: ActivitySummary) => {
    const km = (a.distance_m || 0) / 1000;
    const hours = (a.duration_s || 0) / 3600;
    return km * hours;
  };

  const distanceStacked = buildStacked(activities, keyFnForPeriod, kmFn);
  const elevationStacked = buildStacked(activities, keyFnForPeriod, elevationFn);
  const trainingLoadData = buildAggregate(activities, keyFnForPeriod, trainingLoadFn);

  // tick/tooltip formatters based on period
  const tickFormatter = (k: string) => {
    try {
      const d = new Date(k + "T00:00:00Z");
      if (period === "week") {
        // n'affiche le label que pour la première semaine du mois
        return d.getUTCDate() <= 7 ? d.toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "";
      }
      if (period === "month") return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      return String(d.getFullYear());
    } catch { return k; }
  };
  const tooltipLabel = (v: any) => {
    try {
      const d = new Date(String(v) + "T00:00:00Z");
      if (period === "week") return d.toLocaleDateString();
      if (period === "month") return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      return String(d.getFullYear());
    } catch {
      return String(v);
    }
  };

  // simple color palette
  const colors = ["#60a5fa", "#f59e0b", "#34d399", "#fb7185", "#a78bfa", "#f97316"];

  return (
      <section className="charts-grid">
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <strong style={{ marginRight: 8 }}>Période :</strong>
          <button onClick={() => setPeriod("week")} aria-pressed={period==="week"}>Semaine</button>
          <button onClick={() => setPeriod("month")} aria-pressed={period==="month"}>Mois</button>
          <button onClick={() => setPeriod("year")} aria-pressed={period==="year"}>Année</button>
        </div>

        <div className="chart-card">
          <h3>Distance par période (km) — empilé par sport</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={distanceStacked.data} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={period !== "week"} />
              <XAxis dataKey="key" tick={(props) => {const { x, y, payload } = props; return ( <text x={x} y={y} textAnchor="end" transform={`rotate(-45, ${x}, ${y})`} fontSize={12}>{tickFormatter(payload.value)}</text>);}}height={60}interval={0}/>
              <YAxis />
              <Tooltip labelFormatter={tooltipLabel} />
              <Legend verticalAlign="top" height={28} />
              {distanceStacked.sports.map((s, i) => (
                <Bar key={s} dataKey={s} stackId="a" fill={colors[i % colors.length]}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Dénivelé par période (m) — empilé par sport</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={elevationStacked.data} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={period !== "week"} />
              <XAxis dataKey="key" tick={(props) => {const { x, y, payload } = props; return ( <text x={x} y={y} textAnchor="end" transform={`rotate(-45, ${x}, ${y})`} fontSize={12}>{tickFormatter(payload.value)}</text>);}}height={60}interval={0}/>
              <YAxis />
              <Tooltip labelFormatter={tooltipLabel} />
              <Legend verticalAlign="top" height={28} />
              {elevationStacked.sports.map((s, i) => (
                <Bar key={s} dataKey={s} stackId="a" fill={colors[i % colors.length]}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Charge d'entraînement</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trainingLoadData}>
              <CartesianGrid strokeDasharray="3 3" vertical={period !== "week"} />
              <XAxis dataKey="key" tick={(props) => {const { x, y, payload } = props; return ( <text x={x} y={y} textAnchor="end" transform={`rotate(-45, ${x}, ${y})`} fontSize={12}>{tickFormatter(payload.value)}</text>);}}height={60}interval={0}/>
              <YAxis />
              <Tooltip labelFormatter={tooltipLabel} />
              <Area type="monotone" dataKey="value" stroke="#ffc658" fill="#fff1cc" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
  )
}