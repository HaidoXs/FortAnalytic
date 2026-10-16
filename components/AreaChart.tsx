"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtCompact, fmtInt, LOCALE } from "@/lib/format";

export type SeriesPoint = { t: number; v: number };

function niceTicks(min: number, max: number, count = 5) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? raw;
  const lo = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= max + step * 0.001; v += step) ticks.push(v);
  return ticks;
}

function fmtTime(t: number, span: number, withDay = false) {
  const d = new Date(t * 1000);
  if (span <= 2 * 86400 && !withDay) return d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  if (span <= 2 * 86400 || withDay)
    return d.toLocaleString(LOCALE, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

/**
 * Single-series area chart with a crosshair tooltip. Fills its container's width.
 * `baseline` draws a dashed reference line (e.g. the value at the start of the range).
 */
export function AreaChart({
  data,
  height = 320,
  baseline,
  onHover,
  emptyLabel = "Not enough data yet",
}: {
  data: SeriesPoint[];
  height?: number;
  baseline?: number | null;
  onHover?: (p: SeriesPoint | null) => void;
  emptyLabel?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padR = 48;
  const padT = 28;
  const padB = 26;
  const plotW = width - padR;
  const plotH = height - padT - padB;

  const geo = useMemo(() => {
    if (data.length < 2) return null;
    const t0 = data[0].t;
    const t1 = data[data.length - 1].t;
    let lo = Math.min(...data.map((d) => d.v));
    let hi = Math.max(...data.map((d) => d.v));
    if (baseline != null) {
      lo = Math.min(lo, baseline);
      hi = Math.max(hi, baseline);
    }
    const pad = (hi - lo) * 0.08 || hi * 0.1 || 1;
    lo = Math.max(0, lo - pad);
    hi = hi + pad;
    const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * plotW;
    const y = (v: number) => padT + plotH * (1 - (v - lo) / (hi - lo));
    const line = data.map((d, i) => `${i ? "L" : "M"}${x(d.t).toFixed(1)},${y(d.v).toFixed(1)}`).join("");
    const area = `${line}L${x(t1).toFixed(1)},${padT + plotH}L0,${padT + plotH}Z`;
    const ticks = niceTicks(lo, hi, 5).filter((v) => v >= lo && v <= hi);
    const nX = Math.min(8, Math.max(3, Math.floor(plotW / 110)));
    const xTicks = Array.from({ length: nX }, (_, i) => t0 + ((t1 - t0) * (i + 0.5)) / nX);
    return { x, y, line, area, ticks, xTicks, span: t1 - t0 };
  }, [data, baseline, plotW, plotH]);

  if (!geo) {
    return (
      <div ref={wrap} className="grid place-items-center text-sm text-muted" style={{ height }}>
        {emptyLabel}
      </div>
    );
  }

  const hp = hover != null ? data[hover] : null;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    // nearest point by x
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < data.length; i++) {
      const d = Math.abs(geo.x(data[i].t) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
    onHover?.(data[best]);
  };

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }}>
      <svg width={width} height={height} className="block overflow-visible" role="img" aria-label="Players over time">
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0.02} />
          </linearGradient>
          <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.9" fill="var(--grid)" />
          </pattern>
        </defs>
        <rect x={0} y={padT} width={plotW} height={plotH} fill="url(#dots)" />
        {geo.ticks.map((v) => (
          <text key={v} x={width - 4} y={geo.y(v) + 4} textAnchor="end" className="fill-[var(--muted)] text-[11px] font-semibold tnum">
            {fmtCompact(v)}
          </text>
        ))}
        {geo.xTicks.map((t) => (
          <text key={t} x={geo.x(t)} y={height - 6} textAnchor="middle" className="fill-[var(--muted)] text-[11px] font-semibold">
            {fmtTime(t, geo.span)}
          </text>
        ))}
        <path d={geo.area} fill="url(#areaFill)" />
        {baseline != null && (
          <line x1={0} x2={plotW} y1={geo.y(baseline)} y2={geo.y(baseline)} stroke="var(--muted)" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 4" />
        )}
        <path d={geo.line} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" />
        {/* live dot on the last point */}
        <circle cx={geo.x(data.at(-1)!.t)} cy={geo.y(data.at(-1)!.v)} r={4.5} fill="var(--chart-line)" stroke="var(--panel)" strokeWidth={2} />
        {hp && (
          <g>
            <line x1={geo.x(hp.t)} x2={geo.x(hp.t)} y1={padT - 6} y2={padT + plotH} stroke="var(--muted)" strokeOpacity={0.5} />
            <circle cx={geo.x(hp.t)} cy={geo.y(hp.v)} r={5} fill="var(--chart-line)" stroke="var(--panel)" strokeWidth={2} />
            <text
              x={Math.min(Math.max(geo.x(hp.t), 60), plotW - 60)}
              y={padT - 12}
              textAnchor="middle"
              className="fill-[var(--text)] text-[12px] font-bold tnum"
            >
              {fmtInt(hp.v)}
              <tspan className="fill-[var(--muted)] font-semibold"> {fmtTime(hp.t, geo.span, true)}</tspan>
            </text>
          </g>
        )}
        <rect
          x={0}
          y={0}
          width={plotW}
          height={height}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => {
            setHover(null);
            onHover?.(null);
          }}
        />
      </svg>
    </div>
  );
}
