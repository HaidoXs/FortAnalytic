import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Delta } from "@/components/Delta";
import { Icon } from "@/components/icons";
import { IslandThumb } from "@/components/IslandThumb";
import { fmtCompact, fmtInt } from "@/lib/format";
import { creatorIslands, creatorStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: decodeURIComponent((await params).code) };
}

export default async function CreatorPage({ params }: Props) {
  const creator = decodeURIComponent((await params).code);
  const islands = creatorIslands(creator);
  if (!islands.length) notFound();
  const stats = creatorStats().find((c) => c.creator === creator);
  const sorted = [...islands].sort((a, b) => (b.stats?.ccu ?? -1) - (a.stats?.ccu ?? -1));
  const uefn = islands.filter((i) => i.createdIn === "UEFN").length;

  return (
    <div className="space-y-6">
      <nav className="text-[13px] font-semibold text-muted">
        <Link href="/creators" className="hover:text-text">
          Creators
        </Link>
      </nav>
      <header className="flex flex-wrap items-center gap-5">
        <span className="grid size-20 place-items-center rounded-full bg-panel-3 text-[26px] font-extrabold uppercase">{creator.slice(0, 2)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[32px] font-extrabold tracking-tight">{creator}</h1>
          <p className="text-[14px] font-semibold text-muted">
            {fmtInt(islands.length)} published islands · {fmtInt(uefn)} made in UEFN
          </p>
        </div>
        <a
          href={`https://www.fortnite.com/@${encodeURIComponent(creator)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 text-[14px] font-semibold hover:bg-panel-3"
        >
          fortnite.com profile <Icon name="external" size={14} />
        </a>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Players now", fmtInt(stats?.players ?? 0), <Delta key="d" value={stats?.d24h} />],
          ["vs last week", <Delta key="w" value={stats?.d7d} />, null],
          ["Islands with players", fmtInt(stats?.live ?? 0), "among tracked islands"],
          ["Top island", stats?.top ? fmtCompact(stats.top.ccu) : "–", stats?.top?.title],
        ].map(([label, value, sub], i) => (
          <div key={i} className="rounded-2xl bg-panel px-4 py-3">
            <p className="text-[13px] font-semibold text-muted">{label}</p>
            <p className="mt-1 text-[22px] font-extrabold tracking-tight tnum">{value}</p>
            {sub && <div className="truncate text-[13px] font-medium text-muted">{sub}</div>}
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-[17px] font-bold">Islands</h2>
        {sorted.map((i) => (
          <Link key={i.code} href={`/island/${i.code}`} className="flex items-center gap-3 border-b border-line px-2 py-2.5 transition hover:bg-panel/60">
            <IslandThumb code={i.code} title={i.title} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold">{i.title}</span>
              <span className="block truncate text-[13px] font-medium text-muted capitalize">
                {i.code} · {i.createdIn === "FNC" ? "Creative 1.0" : i.createdIn} {i.tags.length ? `· ${i.tags.slice(0, 3).join(", ")}` : ""}
              </span>
            </span>
            {i.stats ? (
              <span className="flex flex-col items-end">
                <span className="text-[15px] font-bold tnum">{fmtInt(i.stats.ccu)}</span>
                <Delta value={i.stats.d24h} className="text-[13px]" />
              </span>
            ) : (
              <span className="text-[12px] font-semibold text-muted">not tracked</span>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}
