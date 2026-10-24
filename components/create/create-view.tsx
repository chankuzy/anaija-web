/* eslint-disable @next/next/no-img-element */
"use client";
import { loginHref } from "@/lib/auth/next";
import { CreateSkeleton } from "@/components/ui/skeleton";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { publishApi, type MediaInput } from "@/lib/api/publish";
import { uploadBlob } from "@/lib/api/upload";
import { useAuth } from "@/lib/auth/auth-context";
import {
  MAX_IMAGES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  TOO_LARGE,
  TOO_LONG,
  prepareImage,
  probeVideo,
} from "@/lib/create/media";

type Kind = "post" | "story" | "listing";
type Stage = "idle" | "processing" | "uploading" | "saving";
interface Item {
  id: string;
  file: File;
  kind: "image" | "video";
  url: string;
  duration?: number;
  poster?: Blob | null;
}
interface Uploaded {
  key: string;
  thumb?: string;
  width: number;
  height: number;
  duration?: number;
  size: number;
  mime: string;
}

const KINDS: { id: Kind; label: string }[] = [
  { id: "post", label: "Post" },
  { id: "story", label: "Story" },
  { id: "listing", label: "Listing" },
];
const VISIBILITY = [
  ["public", "Everyone"],
  ["followers", "Followers"],
  ["campus", "My Campus"],
] as const;
const LISTING_TYPES = [
  ["product", "Product"],
  ["business", "Business"],
  ["service", "Service"],
  ["rental", "Rental"],
  ["wanted", "Wanted"],
] as const;
const SUBTYPES = [
  ["item", "Item"],
  ["textbook", "Textbook"],
  ["service", "Service"],
  ["housing", "Housing"],
  ["gig", "Gig"],
] as const;
const CONDITIONS = [
  ["new", "New"],
  ["like_new", "Like New"],
  ["good", "Good"],
  ["fair", "Fair"],
  ["poor", "Poor"],
] as const;
const CONTACT = [
  ["chat", "In-app chat"],
  ["whatsapp", "WhatsApp"],
  ["call", "Phone call"],
  ["any", "Any"],
] as const;

const SINGLE_MEDIA_MSG = `Add one video on its own, or up to ${MAX_IMAGES} photos.`;
const ext = (name: string, fallback: string) => (name.includes(".") ? (name.split(".").pop() ?? fallback) : fallback).toLowerCase();

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-secondary ${
        on ? "bg-brand font-extrabold text-brand-fg" : "bg-surface-interactive font-bold text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 mt-6 text-micro font-semibold uppercase tracking-[0.08em] text-muted">{children}</p>;
}

export function CreateView({
  initialKind = "post",
  embedded,
}: {
  initialKind?: Kind;
  /** Set when hosted inside the unified composer: the composer owns close + kind switching. */
  embedded?: { onClose: () => void; switcher: (disabled: boolean) => React.ReactNode };
}) {
  const router = useRouter();
  const { status } = useAuth();
  const [kind, setKind] = useState<Kind>(initialKind);
  const [items, setItems] = useState<Item[]>([]);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<(typeof VISIBILITY)[number][0]>("public");
  const [allowComments, setAllowComments] = useState(true);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // listing
  const [listingType, setListingType] = useState<(typeof LISTING_TYPES)[number][0]>("product");
  const [subtype, setSubtype] = useState<(typeof SUBTYPES)[number][0]>("item");
  const [price, setPrice] = useState("");
  const [negotiable, setNegotiable] = useState(true);
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number][0]>("good");
  const [quantity, setQuantity] = useState("1");
  const [pickup, setPickup] = useState("");
  const [contact, setContact] = useState<(typeof CONTACT)[number][0]>("chat");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(crypto.randomUUID()); // server-side idempotency key
  const uploaded = useRef(new Map<string, Uploaded>()); // survives a failed publish, so retry never re-uploads
  const itemsRef = useRef<Item[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  });
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);
  useEffect(() => {
    if (status === "guest") router.replace(loginHref());
  }, [status, router]);

  const busy = stage !== "idle";
  const isListing = kind === "listing";
  const needsCondition = isListing && (listingType === "product" || listingType === "rental");
  const priceNum = Number(price);
  const ready = items.length > 0 && (!isListing || (price.trim() !== "" && Number.isFinite(priceNum) && priceNum >= 0));

  async function addFiles(files: File[]) {
    setError(null);
    const vids = files.filter((f) => f.type.startsWith("video/"));
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    const hasVideo = items.some((i) => i.kind === "video");
    if (hasVideo || (vids.length > 0 && (items.length > 0 || vids.length > 1 || imgs.length > 0))) {
      return setError(SINGLE_MEDIA_MSG);
    }
    if (vids.length === 1) {
      const f = vids[0];
      if (f.size > MAX_VIDEO_BYTES) return setError(TOO_LARGE);
      try {
        const p = await probeVideo(f);
        if (p.duration > MAX_VIDEO_SECONDS + 0.5) return setError(TOO_LONG);
        setItems([{ id: crypto.randomUUID(), file: f, kind: "video", url: URL.createObjectURL(f), duration: p.duration, poster: p.poster }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "We couldn't read this video.");
      }
      return;
    }
    const room = MAX_IMAGES - items.length;
    if (imgs.length > room) setError(`You can add up to ${MAX_IMAGES} photos.`);
    setItems((prev) => [
      ...prev,
      ...imgs.slice(0, Math.max(0, room)).map((f) => ({ id: crypto.randomUUID(), file: f, kind: "image" as const, url: URL.createObjectURL(f) })),
    ]);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((i) => i.id !== id);
    });
    uploaded.current.delete(id);
  }

  function makeCover(id: string) {
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      return it ? [it, ...prev.filter((i) => i.id !== id)] : prev;
    });
  }

  async function publish() {
    if (busy || !ready) return;
    setError(null);
    try {
      const total = items.reduce((n, i) => n + i.file.size, 0) || 1;
      const sent = new Map<string, number>();
      const report = () => setProgress(Math.min(1, [...sent.values()].reduce((a, b) => a + b, 0) / total));

      const media: MediaInput[] = [];
      for (const it of items) {
        let up = uploaded.current.get(it.id);
        if (!up) {
          if (it.kind === "image") {
            setStage("processing");
            const img = await prepareImage(it.file);
            setStage("uploading");
            const key = await uploadBlob(img.blob, `photo.jpg`, "image/jpeg", (n) => {
              sent.set(it.id, (n / img.blob.size) * it.file.size);
              report();
            });
            up = { key, width: img.width, height: img.height, size: img.blob.size, mime: "image/jpeg" };
          } else {
            setStage("uploading");
            const probe = await probeVideo(it.file);
            const mime = it.file.type || "video/mp4";
            const key = await uploadBlob(it.file, `video.${ext(it.file.name, "mp4")}`, mime, (n) => {
              sent.set(it.id, n);
              report();
            });
            const thumb = it.poster ? await uploadBlob(it.poster, "poster.jpg", "image/jpeg") : undefined;
            up = { key, thumb, width: probe.width, height: probe.height, duration: Math.round(probe.duration), size: it.file.size, mime };
          }
          uploaded.current.set(it.id, up);
        }
        sent.set(it.id, it.file.size);
        report();
        media.push({
          type: it.kind,
          storage_key: up.key,
          ...(up.thumb ? { thumbnail_key: up.thumb } : {}),
          width: up.width,
          height: up.height,
          aspect_ratio: up.width / up.height,
          ...(up.duration !== undefined ? { duration_seconds: up.duration } : {}),
          size_bytes: up.size,
          mime_type: up.mime,
        });
      }

      setStage("saving");
      const text = caption.trim();
      const body: Record<string, unknown> = {
        type: kind,
        client_request_id: requestId.current,
        caption: text,
        media,
      };
      if (isListing) {
        Object.assign(body, {
          allow_comments: allowComments,
          listing_type: listingType,
          subtype,
          price: priceNum,
          price_type: negotiable ? "negotiable" : "fixed",
          contact_preference: contact,
          ...(needsCondition ? { condition, quantity: Math.max(1, parseInt(quantity, 10) || 1) } : {}),
          ...(pickup.trim() ? { pickup_info: pickup.trim() } : {}),
          ...(contact !== "chat" && phone.trim() ? { contact_phone: phone.trim() } : {}),
          ...(listingType === "business" && businessName.trim() ? { business_name: businessName.trim() } : {}),
        });
      } else {
        Object.assign(body, {
          hashtags: [...new Set([...text.matchAll(/#(\w+)/gu)].map((m) => m[1]))],
          visibility,
          ...(kind === "post" ? { allow_comments: allowComments } : {}),
        });
      }

      const res = await publishApi.store(body);
      if (kind === "listing") router.push(`/l/${res.post_id}`);
      else if (kind === "post") router.push(`/p/${res.post_id}`);
      else router.push("/");
    } catch (e) {
      setStage("idle");
      setProgress(0);
      if (e instanceof ApiError && e.errors) {
        setError(Object.values(e.errors).map(String).join(" "));
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    }
  }

  if (status !== "authed") return <CreateSkeleton />;

  const stageLabel =
    stage === "processing" ? "Preparing…" : stage === "uploading" ? `Uploading ${Math.round(progress * 100)}%` : stage === "saving" ? "Publishing…" : null;
  const cta = kind === "story" ? "Share story" : kind === "listing" ? "Post listing" : "Post";

  return (
    <div className="mx-auto w-full max-w-[640px] pb-4">
      <header className="sticky top-0 z-20 bg-bg px-4 pb-2" style={{ paddingTop: embedded ? 10 : "calc(10px + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2 py-1.5">
          <button
            type="button"
            aria-label="Back"
            disabled={busy}
            onClick={() => (embedded ? embedded.onClose() : window.history.length > 1 ? router.back() : router.replace("/"))}
            className="grid size-10 place-items-center rounded-full text-fg disabled:opacity-50"
          >
            <Icon name="back" className="size-5" />
          </button>
          <h1 className="flex-1 text-[22px] font-extrabold tracking-tight text-fg">{embedded ? "New listing" : "Create"}</h1>
        </div>
        {embedded ? (
          <div className="mt-1">{embedded.switcher(busy)}</div>
        ) : (
        <div className="mt-1 flex gap-0.5 rounded-full bg-surface-subtle p-[3px]">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              disabled={busy}
              onClick={() => setKind(k.id)}
              className={`h-[38px] flex-1 rounded-full text-body ${
                k.id === kind ? "bg-brand font-extrabold text-brand-fg" : "font-bold text-white/60"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        )}
      </header>

      <div className="px-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            void addFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />

        <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
          {items.map((it, i) => (
            <div key={it.id} className="relative h-[124px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-card">
              {it.kind === "image" ? (
                <img src={it.url} alt="" className="size-full object-cover" />
              ) : (
                <video src={it.url} muted playsInline preload="metadata" className="size-full object-cover" />
              )}
              <button
                type="button"
                aria-label="Remove"
                disabled={busy}
                onClick={() => removeItem(it.id)}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
              >
                <Icon name="close" className="size-3.5" />
              </button>
              {it.kind === "video" && (
                <span className="pointer-events-none absolute bottom-1.5 left-1.5 grid size-5 place-items-center rounded-full bg-black/55 text-white">
                  <Icon name="play" filled className="size-3" />
                </span>
              )}
              <button
                type="button"
                disabled={busy || i === 0}
                onClick={() => makeCover(it.id)}
                className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-micro font-bold text-white"
              >
                {i === 0 ? "Cover" : i + 1}
              </button>
            </div>
          ))}
          {!items.some((i) => i.kind === "video") && items.length < MAX_IMAGES && (
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="grid h-[124px] w-[92px] shrink-0 place-items-center rounded-xl bg-surface-subtle text-muted"
            >
              <span className="flex flex-col items-center gap-1 text-supporting font-semibold">
                <Icon name="plus" className="size-6" />
                {items.length === 0 ? "Add media" : "Add more"}
              </span>
            </button>
          )}
        </div>
        {items.length === 0 && <p className="mt-2 text-xs text-muted">{SINGLE_MEDIA_MSG} Videos up to {MAX_VIDEO_SECONDS / 60} min.</p>}

        <textarea
          className="mt-5 min-h-[104px] w-full resize-none bg-transparent text-[15px] leading-[1.35] text-fg outline-none placeholder:text-muted"
          placeholder={isListing ? "Describe what you're selling…" : "Add a description…"}
          maxLength={500}
          value={caption}
          disabled={busy}
          onChange={(e) => setCaption(e.target.value)}
        />
        <p className="text-right text-xs text-muted">{caption.length}/500</p>

        {isListing && (
          <>
            <Label>Type</Label>
            <div className="flex flex-wrap gap-2">
              {LISTING_TYPES.map(([v, l]) => (
                <Chip key={v} on={listingType === v} onClick={() => setListingType(v)}>
                  {l}
                </Chip>
              ))}
            </div>

            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {SUBTYPES.map(([v, l]) => (
                <Chip key={v} on={subtype === v} onClick={() => setSubtype(v)}>
                  {l}
                </Chip>
              ))}
            </div>

            {listingType === "business" && (
              <>
                <Label>Business name</Label>
                <input className={inputClass} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Fatima Snacks" />
              </>
            )}

            <Label>{listingType === "business" ? "Starting price" : listingType === "wanted" ? "Budget" : "Price"}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[15px] text-muted">₦</span>
              <input
                className={`${inputClass} pl-10`}
                inputMode="decimal"
                placeholder="Enter amount"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            <label className="mt-3 flex items-center justify-between text-body text-muted">
              Negotiable
              <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} className="size-5 accent-[#ffd84d]" />
            </label>

            {needsCondition && (
              <>
                <Label>Condition</Label>
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map(([v, l]) => (
                    <Chip key={v} on={condition === v} onClick={() => setCondition(v)}>
                      {l}
                    </Chip>
                  ))}
                </div>
                <Label>Quantity available</Label>
                <input className={inputClass} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} />
              </>
            )}

            <Label>Pickup / Location (optional)</Label>
            <input className={inputClass} value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Where can the buyer get it?" />

            <Label>Preferred contact</Label>
            <div className="flex flex-wrap gap-2">
              {CONTACT.map(([v, l]) => (
                <Chip key={v} on={contact === v} onClick={() => setContact(v)}>
                  {l}
                </Chip>
              ))}
            </div>
            {contact !== "chat" && (
              <input className={`${inputClass} mt-3`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
            )}
          </>
        )}

        {!isListing && (
          <>
            <Label>Who can view this</Label>
            <div className="flex flex-wrap gap-2">
              {VISIBILITY.map(([v, l]) => (
                <Chip key={v} on={visibility === v} onClick={() => setVisibility(v)}>
                  {l}
                </Chip>
              ))}
            </div>
          </>
        )}

        {kind !== "story" && (
          <label className="mt-6 flex items-center justify-between text-[15px] text-fg">
            Allow comments
            <input type="checkbox" checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} className="size-5 accent-[#ffd84d]" />
          </label>
        )}

        {error && (
          <p role="alert" className="mt-5 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <div
        className="sticky z-30 mt-8 bg-bg/95 px-4 py-3.5"
        style={{ bottom: embedded ? 0 : "calc(var(--nav-h) + env(safe-area-inset-bottom))" }}
      >
        {busy && stage === "uploading" && (
          <div className="mb-2.5 h-1 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-brand transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => void publish()}
          className="h-[52px] w-full rounded-full bg-brand text-[15px] font-extrabold text-brand-fg disabled:opacity-50"
        >
          {stageLabel ?? cta}
        </button>
      </div>
    </div>
  );
}
