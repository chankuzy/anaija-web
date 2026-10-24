"use client";
import { ProfileHoverCard } from "@/components/profile/profile-hover-card";
import { ListingSkeleton, UserRowsSkeleton } from "@/components/ui/skeleton";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Lightbox } from "@/components/ui/lightbox";
import { ApiError } from "@/lib/api/client";
import { listingApi, type DayHours, type Inquiry, type ListingFull, type ListingStatus } from "@/lib/api/listing";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/next";
import { useShare } from "@/lib/share/share-context";
import type { Post } from "@/lib/api/feed-types";
import { timeAgo } from "@/lib/format";

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
        <span className="ml-1 rounded-full bg-brand/15 px-2 py-0.5 font-bold text-brand" style={{ fontSize: size * 0.5 }}>Nego</span>
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

function Gallery({ urls, onOpen }: { urls: string[]; onOpen: (u: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  if (urls.length === 0) {
    return <div className="grid h-[320px] place-items-center bg-card text-muted md:h-[420px]">No photos</div>;
  }
  return (
    <div className="relative bg-card">
      <div
        ref={ref}
        onScroll={() => {
          const el = ref.current;
          if (el?.clientWidth) setIdx(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar flex h-[360px] snap-x snap-mandatory overflow-x-auto md:h-[460px]"
      >
        {urls.map((u) => (
          <button key={u} type="button" onClick={() => onOpen(u)} className="h-full w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" decoding="async" className="size-full object-contain" />
          </button>
        ))}
      </div>
      {urls.length > 1 && (
        <span className="absolute bottom-3 right-3 rounded-[10px] bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
          {idx + 1} / {urls.length}
        </span>
      )}
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

  const cta = inquired
    ? "View conversation"
    : type === "business"
      ? accepting ? "Order now" : "View menu"
      : type === "service" ? "Book / contact"
      : type === "wanted" ? "Offer item"
      : curStatus === "available" ? "I'm interested" : "Not available";

  async function sendInquiry() {
    if (busy) return;
    if (!authed) {
      router.push(loginHref());
      return;
    }
    if (inquired) {
      if (convId) router.push(`/messages/${convId}`);
      return;
    }
    setBusy(true);
    try {
      const r = await listingApi.inquire(n, "Hi, I'm interested in your listing!");
      setOverride({ id, status: ov?.status, inquired: true, conv: r.conversation_id });
      flash("Inquiry sent. The seller has been notified.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setOverride({ id, status: ov?.status, inquired: true });
      else flash(e instanceof ApiError ? e.message : "Couldn't send inquiry");
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

  return (
    <div className="mx-auto w-full max-w-[720px] pb-4">
      <div className="relative">
        {back}
        <button
          type="button"
          aria-label="Share"
          onClick={() => void share()}
          className="absolute right-3 z-10 grid size-9 place-items-center rounded-full bg-black/55 text-white"
          style={{ top: "calc(12px + env(safe-area-inset-top))" }}
        >
          <Icon name="share" className="size-[18px]" />
        </button>
        <Gallery urls={images} onOpen={setLightbox} />
      </div>

      <div className="-mt-5 rounded-t-image bg-bg px-5 pt-5 md:mt-0 md:rounded-none">
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
            {d && <Price d={d} size={30} />}
            {caption && <p className="mt-3.5 whitespace-pre-wrap text-base leading-[1.55] text-fg">{caption}</p>}
            <div className="mt-3.5 flex flex-wrap gap-2">
              {d?.condition && <Badge color="#a1a1aa">{COND[d.condition] ?? "Used"}</Badge>}
              {curStatus !== "available" && <Badge color={curStatus === "sold" ? "#ff5c5c" : "#ffb340"}>{curStatus.toUpperCase()}</Badge>}
              {type === "rental" && <Badge color="#a1a1aa">RENTAL</Badge>}
            </div>
          </>
        )}

        <div className="my-5" />

        <Link href={isOwn ? "/me" : `/u/${l.author?.username ?? ""}`} className="flex items-center gap-3 rounded-card bg-card p-4">
          <ProfileHoverCard username={l.author?.username}><Avatar url={l.author?.avatar} name={l.author?.name ?? l.author?.username} size={46} /></ProfileHoverCard>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold text-fg">{l.author?.name ?? l.author?.username}</span>
            <span className="block truncate text-secondary text-muted">@{l.author?.username} · {sellerLabel}</span>
          </span>
          <span className="text-xs text-muted">{timeAgo(l.created_at)}</span>
          <Icon name="chevronRight" className="size-4 text-muted" />
        </Link>

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
              {d.pickup_info && <Row label="Location" value={d.pickup_info} />}
              {d.contact_phone && ["whatsapp", "call", "any"].includes(d.contact_preference ?? "") && <Row label="Phone" value={d.contact_phone} />}
              <Row label="Contact" value={(d.contact_preference ?? "chat").replaceAll("_", " ").toUpperCase()} />
              {(d.views_count ?? 0) > 0 && <Row label="Views" value={String(d.views_count)} />}
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

      {!isOwn && (
        <div
          className="sticky z-30 mt-6 bg-bg/95 px-5 py-3.5"
          style={{ bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={() => void sendInquiry()}
            className={`h-[52px] w-full rounded-full text-[15px] font-extrabold transition disabled:opacity-60 ${
              !enabled ? "bg-card-elevated text-muted" : inquired ? "bg-card-elevated text-white" : "bg-brand text-brand-fg"
            }`}
          >
            {busy ? "…" : cta}
          </button>
        </div>
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
