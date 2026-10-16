import { imageFor } from "@/lib/images";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF: the generated thumbnail underneath stays visible.
const EMPTY = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Redirects to the island's image on Epic's CDN, or answers a transparent pixel. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const image = /^\d{4}-\d{4}-\d{4}$/.test(code) ? imageFor(code) : null;
  if (image) return new Response(null, { status: 302, headers: { location: image, "cache-control": "public, max-age=86400" } });
  return new Response(EMPTY, { headers: { "content-type": "image/gif", "cache-control": "public, max-age=600" } });
}
