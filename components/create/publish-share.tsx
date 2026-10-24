"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Quick } from "@/components/share/share-sheet";
import { WhatsappGlyph } from "@/components/share/whatsapp-glyph";
import { uploadManager, type UploadTask } from "@/lib/create/upload-manager";
import { canNativeShare, copyText } from "@/lib/share/external";

interface Published {
  isListing: boolean;
  path: string;
  title: string;
  text: string;
}

const squash = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

// A story-only post has no public page, and a followers/campus post can't be opened by a stranger's link.
function describe(t: UploadTask): Published | null {
  const d = t.draft;
  if (d.visibility !== "public") return null;
  const target = t.targets.find((x) => x.kind !== "story" && x.postId != null);
  if (!target || target.postId == null) return null;

  const caption = squash(d.caption ?? "", 100);
  if (target.kind === "listing") {
    const title = (d.businessName ?? "").trim() || caption || "New listing";
    const n = Number(d.price);
    const price = d.price && Number.isFinite(n) ? `₦${n.toLocaleString("en-NG")}` : "";
    return { isListing: true, path: `/l/${target.postId}`, title, text: `${price ? `${title} · ${price}` : title} on Anaija` };
  }
  return {
    isListing: false,
    path: `/p/${target.postId}`,
    title: caption || "New reel on Anaija",
    text: caption ? `${caption} on Anaija` : "Watch my new reel on Anaija",
  };
}

const url = (path: string) => `${(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "")}${path}`;
const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

export function PublishShare() {
  const router = useRouter();
  const pathname = usePathname();
  const [item, setItem] = useState<Published | null>(null);
  const [copied, setCopied] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(
    () =>
      uploadManager.onPublished((t) => {
        if (seen.current.has(t.id)) return;
        seen.current.add(t.id);
        const p = describe(t);
        if (p) setItem(p);
      }),
    [],
  );

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item]);

  if (!item || pathname.startsWith("/create")) return null;
  const close = () => setItem(null);
  const link = () => url(item.path);

  const whatsapp = () => open(`https://wa.me/?text=${encodeURIComponent(`${item.text}\n${link()}`)}`);
  const facebook = () => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link())}`);
  const x = () => open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(item.text)}&url=${encodeURIComponent(link())}`);
  const copy = async () => {
    if (await copyText(link())) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };
  // On phones the system sheet lists Instagram, TikTok, Snapchat and anything else installed.
  const more = async () => {
    if (!canNativeShare()) return void copy();
    try {
      await navigator.share({ title: item.title, text: item.text, url: link() });
    } catch {
      /* cancelled */
    }
  };

  const letter = (c: string) => <span className="text-[20px] font-black leading-none">{c}</span>;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Share">
      <button type="button" aria-label="Close" onClick={close} className="sv-overlay absolute inset-0 cursor-default bg-black/60" />
      <div
        className="sv-rise relative w-full max-w-[440px] rounded-t-[30px] bg-surface-subtle px-4 pt-3 md:rounded-[30px] md:pt-6"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
      >
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/20 md:hidden" />
        <p className="text-center text-[18px] font-extrabold tracking-tight text-white">
          {item.isListing ? "Your listing is live" : "Your reel is live"}
        </p>
        <p className="mt-1 px-6 text-center text-secondary text-white/55">Share it so more people can find it.</p>

        <div className="mt-5 flex">
          <Quick glyph={<WhatsappGlyph className="size-[22px]" />} label="WhatsApp" onClick={whatsapp} />
          <Quick glyph={letter("f")} label="Facebook" onClick={facebook} />
          <Quick glyph={letter("X")} label="X" onClick={x} />
          <Quick icon="copy" label={copied ? "Copied" : "Copy link"} onClick={() => void copy()} />
          <Quick icon="shareArrow" label="More" onClick={() => void more()} />
        </div>

        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={close}
            className="h-12 flex-1 rounded-full bg-surface-interactive text-[15px] font-bold text-white transition hover:bg-surface-elevated active:scale-[0.98]"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              router.push(item.path);
            }}
            className="h-12 flex-1 rounded-full bg-brand text-[15px] font-extrabold text-brand-fg transition hover:bg-brand-hover active:scale-[0.98]"
          >
            {item.isListing ? "View listing" : "View reel"}
          </button>
        </div>
      </div>
    </div>
  );
}
