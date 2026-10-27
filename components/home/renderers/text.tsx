"use client";

import { CaptionText, withHashtags } from "../caption-text";
import { TapSurface } from "./tap-surface";
import type { BodyProps } from "./types";

// A post that is only words: the words are the content. Short lines get expressive type.
export function TextBody({ post, onOpen, onLike }: BodyProps) {
  const text = withHashtags(post.caption, post.hashtags);
  const short = text.length <= 90 && !text.includes("\n");
  return (
    <TapSurface onOpen={onOpen} onLike={onLike} label="Open post" className="selectable block rounded-image bg-surface-subtle px-6 py-8">
      <p
        className={`whitespace-pre-wrap ${
          short ? "text-[26px] font-bold leading-[1.25] tracking-tight" : "line-clamp-9 text-[19px] font-medium leading-[1.5]"
        } text-fg`}
      >
        <CaptionText text={text} />
      </p>
    </TapSurface>
  );
}
