import sharp from "sharp";

// Anonymous sessions have no image, so they get a drawn anonymous icon (shapes only, no text: no font needed).
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
  <radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#16231c"/><stop offset="1" stop-color="#0A0A0A"/></radialGradient>
  <linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F5B83D"/><stop offset="1" stop-color="#14C27A"/></linearGradient>
</defs>
<rect width="1200" height="630" fill="url(#g)"/>
<circle cx="600" cy="315" r="215" fill="#141414" stroke="url(#r)" stroke-width="10"/>
<ellipse cx="600" cy="262" rx="150" ry="26" fill="#EDEDED"/>
<path d="M505 262 L520 168 Q600 138 680 168 L695 262 Z" fill="#EDEDED"/>
<rect x="505" y="236" width="190" height="20" fill="#14C27A"/>
<rect x="470" y="318" width="112" height="72" rx="30" fill="#0A0A0A" stroke="#EDEDED" stroke-width="8"/>
<rect x="618" y="318" width="112" height="72" rx="30" fill="#0A0A0A" stroke="#EDEDED" stroke-width="8"/>
<path d="M582 342 Q600 330 618 342" fill="none" stroke="#EDEDED" stroke-width="8" stroke-linecap="round"/>
<path d="M520 440 Q600 490 680 440" fill="none" stroke="#EDEDED" stroke-width="8" stroke-linecap="round" opacity=".55"/>
</svg>`;

export async function GET() {
  const out = await sharp(Buffer.from(SVG)).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(out), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" },
  });
}
