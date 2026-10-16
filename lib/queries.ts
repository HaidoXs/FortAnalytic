import { getDb, getMeta } from "./db";
import { change } from "./format";

const HOUR = 3600;
const DAY = 86400;

// ---------------------------------------------------------------------------
// Small per-process memo: pages re-run these on every request, the data only
// moves once an hour.
const memo = new Map<string, { at: number; v: unknown }>();
function cached<T>(key: string, ttlMs: number, fn: () => T): T {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const v = fn();
  memo.set(key, { at: Date.now(), v });
  return v;
}

// ---------------------------------------------------------------------------
// Reference points in time

/** Latest hourly bucket that most tracked islands have reported (the newest one is often still partial). */
export function refHour(): number | null {
  return cached("refHour", 30_000, () => {
    const rows = getDb()
      .prepare(
        `SELECT ts, COUNT(ccu) n FROM island_hourly
         WHERE ts > (SELECT MAX(ts) FROM island_hourly) - 8 * 3600 GROUP BY ts ORDER BY ts DESC`,
      )
      .all() as { ts: number; n: number }[];
    if (!rows.length) return null;
    const max = Math.max(...rows.map((r) => r.n));
    return rows.find((r) => r.n >= max * 0.7)?.ts ?? rows[0].ts;
  });
}

/** Latest complete day in island_daily. */
export function refDay(): number | null {
  const now = Math.floor(Date.now() / 1000);
  const today = now - (now % DAY);
  const r = getDb().prepare("SELECT MAX(ts) ts FROM island_daily WHERE ts < ?").get(today) as { ts: number | null };
  return r.ts;
}

export function lastUpdate(): number | null {
  const v = getMeta("job.islands");
  return v ? Number(v) : null;
}

// ---------------------------------------------------------------------------
// Islands

export interface IslandRow {
  code: string;
  title: string;
  creator: string | null;
  createdIn: string | null;
  tags: string[];
  listPos: number | null;
  genre: string | null;
  genreName: string | null;
  genreRank: number | null;
  ccu: number;
  ccu1h: number | null;
  ccu24h: number | null;
  ccu7d: number | null;
  d1h: number | null;
  d24h: number | null;
  d7d: number | null;
  // latest complete day
  plays: number | null;
  uniques: number | null;
  minutes: number | null;
  favorites: number | null;
  recs: number | null;
  avgMin: number | null;
  d1: number | null;
  d7: number | null;
}

/** Every tracked island with its players now / 1h / 24h / 7d ago and its latest daily metrics. */
export function trackedIslands(): IslandRow[] {
  const H = refHour();
  const D = refDay();
  if (H == null) return [];
  return cached(`tracked:${H}:${D}`, 60_000, () => {
    const rows = getDb()
      .prepare(
        `SELECT t.code, i.title, i.creator, i.created_in createdIn, i.tags, i.list_pos listPos,
                t.genre, g.name genreName, t.genre_rank genreRank,
                h0.ccu ccu, h1.ccu ccu1h, h24.ccu ccu24h, h168.ccu ccu7d,
                d.plays, d.uniques, d.minutes, d.favorites, d.recs, d.avg_min avgMin,
                (SELECT d1 FROM island_daily x WHERE x.code = t.code AND x.d1 IS NOT NULL AND x.ts <= @D ORDER BY ts DESC LIMIT 1) d1,
                (SELECT d7 FROM island_daily x WHERE x.code = t.code AND x.d7 IS NOT NULL AND x.ts <= @D ORDER BY ts DESC LIMIT 1) d7
         FROM tracked t
         JOIN islands i ON i.code = t.code
         LEFT JOIN genres g ON g.slug = t.genre
         LEFT JOIN island_hourly h0 ON h0.code = t.code AND h0.ts = @H
         LEFT JOIN island_hourly h1 ON h1.code = t.code AND h1.ts = @H - 3600
         LEFT JOIN island_hourly h24 ON h24.code = t.code AND h24.ts = @H - 86400
         LEFT JOIN island_hourly h168 ON h168.code = t.code AND h168.ts = @H - 604800
         LEFT JOIN island_daily d ON d.code = t.code AND d.ts = @D`,
      )
      .all({ H, D: D ?? -1 }) as (Omit<IslandRow, "tags" | "d1h" | "d24h" | "d7d"> & { tags: string })[];
    return rows.map((r) => {
      const ccu = r.ccu ?? 0;
      return {
        ...r,
        ccu,
        tags: JSON.parse(r.tags) as string[],
        d1h: change(ccu, r.ccu1h),
        d24h: change(ccu, r.ccu24h),
        d7d: change(ccu, r.ccu7d),
      };
    });
  });
}

export function islandsByCodes(codes: string[]): IslandRow[] {
  const set = new Set(codes);
  return trackedIslands().filter((r) => set.has(r.code));
}

/** Hourly player counts for the sparklines, keyed by island code (last `hours` hours, oldest first). */
export function sparklines(codes: string[], hours = 24): Record<string, number[]> {
  const H = refHour();
  if (H == null || !codes.length) return {};
  const out: Record<string, number[]> = {};
  const rows = getDb()
    .prepare(
      `SELECT code, ts, ccu FROM island_hourly WHERE code IN (${codes.map(() => "?").join(",")}) AND ts > ? AND ts <= ? ORDER BY ts`,
    )
    .all(...codes, H - hours * HOUR, H) as { code: string; ts: number; ccu: number | null }[];
  for (const c of codes) out[c] = new Array(hours).fill(0);
  for (const r of rows) {
    const idx = hours - 1 - (H - r.ts) / HOUR;
    if (idx >= 0 && idx < hours) out[r.code][idx] = r.ccu ?? 0;
  }
  return out;
}

export type IslandSort = "most" | "rising" | "falling" | "new" | "gems";

export function islandList(sort: IslandSort, opts: { genre?: string; tag?: string; q?: string; limit?: number } = {}): IslandRow[] {
  let rows = trackedIslands();
  if (opts.genre) rows = rows.filter((r) => r.genre === opts.genre);
  if (opts.tag) rows = rows.filter((r) => r.tags.includes(opts.tag!));
  if (opts.q) {
    const q = opts.q.toLowerCase();
    rows = rows.filter((r) => r.title.toLowerCase().includes(q) || r.code.includes(q) || r.creator?.toLowerCase().includes(q));
  }
  switch (sort) {
    case "rising":
      rows = rows.filter((r) => r.ccu >= 100 && (r.ccu24h ?? 0) >= 20 && r.d24h != null).sort((a, b) => b.d24h! - a.d24h!);
      break;
    case "falling":
      rows = rows.filter((r) => (r.ccu24h ?? 0) >= 200 && r.d24h != null).sort((a, b) => a.d24h! - b.d24h!);
      break;
    case "new":
      rows = rows.filter((r) => r.ccu > 0 && r.listPos != null).sort((a, b) => a.listPos! - b.listPos!);
      break;
    case "gems":
      // Small islands players stick with: long sessions and good day-1 retention.
      rows = rows
        .filter((r) => r.ccu >= 20 && r.ccu <= 1500 && r.avgMin != null && r.d1 != null && (r.uniques ?? 0) >= 300)
        .sort((a, b) => b.avgMin! * b.d1! - a.avgMin! * a.d1!);
      break;
    default:
      rows = [...rows].sort((a, b) => b.ccu - a.ccu);
  }
  return rows.slice(0, opts.limit ?? 100);
}

export function totalTrackedPlayers(): number {
  return trackedIslands().reduce((s, r) => s + r.ccu, 0);
}

// ---------------------------------------------------------------------------
// Charts (top-5 boards)

export interface Board {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  href: string;
  items: { row: IslandRow; value: string; badge?: { text: string; tone: "up" | "down" | "new" } }[];
}

export function boards(fmt: { compact: (n: number) => string; pct: (n: number) => string; min: (n: number) => string }): Board[] {
  const all = trackedIslands();
  const top = (rows: IslandRow[], n = 5) => rows.slice(0, n);
  const byCcu = [...all].sort((a, b) => b.ccu - a.ccu);
  // Rank movement vs 24h ago for the main board.
  const prevRank = new Map([...all].sort((a, b) => (b.ccu24h ?? 0) - (a.ccu24h ?? 0)).map((r, i) => [r.code, i]));
  const catalogSize = Number(getMeta("catalog.size") ?? 0) || 280000;
  const fresh = all.filter((r) => r.listPos != null && r.listPos < Math.max(5000, catalogSize * 0.03));
  const big = all.filter((r) => (r.uniques ?? 0) >= 2000);

  return [
    {
      id: "played",
      title: "Most Played",
      subtitle: "Most players right now",
      icon: "users",
      href: "/islands",
      items: top(byCcu).map((row, i) => {
        const p = prevRank.get(row.code);
        const moved = p == null ? 0 : p - i;
        return { row, value: fmt.compact(row.ccu), badge: moved ? { text: String(Math.abs(moved)), tone: moved > 0 ? "up" : "down" } : undefined };
      }),
    },
    {
      id: "trending",
      title: "Top Trending",
      subtitle: "Most players gained in 24h",
      icon: "trend",
      href: "/islands?tab=rising",
      items: top([...all].filter((r) => r.ccu24h != null).sort((a, b) => b.ccu - b.ccu24h! - (a.ccu - a.ccu24h!))).map((row) => ({
        row,
        value: fmt.compact(row.ccu),
        badge: row.d24h != null ? { text: fmt.pct(row.d24h), tone: "up" } : undefined,
      })),
    },
    {
      id: "upcoming",
      title: "Up-and-Coming",
      subtitle: "Newest releases with the most players",
      icon: "sprout",
      href: "/islands?tab=new",
      items: top([...fresh].sort((a, b) => b.ccu - a.ccu)).map((row) => ({ row, value: fmt.compact(row.ccu) })),
    },
    {
      id: "engaging",
      title: "Most Engaging",
      subtitle: "Minutes played yesterday",
      icon: "clock",
      href: "/islands",
      items: top([...all].filter((r) => r.minutes != null).sort((a, b) => b.minutes! - a.minutes!)).map((row) => ({
        row,
        value: fmt.compact(row.minutes!),
      })),
    },
    {
      id: "retention",
      title: "Top Retention",
      subtitle: "Players back the next day",
      icon: "repeat",
      href: "/islands?tab=gems",
      items: top([...big].filter((r) => r.d1 != null).sort((a, b) => b.d1! - a.d1!)).map((row) => ({ row, value: `${Math.round(row.d1! * 100)}%` })),
    },
    {
      id: "favorites",
      title: "Most Favorited",
      subtitle: "New favorites yesterday",
      icon: "heart",
      href: "/islands",
      items: top([...all].filter((r) => r.favorites).sort((a, b) => b.favorites! - a.favorites!)).map((row) => ({
        row,
        value: fmt.compact(row.favorites!),
      })),
    },
    {
      id: "recommended",
      title: "Most Recommended",
      subtitle: "Recommendations yesterday",
      icon: "thumb",
      href: "/islands",
      items: top([...all].filter((r) => r.recs).sort((a, b) => b.recs! - a.recs!)).map((row) => ({ row, value: fmt.compact(row.recs!) })),
    },
    {
      id: "sessions",
      title: "Longest Sessions",
      subtitle: "Average minutes per player",
      icon: "hourglass",
      href: "/islands?tab=gems",
      items: top([...big].filter((r) => r.avgMin != null).sort((a, b) => b.avgMin! - a.avgMin!)).map((row) => ({ row, value: fmt.min(row.avgMin!) })),
    },
    {
      id: "creative",
      title: "Top Creative 1.0",
      subtitle: "Built in Fortnite Creative, not UEFN",
      icon: "cube",
      href: "/islands",
      items: top(byCcu.filter((r) => r.createdIn === "FNC")).map((row) => ({ row, value: fmt.compact(row.ccu) })),
    },
  ];
}

// ---------------------------------------------------------------------------
// Genres & tags

export interface GenreRow {
  slug: string;
  name: string;
  total: number | null;
  players: number;
  players24h: number;
  share: number;
  d24h: number | null;
  spark: number[];
  top: IslandRow[];
}

export function genreStats(): GenreRow[] {
  const H = refHour();
  if (H == null) return [];
  return cached(`genres:${H}`, 60_000, () => {
    const db = getDb();
    const genres = db.prepare("SELECT slug, name, total FROM genres").all() as { slug: string; name: string; total: number | null }[];
    const all = trackedIslands();
    const series = db
      .prepare(
        `SELECT t.genre, h.ts, SUM(h.ccu) v FROM island_hourly h JOIN tracked t ON t.code = h.code
         WHERE h.ts > ? AND h.ts <= ? GROUP BY t.genre, h.ts`,
      )
      .all(H - 24 * HOUR, H) as { genre: string; ts: number; v: number }[];
    const total = all.reduce((s, r) => s + r.ccu, 0) || 1;
    return genres
      .map((g) => {
        const isl = all.filter((r) => r.genre === g.slug).sort((a, b) => b.ccu - a.ccu);
        const players = isl.reduce((s, r) => s + r.ccu, 0);
        const players24h = isl.reduce((s, r) => s + (r.ccu24h ?? 0), 0);
        const spark = new Array(24).fill(0);
        for (const p of series) if (p.genre === g.slug) spark[23 - (H - p.ts) / HOUR] = p.v ?? 0;
        return { ...g, players, players24h, share: players / total, d24h: change(players, players24h), spark, top: isl.slice(0, 8) };
      })
      .sort((a, b) => b.players - a.players);
  });
}

export interface TagRow {
  tag: string;
  players: number;
  d24h: number | null;
  islands: number;
  genreName: string | null;
  icon: IslandRow;
}

/** Epic's island tags act as sub-genres: players per tag now vs 24h ago. */
export function tagStats(): TagRow[] {
  const H = refHour();
  if (H == null) return [];
  return cached(`tags:${H}`, 60_000, () => {
    const acc = new Map<string, { now: number; before: number; n: number; genres: Map<string, number>; best: IslandRow }>();
    for (const r of trackedIslands()) {
      for (const tag of r.tags) {
        const a = acc.get(tag) ?? { now: 0, before: 0, n: 0, genres: new Map(), best: r };
        a.now += r.ccu;
        a.before += r.ccu24h ?? 0;
        a.n++;
        if (r.genreName) a.genres.set(r.genreName, (a.genres.get(r.genreName) ?? 0) + r.ccu);
        if (r.ccu > a.best.ccu) a.best = r;
        acc.set(tag, a);
      }
    }
    return [...acc.entries()].map(([tag, a]) => ({
      tag,
      players: a.now,
      d24h: change(a.now, a.before),
      islands: a.n,
      genreName: [...a.genres.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null,
      icon: a.best,
    }));
  });
}

// ---------------------------------------------------------------------------
// Trends: words in the titles of the newest releases

const STOP = new Set(
  "the a an of and or to in on for with by at from my your you me is it its this that vs x de la le les du des el en y map maps fortnite fn island islands game games mode modes edition version new best ultimate official free"
    .split(" "),
);

export function tokenize(title: string): string[] {
  const words = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .match(/\+\d+|\d+v\d+|[\p{L}\p{N}]+/gu);
  if (!words) return [];
  const out = new Set<string>();
  for (const w of words) {
    if (STOP.has(w)) continue;
    if (/^\d+$/.test(w)) continue; // bare numbers / versions
    if (w.length < 3 && !/^\+?\d/.test(w)) continue;
    out.add(w);
  }
  return [...out];
}

export interface TrendRow {
  word: string;
  recent: number;
  before: number;
  growth: number | null;
  players: number;
  buckets: number[];
  examples: { code: string; title: string; creator: string | null }[];
  more: number;
}

export const TREND_WINDOW = 10000;
const TREND_BUCKETS = 12;

export function trends(): TrendRow[] {
  const catalogAt = getMeta("job.catalog") ?? "0";
  const H = refHour() ?? 0;
  return cached(`trends:${catalogAt}:${H}`, 5 * 60_000, () => {
    const db = getDb();
    const W = TREND_WINDOW;
    const rows = db
      .prepare("SELECT code, title, creator, list_pos FROM islands WHERE list_pos IS NOT NULL AND list_pos < ? ORDER BY list_pos")
      .all(2 * W) as { code: string; title: string; creator: string | null; list_pos: number }[];
    const ccu = new Map(trackedIslands().map((r) => [r.code, r.ccu]));
    const players = new Map<string, number>();
    for (const r of trackedIslands()) for (const w of tokenize(r.title)) players.set(w, (players.get(w) ?? 0) + r.ccu);

    type Acc = { recent: number; before: number; buckets: number[]; ex: (typeof rows)[number][] };
    const acc = new Map<string, Acc>();
    const bucketSize = (2 * W) / TREND_BUCKETS;
    for (const r of rows) {
      for (const w of tokenize(r.title)) {
        const a: Acc = acc.get(w) ?? { recent: 0, before: 0, buckets: new Array(TREND_BUCKETS).fill(0), ex: [] };
        if (r.list_pos < W) a.recent++;
        else a.before++;
        // oldest bucket first
        a.buckets[TREND_BUCKETS - 1 - Math.floor(r.list_pos / bucketSize)]++;
        a.ex.push(r);
        acc.set(w, a);
      }
    }
    return [...acc.entries()]
      .filter(([, a]) => a.recent + a.before >= 5)
      .map(([word, a]) => {
        const ex = [...a.ex].sort((x, y) => (ccu.get(y.code) ?? -1) - (ccu.get(x.code) ?? -1) || x.list_pos - y.list_pos);
        return {
          word,
          recent: a.recent,
          before: a.before,
          growth: a.before ? a.recent / a.before - 1 : null,
          players: players.get(word) ?? 0,
          buckets: a.buckets,
          examples: ex.slice(0, 3).map((e) => ({ code: e.code, title: e.title, creator: e.creator })),
          more: a.recent + a.before - 1,
        };
      });
  });
}

// ---------------------------------------------------------------------------
// Creators

export interface CreatorRow {
  creator: string;
  islands: number;
  players: number;
  players24h: number;
  players7d: number;
  d24h: number | null;
  d7d: number | null;
  top: IslandRow | null;
  live: number; // islands with players right now
}

export function creatorStats(): CreatorRow[] {
  const H = refHour() ?? 0;
  const catalogAt = getMeta("job.catalog") ?? "0";
  return cached(`creators:${H}:${catalogAt}`, 60_000, () => {
    const counts = new Map(
      (getDb().prepare("SELECT creator, COUNT(*) n FROM islands WHERE creator IS NOT NULL GROUP BY creator").all() as { creator: string; n: number }[]).map(
        (r) => [r.creator, r.n],
      ),
    );
    const acc = new Map<string, CreatorRow>();
    for (const r of trackedIslands()) {
      if (!r.creator) continue;
      const c =
        acc.get(r.creator) ??
        ({ creator: r.creator, islands: counts.get(r.creator) ?? 1, players: 0, players24h: 0, players7d: 0, d24h: null, d7d: null, top: null, live: 0 } as CreatorRow);
      c.players += r.ccu;
      c.players24h += r.ccu24h ?? 0;
      c.players7d += r.ccu7d ?? 0;
      if (r.ccu > 0) c.live++;
      if (!c.top || r.ccu > c.top.ccu) c.top = r;
      acc.set(r.creator, c);
    }
    return [...acc.values()].map((c) => ({ ...c, d24h: change(c.players, c.players24h), d7d: change(c.players, c.players7d) }));
  });
}

export function creatorIslands(creator: string) {
  const tracked = new Map(trackedIslands().map((r) => [r.code, r]));
  const rows = getDb()
    .prepare("SELECT code, title, created_in createdIn, tags, list_pos listPos FROM islands WHERE creator = ? ORDER BY list_pos")
    .all(creator) as { code: string; title: string; createdIn: string | null; tags: string; listPos: number | null }[];
  return rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) as string[], stats: tracked.get(r.code) ?? null }));
}

// ---------------------------------------------------------------------------
// Fortnite-wide players

export type Range = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export function ecoSeries(range: Range, metric: "in_client" | "in_match" = "in_client") {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const [interval, since] =
    range === "1D"
      ? ["minute", now - DAY]
      : range === "1W"
        ? ["hour", now - 7 * DAY]
        : range === "1M"
          ? ["day", now - 30 * DAY]
          : range === "3M"
            ? ["day", now - 91 * DAY]
            : range === "1Y"
              ? ["day", now - 365 * DAY]
              : ["day", 0];
  return db
    .prepare(`SELECT ts t, ${metric} v FROM eco WHERE interval = ? AND ts >= ? AND ${metric} IS NOT NULL ORDER BY ts`)
    .all(interval, since) as { t: number; v: number }[];
}

export function ecoNow() {
  const db = getDb();
  const last = db
    .prepare("SELECT ts, in_client, in_match FROM eco WHERE interval = 'minute' AND in_client IS NOT NULL ORDER BY ts DESC LIMIT 1")
    .get() as { ts: number; in_client: number; in_match: number | null } | undefined;
  if (!last) return null;
  const dayAgo = db
    .prepare(
      "SELECT in_client FROM eco WHERE interval IN ('minute','hour') AND in_client IS NOT NULL AND ts <= ? ORDER BY ts DESC LIMIT 1",
    )
    .get(last.ts - DAY) as { in_client: number } | undefined;
  const days = db
    .prepare("SELECT ts, in_client v FROM eco WHERE interval = 'day' AND in_client IS NOT NULL ORDER BY ts DESC LIMIT 8")
    .all() as { ts: number; v: number }[];
  return { ts: last.ts, inClient: last.in_client, inMatch: last.in_match, dayAgo: dayAgo?.in_client ?? null, days: days.reverse() };
}

// ---------------------------------------------------------------------------
// Milestones derived from the data

export interface Milestone {
  ts: number;
  text: string;
  code: string;
  kind: "threshold" | "first";
}

const THRESHOLDS = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000];

export function milestones(limit = 6): Milestone[] {
  const H = refHour();
  if (H == null) return [];
  return cached(`milestones:${H}`, 60_000, () => {
    const db = getDb();
    const out: Milestone[] = [];
    const meta = new Map(trackedIslands().map((r) => [r.code, r]));
    // 1) Islands that reached a player threshold in the last 24h for the first time this week.
    const rows = db
      .prepare(
        `SELECT code,
                MAX(CASE WHEN ts > @H - 86400 THEN ccu END) recent,
                MAX(CASE WHEN ts <= @H - 86400 THEN ccu END) before,
                COUNT(CASE WHEN ts <= @H - 86400 THEN 1 END) nBefore
         FROM island_hourly WHERE ts > @H - 7 * 86400 AND ts <= @H GROUP BY code`,
      )
      .all({ H }) as { code: string; recent: number | null; before: number | null; nBefore: number }[];
    const firstHit = db.prepare("SELECT MIN(ts) ts FROM island_hourly WHERE code = ? AND ts > ? AND ccu >= ?");
    for (const r of rows) {
      if (!r.recent || r.nBefore < 48) continue;
      const crossed = THRESHOLDS.filter((t) => r.recent! >= t && (r.before ?? 0) < t).pop();
      const isl = meta.get(r.code);
      if (!crossed || !isl) continue;
      const ts = (firstHit.get(r.code, H - DAY, crossed) as { ts: number }).ts;
      out.push({ ts, code: r.code, kind: "threshold", text: `${isl.title} passed ${crossed >= 1000 ? `${crossed / 1000}K` : crossed} players` });
    }
    // 2) New #1 of a genre leaderboard vs 24h ago.
    const snaps = db.prepare("SELECT DISTINCT snapshot FROM genre_ranks ORDER BY snapshot DESC").all() as { snapshot: number }[];
    if (snaps.length > 1) {
      const latest = snaps[0].snapshot;
      const old = snaps.find((s) => s.snapshot <= latest - DAY)?.snapshot ?? snaps.at(-1)!.snapshot;
      const leaders = db
        .prepare(
          `SELECT a.genre, a.code, g.name FROM genre_ranks a JOIN genres g ON g.slug = a.genre
           WHERE a.snapshot = ? AND a.rank = 1 AND a.code NOT IN (SELECT code FROM genre_ranks b WHERE b.snapshot = ? AND b.genre = a.genre AND b.rank = 1)`,
        )
        .all(latest, old) as { genre: string; code: string; name: string }[];
      for (const l of leaders) {
        const isl = meta.get(l.code);
        if (isl) out.push({ ts: latest, code: l.code, kind: "first", text: `${isl.title} is now #1 in ${l.name}` });
      }
    }
    return out.sort((a, b) => b.ts - a.ts).slice(0, limit);
  });
}

// ---------------------------------------------------------------------------
// One island

export function islandDetail(code: string) {
  const db = getDb();
  const island = db.prepare("SELECT * FROM islands WHERE code = ?").get(code) as
    | { code: string; title: string; creator: string | null; created_in: string | null; tags: string; list_pos: number | null; first_seen: number }
    | undefined;
  if (!island) return null;
  const hourly = db
    .prepare("SELECT ts, ccu, plays, uniques, minutes, favorites, recs, avg_min FROM island_hourly WHERE code = ? ORDER BY ts")
    .all(code) as { ts: number; ccu: number | null; plays: number | null; uniques: number | null; minutes: number | null; favorites: number | null; recs: number | null; avg_min: number | null }[];
  const daily = db
    .prepare("SELECT ts, ccu, plays, uniques, minutes, favorites, recs, avg_min, d1, d7 FROM island_daily WHERE code = ? ORDER BY ts DESC")
    .all(code) as { ts: number; ccu: number | null; plays: number | null; uniques: number | null; minutes: number | null; favorites: number | null; recs: number | null; avg_min: number | null; d1: number | null; d7: number | null }[];
  const latestSnap = (db.prepare("SELECT MAX(snapshot) s FROM genre_ranks").get() as { s: number | null }).s;
  const ranks = db
    .prepare("SELECT r.genre, g.name, r.rank, g.total FROM genre_ranks r JOIN genres g ON g.slug = r.genre WHERE r.code = ? AND r.snapshot = ?")
    .all(code, latestSnap ?? -1) as { genre: string; name: string; rank: number; total: number | null }[];
  const tracked = db.prepare("SELECT genre, genre_rank FROM tracked WHERE code = ?").get(code) as { genre: string | null; genre_rank: number | null } | undefined;
  const genreName = tracked?.genre
    ? ((db.prepare("SELECT name FROM genres WHERE slug = ?").get(tracked.genre) as { name: string } | undefined)?.name ?? null)
    : null;
  return { island: { ...island, tags: JSON.parse(island.tags) as string[] }, hourly, daily, ranks, genre: tracked?.genre ?? null, genreName, genreRank: tracked?.genre_rank ?? null, row: islandsByCodes([code])[0] ?? null };
}

// ---------------------------------------------------------------------------
// Search

export function search(q: string, limit = 8) {
  const db = getDb();
  const term = q.trim();
  if (!term) return { islands: [], creators: [] };
  const ccu = new Map(trackedIslands().map((r) => [r.code, r.ccu]));
  const isCode = /^\d{4}-?\d{4}-?\d{4}$/.test(term);
  const code = isCode ? term.replace(/^(\d{4})-?(\d{4})-?(\d{4})$/, "$1-$2-$3") : null;
  const rows = db
    .prepare(
      `SELECT code, title, creator, tags FROM islands
       WHERE ${code ? "code = @code" : "title LIKE @like ESCAPE '\\' OR creator LIKE @like ESCAPE '\\'"}
       LIMIT 400`,
    )
    .all({ code, like: `%${term.replace(/[%_\\]/g, "\\$&")}%` }) as { code: string; title: string; creator: string | null; tags: string }[];
  const islands = rows
    .map((r) => ({ ...r, tags: JSON.parse(r.tags) as string[], ccu: ccu.get(r.code) ?? null }))
    .sort((a, b) => (b.ccu ?? -1) - (a.ccu ?? -1))
    .slice(0, limit);
  const creators = creatorStats()
    .filter((c) => c.creator.toLowerCase().includes(term.toLowerCase()))
    .sort((a, b) => b.players - a.players)
    .slice(0, 4)
    .map((c) => ({ creator: c.creator, players: c.players, islands: c.islands }));
  return { islands, creators, code };
}
