import { fmtPct } from "@/lib/format";

/** ▲ 4.8% / ▼ 2.1% in the trend colour. `pill` gives it a tinted background. */
export function Delta({ value, pill = false, className = "" }: { value: number | null | undefined; pill?: boolean; className?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className={`text-muted tnum ${className}`}>–</span>;
  const up = value >= 0;
  // The ▲/▼ is drawn by the .tri class (globals.css): this renders hundreds of times per page.
  return (
    <span
      className={`tri inline-flex items-center font-semibold tnum whitespace-nowrap ${up ? "text-up" : "dn text-down"}${
        pill ? ` rounded-md px-1.5 py-0.5 ${up ? "bg-up-soft" : "bg-down-soft"}` : ""
      } ${className}`}
    >
      <span className="sr-only">{up ? "up" : "down"}</span>
      {fmtPct(Math.abs(value))}
    </span>
  );
}

export function RankMove({ text, tone }: { text: string; tone: "up" | "down" | "new" }) {
  if (tone === "new") return <span className="rounded bg-accent-soft px-1.5 py-px text-[10px] font-bold tracking-wide text-accent">NEW</span>;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-bold tnum ${tone === "up" ? "bg-up-soft text-up" : "bg-down-soft text-down"}`}
    >
      <svg width="6" height="5" viewBox="0 0 7 6" aria-hidden className={tone === "up" ? "" : "rotate-180"}>
        <path d="M3.5 0 7 6H0z" fill="currentColor" />
      </svg>
      {text}
    </span>
  );
}
