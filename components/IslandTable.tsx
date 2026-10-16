import Link from "next/link";
import { fmtInt } from "@/lib/format";
import type { IslandRow } from "@/lib/queries";
import { Delta } from "./Delta";
import { IslandThumb } from "./IslandThumb";
import { Sparkline } from "./Sparkline";
import { StarButton } from "./Watchlist";

export function IslandTable({ rows, spark, offset = 0, extra }: { rows: IslandRow[]; spark: Record<string, number[]>; offset?: number; extra?: { label: string; value: (r: IslandRow) => React.ReactNode } }) {
  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_5.5rem_4.5rem] items-center gap-3 rounded-2xl bg-panel px-3 py-3 text-[13px] font-semibold text-muted sm:grid-cols-[2rem_minmax(0,1fr)_6rem_4.5rem_4.5rem_4.5rem] lg:grid-cols-[2rem_minmax(0,1fr)_6rem_4.5rem_4.5rem_4.5rem_7rem_2rem]">
        <span className="text-center">#</span>
        <span>Island</span>
        <span className="text-right">↓ Players</span>
        <span className="hidden text-right sm:block">1H</span>
        <span className="text-right">{extra?.label ?? "24H"}</span>
        <span className="hidden text-right sm:block">7D</span>
        <span className="hidden text-center lg:block">Today</span>
        <span className="hidden lg:block" />
      </div>
      <ol>
        {rows.map((r, i) => (
          <li
            key={r.code}
            className="grid grid-cols-[2rem_minmax(0,1fr)_5.5rem_4.5rem] items-center gap-3 border-b border-line px-3 py-2.5 transition hover:bg-panel/60 sm:grid-cols-[2rem_minmax(0,1fr)_6rem_4.5rem_4.5rem_4.5rem] lg:grid-cols-[2rem_minmax(0,1fr)_6rem_4.5rem_4.5rem_4.5rem_7rem_2rem]"
          >
            <span className={`text-center text-[14px] font-bold tnum ${offset + i < 3 ? "text-[#ffb224]" : "text-muted"}`}>{offset + i + 1}</span>
            <Link href={`/island/${r.code}`} className="flex min-w-0 items-center gap-3">
              <IslandThumb code={r.code} title={r.title} size={38} />
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-bold tracking-tight">{r.title}</span>
                <span className="block truncate text-[13px] font-medium text-muted">
                  {r.creator ?? "Epic"}
                  {r.genreName && ` · ${r.genreName}`}
                  {r.createdIn === "FNC" && " · Creative 1.0"}
                </span>
              </span>
            </Link>
            <span className="text-right text-[15px] font-bold tnum">{fmtInt(r.ccu)}</span>
            <span className="hidden text-right text-[14px] sm:block">
              <Delta value={r.d1h} />
            </span>
            <span className="text-right text-[14px]">{extra ? extra.value(r) : <Delta value={r.d24h} />}</span>
            <span className="hidden text-right text-[14px] sm:block">
              <Delta value={r.d7d} />
            </span>
            <span className="hidden justify-center lg:flex">
              <Sparkline data={spark[r.code] ?? []} width={100} height={28} tone={r.d24h == null ? undefined : r.d24h >= 0 ? "up" : "down"} />
            </span>
            <span className="hidden lg:block">
              <StarButton code={r.code} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
