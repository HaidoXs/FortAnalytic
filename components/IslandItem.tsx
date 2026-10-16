import Link from "next/link";
import { IslandThumb } from "./IslandThumb";

/** Thumbnail + title + subtitle, linking to the island page. Right side is free. */
export function IslandItem({
  code,
  title,
  sub,
  right,
  size = 40,
  rank,
  badge,
}: {
  code: string;
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  size?: number;
  rank?: number;
  badge?: React.ReactNode;
}) {
  return (
    <Link href={`/island/${code}`} className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-panel-2">
      {rank != null && <span className={`w-4 shrink-0 text-center text-[14px] font-bold tnum ${rank <= 3 ? "text-[#ffb224]" : "text-muted"}`}>{rank}</span>}
      <IslandThumb code={code} title={title} size={size} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-bold tracking-tight">{title}</span>
          {badge}
        </span>
        {sub && <span className="block truncate text-[13px] font-medium text-muted">{sub}</span>}
      </span>
      {right && <span className="flex shrink-0 items-center gap-2 text-right">{right}</span>}
    </Link>
  );
}
