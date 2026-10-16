"use client";

import { useState } from "react";
import { change, fmtInt, LOCALE } from "@/lib/format";
import { AreaChart, type SeriesPoint } from "./AreaChart";
import { Delta } from "./Delta";

const RANGES = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;
type Range = (typeof RANGES)[number];
type Metric = "in_client" | "in_match";

const RANGE_LABEL: Record<Range, string> = { "1D": "Past day", "1W": "Past week", "1M": "Past month", "3M": "Past 3 months", "1Y": "Past year", ALL: "All time" };

export function HeroChart({
  series,
  now,
}: {
  series: Record<Metric, Record<Range, SeriesPoint[]>>;
  now: { inClient: number; inMatch: number | null; ts: number } | null;
}) {
  const [range, setRange] = useState<Range>("1D");
  const [metric, setMetric] = useState<Metric>("in_client");
  const [hover, setHover] = useState<SeriesPoint | null>(null);

  const data = series[metric][range];
  const current = metric === "in_client" ? now?.inClient : now?.inMatch;
  const last = data.at(-1)?.v ?? current ?? null;
  const first = data[0]?.v ?? null;
  const shown = hover?.v ?? (range === "1D" ? (current ?? last) : last);
  const delta = range === "1D" || !hover ? change(last, first) : change(hover.v, first);
  const diff = last != null && first != null ? last - first : null;

  return (
    <section>
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-text-2">{metric === "in_client" ? "Playing Fortnite right now" : "In a match right now"}</p>
          <p className="mt-1 text-[44px] leading-none font-extrabold tracking-[-0.03em] tnum sm:text-[52px]">{fmtInt(shown)}</p>
          <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold">
            <Delta value={delta} />
            {diff != null && !hover && (
              <span className={`tnum ${diff >= 0 ? "text-up" : "text-down"}`}>
                ({diff >= 0 ? "+" : "−"}
                {fmtInt(Math.abs(diff))})
              </span>
            )}
            <span className="text-muted">{hover ? new Date(hover.t * 1000).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" }) : RANGE_LABEL[range]}</span>
          </p>
        </div>
      </div>

      <div className="mt-2 -mr-1">
        <AreaChart
          data={data}
          height={340}
          baseline={first}
          onHover={setHover}
          emptyLabel={range === "1D" || range === "1W" ? "Waiting for the collector…" : "History builds up as the collector runs (Epic keeps 7 days)."}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-0.5 rounded-full border border-line bg-panel p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full px-3.5 py-1.5 text-[14px] font-bold transition ${r === range ? "bg-panel-3 text-text" : "text-muted hover:text-text"}`}
            >
              {r === "ALL" ? "All" : r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-full border border-line bg-panel p-1">
          {(
            [
              ["in_client", "Online"],
              ["in_match", "In a match"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-bold transition ${m === metric ? "bg-panel-3 text-text" : "text-muted hover:text-text"}`}
            >
              {m === metric && <span className="size-1.5 rounded-full bg-down" />}
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
