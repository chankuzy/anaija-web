// Hand-added Solar icons that are not in the generated solar-map.ts. Same package, same bold/outline styles.
// icon.tsx spreads this AFTER solar-map, so keys here OVERRIDE the generated ones:
//   share / shareArrow -> paper plane (one share icon app-wide)
//   comment / chatLine -> chat square (one comments icon app-wide)
//   shareIos           -> the original iOS-style share glyph (only for "tap Share in Safari" instructions)
import type { ComponentType, SVGProps } from "react";
import { StarIcon as b_star } from "@solar-icons/react/bold/star";
import { StarIcon as o_star } from "@solar-icons/react/outline/star";
import { StickerSmileCircleIcon as b_sticker } from "@solar-icons/react/bold/sticker-smile-circle";
import { StickerSmileCircleIcon as o_sticker } from "@solar-icons/react/outline/sticker-smile-circle";
import { SmileCircleIcon as b_smile } from "@solar-icons/react/bold/smile-circle";
import { SmileCircleIcon as o_smile } from "@solar-icons/react/outline/smile-circle";
import { GalleryAddIcon as b_gallery_add } from "@solar-icons/react/bold/gallery-add";
import { GalleryAddIcon as o_gallery_add } from "@solar-icons/react/outline/gallery-add";
import { ChatSquareIcon as b_chat_square } from "@solar-icons/react/bold/chat-square";
import { ChatSquareIcon as o_chat_square } from "@solar-icons/react/outline/chat-square";
import { PlaneIcon as b_plane } from "@solar-icons/react/bold/plane";
import { PlaneIcon as o_plane } from "@solar-icons/react/outline/plane";
import { ShareIcon as b_share } from "@solar-icons/react/bold/share";
import { ShareIcon as o_share } from "@solar-icons/react/outline/share";

type SolarComp = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; color?: string }>;
const p = (bold: unknown, outline: unknown) => ({ bold: bold as SolarComp, outline: outline as SolarComp });

export const EXTRA_SOLAR = {
  star: p(b_star, o_star),
  stickerSmileCircle: p(b_sticker, o_sticker),
  smileCircle: p(b_smile, o_smile),
  galleryAdd: p(b_gallery_add, o_gallery_add),
  comment: p(b_chat_square, o_chat_square),
  chatLine: p(b_chat_square, o_chat_square),
  share: p(b_plane, o_plane),
  shareArrow: p(b_plane, o_plane),
  shareIos: p(b_share, o_share),
};
