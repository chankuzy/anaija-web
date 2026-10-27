"use client";

import { CaptionText, withHashtags } from "../caption-text";
import { TapSurface } from "./tap-surface";
import type { BodyProps } from "./types";

// A post that is only words: the words are the content.
export function TextBody({ post, onOpen, onLike }: BodyProps) {
  const text = withHashtags(post.caption, post.hashtags);
  return (
    <TapSurface onOpen={onOpen} onLike={onLike} label="Open post" className="block rounded-image bg-surface-subtle px-5 py-6">
      <p className="line-clamp-8 whitespace-pre-wrap text-[19px] font-medium leading-[1.45] text-fg">
        <CaptionText text={text} />
      </p>
    </TapSurface>
  );
}
