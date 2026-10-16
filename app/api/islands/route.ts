import { NextResponse } from "next/server";
import { markViewed } from "@/lib/ingest";
import { islandsByCodes } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Watchlist rows: /api/islands?codes=1234-5678-9012,...
export function GET(req: Request) {
  const codes = (new URL(req.url).searchParams.get("codes") ?? "")
    .split(",")
    .filter((c) => /^\d{4}-\d{4}-\d{4}$/.test(c))
    .slice(0, 200);
  // Followed islands stay in the hourly sync even when they leave the genre top lists.
  markViewed(codes);
  const rows = islandsByCodes(codes);
  const order = new Map(codes.map((c, i) => [c, i]));
  return NextResponse.json(rows.sort((a, b) => order.get(a.code)! - order.get(b.code)!));
}
