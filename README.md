# FortAnalytic

Analytics for Fortnite Creative / UEFN islands, in the spirit of roterminal.co (Roblox): live player counts, top lists, genres, title trends and creators.

## Run it

```bash
npm install
npm run collect      # first fill of the database (~15 min: catalog + 1,300 islands x 7 days)
npm run dev          # http://localhost:3000
```

Keep the data flowing with the collector in watch mode (or both at once with `npm run dev:all`):

```bash
npm run collect:watch
```

## Free hosting (GitHub Actions + Render)

1. **Collector**: `.github/workflows/collect.yml` runs every hour on GitHub Actions and publishes the database (gzipped) to the `db` release of this repository. The repository must be **public** (unlimited Actions minutes, and release files downloadable without a token). Run it once by hand from the Actions tab to fill the first database (~15 min).
2. **Website**: `render.yaml` is a Render Blueprint (free web service). On start, and every 10 minutes, the site downloads the latest database from `DB_SNAPSHOT_URL` (`lib/snapshot.ts`).

Limits of this setup: data is refreshed hourly; islands opened on the site but outside the genre top lists are fetched live but not kept between snapshots; a free Render service sleeps when idle (first visit after a pause takes ~1 min).

## How it works

- **Data source**: Epic's public [Fortnite Data API](https://api.fortnite.com/ecosystem/v1/docs). No key needed, but it rate-limits bursts, so every call goes through one pacer (~4 req/s, `FN_API_GAP_MS`) with retries on 429.
- **Collector** (`collector/index.ts`) writes to `data/fortanalytic.db` (SQLite):
  | Job | Every | What |
  |---|---|---|
  | eco | 10 min | Fortnite-wide players online / in a match |
  | catalog | day | all ~283k public islands (title, creator code, tags, UEFN vs Creative 1.0) |
  | rankings | hour | top `TOP_PER_GENRE` (default 100) of Epic's 13 genre leaderboards → tracked islands |
  | islands | hour | hourly metrics of tracked islands; daily metrics + retention once a day |
- **Site** (Next.js 16, App Router, Tailwind 4) reads the same database. Pages: Home, Islands (most played / rising / falling / new / hidden gems), Charts, Genres (+ tags as sub-genres), Trends (words in the newest titles), Creators, island and creator pages, Watchlist (stored in the browser), About.
- Opening an island that is not tracked fetches it on demand; it then stays in the hourly sync for 3 days (or as long as it is on someone's watchlist).

## Limits

- Epic keeps 7 days of history; longer ranges (1M, 3M, 1Y) fill in as the collector keeps running.
- Island "players" = peak concurrent players of the last complete hour. Values under 5 players are hidden by Epic.
- Creator codes do not tell solo developers and studios apart, so there is one Creators list.
- No island images in the API: thumbnails are generated from the code and title. Real images can come from fortnite.gg once they agree: the integration is coded but off (`NEXT_PUBLIC_ISLAND_IMAGES`, see `.env.example`, `lib/images.ts` and `docs/fortnite-gg-request.md`).
