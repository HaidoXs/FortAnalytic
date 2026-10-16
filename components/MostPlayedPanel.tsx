"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtCompact } from "@/lib/format";
import { Delta } from "./Delta";
import { Icon } from "./icons";
import { IslandItem } from "./IslandItem";
import { StarButton, useWatchlist } from "./Watchlist";

export type PanelIsland = { code: string; title: string; sub: string; ccu: number; d7d: number | null };
export type PanelCreator = { creator: string; islands: number; players: number; d7d: number | null; top: string | null };

const TABS = [
  ["played", "Most played"],
  ["watch", "Watchlist"],
  ["creators", "Creators"],
] as const;

function Row({ i }: { i: PanelIsland }) {
  return (
    <div className="flex items-center">
      <div className="min-w-0 flex-1">
        <IslandItem
          code={i.code}
          title={i.title}
          sub={i.sub}
          right={
            <span className="flex flex-col items-end">
              <span className="text-[15px] font-bold tnum">{fmtCompact(i.ccu)}</span>
              <Delta value={i.d7d} className="text-[13px]" />
            </span>
          }
        />
      </div>
      <StarButton code={i.code} className="ml-1" />
    </div>
  );
}

export function MostPlayedPanel({ islands, creators }: { islands: PanelIsland[]; creators: PanelCreator[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("played");
  const { codes, ready } = useWatchlist();
  const [watch, setWatch] = useState<PanelIsland[] | null>(null);

  useEffect(() => {
    if (tab !== "watch" || !ready) return;
    if (!codes.length) {
      setWatch([]);
      return;
    }
    fetch(`/api/islands?codes=${codes.join(",")}`)
      .then((r) => r.json())
      .then((rows: { code: string; title: string; creator: string | null; genreName: string | null; ccu: number; d7d: number | null }[]) =>
        setWatch(rows.map((r) => ({ code: r.code, title: r.title, sub: r.genreName ?? r.creator ?? "", ccu: r.ccu, d7d: r.d7d }))),
      )
      .catch(() => setWatch([]));
  }, [tab, codes, ready]);

  return (
    <section className="rounded-[22px] bg-panel p-4">
      <div className="mb-2 flex items-center gap-4">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`text-[17px] font-bold tracking-tight transition ${tab === k ? "text-text" : "text-muted hover:text-text-2"}`}
          >
            {label}
          </button>
        ))}
        <Link href={tab === "creators" ? "/creators" : tab === "watch" ? "/watchlist" : "/islands"} className="ml-auto text-muted hover:text-text" aria-label="Open full list">
          <Icon name="external" size={16} />
        </Link>
      </div>

      {tab === "played" && islands.map((i) => <Row key={i.code} i={i} />)}

      {tab === "watch" &&
        (watch == null ? (
          <p className="py-10 text-center text-sm text-muted">Loading…</p>
        ) : watch.length ? (
          watch.slice(0, 7).map((i) => <Row key={i.code} i={i} />)
        ) : (
          <p className="py-10 text-center text-sm text-muted">
            Tap the <Icon name="star" size={13} className="inline -mt-0.5" /> next to an island to follow it here.
          </p>
        ))}

      {tab === "creators" &&
        creators.map((c) => (
          <Link key={c.creator} href={`/creator/${encodeURIComponent(c.creator)}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-panel-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-panel-3 text-[13px] font-bold uppercase">{c.creator.slice(0, 2)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold">{c.creator}</span>
              <span className="block truncate text-[13px] font-medium text-muted">{c.top ?? `${c.islands} islands`}</span>
            </span>
            <span className="flex flex-col items-end">
              <span className="text-[15px] font-bold tnum">{fmtCompact(c.players)}</span>
              <Delta value={c.d7d} className="text-[13px]" />
            </span>
          </Link>
        ))}

      <p className="mt-2 text-[12px] font-medium text-muted">{tab === "creators" ? "Players across their tracked islands · vs last week" : "vs this time last week · peak players last hour"}</p>
    </section>
  );
}
