import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Pills } from "@/components/Card";
import { Delta } from "@/components/Delta";
import { ThumbStack } from "@/components/IslandThumb";
import { fmtInt } from "@/lib/format";
import { creatorStats, trackedIslands } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Creators" };

const TABS = [
  { key: "most", label: "Most played" },
  { key: "rising", label: "Rising" },
  { key: "islands", label: "Most islands" },
];

export default async function CreatorsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "most" } = await searchParams;
  let rows = creatorStats();
  if (tab === "rising") rows = rows.filter((c) => c.players >= 300 && c.d24h != null).sort((a, b) => b.d24h! - a.d24h!);
  else if (tab === "islands") rows = [...rows].sort((a, b) => b.islands - a.islands);
  else rows = [...rows].sort((a, b) => b.players - a.players);
  rows = rows.slice(0, 60);

  // Up to three of each creator's islands for the thumbnail stack.
  const byCreator = new Map<string, { code: string; title: string }[]>();
  for (const r of [...trackedIslands()].sort((a, b) => b.ccu - a.ccu)) {
    if (!r.creator) continue;
    const l = byCreator.get(r.creator) ?? [];
    if (l.length < 3) l.push({ code: r.code, title: r.title });
    byCreator.set(r.creator, l);
  }

  return (
    <>
      <h1 className="text-[28px] font-extrabold tracking-tight">Creators</h1>
      <p className="mb-5 text-[14px] font-medium text-muted">
        Grouped by Support-a-Creator code. Fortnite does not say whether a code belongs to a solo developer or a studio, so both are listed together.
      </p>
      <div className="mb-4">
        <Pills items={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "most" ? "/creators" : `/creators?tab=${t.key}` }))} active={tab} />
      </div>
      {!rows.length ? (
        <EmptyState title="No creator data yet" />
      ) : (
        <>
          <div className="grid-creators rounded-2xl bg-panel px-3 py-3 text-[13px] font-semibold text-muted">
            <span />
            <span>Creator</span>
            <span className="hidden text-right sm:block">Islands</span>
            <span className="text-right">Players</span>
            <span className="text-right">24H</span>
            <span className="hidden text-right sm:block">7D</span>
          </div>
          {rows.map((c, i) => (
            <Link
              key={c.creator}
              href={`/creator/${encodeURIComponent(c.creator)}`}
              className="grid-creators border-b border-line px-3 py-2.5 transition hover:bg-panel/60"
            >
              <span className={`text-center text-[14px] font-bold tnum ${i < 3 ? "text-[#ffb224]" : "text-muted"}`}>{i + 1}</span>
              <span className="flex min-w-0 items-center gap-3">
                <ThumbStack items={byCreator.get(c.creator) ?? []} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-bold">{c.creator}</span>
                  <span className="block truncate text-[13px] font-medium text-muted">{c.top?.title}</span>
                </span>
              </span>
              <span className="hidden text-right text-[14px] font-semibold text-text-2 tnum sm:block">{fmtInt(c.islands)}</span>
              <span className="text-right text-[15px] font-bold tnum">{fmtInt(c.players)}</span>
              <span className="text-right text-[14px]">
                <Delta value={c.d24h} />
              </span>
              <span className="hidden text-right text-[14px] sm:block">
                <Delta value={c.d7d} />
              </span>
            </Link>
          ))}
          <p className="mt-4 text-[12px] font-medium text-muted">Players are summed over each creator&apos;s islands that rank in a genre top 100. Island counts cover the whole catalog.</p>
        </>
      )}
    </>
  );
}
