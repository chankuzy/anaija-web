import sharp from "sharp";
import { getMomentMeta } from "@/lib/server/community-public";

// Shapes only (no text, so no font dependency). Each type has its own colour and mark. Nothing here depends on who the host is.
const COLOR: Record<string, string> = { hot_seat: "#ffb340", verdict: "#4c8dff", confession_drop: "#9b8cff", dept_war: "#ff6b5c", one_question: "#ffd23f" };

function mark(type: string, c: string): string {
  switch (type) {
    case "hot_seat":
      return `<polygon points="600,0 360,630 840,630" fill="${c}" opacity=".14"/><circle cx="600" cy="285" r="78" fill="#f4f4f6"/><path d="M450 470 Q450 370 600 370 Q750 370 750 470 L750 520 L450 520Z" fill="#f4f4f6"/>
<rect x="110" y="170" width="250" height="84" rx="42" fill="${c}" opacity=".85"/><rect x="860" y="300" width="230" height="84" rx="42" fill="${c}" opacity=".55"/><rect x="150" y="360" width="210" height="84" rx="42" fill="${c}" opacity=".35"/>`;
    case "verdict":
      return `<rect x="190" y="210" width="820" height="120" rx="60" fill="#19191d"/><rect x="190" y="210" width="520" height="120" rx="60" fill="${c}"/><rect x="190" y="370" width="820" height="120" rx="60" fill="#19191d"/><rect x="190" y="370" width="300" height="120" rx="60" fill="#4a4a53"/>`;
    case "confession_drop":
      return `<rect x="340" y="170" width="520" height="330" rx="48" fill="#19191d"/><path d="M340 215 L600 380 L860 215" fill="none" stroke="${c}" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/><circle cx="600" cy="470" r="44" fill="${c}"/><circle cx="600" cy="470" r="16" fill="#09090b"/>`;
    case "dept_war":
      return `<circle cx="430" cy="315" r="150" fill="${c}" opacity=".9"/><circle cx="770" cy="315" r="150" fill="#26262b"/><path d="M620 170 L545 330 L605 330 L580 460 L670 290 L610 290Z" fill="#f4f4f6"/>`;
    default:
      return `<circle cx="600" cy="315" r="215" fill="#19191d"/><path d="M520 250 Q520 175 600 175 Q685 175 685 245 Q685 295 635 322 Q600 342 600 385" fill="none" stroke="${c}" stroke-width="30" stroke-linecap="round"/><circle cx="600" cy="460" r="20" fill="${c}"/>`;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const m = await getMomentMeta(code);
  const type = m?.type ?? "one_question";
  const c = COLOR[type] ?? "#ffd23f";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#09090b"/><circle cx="600" cy="315" r="330" fill="${c}" opacity=".09"/>${mark(type, c)}</svg>`;
  const out = await sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(out), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
