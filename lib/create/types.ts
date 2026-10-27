// Port of content_draft.dart + post_audio_selection.dart + audio_asset.dart + slideshow_config.dart.
// Everything here is structured-cloneable (File/Blob/plain data) so a draft or a pending upload
// can live in IndexedDB as-is.

export type ContentKind = "reel" | "photo" | "story" | "listing";
export type Visibility = "public" | "followers" | "campus";
export type ListingType = "product" | "business" | "service" | "rental" | "wanted";

export const maxSelection = (k: ContentKind) => (k === "story" ? 1 : k === "reel" || k === "photo" ? 10 : 5);

export interface DraftMedia {
  id: string;
  /** Untouched source. Edits are always baked from this, so going back and forth never double-applies. */
  original: File;
  /** What gets uploaded: `original` until an edit is baked. */
  file: File;
  type: "image" | "video";
  durationSeconds?: number;
  /** Known from the first probe, so the upload never has to re-read the video. */
  durationMs?: number;
  width?: number;
  height?: number;
  /** Custom video cover (JPEG). Absent = automatic frame. */
  cover?: Blob | null;
}

/** A track picked from this computer, with its playback window. */
export interface AudioSelection {
  file: File;
  title: string;
  artist?: string;
  trackDurationMs: number;
  startMs: number;
  assetName?: string;
}

/** A saved sound (My Sounds). `durationMs` is the length of the CLIP; it starts `sourceStartMs` into the file. */
export interface AudioAsset {
  id: number;
  userId: number;
  name: string;
  url: string | null;
  storageKey: string;
  mimeType: string | null;
  durationMs: number;
  sourceStartMs: number;
  fileSize: number | null;
  createdAt: string;
}

export function parseAudioAsset(j: Record<string, unknown>): AudioAsset {
  return {
    id: Number(j.id),
    userId: Number(j.user_id),
    name: (j.name as string) || "Untitled Audio",
    url: (j.url as string) ?? null,
    storageKey: j.storage_key as string,
    mimeType: (j.mime_type as string) ?? null,
    durationMs: Number(j.duration_ms),
    sourceStartMs: Number(j.source_start_ms ?? 0),
    fileSize: j.file_size == null ? null : Number(j.file_size),
    createdAt: (j.created_at as string) ?? "",
  };
}

export const audioDisplayDuration = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

export interface SlideshowConfig {
  enabled: boolean;
  intervalMs: number;
}
export const DEFAULT_SLIDE_MS = 2800;
export const slideshowJson = (s: SlideshowConfig) => ({
  enabled: s.enabled,
  interval_ms: s.intervalMs,
  transition: "fade",
});

export interface ContentDraft {
  kind: ContentKind;
  media: DraftMedia[];
  caption: string;

  visibility: Visibility;
  allowComments: boolean;
  /** null = follow the account-wide "let others add my posts to stories" setting. */
  allowStorySharing: boolean | null;

  location: string | null;
  locationInfo?: import("@/lib/location/types").LocationInfo | null;
  taggedUsernames: string[];

  listingType: ListingType | null;
  subtype: string | null;
  price: string | null;
  priceType: string | null;
  condition: string | null;
  contactPreference: string | null;
  contactPhone: string | null;
  pickupInfo: string | null;
  quantity: string | null;

  businessName: string | null;
  businessDescription: string | null;
  acceptingOrders: boolean | null;
  deliveryAvailable: boolean;

  fulfillmentType: string | null;
  serviceRadiusKm: number | null;
  estimatedDelivery: number | null;
  minimumOrderPrice: string | null;

  openingHours: Record<string, { open: string; close: string; closed: boolean }> | null;

  audioAsset: AudioAsset | null;
  audio: AudioSelection | null;

  slideshow: SlideshowConfig;

  draftId: string | null;
  savedAtMs: number | null;
}

export function createDraft(kind: ContentKind, media: DraftMedia[] = []): ContentDraft {
  return {
    kind,
    media,
    caption: "",
    visibility: "public",
    allowComments: true,
    allowStorySharing: null,
    location: null,
    locationInfo: null,
    taggedUsernames: [],
    listingType: null,
    subtype: null,
    price: null,
    priceType: null,
    condition: null,
    contactPreference: null,
    contactPhone: null,
    pickupInfo: null,
    quantity: null,
    businessName: null,
    businessDescription: null,
    acceptingOrders: null,
    deliveryAvailable: false,
    fulfillmentType: null,
    serviceRadiusKm: null,
    estimatedDelivery: null,
    minimumOrderPrice: null,
    openingHours: null,
    audioAsset: null,
    audio: null,
    slideshow: { enabled: false, intervalMs: DEFAULT_SLIDE_MS },
    draftId: null,
    savedAtMs: null,
  };
}

export const hashtagsOf = (caption: string): string[] => [
  ...new Set([...caption.matchAll(/#(\w+)/g)].map((m) => m[1])),
];

export const draftHasMusic = (d: ContentDraft) => d.audioAsset !== null || d.audio !== null;
export const draftMusicName = (d: ContentDraft) =>
  d.audioAsset?.name ?? d.audio?.assetName ?? d.audio?.title ?? null;
