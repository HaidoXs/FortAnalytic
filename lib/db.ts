import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Single SQLite file shared by the collector (writer) and the Next.js app (reader).
const DB_PATH = process.env.FORTANALYTIC_DB ?? path.join(process.cwd(), "data", "fortanalytic.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS islands (
  code        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  creator     TEXT,
  created_in  TEXT,
  tags        TEXT NOT NULL DEFAULT '[]',
  list_pos    INTEGER,            -- position in Epic's catalog (0 = newest release) at the last crawl
  first_seen  INTEGER NOT NULL,   -- unix seconds
  last_seen   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS islands_creator ON islands(creator);
CREATE INDEX IF NOT EXISTS islands_pos ON islands(list_pos);

CREATE TABLE IF NOT EXISTS genres (
  slug   TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  total  INTEGER,                 -- number of ranked islands in the genre
  updated INTEGER
);

-- Hourly genre leaderboard snapshots (top N per genre).
CREATE TABLE IF NOT EXISTS genre_ranks (
  snapshot INTEGER NOT NULL,
  genre    TEXT NOT NULL,
  code     TEXT NOT NULL,
  rank     INTEGER NOT NULL,
  PRIMARY KEY (snapshot, genre, code)
);
CREATE INDEX IF NOT EXISTS genre_ranks_code ON genre_ranks(code, snapshot);

-- Islands whose metrics the collector refreshes every hour.
CREATE TABLE IF NOT EXISTS tracked (
  code        TEXT PRIMARY KEY,
  reason      TEXT NOT NULL,      -- 'ranked' | 'viewed'
  genre       TEXT,               -- primary genre (best rank in the latest snapshot)
  genre_rank  INTEGER,
  added       INTEGER NOT NULL,
  last_ranked INTEGER,
  last_viewed INTEGER,
  hour_synced INTEGER,            -- latest hourly bucket stored
  day_synced  INTEGER
);

CREATE TABLE IF NOT EXISTS island_hourly (
  code TEXT NOT NULL,
  ts   INTEGER NOT NULL,
  ccu INTEGER, plays INTEGER, uniques INTEGER, minutes INTEGER,
  favorites INTEGER, recs INTEGER, avg_min REAL,
  PRIMARY KEY (code, ts)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS island_hourly_ts ON island_hourly(ts);

CREATE TABLE IF NOT EXISTS island_daily (
  code TEXT NOT NULL,
  ts   INTEGER NOT NULL,
  ccu INTEGER, plays INTEGER, uniques INTEGER, minutes INTEGER,
  favorites INTEGER, recs INTEGER, avg_min REAL, d1 REAL, d7 REAL,
  PRIMARY KEY (code, ts)
) WITHOUT ROWID;

-- Fortnite-wide concurrent players.
CREATE TABLE IF NOT EXISTS eco (
  interval TEXT NOT NULL,         -- 'minute' (10 min buckets) | 'hour' | 'day'
  ts       INTEGER NOT NULL,
  in_client INTEGER,
  in_match  INTEGER,
  PRIMARY KEY (interval, ts)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

function migrate(d: Database.Database) {
  const cols = new Set((d.prepare("PRAGMA table_info(islands)").all() as { name: string }[]).map((c) => c.name));
  // Island cover art (Epic CDN URL) and when we last looked it up.
  if (!cols.has("image")) d.exec("ALTER TABLE islands ADD COLUMN image TEXT");
  if (!cols.has("image_checked")) d.exec("ALTER TABLE islands ADD COLUMN image_checked INTEGER");
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string | number) {
  getDb().prepare("INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
}
