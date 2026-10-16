import Link from "next/link";
import { Card, CardHeader, EmptyState } from "@/components/Card";
import { Delta } from "@/components/Delta";
import { HeroChart } from "@/components/HeroChart";
import { Icon } from "@/components/icons";
import { IslandItem } from "@/components/IslandItem";
import { MostPlayedPanel } from "@/components/MostPlayedPanel";
import { Sparkline } from "@/components/Sparkline";
import { getMeta } from "@/lib/db";
import { change, fmtCompact, fmtInt, fmtShare, timeAgo, LOCALE } from "@/lib/format";
import { creatorStats, ecoNow, ecoSeries, genreStats, islandList, lastUpdate, milestones, sparklines, trackedIslands, type Range } from "@/lib/queries";

export const dynamic = "force-dynamic";

const RANGES: Range[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

export default function Home() {
  const now = ecoNow();
  const series = {
    in_client: Object.fromEntries(RANGES.map((r) => [r, ecoSeries(r, "in_client")])),
    in_match: Object.fromEntries(RANGES.map((r) => [r, ecoSeries(r, "in_match")])),
  } as Parameters<typeof HeroChart>[0]["series"];

  const tracked = trackedIslands();
  const hasIslands = tracked.length > 0;
  const top = islandList("most", { limit: 7 });
  const rising = islandList("rising", { limit: 30 })
    .filter((r) => r.ccu >= 300)
    .slice(0, 4);
  const fresh = islandList("new", { limit: 40 })
    .filter((r) => r.ccu >= 20)
    .slice(0, 4);
  const spark = sparklines(rising.map((r) => r.code));
  const genres = genreStats().slice(0, 4);
  const events = milestones(4);
  const creators = creatorStats()
    .sort((a, b) => b.players - a.players)
    .slice(0, 7);
  const updated = lastUpdate();
  const catalog = Number(getMeta("catalog.size") ?? 0);

  const days = now?.days ?? [];
  const completeDays = days.slice(0, -1); // the last day is still running
  const avgPeak = completeDays.length ? completeDays.reduce((s, d) => s + d.v, 0) / completeDays.length : null;
  const maxDay = Math.max(1, ...days.map((d) => d.v));
  const peakDay = completeDays.reduce<(typeof days)[number] | null>((b, d) => (!b || d.v > b.v ? d : b), null);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
      <div className="min-w-0 space-y-6">
        <HeroChart series={series} now={now} />

        {!hasIslands ? (
          <EmptyState title="No island data yet">
            Run <code className="rounded bg-panel-3 px-1">npm run collect</code> to pull the first batch from Epic&apos;s Fortnite Data API.
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Rising" subtitle="Past 24h" href="/islands?tab=rising" />
              {rising.map((r) => (
                <IslandItem
                  key={r.code}
                  code={r.code}
                  title={r.title}
                  sub={`${fmtInt(r.ccu)} playing`}
                  right={
                    <>
                      <Sparkline data={spark[r.code] ?? []} width={64} height={24} tone="up" />
                      <span className="w-14 text-[13px]">
                        <Delta value={r.d24h} />
                      </span>
                    </>
                  }
                />
              ))}
            </Card>

            <Card>
              <CardHeader title="Fresh releases" subtitle="Newest islands with players" href="/islands?tab=new" />
              {fresh.map((r) => (
                <IslandItem
                  key={r.code}
                  code={r.code}
                  title={r.title}
                  sub={`${r.creator ?? "Epic"} · ${r.genreName ?? r.tags[0] ?? ""}`}
                  right={<span className="text-[15px] font-bold tnum">{fmtCompact(r.ccu)}</span>}
                />
              ))}
              {!fresh.length && <p className="py-6 text-center text-sm text-muted">No new release has players yet.</p>}
            </Card>

            <Card>
              <CardHeader title="Genres" subtitle="Share of players · vs 24h ago" href="/genres" />
              <div className="space-y-3 pt-1">
                {genres.map((g) => (
                  <Link key={g.slug} href={`/islands?genre=${g.slug}`} className="grid grid-cols-[minmax(0,7.5rem)_1fr_3rem_4rem] items-center gap-3">
                    <span className="truncate text-[15px] font-bold">{g.name}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-panel-3">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(3, (g.share / genres[0].share) * 100)}%` }} />
                    </span>
                    <span className="text-right text-[14px] font-bold tnum">{fmtShare(g.share)}</span>
                    <span className="text-right text-[13px]">
                      <Delta value={g.d24h} />
                    </span>
                  </Link>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Milestones" subtitle="Latest" />
              {events.length ? (
                events.map((m) => {
                  const r = tracked.find((t) => t.code === m.code);
                  return (
                    <IslandItem
                      key={m.code + m.kind}
                      code={m.code}
                      title={m.text}
                      sub={`${r?.creator ?? "Epic"} · ${timeAgo(m.ts)}`}
                      badge={m.kind === "first" ? <Icon name="star" size={13} className="shrink-0 text-[#ffb224]" fill="currentColor" /> : undefined}
                    />
                  );
                })
              ) : (
                <p className="py-6 text-center text-sm text-muted">Milestones show up once the collector has a few days of history.</p>
              )}
            </Card>
          </div>
        )}
      </div>

      <aside className="min-w-0 space-y-5">
        <Card className="bg-gradient-to-br from-[#1d3a8a]/40 to-panel">
          <p className="text-[17px] font-bold tracking-tight">Every island, every hour</p>
          <p className="mt-1 text-[14px] text-text-2">
            <b className="text-text">{fmtInt(tracked.length)}</b> top islands tracked hourly across <b className="text-text">13 genres</b>, out of{" "}
            <b className="text-text">{fmtInt(catalog)}</b> published islands.
          </p>
          <p className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-muted">
            <span className="size-1.5 rounded-full bg-up" />
            {updated ? `Updated ${timeAgo(updated)}` : "Waiting for first sync"} · Source: Epic Fortnite Data API
          </p>
        </Card>

        {hasIslands && (
          <MostPlayedPanel
            islands={top.map((r) => ({ code: r.code, title: r.title, sub: r.genreName ?? r.creator ?? "", ccu: r.ccu, d7d: r.d7d }))}
            creators={creators.map((c) => ({ creator: c.creator, islands: c.islands, players: c.players, d7d: c.d7d, top: c.top?.title ?? null }))}
          />
        )}

        <Card>
          <div className="flex items-baseline justify-between">
            <p className="text-[17px] font-bold tracking-tight">This week</p>
            <span className="text-[13px] font-semibold text-muted underline decoration-dotted underline-offset-4" title="Highest number of players online each day">
              Average daily peak
            </span>
          </div>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-[32px] font-extrabold tracking-tight tnum">{fmtCompact(avgPeak)}</span>
            <span className="text-[13px] font-semibold text-muted">players online, last {completeDays.length} days</span>
          </p>
          <div className="mt-4 flex h-28 items-end gap-1.5">
            {days.map((d, i) => {
              const today = i === days.length - 1;
              return (
                <div key={d.ts} className="group flex flex-1 flex-col items-center gap-1.5" title={`${new Date(d.ts * 1000).toLocaleDateString()} · peak ${fmtInt(d.v)}`}>
                  <div
                    className={`w-full rounded-t-[6px] rounded-b-[3px] transition ${today ? "bg-accent" : d === peakDay ? "bg-accent/70" : "bg-panel-3 group-hover:bg-panel-3/70"}`}
                    style={{ height: `${Math.max(6, (d.v / maxDay) * 92)}px` }}
                  />
                  <span className="text-[10px] font-semibold text-muted">{new Date(d.ts * 1000).toLocaleDateString(LOCALE, { weekday: "narrow" })}</span>
                </div>
              );
            })}
          </div>
          {peakDay && (
            <p className="mt-3 text-[12px] font-medium text-muted">
              Peak: {fmtInt(peakDay.v)} on {new Date(peakDay.ts * 1000).toLocaleDateString(LOCALE, { weekday: "long" })} · today so far in blue
            </p>
          )}
        </Card>
      </aside>
    </div>
  );
}
