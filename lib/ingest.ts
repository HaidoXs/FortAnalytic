import { getDb } from "./db";
import { fnApi, type ApiIsland, type EcoMetrics, type IslandMetrics, type Interval } from "./fortnite-api";

const toSec = (isoTs: string) => Math.floor(Date.parse(isoTs) / 1000);
export const nowSec = () => Math.floor(Date.now() / 1000);
const DAY = 86400;

/** Oldest `from` the API accepts: midnight UTC, 7 days ago. */
export function oldestAllowed() {
  const n = nowSec();
  return n - (n % DAY) - 7 * DAY;
}

export function upsertIslands(islands: ApiIsland[], startPos: number | null) {
  const db = getDb();
  const now = nowSec();
  const stmt = db.prepare(`
    INSERT INTO islands (code, title, creator, created_in, tags, list_pos, first_seen, last_seen)
    VALUES (@code, @title, @creator, @createdIn, @tags, @pos, @now, @now)
    ON CONFLICT(code) DO UPDATE SET
      title = excluded.title, creator = excluded.creator, created_in = excluded.created_in,
      tags = excluded.tags, list_pos = COALESCE(excluded.list_pos, islands.list_pos), last_seen = excluded.last_seen`);
  db.transaction(() => {
    islands.forEach((i, idx) =>
      stmt.run({
        code: i.code,
        title: i.title ?? i.code,
        creator: i.creatorCode ?? null,
        createdIn: i.createdIn ?? null,
        tags: JSON.stringify(i.tags ?? []),
        pos: startPos === null ? null : startPos + idx,
        now,
      }),
    );
  })();
}

function storeIslandMetrics(code: string, interval: "hour" | "day", m: IslandMetrics) {
  const db = getDb();
  const rows = new Map<number, Record<string, number | null>>();
  const put = (pts: { timestamp: string }[] | undefined, pick: (p: any) => Record<string, number | null>) => {
    for (const p of pts ?? []) {
      const ts = toSec(p.timestamp);
      rows.set(ts, { ...(rows.get(ts) ?? {}), ...pick(p) });
    }
  };
  put(m.peakCCU, (p) => ({ ccu: p.value }));
  put(m.plays, (p) => ({ plays: p.value }));
  put(m.uniquePlayers, (p) => ({ uniques: p.value }));
  put(m.minutesPlayed, (p) => ({ minutes: p.value }));
  put(m.favorites, (p) => ({ favorites: p.value }));
  put(m.recommendations, (p) => ({ recs: p.value }));
  put(m.averageMinutesPerPlayer, (p) => ({ avg_min: p.value }));
  if (interval === "day") put(m.retention, (p) => ({ d1: p.d1, d7: p.d7 }));

  const cols = ["ccu", "plays", "uniques", "minutes", "favorites", "recs", "avg_min", ...(interval === "day" ? ["d1", "d7"] : [])];
  const table = interval === "hour" ? "island_hourly" : "island_daily";
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO ${table} (code, ts, ${cols.join(",")}) VALUES (?, ?, ${cols.map(() => "?").join(",")})`,
  );
  db.transaction(() => {
    for (const [ts, r] of rows) stmt.run(code, ts, ...cols.map((c) => r[c] ?? null));
  })();
  return rows.size ? Math.max(...rows.keys()) : null;
}

/** Pull hourly (and optionally daily) metrics for one island, resuming from what is already stored. */
export async function syncIsland(code: string, opts: { daily?: boolean } = {}) {
  const db = getDb();
  const t = db.prepare("SELECT hour_synced, day_synced FROM tracked WHERE code = ?").get(code) as
    | { hour_synced: number | null; day_synced: number | null }
    | undefined;
  const floor = oldestAllowed();
  // Re-fetch the last few buckets: the most recent ones are still filling up when we read them.
  const hourFrom = Math.max(floor, t?.hour_synced ? t.hour_synced - 3 * 3600 : floor);
  const hourly = await fnApi.islandMetrics(code, "hour", hourFrom);
  const lastHour = storeIslandMetrics(code, "hour", hourly);
  let lastDay = t?.day_synced ?? null;
  if (opts.daily || !t?.day_synced) {
    const dayFrom = Math.max(floor, t?.day_synced ? t.day_synced - 2 * DAY : floor);
    lastDay = storeIslandMetrics(code, "day", await fnApi.islandMetrics(code, "day", dayFrom)) ?? lastDay;
  }
  db.prepare("UPDATE tracked SET hour_synced = COALESCE(?, hour_synced), day_synced = COALESCE(?, day_synced) WHERE code = ?").run(
    lastHour,
    lastDay,
    code,
  );
}

export function storeEco(interval: Interval, m: EcoMetrics) {
  const db = getDb();
  const rows = new Map<number, { c: number | null; m: number | null }>();
  for (const p of m.inClientPeakCCU ?? []) rows.set(toSec(p.timestamp), { c: p.value, m: rows.get(toSec(p.timestamp))?.m ?? null });
  for (const p of m.inMatchPeakCCU ?? []) rows.set(toSec(p.timestamp), { c: rows.get(toSec(p.timestamp))?.c ?? null, m: p.value });
  const stmt = db.prepare(`
    INSERT INTO eco (interval, ts, in_client, in_match) VALUES (?, ?, ?, ?)
    ON CONFLICT(interval, ts) DO UPDATE SET
      in_client = COALESCE(excluded.in_client, eco.in_client), in_match = COALESCE(excluded.in_match, eco.in_match)`);
  db.transaction(() => {
    for (const [ts, r] of rows) stmt.run(interval, ts, r.c, r.m);
  })();
}

/** Keep islands someone follows (watchlist) in the collector's hourly sync. */
export function markViewed(codes: string[]) {
  const db = getDb();
  const now = nowSec();
  const stmt = db.prepare(`
    INSERT INTO tracked (code, reason, added, last_viewed)
    SELECT code, 'viewed', @now, @now FROM islands WHERE code = @code
    ON CONFLICT(code) DO UPDATE SET last_viewed = @now`);
  db.transaction(() => codes.forEach((code) => stmt.run({ code, now })))();
}

/**
 * Make sure an island exists and has fresh data. Used by island pages for islands the
 * collector does not follow yet: they get tracked from now on.
 */
export async function ensureIsland(code: string): Promise<boolean> {
  const db = getDb();
  const now = nowSec();
  let known = db.prepare("SELECT 1 FROM islands WHERE code = ?").get(code);
  if (!known) {
    try {
      upsertIslands([await fnApi.island(code)], null);
    } catch {
      return false;
    }
  }
  const t = db.prepare("SELECT hour_synced, last_viewed FROM tracked WHERE code = ?").get(code) as
    | { hour_synced: number | null; last_viewed: number | null }
    | undefined;
  if (!t) {
    db.prepare("INSERT INTO tracked (code, reason, added, last_viewed) VALUES (?, 'viewed', ?, ?)").run(code, now, now);
  } else {
    db.prepare("UPDATE tracked SET last_viewed = ? WHERE code = ?").run(now, code);
  }
  // Sync on demand when the collector has nothing recent for it.
  if (!t?.hour_synced || now - t.hour_synced > 2 * 3600) {
    try {
      await syncIsland(code, { daily: true });
      const r = await fnApi.islandRankings(code).catch(() => null);
      const best = r?.data?.[0]?.genres?.sort((a, b) => a.rank - b.rank)[0];
      if (best) db.prepare("UPDATE tracked SET genre = ?, genre_rank = ? WHERE code = ?").run(best.genreSlug, best.rank, code);
    } catch {
      /* keep whatever we have */
    }
  }
  return true;
}
