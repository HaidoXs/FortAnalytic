import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Pills } from "@/components/Card";
import { Delta } from "@/components/Delta";
import { IslandThumb, ThumbStack } from "@/components/IslandThumb";
import { SectionTabs } from "@/components/SectionTabs";
import { MiniBars } from "@/components/Sparkline";
import { fmtCompact, fmtInt } from "@/lib/format";
import { TREND_WINDOW, trends } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trends" };

const TABS = [
  { key: "made", label: "Most made" },
  { key: "heating", label: "Heating up" },
  { key: "cooling", label: "Cooling" },
  { key: "played", label: "Most played" },
];

export default async function TrendsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "made" } = await searchParams;
  const all = trends();
  const growing = all.filter((t) => t.recent >= 10 && t.before >= 3 && t.growth != null);
  const cooling = all.filter((t) => t.before >= 10 && t.growth != null);

  let rows = [...all];
  if (tab === "made") rows.sort((a, b) => b.recent - a.recent);
  if (tab === "heating") rows = [...growing].sort((a, b) => b.growth! - a.growth!);
  if (tab === "cooling") rows = [...cooling].sort((a, b) => a.growth! - b.growth!);
  if (tab === "played") rows.sort((a, b) => b.players - a.players);
  rows = rows.slice(0, 40);

  const heating = [...growing].sort((a, b) => b.growth! - a.growth!).slice(0, 5);
  const cool = [...cooling].sort((a, b) => a.growth! - b.growth!).slice(0, 5);
  const win = fmtCompact(TREND_WINDOW);

  return (
    <>
      <SectionTabs active="/trends" />
      {!all.length ? (
        <EmptyState title="No catalog yet">Trends are computed from the island catalog, which the collector downloads once a day.</EmptyState>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0">
            <div className="mb-4">
              <Pills items={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "made" ? "/trends" : `/trends?tab=${t.key}` }))} active={tab} />
            </div>
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_4rem_5rem] items-center gap-3 rounded-2xl bg-panel px-3 py-3 text-[13px] font-semibold text-muted md:grid-cols-[2rem_minmax(0,1fr)_4.5rem_5rem_5rem_8.5rem]">
              <span />
              <span>Word in title</span>
              <span className="text-right" title={`Islands released among the newest ${win}`}>
                Last {win}
              </span>
              <span className="text-right">vs before</span>
              <span className="hidden text-right md:block">Playing</span>
              <span className="hidden text-right md:block">Releases</span>
            </div>
            {rows.map((t, i) => (
              <div
                key={t.word}
                className="grid grid-cols-[2rem_minmax(0,1fr)_4rem_5rem] items-center gap-3 border-b border-line px-3 py-3 md:grid-cols-[2rem_minmax(0,1fr)_4.5rem_5rem_5rem_8.5rem]"
              >
                <span className={`text-center text-[15px] font-bold tnum ${i < 3 ? "text-[#ffb224]" : "text-muted"}`}>{i + 1}</span>
                <span className="flex min-w-0 items-center gap-3">
                  <ThumbStack items={t.examples} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-bold tracking-tight capitalize">{t.word}</span>
                    <span className="block truncate text-[13px] font-medium text-muted">
                      <Link href={`/island/${t.examples[0].code}`} className="hover:text-text">
                        {t.examples[0].title}
                      </Link>
                      {t.more > 0 && ` + ${fmtInt(t.more)} more`}
                    </span>
                  </span>
                </span>
                <span className="text-right text-[15px] font-bold tnum">{fmtInt(t.recent)}</span>
                <span className="text-right text-[14px]">{t.growth == null ? <span className="text-[12px] font-bold text-accent">NEW</span> : <Delta value={t.growth} />}</span>
                <span className="hidden text-right text-[14px] font-semibold text-text-2 tnum md:block">{t.players ? fmtCompact(t.players) : "–"}</span>
                <span className="hidden justify-end md:flex">
                  <MiniBars data={t.buckets} />
                </span>
              </div>
            ))}
            <p className="mt-4 text-[12px] font-medium text-muted">
              Words from the titles of the newest {fmtInt(TREND_WINDOW)} published islands, compared with the {fmtInt(TREND_WINDOW)} released before them. Bars:
              releases containing the word over the last {fmtInt(TREND_WINDOW * 2)} islands, oldest to newest. Playing = players right now on tracked islands with the
              word.
            </p>
          </div>

          <aside>
            <h2 className="text-[24px] font-extrabold tracking-tight">Movers</h2>
            <Link href="/trends?tab=heating" className="mb-3 block text-[13px] font-semibold text-muted hover:text-text">
              See what&apos;s heating up ›
            </Link>
            {[
              ["Heating up", heating],
              ["Cooling", cool],
            ].map(([label, list]) => (
              <div key={label as string} className="mb-5">
                <p className="mb-1 text-[13px] font-semibold text-muted">{label as string}</p>
                {(list as typeof rows).map((t) => (
                  <Link key={t.word} href={`/island/${t.examples[0].code}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-panel">
                    <IslandThumb code={t.examples[0].code} title={t.examples[0].title} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold capitalize">{t.word}</span>
                      <span className="block truncate text-[13px] font-medium text-muted">{fmtInt(t.recent)} new releases</span>
                    </span>
                    <Delta value={t.growth} pill className="text-[13px]" />
                  </Link>
                ))}
              </div>
            ))}
          </aside>
        </div>
      )}
    </>
  );
}
