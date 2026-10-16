// Client for Epic's public Fortnite Data API (https://api.fortnite.com/ecosystem/v1/docs).
// No auth needed, but it rate-limits hard: bursts past ~30 requests return 429,
// so every call goes through one shared pacer (~4 req/s) with retries.

const BASE = "https://api.fortnite.com/ecosystem/v1";
const MIN_GAP_MS = Number(process.env.FN_API_GAP_MS ?? 240);

let nextSlot = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pace() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
  if (wait) await sleep(wait);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiGet<T>(pathAndQuery: string): Promise<T> {
  let backoff = 2000;
  for (let attempt = 0; ; attempt++) {
    await pace();
    let res: Response;
    try {
      res = await fetch(BASE + pathAndQuery, { headers: { accept: "application/json" }, cache: "no-store" });
    } catch (err) {
      if (attempt >= 4) throw err;
      await sleep(backoff);
      backoff *= 2;
      continue;
    }
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      // Push every queued caller back too, so the whole pacer cools down.
      nextSlot = Date.now() + backoff;
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 30000);
      continue;
    }
    throw new ApiError(res.status, `${res.status} on ${pathAndQuery}: ${(await res.text()).slice(0, 200)}`);
  }
}

export type Interval = "minute" | "hour" | "day";

export interface ApiIsland {
  code: string;
  creatorCode: string | null;
  title: string;
  createdIn: string | null;
  tags: string[];
}

export interface Page<T> {
  meta: { count: number; total?: number; snapshot?: string; page: { nextCursor: string | null; prevCursor: string | null } };
  data: T[];
}

export interface Point {
  value: number | null;
  timestamp: string;
}

export interface IslandMetrics {
  averageMinutesPerPlayer?: Point[];
  peakCCU?: Point[];
  favorites?: Point[];
  minutesPlayed?: Point[];
  recommendations?: Point[];
  plays?: Point[];
  uniquePlayers?: Point[];
  retention?: { d1: number | null; d7: number | null; timestamp: string }[];
}

export interface EcoMetrics {
  inMatchPeakCCU?: Point[];
  inClientPeakCCU?: Point[];
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
};

export const iso = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString();

export const fnApi = {
  islands: (after?: string | null, size = 1000) => apiGet<Page<ApiIsland>>(`/islands${qs({ size, after })}`),
  island: (code: string) => apiGet<ApiIsland>(`/islands/${encodeURIComponent(code)}`),
  islandMetrics: (code: string, interval: Interval, from?: number, to?: number) =>
    apiGet<IslandMetrics>(
      `/islands/${encodeURIComponent(code)}/metrics/${interval}${qs({ from: from ? iso(from) : undefined, to: to ? iso(to) : undefined })}`,
    ),
  islandRankings: (code: string) =>
    apiGet<{ data: { timestamp: string; genres: { genreSlug: string; genre: string; rank: number }[] }[] }>(
      `/islands/${encodeURIComponent(code)}/rankings`,
    ),
  genres: () => apiGet<{ data: { slug: string; displayName: string }[] }>(`/genres`),
  genreRankings: (slug: string, size = 100, after?: string | null) =>
    apiGet<Page<{ islandCode: string; rank: number }>>(`/genres/${slug}/rankings${qs({ size, after })}`),
  eco: (interval: Interval, from?: number, to?: number) =>
    apiGet<EcoMetrics>(`/metrics/${interval}${qs({ from: from ? iso(from) : undefined, to: to ? iso(to) : undefined })}`),
};
