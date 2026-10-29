// Hand-added Solar icons that are not in the generated solar-map.ts. Same package, same bold/outline styles.
import type { ComponentType, SVGProps } from "react";
import { StarIcon as b_star } from "@solar-icons/react/bold/star";
import { StarIcon as o_star } from "@solar-icons/react/outline/star";
import { StickerSmileCircleIcon as b_sticker } from "@solar-icons/react/bold/sticker-smile-circle";
import { StickerSmileCircleIcon as o_sticker } from "@solar-icons/react/outline/sticker-smile-circle";
import { SmileCircleIcon as b_smile } from "@solar-icons/react/bold/smile-circle";
import { SmileCircleIcon as o_smile } from "@solar-icons/react/outline/smile-circle";
import { GalleryAddIcon as b_gallery_add } from "@solar-icons/react/bold/gallery-add";
import { GalleryAddIcon as o_gallery_add } from "@solar-icons/react/outline/gallery-add";

type SolarComp = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; color?: string }>;
const p = (bold: unknown, outline: unknown) => ({ bold: bold as SolarComp, outline: outline as SolarComp });

export const EXTRA_SOLAR = {
  star: p(b_star, o_star),
  stickerSmileCircle: p(b_sticker, o_sticker),
  smileCircle: p(b_smile, o_smile),
  galleryAdd: p(b_gallery_add, o_gallery_add),
};
