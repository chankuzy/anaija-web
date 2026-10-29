import type { Metadata } from "next";
import type { Post } from "@/lib/api/feed-types";
import type { PublicProfile } from "@/lib/server/public";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")).replace(/\/+$/, "");
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

export const ogImage = (p: Post): string | null => (postImage(p) ? abs(`/og/${p.id}`) : null);

export function card(o: { title: string; description: string; url: string; image: string | null; type?: "website" | "profile"; wide?: boolean }): Metadata {
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
      ...(image ? { images: [{ url: image, alt: title, ...(o.wide ? { width: 1200, height: 630 } : {}) }] } : {}),
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
    image: ogImage(p),
    wide: true,
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

export function listingMetadata(p: Post): Metadata {
  const d = p.listing;
  const caption = (p.caption ?? "").trim();
  const who = p.author?.username ? `@${p.author.username}` : (p.author?.name ?? "a seller");
  const KIND: Record<string, string> = { product: "For sale", rental: "For rent", service: "Service", wanted: "Wanted", business: "Business" };
  const name = (d?.business_name ?? "").trim() || caption || `${KIND[p.listing_type ?? "product"] ?? "Listing"} by ${who}`;
  const price = d ? `${d.currency === "NGN" ? "₦" : `${d.currency} `}${d.formatted_price}` : "";
  const seller = p.author?.username ? `@${p.author.username}` : (p.author?.name ?? "a seller");
  const status = d && d.status !== "available" ? ` (${d.status})` : "";
  const bits = [
    price ? `${price}${d?.price_type === "negotiable" ? " · negotiable" : ""}` : "",
    d?.condition ? d.condition.replace("_", " ") : "",
    `by ${seller}`,
  ].filter(Boolean);
  return card({
    title: clip(price ? `${name} · ${price}${status}` : `${name}${status}`, 70),
    description: clip(`${bits.join(" · ")}${caption && caption !== name ? `. ${caption}` : ""}`, 200),
    url: abs(`/l/${p.id}`),
    image: ogImage(p),
    wide: true,
  });
}

export function communityMetadata(c: { slug: string; name: string; description: string | null }): Metadata {
  return card({
    title: c.name,
    description: clip(c.description ?? `Join ${c.name} on Anaija.`, 200),
    url: abs(`/c/${encodeURIComponent(c.slug)}`),
    image: abs(`/og/c/${encodeURIComponent(c.slug)}`),
    wide: true,
  });
}

export function sessionMetadata(code: string, s: { title: string; community: string }): Metadata {
  return card({
    title: `${s.title} · ${s.community}`,
    description: `An anonymous session in ${s.community} on Anaija. Tap to join in.`,
    url: abs(`/s/${encodeURIComponent(code)}`),
    image: abs("/og/s/" + encodeURIComponent(code)),
    wide: true,
  });
}

export const joinMetadata = (token: string, m: { name: string; slug: string; members: number } | null): Metadata => ({
  ...card(
    m
      ? {
          title: `Join ${m.name} on Anaija`,
          description: `${m.members} ${m.members === 1 ? "member" : "members"}. Tap to join. Hustle. Flex. Earn.`,
          url: abs(`/join/${encodeURIComponent(token)}`),
          image: abs(`/og/c/${encodeURIComponent(m.slug)}`),
          wide: true,
        }
      : {
          title: "You're invited to a community on Anaija",
          description: "Tap to join. Hustle. Flex. Earn.",
          url: abs("/"),
          image: abs("/brand/app_icon.png"),
        },
  ),
  robots: { index: false, follow: false },
});
