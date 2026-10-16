import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/Card";
import { CopyCode } from "@/components/CopyCode";
import { Delta } from "@/components/Delta";
import { IslandChart } from "@/components/IslandChart";
import { IslandThumb } from "@/components/IslandThumb";
import { StarButton } from "@/components/Watchlist";
import { getDb } from "@/lib/db";
import { change, fmtCompact, fmtInt, fmtMinutes, LOCALE } from "@/lib/format";
import { ensureIsland } from "@/lib/ingest";
import { islandDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const row = getDb().prepare("SELECT title FROM islands WHERE code = ?").get(code) as { title: string } | undefined;
  return { title: row?.title ?? code };
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-panel px-4 py-3">
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className="mt-1 text-[22px] font-extrabold tracking-tight tnum">{value}</p>
      {sub && <div className="text-[13px] font-medium text-muted">{sub}</div>}
    </div>
  );
}

export default async function IslandPage({ params }: Props) {
  const { code } = await params;
  if (!/^\d{4}-\d{4}-\d{4}$/.test(code)) notFound();
  if (!(await ensureIsland(code))) notFound();
  const d = islandDetail(code);
  if (!d) notFound();

  const { island, hourly, daily, ranks, row } = d;
  const withCcu = hourly.filter((h) => h.ccu != null);
  const lastH = hourly.at(-1)?.ts ?? 0;
  const day = hourly.filter((h) => h.ts > lastH - 86400);
  const prevDay = hourly.filter((h) => h.ts <= lastH - 86400 && h.ts > lastH - 2 * 86400);
  const sum = (a: typeof hourly, k: "plays" | "minutes" | "favorites" | "recs") => a.reduce((s, h) => s + (h[k] ?? 0), 0);
  const peak24 = Math.max(0, ...day.map((h) => h.ccu ?? 0));
  const peakAll = withCcu.reduce((b, h) => (h.ccu! > (b?.ccu ?? -1) ? h : b), null as (typeof hourly)[number] | null);
  const nowCcu = row?.ccu ?? withCcu.at(-1)?.ccu ?? 0;
  // Today is still filling up: its retention is not meaningful yet.
  const todayStart = Math.floor(Date.now() / 86400000) * 86400;
  const ret = daily.find((x) => x.d1 != null && x.ts < todayStart);
  const lastDay = daily.find((x) => x.uniques != null && x.ts < todayStart);

  return (
    <div className="space-y-6">
      <nav className="text-[13px] font-semibold text-muted">
        <Link href="/islands" className="hover:text-text">
          Islands
        </Link>
        {d.genreName && (
          <>
            {" / "}
            <Link href={`/islands?genre=${d.genre}`} className="hover:text-text">
              {d.genreName}
            </Link>
          </>
        )}
      </nav>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <IslandThumb code={island.code} title={island.title} size={96} rounded={22} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight sm:text-[34px]">{island.title}</h1>
          <p className="mt-1 text-[15px] font-semibold text-muted">
            by{" "}
            {island.creator ? (
              <Link href={`/creator/${encodeURIComponent(island.creator)}`} className="text-text-2 hover:text-text">
                {island.creator}
              </Link>
            ) : (
              "Epic Games"
            )}
            {" · "}
            {island.created_in === "FNC" ? "Fortnite Creative 1.0" : island.created_in === "UEFN" ? "Made in UEFN" : (island.created_in ?? "")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CopyCode code={island.code} />
            {island.tags.map((t) => (
              <Link key={t} href={`/islands?tag=${encodeURIComponent(t)}`} className="rounded-full bg-panel px-3 py-1.5 text-[13px] font-semibold text-text-2 capitalize hover:bg-panel-3">
                {t}
              </Link>
            ))}
            <StarButton code={island.code} size={18} />
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-[13px] font-semibold text-muted">Players (last hour peak)</p>
          <p className="text-[40px] leading-none font-extrabold tracking-tight tnum">{fmtInt(nowCcu)}</p>
          <p className="mt-1 flex gap-3 text-[14px] sm:justify-end">
            <span className="text-muted">24h</span> <Delta value={row?.d24h} />
            <span className="text-muted">7d</span> <Delta value={row?.d7d} />
          </p>
        </div>
      </header>

      {!withCcu.length && (
        <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[14px] text-muted">
          Epic reports no data for this island over the last 7 days: it had fewer than 5 players in every hour. It is now synced every hour for 3 days.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="24h peak" value={fmtInt(peak24)} sub={peakAll ? `Best: ${fmtInt(peakAll.ccu)} · ${new Date(peakAll.ts * 1000).toLocaleDateString()}` : undefined} />
        <Stat label="Plays · 24h" value={fmtCompact(sum(day, "plays"))} sub={<Delta value={change(sum(day, "plays"), sum(prevDay, "plays"))} />} />
        <Stat label="Minutes played · 24h" value={fmtCompact(sum(day, "minutes"))} sub={<Delta value={change(sum(day, "minutes"), sum(prevDay, "minutes"))} />} />
        <Stat label="Avg session" value={fmtMinutes(lastDay?.avg_min)} sub="per player, last full day" />
        <Stat label="Unique players" value={fmtCompact(lastDay?.uniques)} sub="last full day" />
        <Stat label="Day-1 retention" value={ret?.d1 != null ? `${Math.round(ret.d1 * 100)}%` : "–"} sub={ret?.d7 != null ? `Day-7: ${Math.round(ret.d7 * 100)}%` : "Day-7: –"} />
        <Stat label="Favorites · 24h" value={fmtCompact(sum(day, "favorites"))} />
        <Stat label="Recommendations · 24h" value={fmtCompact(sum(day, "recs"))} />
      </div>

      <Card className="p-5">
        <IslandChart hourly={hourly} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-x-auto">
          <h2 className="mb-2 text-[17px] font-bold">Daily</h2>
          <table className="w-full min-w-[620px] text-[14px] tnum">
            <thead className="text-left text-[12px] font-semibold text-muted">
              <tr>
                <th className="py-2 font-semibold">Day (UTC)</th>
                <th className="text-right font-semibold">Peak</th>
                <th className="text-right font-semibold">Unique</th>
                <th className="text-right font-semibold">Plays</th>
                <th className="text-right font-semibold">Minutes</th>
                <th className="text-right font-semibold">Session</th>
                <th className="text-right font-semibold">D1</th>
                <th className="text-right font-semibold">D7</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((x) => (
                <tr key={x.ts} className="border-t border-line">
                  <td className="py-2 font-semibold">{new Date(x.ts * 1000).toLocaleDateString(LOCALE, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })}</td>
                  <td className="text-right">{fmtInt(x.ccu)}</td>
                  <td className="text-right">{fmtCompact(x.uniques)}</td>
                  <td className="text-right">{fmtCompact(x.plays)}</td>
                  <td className="text-right">{fmtCompact(x.minutes)}</td>
                  <td className="text-right">{fmtMinutes(x.avg_min)}</td>
                  <td className="text-right">{x.d1 != null ? `${Math.round(x.d1 * 100)}%` : "–"}</td>
                  <td className="text-right">{x.d7 != null ? `${Math.round(x.d7 * 100)}%` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!daily.length && <p className="py-6 text-center text-sm text-muted">No daily data yet.</p>}
        </Card>

        <Card>
          <h2 className="mb-2 text-[17px] font-bold">Genre rankings</h2>
          {ranks.length ? (
            ranks.map((r) => (
              <Link key={r.genre} href={`/islands?genre=${r.genre}`} className="-mx-2 flex items-center justify-between rounded-xl px-2 py-2 hover:bg-panel-2">
                <span className="font-semibold">{r.name}</span>
                <span className="font-extrabold tnum">
                  #{r.rank}
                  {r.total != null && <span className="text-[12px] font-semibold text-muted"> / {fmtInt(r.total)}</span>}
                </span>
              </Link>
            ))
          ) : d.genreName && d.genreRank ? (
            <p className="py-2 font-semibold">
              #{d.genreRank} in {d.genreName}
            </p>
          ) : (
            <p className="py-4 text-sm text-muted">Not in a genre top 100 right now.</p>
          )}
          <p className="mt-3 text-[12px] font-medium text-muted">Epic&apos;s hourly genre leaderboards.</p>
        </Card>
      </div>
    </div>
  );
}
