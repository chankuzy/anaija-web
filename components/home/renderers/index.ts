import type { ContentKind } from "@/lib/feed/content";
import { immersiveHref, stageForImmersive } from "@/lib/feed/handoff";
import { AnnouncementBody } from "./announcement";
import { AudioReelBody } from "./audio-reel";
import { DocumentBody } from "./document";
import { GalleryBody } from "./gallery";
import { ListingBody, ListingCta } from "./listing";
import { PollBody } from "./poll";
import { PublicationBody } from "./publication";
import { ReelBody } from "./reel";
import { TextBody } from "./text";
import type { Renderer } from "./types";

const read = (p: { id: number }) => `/read/${p.id}`;

// Record<ContentKind, ...>: a new ContentKind does not compile until it has a renderer here.
// Only reels (video or image+audio) hand off to Immersive. Everything else opens its own focused viewer.
export const RENDERERS: Record<ContentKind, Renderer> = {
  reel: { Body: ReelBody, href: (p) => immersiveHref(p.id), prepare: stageForImmersive },
  audioReel: { Body: AudioReelBody, href: (p) => immersiveHref(p.id), prepare: stageForImmersive },
  gallery: { Body: GalleryBody, href: (p) => `/p/${p.id}` },
  listing: { Body: ListingBody, Cta: ListingCta, ownsCaption: true, href: (p) => `/l/${p.id}` },
  text: { Body: TextBody, ownsCaption: true, href: (p) => `/p/${p.id}` },
  poll: { Body: PollBody, ownsCaption: true, href: read },
  document: { Body: DocumentBody, ownsCaption: true, href: read },
  publication: { Body: PublicationBody, ownsCaption: true, href: read },
  announcement: { Body: AnnouncementBody, ownsCaption: true, href: read },
};
