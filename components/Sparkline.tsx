/** Tiny line chart; colour follows the overall trend (first vs last point) unless given. */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  tone,
  fill = false,
}: {
  data: number[];
  width?: number;
  height?: number;
  tone?: "up" | "down" | "accent";
  fill?: boolean;
}) {
  if (!data.length) return <svg width={width} height={height} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pad = 2;
  const step = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((v, i) => [pad + i * step, pad + (height - pad * 2) * (1 - (v - min) / span)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const t = tone ?? (data[data.length - 1] >= data[0] ? "up" : "down");
  const color = t === "up" ? "var(--up)" : t === "down" ? "var(--down)" : "var(--accent)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden>
      {fill && <path d={`${d}L${pts.at(-1)![0]},${height}L${pts[0][0]},${height}Z`} fill={color} opacity={0.12} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Small bar series (new releases per bucket on the Trends page). */
export function MiniBars({ data, width = 132, height = 30 }: { data: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...data);
  const gap = 2;
  const w = (width - gap * (data.length - 1)) / data.length;
  return (
    <svg width={width} height={height} aria-hidden>
      {data.map((v, i) => {
        const h = v ? Math.max(3, (v / max) * height) : 2;
        const recent = i >= data.length / 2;
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={height - h}
            width={w}
            height={h}
            rx={1.5}
            fill={v ? (recent ? "var(--accent)" : "var(--muted)") : "var(--panel-3)"}
            opacity={v && !recent ? 0.45 : 1}
          />
        );
      })}
    </svg>
  );
}
