"use client";

import { CaptionText, withHashtags } from "../caption-text";
import { TapSurface } from "./tap-surface";
import type { BodyProps } from "./types";

// A post that is only words: the words are the content. A short brand rule opens the card; short lines get large,
// tight display type, longer ones settle into a comfortable reading size.
export function TextBody({ post, onOpen, onLike }: BodyProps) {
  const text = withHashtags(post.caption, post.hashtags);
  const short = text.length <= 90 && !text.includes("\n");
  return (
    <TapSurface
      onOpen={onOpen}
      onLike={onLike}
      label="Open post"
      className="selectable block overflow-hidden rounded-image border border-white/[0.06] bg-[linear-gradient(180deg,#19191d_0%,#101013_100%)] px-6 pb-9 pt-7"
    >
      <span aria-hidden className="mb-5 block h-[3px] w-8 rounded-full bg-brand" />
      <p
        className={`whitespace-pre-wrap ${
          short
            ? "text-[28px] font-semibold leading-[1.18] tracking-[-0.02em] text-fg"
            : "line-clamp-9 text-[17px] font-normal leading-[1.6] text-fg/90"
        }`}
      >
        <CaptionText text={text} />
      </p>
    </TapSurface>
  );
}
