import type { Metadata } from "next";
import { getDb, getMeta } from "@/lib/db";
import { fmtInt, timeAgo } from "@/lib/format";
import { imagesEnabled } from "@/lib/images";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "About the data" };

export default function AboutPage() {
  const db = getDb();
  const tracked = (db.prepare("SELECT COUNT(*) n FROM tracked").get() as { n: number }).n;
  const hours = (db.prepare("SELECT COUNT(*) n FROM island_hourly").get() as { n: number }).n;
  const jobs = ["eco", "catalog", "rankings", "islands"].map((j) => [j, getMeta(`job.${j}`)] as const);

  return (
    <article className="max-w-[720px] space-y-5 text-[15px] leading-relaxed text-text-2">
      <h1 className="text-[28px] font-extrabold tracking-tight text-text">About the data</h1>
      <p>
        Everything on FortAnalytic comes from Epic Games&apos; public{" "}
        <a className="font-semibold text-accent" href="https://api.fortnite.com/ecosystem/v1/docs" target="_blank" rel="noreferrer">
          Fortnite Data API
        </a>
        . A collector stores it in a local database so history can go further back than the 7 days the API keeps.
      </p>
      <h2 className="pt-2 text-[18px] font-bold text-text">What is collected</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b className="text-text">Players on Fortnite</b>: peak players online and in a match, every 10 minutes.
        </li>
        <li>
          <b className="text-text">Genre leaderboards</b>: the top 100 islands of each of Epic&apos;s 13 genres, every hour. These islands are the ones tracked.
        </li>
        <li>
          <b className="text-text">Island metrics</b>: peak players, plays, unique players, minutes played, favorites and recommendations per hour; retention (day 1 / day 7)
          per day.
        </li>
        <li>
          <b className="text-text">Catalog</b>: every public island&apos;s title, creator code, tags and whether it was made in UEFN or Creative 1.0, once a day.
        </li>
      </ul>
      <h2 className="pt-2 text-[18px] font-bold text-text">Limits to know</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>&ldquo;Players&rdquo; on an island is the peak concurrent players of the last complete hour, not a live count.</li>
        <li>Epic hides values under 5 players; those hours count as 0.</li>
        <li>Creators are Support-a-Creator codes: Fortnite does not say whether one is a solo developer or a studio.</li>
        <li>
          {imagesEnabled ? (
            <>
              Island images come from Epic&apos;s CDN, found through{" "}
              <a className="font-semibold text-accent" href="https://fortnite.gg" target="_blank" rel="noreferrer">
                fortnite.gg
              </a>{" "}
              with their permission. Islands without one get a generated thumbnail.
            </>
          ) : (
            "The API has no island images, so thumbnails are generated from the island code and title."
          )}
        </li>
        <li>Release dates are not published; &ldquo;new&rdquo; means most recent in Epic&apos;s release-ordered catalog.</li>
      </ul>
      <h2 className="pt-2 text-[18px] font-bold text-text">Collector status</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {jobs.map(([j, at]) => (
          <div key={j} className="rounded-2xl bg-panel px-4 py-3">
            <p className="text-[13px] font-semibold text-muted capitalize">{j}</p>
            <p className="font-bold text-text">{at ? timeAgo(Number(at)) : "never"}</p>
          </div>
        ))}
      </div>
      <p className="text-[13px] text-muted">
        {fmtInt(tracked)} islands tracked · {fmtInt(hours)} hourly data points stored · {fmtInt(Number(getMeta("catalog.size") ?? 0))} islands in the catalog.
      </p>
      <p className="text-[13px] text-muted">FortAnalytic is not affiliated with Epic Games. Fortnite is a trademark of Epic Games, Inc.</p>
    </article>
  );
}
