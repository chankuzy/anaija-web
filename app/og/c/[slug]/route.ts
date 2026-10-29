import sharp from "sharp";
import { getCommunityMeta } from "@/lib/server/community-public";

// 1200x630 JPEG: community avatar as a circle over a blurred copy of itself. No avatar -> the Anaija icon.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCommunityMeta(slug);
  const fallback = () => Response.redirect(new URL("/brand/app_icon.png", req.url), 302);
  if (!c?.image) return fallback();
  try {
    const up = await fetch(c.image, { signal: AbortSignal.timeout(8000) });
    if (!up.ok) throw new Error(`upstream ${up.status}`);
    const input = Buffer.from(await up.arrayBuffer());
    const bg = await sharp(input).rotate().resize(1200, 630, { fit: "cover" }).blur(40).modulate({ brightness: 0.5 }).toBuffer();
    const D = 420;
    const circle = Buffer.from(`<svg width="${D}" height="${D}"><circle cx="${D / 2}" cy="${D / 2}" r="${D / 2}" fill="#fff"/></svg>`);
    const fg = await sharp(input).rotate().resize(D, D, { fit: "cover" }).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
    const out = await sharp(bg).composite([{ input: fg, gravity: "center" }]).flatten({ background: "#0A0A0A" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(out), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch {
    return fallback();
  }
}
