// Island cover art. Epic's Data API has no images, so the image URL (hosted on Epic's
// own CDN) comes from fortnite.gg's island pages.
//
// OFF by default: only turn it on once fortnite.gg has agreed (see docs/fortnite-gg-request.md).
//   NEXT_PUBLIC_ISLAND_IMAGES=fortnitegg   enables lookups (collector + site) and <img> thumbnails
//   FORTANALYTIC_CONTACT=https://...        URL or e-mail put in the User-Agent so they can reach us
//   FORTNITE_GG_API_URL=https://...{code}   optional: an endpoint they give us instead of the pages;
//                                           must answer JSON with an `image` field (adapt parseApi if not)

import { getDb } from "./db";

export const imagesEnabled = process.env.NEXT_PUBLIC_ISLAND_IMAGES === "fortnitegg";

const UA = `FortAnalytic/0.1 (+${process.env.FORTANALYTIC_CONTACT ?? "no contact set"})`;
const GAP_MS = 1100; // at most ~1 request per second, as promised
let nextSlot = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ImageSourceBlocked extends Error {}

async function pace() {
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Math.max(Date.now(), nextSlot) + GAP_MS;
  if (wait) await sleep(wait);
}

const CDN = /^https:\/\/cdn-\d+\.qstv\.on\.epicgames\.com\//;

function parsePage(html: string): string | null {
  const og = html.match(/property=['"]og:image['"]\s+content=['"](https:\/\/cdn-\d+\.qstv\.on\.epicgames\.com\/[^'"]+)['"]/)?.[1];
  if (!og) return null;
  // landscape_comp.jpeg (~160 KB) -> landscape_comp_s.jpeg (~17 KB) when the page lists it.
  const small = og.replace(/\.jpe?g$/, "_s$&");
  return html.includes(small) ? small : og;
}

function parseApi(json: unknown): string | null {
  const img = (json as { image?: unknown })?.image;
  return typeof img === "string" && CDN.test(img) ? img : null;
}

/** Image URL of an island, or null when it has none. Throws ImageSourceBlocked on 403/429. */
export async function lookupImage(code: string): Promise<string | null> {
  if (!imagesEnabled) return null;
  await pace();
  const api = process.env.FORTNITE_GG_API_URL;
  const url = api ? api.replace("{code}", code) : `https://fortnite.gg/island/${code}`;
  const res = await fetch(url, { headers: { "user-agent": UA, accept: api ? "application/json" : "text/html" }, cache: "no-store" });
  if (res.status === 404) return null;
  if (res.status === 403 || res.status === 429) {
    // Never try to get around a block: stop and wait for the next run.
    throw new ImageSourceBlocked(`fortnite.gg answered ${res.status}${res.headers.get("cf-mitigated") ? " (Cloudflare challenge)" : ""}`);
  }
  if (!res.ok) throw new Error(`fortnite.gg ${res.status} for ${code}`);
  return api ? parseApi(await res.json()) : parsePage(await res.text());
}

export function storeImage(code: string, image: string | null) {
  getDb()
    .prepare("UPDATE islands SET image = COALESCE(?, image), image_checked = ? WHERE code = ?")
    .run(image, Math.floor(Date.now() / 1000), code);
}

/** Look up an island's image right away if we never did (island pages). */
export async function ensureImage(code: string) {
  if (!imagesEnabled) return;
  const row = getDb().prepare("SELECT image_checked FROM islands WHERE code = ?").get(code) as { image_checked: number | null } | undefined;
  if (!row || row.image_checked) return;
  try {
    storeImage(code, await lookupImage(code));
  } catch {
    /* try again another time */
  }
}

export function imageFor(code: string): string | null {
  const row = getDb().prepare("SELECT image FROM islands WHERE code = ?").get(code) as { image: string | null } | undefined;
  return row?.image ?? null;
}
