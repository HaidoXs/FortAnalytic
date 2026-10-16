const NBSP = " ";

export function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 932K, 1.3M, 77.1K, 6.44K – three significant digits, like the reference. */
export function fmtCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  const abs = Math.abs(n);
  const unit = abs >= 1e9 ? ["B", 1e9] : abs >= 1e6 ? ["M", 1e6] : abs >= 1e3 ? ["K", 1e3] : ["", 1];
  const v = n / (unit[1] as number);
  if (unit[0] === "") return String(Math.round(n));
  const digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return `${Number(v.toFixed(digits))}${unit[0]}`;
}

/** Percent with 3 significant digits: 987%, 17.3%, 2.12%. Input is a ratio change (0.12 = 12%). */
export function fmtPct(ratio: number | null | undefined, signed = false): string {
  if (ratio == null || !Number.isFinite(ratio)) return "–";
  const p = ratio * 100;
  const abs = Math.abs(p);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  const s = abs >= 10000 ? fmtCompact(abs) : abs.toFixed(digits);
  return `${signed ? (p >= 0 ? "+" : "−") : ""}${s}%`;
}

export function fmtShare(ratio: number): string {
  const p = ratio * 100;
  return `${p >= 10 ? Math.round(p) : p.toFixed(1)}%`;
}

export function fmtMinutes(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "–";
  if (min < 60) return `${min.toFixed(min < 10 ? 1 : 0)} min`;
  return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;
}

export function change(now: number | null | undefined, before: number | null | undefined): number | null {
  if (now == null || before == null || before <= 0) return null;
  return now / before - 1;
}

export function timeAgo(unixSec: number, now = Date.now() / 1000): string {
  const d = Math.max(0, now - unixSec);
  if (d < 90) return "just now";
  if (d < 3600) return `${Math.round(d / 60)} min ago`;
  if (d < 86400) return `${Math.round(d / 3600)} h ago`;
  return `${Math.round(d / 86400)} d ago`;
}

/** One locale everywhere, so server and browser render dates the same way. */
export const LOCALE = "en-GB";
