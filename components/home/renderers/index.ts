import type { ContentKind } from "@/lib/feed/content";
import { immersiveHref, stageForImmersive } from "@/lib/feed/handoff";
import { AnnouncementBody } from "./announcement";
import { AudioReelBody } from "./audio-reel";
import { DocumentBody } from "./document";
import { GalleryBody } from "./gallery";
import { ListingBody, ListingCta } from "./listing";
import { PollBody } from "./poll";
import { PublicationBody } from "./publication";
import { QuestionBody } from "./question";
import { ReelBody } from "./reel";
import { TextBody } from "./text";
import type { Renderer } from "./types";

const detail = (p: { id: number }) => `/p/${p.id}`;

// Record<ContentKind, ...>: a new ContentKind does not compile until it has a renderer here.
// Only reels (video or image+audio) hand off to Immersive Media. Everything else opens its standalone page.
// Questions open the comments sheet instead (HomePost special-cases them); href is only the fallback.
export const RENDERERS: Record<ContentKind, Renderer> = {
  reel: { Body: ReelBody, href: (p) => immersiveHref(p.id), prepare: stageForImmersive },
  audioReel: { Body: AudioReelBody, href: (p) => immersiveHref(p.id), prepare: stageForImmersive },
  gallery: { Body: GalleryBody, href: detail },
  listing: { Body: ListingBody, Cta: ListingCta, ownsCaption: true, href: (p) => `/l/${p.id}` },
  text: { Body: TextBody, ownsCaption: true, href: detail },
  poll: { Body: PollBody, ownsCaption: true, href: detail },
  document: { Body: DocumentBody, ownsCaption: true, href: detail },
  publication: { Body: PublicationBody, ownsCaption: true, href: detail },
  announcement: { Body: AnnouncementBody, ownsCaption: true, href: detail },
  question: { Body: QuestionBody, ownsCaption: true, href: detail },
};
