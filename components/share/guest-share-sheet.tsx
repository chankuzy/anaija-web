"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import type { Post } from "@/lib/api/feed-types";
import { loginHref } from "@/lib/auth/next";
import { canNativeShare, copyLink, nativeShare, openWhatsapp } from "@/lib/share/external";
import { Quick } from "./share-sheet";
import { WhatsappGlyph } from "./whatsapp-glyph";

// What a visitor without an account can do with a public post: send the link out. No people list, no story.
export function GuestShareSheet({ post, onClose, flash }: { post: Post; onClose: () => void; flash: (text: string) => void }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, []);

  // Page-level scroll hijackers (feed paging) must not see gestures made inside the sheet.
  useEffect(() => {
    const isolate = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("[data-share-sheet]")) e.stopPropagation();
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener("wheel", isolate, opts);
    window.addEventListener("touchmove", isolate, opts);
    return () => {
      window.removeEventListener("wheel", isolate, opts);
      window.removeEventListener("touchmove", isolate, opts);
    };
  }, []);

  const copy = async () => {
    flash((await copyLink(post)) ? "Link copied" : "Couldn't copy the link");
    onClose();
  };
  const more = async () => {
    const r = await nativeShare(post);
    if (r === "failed") flash("Couldn't open sharing");
    else if (r === "shared") onClose();
  };

  return (
    <div
      ref={root}
      tabIndex={-1}
      data-share-sheet
      role="dialog"
      aria-modal="true"
      aria-label="Share"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        e.stopPropagation();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center outline-none md:items-center"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/50" />
      <div
        className="glass relative m-2.5 w-full max-w-md overflow-hidden rounded-floating pb-5"
        style={{ marginBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        <div className="relative flex h-12 shrink-0 items-center justify-center">
          <span className="absolute top-2 h-1 w-9 rounded-full bg-white/20 md:hidden" />
          <h2 className="mt-1.5 text-[16px] font-bold tracking-tight text-fg md:mt-0">Share</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-2 hidden size-9 place-items-center rounded-full text-fg hover:bg-white/8 md:grid"
          >
            <Icon name="close" weight="regular" className="size-5" />
          </button>
        </div>

        <div className="flex px-4 pt-2">
          <Quick
            glyph={<WhatsappGlyph className="size-[22px]" />}
            label="WhatsApp"
            onClick={() => {
              openWhatsapp(post);
              onClose();
            }}
          />
          <Quick icon="copy" label="Copy link" onClick={() => void copy()} />
          {canNativeShare() && <Quick icon="shareArrow" label="More" onClick={() => void more()} />}
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            router.push(loginHref());
          }}
          className="mx-auto mt-5 block text-secondary font-semibold text-white/60 hover:text-white"
        >
          Sign in to send it to people on Anaija
        </button>
      </div>
    </div>
  );
}
