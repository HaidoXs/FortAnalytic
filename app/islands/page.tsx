import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, Pills } from "@/components/Card";
import { Delta } from "@/components/Delta";
import { Icon } from "@/components/icons";
import { IslandTable } from "@/components/IslandTable";
import { ListFilters } from "@/components/ListFilters";
import { SectionTabs } from "@/components/SectionTabs";
import { getDb } from "@/lib/db";
import { fmtMinutes } from "@/lib/format";
import { islandList, sparklines, type IslandSort } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Islands" };

const TABS: { key: IslandSort; label: string }[] = [
  { key: "most", label: "Most played" },
  { key: "rising", label: "Rising" },
  { key: "falling", label: "Falling" },
  { key: "new", label: "New" },
  { key: "gems", label: "Hidden gems" },
];

export default async function IslandsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "most") as IslandSort;
  const limit = Math.min(500, Number(sp.limit) || 100);
  const rows = islandList(tab, { genre: sp.genre, tag: sp.tag, q: sp.q, limit: limit + 1 });
  const shown = rows.slice(0, limit);
  const spark = sparklines(shown.map((r) => r.code));
  const genres = getDb().prepare("SELECT slug, name FROM genres ORDER BY name").all() as { slug: string; name: string }[];

  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ genre: sp.genre, tag: sp.tag, q: sp.q, tab: tab === "most" ? undefined : tab, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return `/islands${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <SectionTabs active="/islands" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Pills items={TABS.map((t) => ({ key: t.key, label: t.label, href: href({ tab: t.key === "most" ? undefined : t.key }) }))} active={tab} />
          <Link href="/watchlist" aria-label="Watchlist" className="grid size-10 place-items-center rounded-full border border-line bg-panel text-muted hover:text-text">
            <Icon name="star" size={16} />
          </Link>
        </div>
        <Suspense>
          <ListFilters genres={genres} />
        </Suspense>
      </div>

      {sp.tag && (
        <p className="mb-3 flex items-center gap-2 text-[13px] font-medium text-muted">
          Tag
          <Link href={href({ tag: "" })} className="flex items-center gap-1 rounded-full bg-panel-3 px-2.5 py-1 font-semibold text-text capitalize">
            {sp.tag} <Icon name="close" size={12} />
          </Link>
        </p>
      )}
      {tab === "gems" && (
        <p className="mb-3 text-[13px] font-medium text-muted">Smaller islands (under 1,500 players) with the best mix of long sessions and day-1 retention.</p>
      )}
      {tab === "new" && <p className="mb-3 text-[13px] font-medium text-muted">Tracked islands sorted by release order, newest first.</p>}

      {shown.length ? (
        <IslandTable
          rows={shown}
          spark={spark}
          extra={
            tab === "gems"
              ? {
                  label: "Session",
                  value: (r) => <span className="font-semibold tnum">{fmtMinutes(r.avgMin)}</span>,
                }
              : tab === "rising" || tab === "falling"
                ? { label: "24H", value: (r) => <Delta value={r.d24h} pill /> }
                : undefined
          }
        />
      ) : (
        <EmptyState title="Nothing here yet">No tracked island matches these filters.</EmptyState>
      )}

      {rows.length > limit && (
        <div className="mt-5 flex justify-center">
          <Link href={href({ limit: String(limit + 100) })} scroll={false} className="rounded-full border border-line bg-panel px-5 py-2 text-[14px] font-semibold hover:bg-panel-3">
            Show more
          </Link>
        </div>
      )}
    </>
  );
}
