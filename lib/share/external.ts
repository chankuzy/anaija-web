import type { Post } from "@/lib/api/feed-types";
import { postLink } from "./link";

// Building blocks for sharing a public link outside Anaija. Everything shares the canonical URL from postLink();
// only the human text changes with the content type. None of this proves delivery: a resolved native share means
// the person finished the OS share sheet, not that anyone received or opened the link.

const squash = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
const isListing = (p: Post) => p.type === "listing" || !!p.listing;

export function shareText(p: Post): { title: string; text: string } {
  const who = p.author?.username ? `@${p.author.username}` : "someone";
  const caption = squash(p.caption ?? "", 100);
  const d = p.listing;
  if (isListing(p)) {
    const name = (d?.business_name ?? "").trim() || caption || `Listing by ${who}`;
    const price = d ? `${d.currency === "NGN" ? "₦" : `${d.currency} `}${d.formatted_price}` : "";
    const tail = d && d.status !== "available" ? ` (${d.status})` : d?.price_type === "negotiable" ? " · negotiable" : "";
    return { title: name, text: `${price ? `${name} · ${price}` : name}${tail} on Anaija` };
  }
  return {
    title: caption || `${who} on Anaija`,
    text: caption ? `${caption} — ${who} on Anaija` : `Watch ${who}'s post on Anaija`,
  };
}

export const canNativeShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

export type ShareResult = "shared" | "cancelled" | "unsupported" | "failed";

/** Cancelling the OS sheet is "cancelled", never a success. */
export async function nativeShare(p: Post): Promise<ShareResult> {
  if (!canNativeShare()) return "unsupported";
  const { title, text } = shareText(p);
  try {
    await navigator.share({ title, text, url: postLink(p) });
    return "shared";
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError" ? "cancelled" : "failed";
  }
}

export function whatsappUrl(p: Post): string {
  return `https://wa.me/?text=${encodeURIComponent(`${shareText(p).text}\n${postLink(p)}`)}`;
}

/** Must run inside a click handler so popup blockers allow it. */
export function openWhatsapp(p: Post) {
  window.open(whatsappUrl(p), "_blank", "noopener,noreferrer");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export const copyLink = (p: Post) => copyText(postLink(p));
