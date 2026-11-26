"use client";
import { openAuth } from "@/lib/auth/auth-modal";
import { ProfileHoverCard } from "@/components/profile/profile-hover-card";
import { ListingSkeleton, UserRowsSkeleton } from "@/components/ui/skeleton";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLike } from "@/components/market/market-view";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Lightbox } from "@/components/ui/lightbox";
import { ApiError } from "@/lib/api/client";
import { listingApi, type DayHours, type Inquiry, type ListingFull, type ListingStatus } from "@/lib/api/listing";
import { useAuth } from "@/lib/auth/auth-context";
import { useShare } from "@/lib/share/share-context";
import type { Post } from "@/lib/api/feed-types";
import { formatCount, timeAgo } from "@/lib/format";
import { formatCompactLocation, formatFullLocation } from "@/lib/location/types";
import { MoreLikeThis } from "./more-like-this";
import { SimilarListings } from "./similar-listings";

interface Data {
  id: string;
  listing: ListingFull | null;
  status: number;
}

const IMAGE = new Set(["image", "photo", "picture"]);
const DAYS: [string, string][] = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];
const COND: Record<string, string> = { new: "New", like_new: "Like New", good: "Good", fair: "Fair", poor: "Poor" };
const FULFIL: Record<string, string> = { pickup: "Pickup", delivery: "Delivery", onsite: "On-site", remote: "Remote", digital: "Digital" };
const TYPE_LABEL: Record<string, string> = { product: "Product", service: "Service", rental: "Rental", business: "Business", wanted: "Wanted" };

function openNow(h: Record<string, DayHours>): boolean {
  const key = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
  const d = h[key];
  if (!d || d.closed) return false;
  try {
    const [oh, om] = d.open.split(":").map(Number);
    const [ch, cm] = d.close.split(":").map(Number);
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    return now >= oh * 60 + om && now < ch * 60 + cm;
  } catch {
    return false;
  }
}

function eta(mins: number) {
  if (mins < 60) return `~${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `~${h}h` : `~${h}h ${m}min`;
}

function Price({ d, size, prefix }: { d: NonNullable<ListingFull["listing"]>; size: number; prefix?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      {prefix && <span className="text-muted" style={{ fontSize: size * 0.75 }}>{prefix}</span>}
      <span className="font-bold text-brand" style={{ fontSize: size * 0.75 }}>₦</span>
      <span className="font-bold text-fg" style={{ fontSize: size }}>{d.formatted_price}</span>
      {d.price_type === "negotiable" && (
        <span className="ml-1 rounded-full bg-surface-interactive px-2 py-0.5 font-bold text-fg/80" style={{ fontSize: size * 0.5 }}>Negotiable</span>
      )}
    </span>
  );
}

function Badge({ children, color = "#7a7a85" }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="rounded-lg px-2.5 py-1 text-supporting font-bold" style={{ color, backgroundColor: `${color}1f` }}>
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-secondary">
      <span className="text-muted">{label}</span>
      <span className="text-right text-fg">{value}</span>
    </div>
  );
}

function Gallery({ urls, badge, onOpen }: { urls: string[]; badge: string | null; onOpen: (u: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  return (
    <div className="relative mx-4 overflow-hidden rounded-[26px] bg-card md:mx-5">
      {urls.length === 0 ? (
        <div className="grid h-[240px] place-items-center text-muted md:h-[380px]">No photos</div>
      ) : (
        <div
          ref={ref}
          onScroll={() => {
            const el = ref.current;
            if (el?.clientWidth) setIdx(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="no-scrollbar flex h-[240px] snap-x snap-mandatory overflow-x-auto md:h-[380px]"
        >
          {urls.map((u) => (
            <button key={u} type="button" onClick={() => onOpen(u)} className="h-full w-full shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" decoding="async" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {badge && (
        <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-fg/10 bg-black/60 px-3 py-1 text-[13px] font-semibold text-white backdrop-blur">
          {badge}
        </span>
      )}
      {urls.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
          {urls.map((u, n) => (
            <span key={u} className={`size-2 rounded-full transition-colors ${n === idx ? "bg-brand" : "bg-fg/35"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function HeartButton({ post }: { post: Post }) {
  const { liked, toggle } = useLike(post);
  return (
    <button type="button" aria-label={liked ? "Remove like" : "Like"} aria-pressed={liked} onClick={toggle} className="grid size-10 place-items-center text-fg transition-transform active:scale-90">
      <Icon name="heart" filled={liked} className={`size-[26px] ${liked ? "text-like" : "text-fg"}`} />
    </button>
  );
}

function OfferSheet({ asking, busy, onClose, onSend }: { asking: string; busy: boolean; onClose: () => void; onSend: (amount: number) => void }) {
  const [amt, setAmt] = useState("");
  const n = Number(amt.replace(/\D/g, ""));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-[720px] rounded-t-[30px] bg-card-elevated px-5 pt-5"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[18px] font-extrabold text-fg">Make an offer</p>
        <p className="mt-1 text-secondary text-muted">Asking price ₦{asking}. Your offer goes to the seller as a chat message.</p>
        <div className="mt-4 flex h-14 items-center gap-2 rounded-2xl bg-surface-subtle px-4">
          <span className="text-[20px] font-bold text-brand">₦</span>
          <input
            inputMode="numeric"
            autoFocus
            value={amt ? n.toLocaleString("en-NG") : ""}
            onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))}
            placeholder="Your offer"
            className="min-w-0 flex-1 bg-transparent text-[20px] font-bold text-fg outline-none placeholder:text-muted"
          />
        </div>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onClose} className="h-[52px] flex-1 rounded-full bg-surface-interactive text-[15px] font-bold text-fg">
            Cancel
          </button>
          <button
            type="button"
            disabled={n <= 0 || busy}
            onClick={() => onSend(n)}
            className="h-[52px] flex-1 rounded-full bg-brand text-[15px] font-extrabold text-brand-fg disabled:opacity-50"
          >
            {busy ? "…" : "Send offer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusControl({ current, busy, onChange }: { current: ListingStatus; busy: boolean; onChange: (s: ListingStatus) => void }) {
  const opts: [ListingStatus, string, string][] = [
    ["available", "Available", "#00e676"],
    ["reserved", "Reserved", "#ffb340"],
    ["sold", "Sold", "#ff5c5c"],
  ];
  return (
    <div>
      <h2 className="mb-3 text-[15px] font-bold text-fg">Listing status</h2>
      <div className="flex gap-1 rounded-[14px] bg-card p-1">
        {opts.map(([id, label, color]) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            onClick={() => onChange(id)}
            className="h-10 flex-1 rounded-[11px] text-secondary font-semibold disabled:opacity-60"
            style={id === current ? { color, backgroundColor: `${color}29`, fontWeight: 700 } : { color: "#7a7a85" }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Inquiries({ id }: { id: number }) {
  const [state, setState] = useState<{ id: number; items: Inquiry[] | null; error: boolean } | null>(null);
  useEffect(() => {
    let off = false;
    listingApi
      .inquiries(id)
      .then((items) => !off && setState({ id, items, error: false }))
      .catch(() => !off && setState({ id, items: null, error: true }));
    return () => {
      off = true;
    };
  }, [id]);
  const cur = state?.id === id ? state : null;
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.location.hash === "#inquiries") root.current?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <div id="inquiries" ref={root} className="scroll-mt-4">
      <h2 className="mb-1 flex items-center text-[15px] font-bold text-fg">
        Inquiries <span className="ml-auto text-secondary font-semibold text-muted">{cur?.items?.length ?? ""}</span>
      </h2>
      {!cur ? (
        <UserRowsSkeleton count={2} />
      ) : cur.error ? (
        <p className="py-6 text-center text-sm text-muted">Couldn&apos;t load inquiries</p>
      ) : cur.items!.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No inquiries yet</p>
      ) : (
        cur.items!.map((q) => (
          <div key={q.id} className="flex items-start gap-3 py-2.5">
            <Link href={q.buyer?.username ? `/u/${q.buyer.username}` : "#"}>
              <ProfileHoverCard username={q.buyer?.username}><Avatar url={q.buyer?.avatar} name={q.buyer?.name ?? q.buyer?.username} size={40} /></ProfileHoverCard>
            </Link>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-bold text-fg">
                <span className="truncate">{q.buyer?.username ?? q.buyer?.name}</span>
                <span className="text-micro font-bold uppercase tracking-wide text-muted">{q.status}</span>
              </p>
              {q.message?.trim() && <p className="mt-0.5 line-clamp-2 text-secondary text-muted">{q.message}</p>}
            </div>
            <span className="text-xs text-muted">{timeAgo(/(Z|[+-]\d\d(:?\d\d)?)$/i.test(q.created_at) ? q.created_at : `${q.created_at}Z`)}</span>
            {q.conversation_id && (
              <Link href={`/messages/${q.conversation_id}`} className="rounded-full bg-surface-interactive px-3 py-1 text-xs font-bold text-fg">
                Chat
              </Link>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export function ListingView({ id, initial }: { id: string; initial?: ListingFull | null }) {
  const router = useRouter();
  const { status, user } = useAuth();
  const openShare = useShare();
  const authed = status === "authed";
  const n = Number(id);
  const valid = Number.isInteger(n) && n > 0;
  const [data, setData] = useState<Data | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [override, setOverride] = useState<{ id: string; status?: ListingStatus; inquired?: boolean; conv?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!authed || !valid) return;
    const ac = new AbortController();
    listingApi
      .show(n, ac.signal)
      .then((listing) => !ac.signal.aborted && setData({ id, listing, status: 200 }))
      .catch((e: unknown) => !ac.signal.aborted && setData({ id, listing: null, status: e instanceof ApiError ? e.status : 0 }));
    return () => ac.abort();
  }, [authed, valid, n, id]);

  function flash(m: string) {
    setToast(m);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  // Signed in: marketplace-show (viewer flags). Everyone else: the public copy the server fetched for this page.
  // initial: ListingFull = public listing, null = not available / not public, undefined = could not load.
  const publicData: Data | null =
    initial !== undefined
      ? { id, listing: initial, status: initial ? 200 : 404 }
      : status === "guest"
        ? { id, listing: null, status: 0 }
        : null;
  const cur = authed ? (data && data.id === id ? data : null) : publicData;
  const ov = override && override.id === id ? override : null;

  // Used by the loading and error states only; the loaded screen has its own header row.
  const back = (
    <button
      type="button"
      aria-label="Back"
      onClick={() => (window.history.length > 1 ? router.back() : router.replace("/"))}
      className="absolute left-3 z-10 grid size-9 place-items-center rounded-full bg-black/55 text-white"
      style={{ top: "calc(12px + env(safe-area-inset-top))" }}
    >
      <Icon name="back" className="size-[18px]" />
    </button>
  );

  if (!valid || cur?.status === 404) return <Msg back={back} title="This listing isn't available" sub="It may have been removed or sold out of the marketplace." />;
  if (cur && !cur.listing) return <Msg back={back} title="Couldn't load this listing" sub="Check your connection and try again." />;
  if (!cur?.listing) return <ListingSkeleton back={back} />;

  const l = cur.listing;
  const d = l.listing;
  const type = l.listing_type ?? "product";
  const isOwn = !!user?.username && user.username === l.author?.username;
  const curStatus = (ov?.status ?? d?.status ?? "available") as ListingStatus;
  const inquired = ov?.inquired ?? (l.has_inquired === true || d?.has_inquired === true);
  const convId = ov?.conv ?? null;
  const images = [...l.media]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .filter((m) => IMAGE.has((m.type ?? "").toLowerCase()) && m.url)
    .map((m) => m.url!);
  if (images.length === 0 && l.thumbnail_url) images.push(l.thumbnail_url);

  const accepting = d?.accepting_orders == null ? curStatus === "available" : d.accepting_orders;
  const hours = d?.opening_hours ?? null;
  const open = hours ? openNow(hours) : false;
  const enabled = curStatus === "available" || inquired;
  const negotiable = d?.price_type === "negotiable";
  const canOffer = !isOwn && !inquired && curStatus === "available" && negotiable && (type === "product" || type === "rental");

  const cta = inquired
    ? "View conversation"
    : type === "business"
      ? accepting ? "Order now" : "View menu"
      : type === "service" ? "Book / contact"
      : type === "wanted" ? "Offer item"
      : curStatus === "available" ? "Chat with seller" : "Not available";

  async function sendInquiry(message = "Hi, I'm interested in your listing!") {
    if (busy) return;
    if (!authed) {
      openAuth();
      return;
    }
    if (inquired) {
      if (convId) router.push(`/messages/${convId}`);
      return;
    }
    setBusy(true);
    try {
      const r = await listingApi.inquire(n, message);
      setOverride({ id, status: ov?.status, inquired: true, conv: r.conversation_id });
      setOfferOpen(false);
      flash("Sent. The seller has been notified.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setOverride({ id, status: ov?.status, inquired: true });
        setOfferOpen(false);
      } else flash(e instanceof ApiError ? e.message : "Couldn't send");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(s: ListingStatus) {
    if (busy || s === curStatus) return;
    setBusy(true);
    try {
      await listingApi.setStatus(n, s);
      setOverride({ id, status: s, inquired: ov?.inquired, conv: ov?.conv });
      flash(`Listing marked as ${s.toUpperCase()}`);
    } catch (e) {
      flash(e instanceof ApiError ? e.message : "Couldn't update status");
    } finally {
      setBusy(false);
    }
  }

  function share() {
    openShare(l as unknown as Post);
  }

  const caption = (l.caption ?? "").trim();
  const sellerLabel = type === "business" ? "Vendor" : type === "service" ? "Provider" : type === "wanted" ? "Buyer" : "Seller";
  const conditionLabel = d?.condition ? (COND[d.condition] ?? null) : null;
  const imageBadge = conditionLabel ?? (type === "rental" ? "For Rent" : null);

  // Product and rental: first line of the caption is the title, anything after it is the description.
  const nl = caption.indexOf("\n");
  const title = nl === -1 ? caption : caption.slice(0, nl).trim();
  const desc = nl === -1 ? "" : caption.slice(nl + 1).trim();
  const longDesc = desc.length > 150;
  const tags = (l.hashtags ?? []).slice(0, 6);

  const views = l.views_count || d?.views_count || 0;
  const place = d?.location_info ? formatCompactLocation(d.location_info) : d?.pickup_info || l.location || "";
  const ago = timeAgo(l.created_at);
  const meta: { icon: "tag" | "pointOnMap"; text: string }[] | null = null;
  void meta;

  return (
    <div className="mx-auto w-full max-w-[720px] pb-4">
      <div className="flex items-center gap-3 px-4 pb-3" style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}>
        <button
          type="button"
          aria-label="Back"
          onClick={() => (window.history.length > 1 ? router.back() : router.replace("/"))}
          className="grid size-10 place-items-center text-fg"
        >
          <Icon name="back" className="size-[26px]" />
        </button>
        <span className="min-w-0 flex-1 truncate text-[18px] font-medium text-fg/90">{TYPE_LABEL[type] ?? "Listing"}</span>
        <button type="button" aria-label="Share" onClick={() => void share()} className="grid size-10 place-items-center text-fg">
          <Icon name="share" className="size-[24px]" />
        </button>
        <HeartButton post={l as unknown as Post} />
      </div>

      <Gallery urls={images} badge={imageBadge} onOpen={setLightbox} />

      <div className="px-5 pt-5">
        {/* Header, adapted by listing type (same split as _ListingHeader) */}
        {type === "business" ? (
          <>
            <h1 className="flex items-center gap-2 text-[23px] font-bold tracking-tight text-fg">
              {d?.business_name ?? caption}
              {d?.verification_status === "verified" && <Icon name="check" className="size-5 text-brand" />}
            </h1>
            {(d?.business_description || caption) && <p className="mt-2 text-sm leading-[1.55] text-muted">{d?.business_description ?? caption}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {hours && <Badge color={open ? "#00e676" : "#ff5c5c"}>{open ? "Open now" : "Closed"}</Badge>}
              {accepting && <Badge color="#a1a1aa">Accepting orders</Badge>}
              {d?.delivery_available && <Badge color="#a1a1aa">Delivery available</Badge>}
              {d?.estimated_delivery != null && <Badge>{eta(d.estimated_delivery)}</Badge>}
            </div>
            {d && <div className="mt-4"><Price d={d} size={20} prefix="Starting from " /></div>}
          </>
        ) : type === "service" ? (
          <>
            <h1 className="text-[23px] font-bold tracking-tight text-fg">{caption}</h1>
            <p className="mt-1.5 text-sm text-muted">by {l.author?.name ?? l.author?.username}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {d?.service_radius_km != null && <Badge color="#a1a1aa">{d.service_radius_km}km radius</Badge>}
              {d?.fulfillment_type && <Badge>{FULFIL[d.fulfillment_type] ?? d.fulfillment_type}</Badge>}
              {d?.verification_status === "verified" && <Badge color="#ffb340">Verified</Badge>}
            </div>
            {d && <div className="mt-4"><Price d={d} size={22} prefix="From " /></div>}
          </>
        ) : type === "wanted" ? (
          <>
            <span className="inline-block rounded-lg bg-brand/15 px-2.5 py-1 text-supporting font-bold tracking-wide text-brand">LOOKING FOR</span>
            <p className="mt-3.5 text-lg leading-[1.55] text-fg">{caption}</p>
            {d && <div className="mt-3.5"><Price d={d} size={22} prefix="Budget: " /></div>}
          </>
        ) : (
          <>
            {title && <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-tight text-fg">{title}</h1>}
            {d && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-[30px] font-extrabold leading-none tracking-tight text-brand">₦{d.formatted_price}</span>
                {negotiable && (
                  <span className="rounded-full bg-surface-interactive px-3 py-1 text-[14px] font-bold text-fg/85">Negotiable</span>
                )}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[15px] text-muted">
              {conditionLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="tag" className="size-[18px]" />
                  {conditionLabel}
                </span>
              )}
              {place && (
                <>
                  {conditionLabel && <span aria-hidden>•</span>}
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Icon name={d?.location_info?.campus ? "mapPointSchool" : "pointOnMap"} className="size-[18px] shrink-0" />
                    <span className="truncate">{place}</span>
                  </span>
                </>
              )}
              {ago && (
                <>
                  <span aria-hidden>•</span>
                  <span>{ago === "now" ? "just now" : `${ago} ago`}</span>
                </>
              )}
              {views > 0 && (
                <>
                  <span aria-hidden>•</span>
                  <span>{formatCount(views)} views</span>
                </>
              )}
            </div>
            {curStatus !== "available" && (
              <div className="mt-3">
                <Badge color={curStatus === "sold" ? "#ff5c5c" : "#ffb340"}>{curStatus.toUpperCase()}</Badge>
              </div>
            )}
          </>
        )}

        <div className="my-5" />

        <Link href={isOwn ? "/me" : `/u/${l.author?.username ?? ""}`} className="flex items-center gap-3 rounded-card border border-fg/[0.07] bg-card p-4">
          <ProfileHoverCard username={l.author?.username}><Avatar url={l.author?.avatar} name={l.author?.name ?? l.author?.username} size={50} /></ProfileHoverCard>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-bold text-fg">{l.author?.name ?? l.author?.username}</span>
            <span className="block truncate text-secondary text-muted">@{l.author?.username} · {sellerLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[15px] font-bold text-brand">
            {isOwn ? "My profile" : "View Profile"}
            <Icon name="chevronRight" className="size-4" />
          </span>
        </Link>

        {(type === "product" || type === "rental") && desc && (
          <div className="mt-6">
            <h2 className="mb-1.5 text-[18px] font-bold text-fg">Description</h2>
            <p className={`whitespace-pre-wrap text-[16px] leading-[1.5] text-fg/70 ${descOpen ? "" : "line-clamp-3"}`}>
              {desc}
            </p>
            {longDesc && (
              <button type="button" onClick={() => setDescOpen((o) => !o)} className="mt-1 text-[15px] font-semibold text-brand underline underline-offset-2">
                {descOpen ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {(type === "product" || type === "rental") && tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="rounded-xl bg-surface-interactive px-3.5 py-2 text-[14px] font-medium text-fg/85">
                {t.replace(/^#/, "")}
              </span>
            ))}
          </div>
        )}

        {isOwn && (
          <>
            <div className="my-5" />
            <StatusControl current={curStatus} busy={busy} onChange={(s) => void changeStatus(s)} />
            <div className="my-5" />
            <Inquiries id={n} />
          </>
        )}

        {d && (
          <>
            <div className="my-5" />
            <h2 className="mb-1 text-[15px] font-bold text-fg">Details</h2>
            <div>
              {(d.location_info || d.pickup_info) && (
                <div className="flex items-center justify-between gap-4 py-2.5 text-secondary">
                  <span className="text-muted flex items-center gap-1.5">
                    <Icon
                      name={d.location_info?.campus ? "mapPointSchool" : "pointOnMap"}
                      className="size-4 text-brand shrink-0"
                    />
                    <span>Location</span>
                  </span>
                  <span className="text-right font-medium text-fg">
                    {d.location_info ? formatFullLocation(d.location_info) : d.pickup_info}
                  </span>
                </div>
              )}
              {d.contact_phone && ["whatsapp", "call", "any"].includes(d.contact_preference ?? "") && <Row label="Phone" value={d.contact_phone} />}
              <Row label="Contact" value={(d.contact_preference ?? "chat").replaceAll("_", " ").toUpperCase()} />
              {d.inquiries_count != null && <Row label="Inquiries" value={`${d.inquiries_count} interested`} />}
              {(type === "product" || type === "rental") && <Row label="Quantity" value={`${d.quantity ?? 1} available`} />}
              {type === "rental" && d.fulfillment_type && <Row label="Arrangement" value={FULFIL[d.fulfillment_type] ?? d.fulfillment_type} />}
              {type === "business" && (
                <>
                  {d.fulfillment_type && <Row label="Fulfillment" value={FULFIL[d.fulfillment_type] ?? d.fulfillment_type} />}
                  {d.minimum_order_price != null && <Row label="Min order" value={`₦${Math.round(d.minimum_order_price / 100).toLocaleString()}`} />}
                  {d.estimated_delivery != null && <Row label="Est. delivery" value={eta(d.estimated_delivery)} />}
                  {d.service_radius_km != null && <Row label="Delivery radius" value={`${d.service_radius_km} km`} />}
                </>
              )}
              {type === "service" && (
                <>
                  {d.service_radius_km != null && <Row label="Service radius" value={`${d.service_radius_km} km`} />}
                  {d.fulfillment_type && <Row label="How" value={FULFIL[d.fulfillment_type] ?? d.fulfillment_type} />}
                </>
              )}
            </div>
            {hours && (type === "business" || type === "service") && (
              <div className="mt-1">
                <button type="button" onClick={() => setHoursOpen((o) => !o)} className="flex w-full items-center justify-between py-2.5 text-secondary">
                  <span className="text-muted">Hours</span>
                  <span className={`flex items-center gap-1.5 font-semibold ${open ? "text-success" : "text-danger"}`}>
                    {open ? "Open now" : "Closed now"}
                    <Icon name="chevronDown" className={`size-4 text-muted ${hoursOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {hoursOpen && (
                  <div className="pb-2 text-xs">
                    {DAYS.map(([k, label]) => {
                      const h = hours[k];
                      if (!h) return null;
                      return (
                        <div key={k} className="flex py-1">
                          <span className="w-28 text-muted">{label}</span>
                          <span className={h.closed ? "text-muted" : "text-fg"}>{h.closed ? "Closed" : `${h.open} – ${h.close}`}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {authed ? <SimilarListings key={n} excludeId={n} type={type} /> : <MoreLikeThis key={n} excludeId={n} type={type} />}

      {!isOwn && (
        <div
          className="sticky z-30 mt-6 flex gap-3 border-t border-fg/[0.06] bg-bg/95 px-5 py-3.5 backdrop-blur"
          style={{ bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom))" }}
        >
          {canOffer && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setOfferOpen(true)}
              className="h-[54px] flex-1 rounded-full border-2 border-brand/70 text-[16px] font-extrabold text-brand transition active:scale-[0.98] disabled:opacity-60"
            >
              Make an offer
            </button>
          )}
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={() => void sendInquiry()}
            className={`h-[54px] flex-1 rounded-full text-[16px] font-extrabold transition active:scale-[0.98] disabled:opacity-60 ${
              !enabled ? "bg-card-elevated text-muted" : inquired ? "bg-card-elevated text-fg" : "bg-brand text-brand-fg"
            }`}
          >
            {busy ? "…" : cta}
          </button>
        </div>
      )}

      {offerOpen && d && (
        <OfferSheet
          asking={d.formatted_price}
          busy={busy}
          onClose={() => setOfferOpen(false)}
          onSend={(amount) => void sendInquiry(`Hi, I'd like to offer ₦${amount.toLocaleString("en-NG")} for this listing. Is that okay?`)}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center">
          <span className="rounded-full bg-black/80 px-3 py-1.5 text-xs font-semibold text-white">{toast}</span>
        </div>
      )}
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function Msg({ back, title, sub }: { back: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="relative grid min-h-[70dvh] place-items-center px-6 text-center">
      {back}
      <div>
        <p className="text-[17px] font-bold text-fg">{title}</p>
        <p className="mt-1.5 text-secondary text-muted">{sub}</p>
      </div>
    </div>
  );
}
