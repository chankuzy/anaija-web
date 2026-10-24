import sharp from "sharp";
import { getPublicPost } from "@/lib/server/public";
import { postImage } from "@/lib/share/meta";

// 1200x630 JPEG under ~250 KB: WhatsApp drops previews for heavy images.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPublicPost(Number(id));
  const src = post ? postImage(post) : null;
  if (!src) return new Response("Not found", { status: 404 });
  try {
    const up = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!up.ok) throw new Error(`upstream ${up.status}`);
    const input = Buffer.from(await up.arrayBuffer());
    const bg = await sharp(input).rotate().resize(1200, 630, { fit: "cover" }).blur(40).modulate({ brightness: 0.55 }).toBuffer();
    const fg = await sharp(input).rotate().resize(1200, 630, { fit: "inside", withoutEnlargement: true }).toBuffer();
    let out = Buffer.alloc(0);
    for (const q of [82, 72, 62, 50]) {
      out = await sharp(bg)
        .composite([{ input: fg, gravity: "center" }])
        .flatten({ background: "#0A0A0A" })
        .jpeg({ quality: q, mozjpeg: true })
        .toBuffer();
      if (out.length <= 250_000) break;
    }
    return new Response(new Uint8Array(out), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return Response.redirect(src, 302);
  }
}
