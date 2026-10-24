import type { Metadata } from "next";
import type { Post } from "@/lib/api/feed-types";
import type { PublicProfile } from "@/lib/server/public";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
export const abs = (path: string) => (SITE ? `${SITE}${path}` : path);

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
const https = (u: string | null | undefined) => (u && /^https:\/\//i.test(u) ? u : null);

export function postImage(p: Post): string | null {
  if (p.thumbnail_url) return https(p.thumbnail_url);
  const m = [...(p.media ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
  if (!m) return null;
  const video = (m.type ?? "").toLowerCase() === "video";
  return https(video ? m.thumbnail : (m.url ?? m.thumbnail));
}

function card(o: { title: string; description: string; url: string; image: string | null; type?: "website" | "profile" }): Metadata {
  const { title, description, url, image } = o;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: o.type ?? "website",
      siteName: "Anaija",
      title,
      description,
      url,
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export function postMetadata(p: Post): Metadata {
  const who = p.author?.username ? `@${p.author.username}` : (p.author?.name ?? "Anaija");
  const caption = (p.caption ?? "").trim();
  return card({
    title: caption ? clip(caption, 70) : `${who} on Anaija`,
    description: clip(caption ? `${who} on Anaija: ${caption}` : `Watch ${who}'s post on Anaija. Hustle. Flex. Earn.`, 200),
    url: abs(`/p/${p.id}`),
    image: postImage(p),
  });
}

export function profileMetadata(p: PublicProfile): Metadata {
  return card({
    title: `${p.name ?? p.username} (@${p.username})`,
    description: clip(p.tagline || p.bio || `Follow @${p.username} on Anaija. Hustle. Flex. Earn.`, 200),
    url: abs(`/u/${encodeURIComponent(p.username)}`),
    image: https(p.avatar),
    type: "profile",
  });
}

export const unavailable = (what: string): Metadata => ({
  title: `${what} unavailable`,
  robots: { index: false, follow: false },
});
