"use client";

import { useEffect, useState } from "react";
import { Delta } from "@/components/Delta";
import { Icon } from "@/components/icons";
import { IslandItem } from "@/components/IslandItem";
import { StarButton, useWatchlist } from "@/components/Watchlist";
import { fmtInt } from "@/lib/format";
import type { IslandRow } from "@/lib/queries";

export default function WatchlistPage() {
  const { codes, ready } = useWatchlist();
  const [rows, setRows] = useState<IslandRow[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!codes.length) {
      setRows([]);
      return;
    }
    fetch(`/api/islands?codes=${codes.join(",")}`)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, [codes, ready]);

  const missing = rows ? codes.filter((c) => !rows.some((r) => r.code === c)) : [];

  return (
    <>
      <h1 className="text-[28px] font-extrabold tracking-tight">Watchlist</h1>
      <p className="mb-5 text-[14px] font-medium text-muted">Saved in this browser. Followed islands are synced every hour, even outside the genre top lists.</p>
      {rows == null ? (
        <p className="py-10 text-center text-muted">Loading…</p>
      ) : !codes.length ? (
        <div className="rounded-[22px] border border-dashed border-line px-6 py-14 text-center text-muted">
          <Icon name="star" size={28} className="mx-auto mb-2" />
          Tap the star next to any island to follow it here.
        </div>
      ) : (
        <div className="rounded-[22px] bg-panel p-3">
          {rows.map((r) => (
            <div key={r.code} className="flex items-center">
              <div className="min-w-0 flex-1">
                <IslandItem
                  code={r.code}
                  title={r.title}
                  sub={`${r.creator ?? "Epic"}${r.genreName ? ` · ${r.genreName}` : ""}`}
                  right={
                    <span className="grid grid-cols-[5rem_4.5rem_4.5rem] items-center gap-2 text-[14px]">
                      <span className="text-right text-[15px] font-bold tnum">{fmtInt(r.ccu)}</span>
                      <span className="text-right">
                        <Delta value={r.d24h} />
                      </span>
                      <span className="text-right">
                        <Delta value={r.d7d} />
                      </span>
                    </span>
                  }
                />
              </div>
              <StarButton code={r.code} />
            </div>
          ))}
          {missing.map((c) => (
            <div key={c} className="flex items-center">
              <div className="min-w-0 flex-1">
                <IslandItem code={c} title={c} sub="Syncing — data appears after the next hourly update" />
              </div>
              <StarButton code={c} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
