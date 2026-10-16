import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Pills } from "@/components/Card";
import { Delta } from "@/components/Delta";
import { Icon } from "@/components/icons";
import { IslandItem } from "@/components/IslandItem";
import { IslandThumb, ThumbStack } from "@/components/IslandThumb";
import { SectionTabs } from "@/components/SectionTabs";
import { Sparkline } from "@/components/Sparkline";
import { fmtCompact, fmtInt, fmtShare } from "@/lib/format";
import { genreStats, tagStats } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Genres" };

const TABS = [
  { key: "most", label: "Most played" },
  { key: "rising", label: "Rising" },
  { key: "falling", label: "Falling" },
];

export default async function GenresPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "most" } = await searchParams;
  let rows = genreStats();
  if (tab === "rising") rows = [...rows].sort((a, b) => (b.d24h ?? -9) - (a.d24h ?? -9));
  if (tab === "falling") rows = [...rows].sort((a, b) => (a.d24h ?? 9) - (b.d24h ?? 9));

  const tags = tagStats().filter((t) => t.players >= 1500 && t.islands >= 3 && t.d24h != null);
  const gaining = [...tags].sort((a, b) => b.d24h! - a.d24h!).filter((t) => t.d24h! > 0).slice(0, 5);
  const falling = [...tags].sort((a, b) => a.d24h! - b.d24h!).filter((t) => t.d24h! < 0).slice(0, 5);

  return (
    <>
      <SectionTabs active="/genres" />
      {!rows.length ? (
        <EmptyState title="No genre data yet">Genres fill in after the collector&apos;s first hourly sync.</EmptyState>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0">
            <div className="mb-4">
              <Pills items={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "most" ? "/genres" : `/genres?tab=${t.key}` }))} active={tab} />
            </div>
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_5rem_1.5rem] items-center gap-3 rounded-2xl bg-panel px-3 py-3 text-[13px] font-semibold text-muted sm:grid-cols-[2rem_minmax(0,1fr)_5rem_5.5rem_6rem_7rem_1.5rem]">
              <span />
              <span>Genre</span>
              <span className="hidden text-right sm:block">% of players</span>
              <span className="text-right">↓ Players</span>
              <span className="hidden text-right sm:block">24H</span>
              <span className="hidden sm:block" />
              <span />
            </div>
            {rows.map((g, i) => (
              <details key={g.slug} className="group border-b border-line">
                <summary className="grid cursor-pointer list-none grid-cols-[2rem_minmax(0,1fr)_5rem_1.5rem] items-center gap-3 px-3 py-3 transition hover:bg-panel/60 sm:grid-cols-[2rem_minmax(0,1fr)_5rem_5.5rem_6rem_7rem_1.5rem] [&::-webkit-details-marker]:hidden">
                  <span className={`text-center text-[15px] font-bold tnum ${i < 3 ? "text-[#ffb224]" : "text-muted"}`}>{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-3">
                    <ThumbStack items={g.top} size={30} />
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-bold tracking-tight">{g.name}</span>
                      <span className="block text-[13px] font-medium text-muted">{g.total != null ? `${fmtInt(g.total)} islands` : ""}</span>
                    </span>
                  </span>
                  <span className="hidden items-center justify-end gap-1.5 text-[14px] font-semibold text-text-2 tnum sm:flex">
                    <span className="h-3.5 w-[3px] rounded-full bg-accent" />
                    {fmtShare(g.share)}
                  </span>
                  <span className="text-right text-[15px] font-bold tnum">{fmtCompact(g.players)}</span>
                  <span className="hidden justify-end sm:flex">
                    <Delta value={g.d24h} pill className="text-[13px]" />
                  </span>
                  <span className="hidden justify-center sm:flex">
                    <Sparkline data={g.spark} width={96} height={28} tone={g.d24h == null ? undefined : g.d24h >= 0 ? "up" : "down"} />
                  </span>
                  <Icon name="chevronDown" size={16} className="text-muted transition group-open:rotate-180" />
                </summary>
                <div className="grid gap-x-6 px-3 pb-4 sm:grid-cols-2">
                  {g.top.map((r) => (
                    <IslandItem
                      key={r.code}
                      code={r.code}
                      title={r.title}
                      sub={r.creator ?? "Epic"}
                      size={34}
                      right={
                        <span className="flex flex-col items-end text-[13px]">
                          <span className="text-[14px] font-bold tnum">{fmtCompact(r.ccu)}</span>
                          <Delta value={r.d24h} />
                        </span>
                      }
                    />
                  ))}
                  <Link href={`/islands?genre=${g.slug}`} className="mt-2 text-[13px] font-semibold text-accent sm:col-span-2">
                    All {g.name} islands →
                  </Link>
                </div>
              </details>
            ))}
            <p className="mt-4 text-[12px] font-medium text-muted">
              Players = peak concurrent players last hour across each genre&apos;s top 100 islands (Epic genre leaderboards). Island counts come from Epic&apos;s rankings.
            </p>
          </div>

          <aside>
            <h2 className="text-[24px] font-extrabold tracking-tight">Inside the genres</h2>
            <p className="mb-3 text-[13px] font-medium text-muted">Island tags, players now vs 24h ago</p>
            {[
              ["Gaining", gaining],
              ["Falling", falling],
            ].map(([label, list]) => (
              <div key={label as string} className="mb-5">
                <p className="mb-1 text-[13px] font-semibold text-muted">{label as string}</p>
                {(list as typeof tags).map((t) => (
                  <Link key={t.tag} href={`/islands?tag=${encodeURIComponent(t.tag)}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-panel">
                    <IslandThumb code={t.icon.code} title={t.icon.title} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold capitalize">{t.tag}</span>
                      <span className="block truncate text-[13px] font-medium text-muted">
                        {t.genreName ?? "Mixed"} · {fmtCompact(t.players)} playing
                      </span>
                    </span>
                    <Delta value={t.d24h} pill className="text-[13px]" />
                  </Link>
                ))}
                {!(list as typeof tags).length && <p className="py-2 text-[13px] text-muted">Nothing yet.</p>}
              </div>
            ))}
          </aside>
        </div>
      )}
    </>
  );
}
