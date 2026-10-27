import type { IconName } from "@/components/ui/icon";

export type StructuredCreateKind = "document" | "poll" | "article" | "announcement";
export type CreateKind = "reel" | "photo" | "story" | "listing" | StructuredCreateKind;
export type Tone = "brand" | "neutral" | "info" | "accent" | "warm";

export interface KindMeta {
  title: string;
  sub: string;
  icon: IconName;
  tone: Tone;
}

// One place to change copy or icons. Icons are limited to names that already exist in the Solar map.
export const KIND_META: Record<CreateKind, KindMeta> = {
  reel: { title: "Reel", sub: "A video for your followers", icon: "clapperboard", tone: "brand" },
  photo: { title: "Image post", sub: "One photo or a swipeable set", icon: "gallery", tone: "neutral" },
  story: { title: "Story", sub: "Fades after 24 hours", icon: "videocamera", tone: "neutral" },
  listing: { title: "Listing", sub: "Sell a product, service or rental", icon: "bag", tone: "warm" },
  document: { title: "Document", sub: "Share a PDF, slides or a sheet", icon: "copy", tone: "info" },
  poll: { title: "Poll", sub: "Ask campus a question", icon: "filters", tone: "accent" },
  article: { title: "Publication", sub: "Long-form writing with a cover", icon: "notebookMinimalistic", tone: "neutral" },
  announcement: { title: "Announcement", sub: "An official notice", icon: "bell", tone: "brand" },
};

export const STRUCTURED_KINDS: readonly StructuredCreateKind[] = ["document", "poll", "article", "announcement"];
export const isStructuredKind = (k: string | undefined): k is StructuredCreateKind =>
  !!k && (STRUCTURED_KINDS as readonly string[]).includes(k);
