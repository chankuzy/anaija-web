import type { ContentKind } from "@/lib/feed/content";
import { immersiveHref, stageForImmersive } from "@/lib/feed/handoff";
import { GalleryBody } from "./gallery";
import { ListingBody, ListingCta } from "./listing";
import { ReelBody } from "./reel";
import { TextBody } from "./text";
import type { Renderer } from "./types";

// Record<ContentKind, ...>: a new ContentKind does not compile until it has a renderer here.
export const RENDERERS: Record<ContentKind, Renderer> = {
  reel: { Body: ReelBody, href: (p) => immersiveHref(p.id), prepare: stageForImmersive },
  gallery: { Body: GalleryBody, href: (p) => `/p/${p.id}` },
  listing: { Body: ListingBody, Cta: ListingCta, ownsCaption: true, href: (p) => `/l/${p.id}` },
  text: { Body: TextBody, ownsCaption: true, href: (p) => `/p/${p.id}` },
};
