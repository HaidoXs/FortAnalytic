// Collector: pulls Epic's Fortnite Data API into data/fortanalytic.db.
//   tsx collector/index.ts once    run every job that is due, then exit
//   tsx collector/index.ts watch   keep running, checking every minute
//
// Jobs and cadence:
//   eco      every 10 min  Fortnite-wide concurrent players (in client / in match)
//   rankings every hour    genre leaderboards -> which islands we track
//   islands  every hour    hourly metrics of every tracked island (daily metrics once a day)
//   catalog  every day     full island catalog (~285k islands, title / creator / tags)

import { getDb, getMeta, setMeta } from "../lib/db";
import { fnApi } from "../lib/fortnite-api";
import { nowSec, oldestAllowed, storeEco, syncIsland, upsertIslands } from "../lib/ingest";

const TOP_PER_GENRE = Number(process.env.TOP_PER_GENRE ?? 100);
const VIEWED_TTL = 3 * 86400; // islands opened on the site stay tracked for 3 days
const HOUR = 3600;
const DAY = 86400;

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function jobEco() {
  const first = !getMeta("eco.done");
  const from = first ? oldestAllowed() : undefined;
  storeEco("minute", await fnApi.eco("minute", first ? nowSec() - DAY : undefined));
  storeEco("hour", await fnApi.eco("hour", from ?? nowSec() - 2 * DAY));
  storeEco("day", await fnApi.eco("day", from ?? nowSec() - 3 * DAY));
  setMeta("eco.done", nowSec());
}

async function jobRankings() {
  const db = getDb();
  const now = nowSec();
  const genres = (await fnApi.genres()).data;
  const upGenre = db.prepare(
    "INSERT INTO genres (slug, name, total, updated) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET name = excluded.name, total = excluded.total, updated = excluded.updated",
  );
  const insRank = db.prepare("INSERT OR REPLACE INTO genre_ranks (snapshot, genre, code, rank) VALUES (?, ?, ?, ?)");
  const best = new Map<string, { genre: string; rank: number }>();

  for (const g of genres) {
    const page = await fnApi.genreRankings(g.slug, TOP_PER_GENRE);
    const snapshot = page.meta.snapshot ? Math.floor(Date.parse(page.meta.snapshot) / 1000) : now - (now % HOUR);
    upGenre.run(g.slug, g.displayName, page.meta.total ?? null, now);
    db.transaction(() => {
      for (const r of page.data) {
        insRank.run(snapshot, g.slug, r.islandCode, r.rank);
        const b = best.get(r.islandCode);
        if (!b || r.rank < b.rank) best.set(r.islandCode, { genre: g.slug, rank: r.rank });
      }
    })();
  }

  const upTracked = db.prepare(`
    INSERT INTO tracked (code, reason, genre, genre_rank, added, last_ranked) VALUES (?, 'ranked', ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET reason = 'ranked', genre = excluded.genre, genre_rank = excluded.genre_rank, last_ranked = excluded.last_ranked`);
  db.transaction(() => {
    for (const [code, b] of best) upTracked.run(code, b.genre, b.rank, now, now);
    // Islands that fell out of every top list keep their history but stop being refreshed after a day.
    db.prepare(
      "DELETE FROM tracked WHERE COALESCE(last_ranked, 0) < ? AND COALESCE(last_viewed, 0) < ?",
    ).run(now - DAY, now - VIEWED_TTL);
    // Old leaderboard snapshots: keep 35 days.
    db.prepare("DELETE FROM genre_ranks WHERE snapshot < ?").run(now - 35 * DAY);
  })();

  // Fetch metadata for ranked islands the catalog crawl has not seen yet.
  const missing = db
    .prepare("SELECT t.code FROM tracked t LEFT JOIN islands i ON i.code = t.code WHERE i.code IS NULL")
    .all() as { code: string }[];
  for (const { code } of missing) {
    try {
      upsertIslands([await fnApi.island(code)], null);
    } catch (e) {
      log("  metadata failed", code, (e as Error).message);
    }
  }
  log(`rankings: ${genres.length} genres, ${best.size} ranked islands, ${missing.length} new`);
}

async function jobIslands() {
  const db = getDb();
  const codes = (db.prepare("SELECT t.code FROM tracked t JOIN islands i ON i.code = t.code ORDER BY COALESCE(t.genre_rank, 9999)").all() as { code: string }[]).map((r) => r.code);
  const daily = nowSec() - Number(getMeta("islands.daily") ?? 0) > DAY - HOUR;
  let ok = 0;
  let failed = 0;
  // A handful of workers; the shared pacer in fortnite-api keeps the overall rate safe.
  let i = 0;
  const worker = async () => {
    while (i < codes.length) {
      const code = codes[i++];
      try {
        await syncIsland(code, { daily });
        ok++;
      } catch (e) {
        failed++;
        if (failed < 10) log("  sync failed", code, (e as Error).message);
      }
      if ((ok + failed) % 200 === 0) log(`  islands ${ok + failed}/${codes.length}`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  if (daily) setMeta("islands.daily", nowSec());
  // Raw hourly rows older than 120 days are not shown anywhere.
  db.prepare("DELETE FROM island_hourly WHERE ts < ?").run(nowSec() - 120 * DAY);
  log(`islands: ${ok} synced, ${failed} failed${daily ? " (with daily metrics)" : ""}`);
}

async function jobCatalog() {
  let after: string | null = null;
  let pos = 0;
  for (;;) {
    const page = await fnApi.islands(after, 1000);
    upsertIslands(page.data, pos);
    pos += page.data.length;
    after = page.meta.page.nextCursor;
    if (pos % 20000 === 0) log(`  catalog ${pos}`);
    if (!after || page.data.length === 0) break;
  }
  setMeta("catalog.size", pos);
  log(`catalog: ${pos} islands`);
}

const JOBS = [
  { name: "eco", every: 10 * 60, run: jobEco },
  { name: "catalog", every: DAY, run: jobCatalog },
  { name: "rankings", every: HOUR, run: jobRankings },
  { name: "islands", every: HOUR, run: jobIslands },
] as const;

async function runDue() {
  for (const job of JOBS) {
    const last = Number(getMeta(`job.${job.name}`) ?? 0);
    // Hourly jobs wait until a few minutes past the hour, when Epic has published the new bucket.
    const due = nowSec() - last >= job.every - 60;
    if (!due) continue;
    const t0 = Date.now();
    log(`> ${job.name}`);
    try {
      await job.run();
      setMeta(`job.${job.name}`, nowSec());
      log(`< ${job.name} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } catch (e) {
      log(`! ${job.name} failed:`, (e as Error).message);
    }
  }
}

const mode = process.argv[2] ?? "once";
getDb();
if (mode === "watch") {
  log("collector watching (Ctrl+C to stop)");
  for (;;) {
    await runDue();
    await new Promise((r) => setTimeout(r, 60_000));
  }
} else {
  await runDue();
}
