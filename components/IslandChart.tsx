"use client";

import { useMemo, useState } from "react";
import { AreaChart } from "./AreaChart";

type Hour = { ts: number; ccu: number | null; plays: number | null; uniques: number | null; minutes: number | null };

const METRICS = [
  ["ccu", "Players"],
  ["plays", "Plays"],
  ["uniques", "Unique players"],
  ["minutes", "Minutes played"],
] as const;
const RANGES = [
  ["24H", 86400],
  ["7D", 7 * 86400],
  ["30D", 30 * 86400],
  ["All", Infinity],
] as const;

export function IslandChart({ hourly }: { hourly: Hour[] }) {
  const [metric, setMetric] = useState<(typeof METRICS)[number][0]>("ccu");
  const [range, setRange] = useState<(typeof RANGES)[number][0]>("7D");

  const data = useMemo(() => {
    const span = RANGES.find((r) => r[0] === range)![1];
    const last = hourly.at(-1)?.ts ?? 0;
    // Missing values mean fewer than 5 players in that hour: plot them as 0.
    return hourly.filter((h) => h.ts > last - span).map((h) => ({ t: h.ts, v: h[metric] ?? 0 }));
  }, [hourly, metric, range]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-full border border-line bg-panel p-1">
          {METRICS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMetric(k)}
              className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold ${k === metric ? "bg-panel-3 text-text" : "text-muted hover:text-text"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 rounded-full border border-line bg-panel p-1">
          {RANGES.map(([k]) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={`rounded-full px-3 py-1 text-[13px] font-bold ${k === range ? "bg-panel-3 text-text" : "text-muted hover:text-text"}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <AreaChart data={data} height={300} emptyLabel="No hourly data for this island yet" />
      <p className="mt-1 text-[12px] font-medium text-muted">
        {metric === "ccu" ? "Peak concurrent players per hour." : "Per hour."} Hours with fewer than 5 players are reported as 0 by Epic.
      </p>
    </div>
  );
}
