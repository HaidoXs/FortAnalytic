// Hosted mode (Render): the collector runs in GitHub Actions and publishes the database
// as a release asset. The site downloads it at start-up, then checks every 10 minutes.
//
//   DB_SNAPSHOT_URL=https://github.com/<owner>/<repo>/releases/download/db/
//
// Release download URLs are plain HTTPS redirects (no API rate limit), but they only
// work without a token when the repository is public.

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import { reopenDb } from "./db";
import { clearCache, warmCache } from "./queries";

const CHECK_EVERY_MS = 10 * 60_000;
let current = 0; // "at" of the snapshot in use
let busy = false;

function dbPath() {
  return process.env.FORTANALYTIC_DB ?? path.join(process.cwd(), "data", "fortanalytic.db");
}

async function refresh(base: string) {
  if (busy) return;
  busy = true;
  try {
    const meta = await fetch(new URL("snapshot.json", base), { cache: "no-store" });
    if (!meta.ok) throw new Error(`snapshot.json: HTTP ${meta.status}`);
    const { at } = (await meta.json()) as { at: number };
    if (!at || at <= current) return;

    const res = await fetch(new URL("fortanalytic.db.gz", base), { cache: "no-store" });
    if (!res.ok || !res.body) throw new Error(`fortanalytic.db.gz: HTTP ${res.status}`);
    const target = dbPath();
    const tmp = `${target}.download`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), zlib.createGunzip(), fs.createWriteStream(tmp));
    // Swap files, then make the app open the new one.
    reopenDb(() => {
      for (const ext of ["-wal", "-shm"]) fs.rmSync(target + ext, { force: true });
      fs.renameSync(tmp, target);
    });
    current = at;
    const t0 = Date.now();
    clearCache();
    warmCache();
    console.log(`[snapshot] database updated (${new Date(at * 1000).toISOString()}), cache warmed in ${Date.now() - t0} ms`);
  } catch (e) {
    console.warn("[snapshot]", (e as Error).message);
  } finally {
    busy = false;
  }
}

export async function startSnapshotSync() {
  const base = process.env.DB_SNAPSHOT_URL;
  if (!base) {
    // Local mode: the collector writes the database directly; just pre-compute.
    setTimeout(() => {
      try {
        warmCache();
      } catch {
        /* empty database: nothing to warm */
      }
    }, 0);
    return;
  }
  const url = base.endsWith("/") ? base : `${base}/`;
  // Wait (up to a minute) for the first copy so the first visitor does not see an empty site.
  await Promise.race([refresh(url), new Promise((r) => setTimeout(r, 60_000))]);
  setInterval(() => void refresh(url), CHECK_EVERY_MS).unref();
}
