"use client";

import Link from "next/link";

// Hashtags the caption doesn't already contain get appended (same rule as the immersive caption).
export function withHashtags(caption: string | null, tags: string[] | undefined): string {
  const raw = (caption ?? "").trim();
  const have = new Set([...raw.matchAll(/#(\w+)/gu)].map((m) => m[1].toLowerCase()));
  const extra: string[] = [];
  for (const t of tags ?? []) {
    const c = t.replace(/#/g, "").trim();
    if (c && !have.has(c.toLowerCase())) {
      have.add(c.toLowerCase());
      extra.push(`#${c}`);
    }
  }
  if (!extra.length) return raw;
  return raw ? `${raw} ${extra.join(" ")}` : extra.join(" ");
}

const TLD = "com|ng|org|net|io|app|co|me|ly|link|xyz|edu|gov";
// 1 full url, 2 bare domain (known TLDs only), 3 @mention, 4 #hashtag
const TOKEN = new RegExp(
  `(https?:\\/\\/[^\\s<>]+)|((?:www\\.)?(?:[a-z0-9-]+\\.)+(?:${TLD})(?![a-z0-9-])(?:\\/[^\\s<>]*)?)|(@[a-z0-9_.]{2,30})|(#\\w+)`,
  "giu",
);
const TRAIL = ".,!?;:)]}'\"”’";

const SITE_HOST = (() => {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
})();

// Punctuation that ends a sentence is not part of the link.
function trim(s: string): [string, string] {
  let end = s.length;
  while (end > 0 && TRAIL.includes(s[end - 1])) {
    const head = s.slice(0, end);
    if (s[end - 1] === ")" && head.split("(").length > head.split(")").length) break; // balanced, keep
    end--;
  }
  return [s.slice(0, end), s.slice(end)];
}

function resolve(raw: string): { href: string; internal: boolean } | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.host.replace(/^www\./, "");
  const own = typeof window !== "undefined" ? window.location.host.replace(/^www\./, "") : "";
  if (host === own || (SITE_HOST && host === SITE_HOST)) return { href: u.pathname + u.search + u.hash, internal: true };
  return { href: u.toString(), internal: false };
}

const shortLabel = (raw: string) => {
  const s = raw.replace(/^https?:\/\/(www\.)?/i, "").replace(/^www\./i, "");
  return s.length > 34 ? `${s.slice(0, 33)}…` : s;
};

const LINK = "break-words underline decoration-current/40 underline-offset-2 transition-colors hover:decoration-current";
const stop = (e: React.MouseEvent) => e.stopPropagation(); // a link tap must not trigger the post's own tap

// Caption renderer: links open smartly (Anaija links stay in-app, everything else opens in a new tab so the
// viewer keeps Anaija open), @mentions go to the profile, #hashtags are emphasised.
export function CaptionText({ text, bold = "font-semibold" }: { text: string; bold?: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at < last) continue;
    const prev = at > 0 ? text[at - 1] : "";
    if ((m[2] || m[3]) && /[\w.@/-]/.test(prev)) continue; // inside an email or a word: leave as text
    const [body, tail] = trim(m[0]);
    if (body.length < 2) continue;
    if (at > last) out.push(text.slice(last, at));

    if (m[4]) {
      out.push(
        <span key={k++} className={bold}>
          {body}
        </span>,
      );
    } else if (m[3]) {
      out.push(
        <Link key={k++} href={`/u/${body.slice(1)}`} prefetch={false} onClick={stop} className={bold}>
          {body}
        </Link>,
      );
    } else {
      const r = resolve(body);
      if (!r) out.push(body);
      else if (r.internal)
        out.push(
          <Link key={k++} href={r.href} onClick={stop} className={LINK}>
            {shortLabel(body)}
          </Link>,
        );
      else
        out.push(
          <a key={k++} href={r.href} target="_blank" rel="noopener noreferrer nofollow ugc" onClick={stop} className={LINK}>
            {shortLabel(body)}
          </a>,
        );
    }
    if (tail) out.push(tail);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
