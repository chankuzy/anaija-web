import type { ContentDraft } from "./types";

export const LISTING_TYPES = [
  ["product", "Product"],
  ["business", "Business"],
  ["service", "Service"],
  ["rental", "Rental"],
  ["wanted", "Wanted"],
] as const;
export const SUBTYPES = [
  ["item", "Item"],
  ["textbook", "Textbook"],
  ["service", "Service"],
  ["housing", "Housing"],
  ["gig", "Gig"],
] as const;
export const CONDITIONS = [
  ["new", "New"],
  ["like_new", "Like New"],
  ["good", "Good"],
  ["fair", "Fair"],
  ["poor", "Poor"],
] as const;
export const CONTACT = [
  ["chat", "In-app chat"],
  ["whatsapp", "WhatsApp"],
  ["call", "Phone call"],
  ["any", "Any"],
] as const;

/** Applied when a draft becomes a listing, matching the defaults of the original listing form. */
export const LISTING_DEFAULTS: Partial<ContentDraft> = {
  listingType: "product",
  subtype: "item",
  priceType: "negotiable",
  condition: "good",
  contactPreference: "chat",
  quantity: "1",
};

export const needsCondition = (d: ContentDraft) => d.listingType === "product" || d.listingType === "rental";

export function listingError(d: ContentDraft): string | null {
  if (d.kind !== "listing") return null;
  const p = (d.price ?? "").trim();
  if (p === "" || !Number.isFinite(Number(p)) || Number(p) < 0) return "Add a price in Listing details";
  return null;
}

export function listingSummary(d: ContentDraft): string | null {
  const p = (d.price ?? "").trim();
  const type = LISTING_TYPES.find(([v]) => v === d.listingType)?.[1];
  const parts = [p ? `₦${p}` : null, type ?? null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
