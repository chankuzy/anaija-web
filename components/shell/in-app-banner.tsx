/* eslint-disable @next/next/no-img-element */
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { resolveTarget } from "@/lib/activity/route";
import { activityApi } from "@/lib/api/activity";
import { useAuth } from "@/lib/auth/auth-context";
import { onBanner, type Banner } from "@/lib/notifications/banner-bus";
import { useNotificationsPanel } from "@/lib/notifications/panel-context";
import { PANEL_URL } from "@/lib/push/route";
import { readPushState } from "@/lib/push/web-push";

const SHARE = { icon: "message" as IconName, color: "#14B8A6" };
const GLYPH: Record<string, { icon: IconName; color: string }> = {
  like: { icon: "heart", color: "#E11D48" },
  story_like: { icon: "heart", color: "#E11D48" },
  milestone: { icon: "heart", color: "#E11D48" },
  comment: { icon: "message", color: "#2563EB" },
  reply: { icon: "message", color: "#2563EB" },
  mention: { icon: "message", color: "#2563EB" },
  story_reply: { icon: "message", color: "#2563EB" },
  message: { icon: "message", color: "#14B8A6" },
  follow: { icon: "userPlus", color: "#7C3AED" },
  follow_back: { icon: "userPlus", color: "#7C3AED" },
  repost: { icon: "repeat", color: "#16A34A" },
  post_new: { icon: "plus", color: "#7C3AED" },
  inquiry: { icon: "bag", color: "#C026D3" },
  reel: SHARE,
  post: SHARE,
  listing: SHARE,
  story: SHARE,
};
const FALLBACK = { icon: "bell" as IconName, color: "#71717A" };

type Live = Banner & { seq: number; more: number };

/** The one transient in-app notification surface: slides in from the top, swipe up or wait to dismiss. */
export function InAppBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user } = useAuth();
  const { open: panelOpen, show: showPanel } = useNotificationsPanel();

  const [cur, setCur] = useState<Live | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);

  const seq = useRef(0);
  const curRef = useRef<Live | null>(null);
  const gate = useRef({ pathname, status, panelOpen });
  const press = useRef<{ y: number; id: number } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    gate.current = { pathname, status, panelOpen };
  });
  useEffect(() => {
    curRef.current = cur;
  });

  useEffect(() => {
    return onBanner((b) => {
      const g = gate.current;
      if (g.status !== "authed" || g.pathname === "/login" || g.pathname === "/setup") return;
      const chat = b.chat === true || b.conv !== undefined;
      if (chat && g.pathname.startsWith("/messages")) return; // you are already looking at your chats
      if (!chat && g.panelOpen) return; // the activity panel is open
      // Inbox/activity diffs only stand in when this device has no push; with push the service worker is the source.
      if (b.source === "poll" && (document.visibilityState !== "visible" || readPushState() === "on")) return;
      const prev = curRef.current;
      const same = !!prev && prev.key === b.key;
      seq.current += 1;
      setLeaving(false);
      setPaused(false);
      setDrag(0);
      setCur({ ...b, seq: seq.current, more: same && prev ? prev.more : prev ? prev.more + 1 : 0 });
    });
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      setCur(null);
      setLeaving(false);
      setDrag(0);
    }, 190);
    return () => window.clearTimeout(t);
  }, [leaving]);

  const dismiss = useCallback(() => setLeaving(true), []);

  function go() {
    const b = cur;
    if (!b || moved.current) return;
    setLeaving(true);
    if (b.source === "push") {
      const href = b.href || PANEL_URL;
      if (href === PANEL_URL) showPanel();
      else router.push(href);
      return;
    }
    if (b.act && b.act.id > 0 && !b.act.is_read) void activityApi.read(b.act.id).catch(() => {});
    if (b.conv) {
      router.push(`/messages/${b.conv}`);
      return;
    }
    if (b.act) {
      const t = resolveTarget(b.act, b.act.destination, user?.username);
      if (t.type === "url") {
        router.push(t.url);
        return;
      }
      if (t.type === "conversation") {
        router.push(`/messages/${t.id}`);
        return;
      }
    }
    showPanel(); // grouped likes, stories and the rest live in the activity panel
  }

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    press.current = { y: e.clientY, id: e.pointerId };
    moved.current = false;
    setPaused(true);
  };
  const onMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p) return;
    const dy = e.clientY - p.y;
    if (!moved.current && Math.abs(dy) > 6) {
      moved.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(p.id);
    }
    if (moved.current) setDrag(Math.min(0, dy));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!press.current) return;
    press.current = null;
    setDragging(false);
    setPaused(e.pointerType === "mouse");
    if (drag < -36) setLeaving(true);
    else setDrag(0);
  };

  if (!cur) return null;
  const g = GLYPH[cur.kind ?? ""] ?? FALLBACK;
  const first = cur.title.split(" ")[0] || "A";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-3 md:inset-x-auto md:right-6 md:justify-end md:px-0"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={cur.title}
        onClick={go}
        onKeyDown={(e) => e.key === "Enter" && go()}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => !press.current && setPaused(false)}
        className={`anaija-banner group pointer-events-auto relative w-full max-w-[420px] cursor-pointer touch-none select-none overflow-hidden rounded-floating bg-surface-subtle/90 backdrop-blur-xl ${
          leaving ? "anaija-banner-out" : ""
        }`}
        style={{
          transform: drag ? `translateY(${drag}px)` : undefined,
          opacity: drag ? Math.max(0.3, 1 + drag / 140) : undefined,
          transition: dragging ? "none" : "transform 160ms ease, opacity 160ms ease",
        }}
      >
        <div className="flex items-center gap-3 px-3.5 pb-3.5 pt-3">
          <span className="relative shrink-0">
            <Avatar url={cur.avatar ?? null} name={first} size={46} />
            <span
              className="absolute -bottom-1 -right-1 grid size-[20px] place-items-center rounded-full text-white ring-2 ring-surface-subtle"
              style={{ background: g.color }}
            >
              <Icon name={g.icon} filled className="size-[11px]" />
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-[14.5px] font-bold leading-[1.25] text-fg">{cur.title}</span>
            {cur.body && <span className="mt-0.5 line-clamp-2 block text-[13px] leading-[1.3] text-white/65">{cur.body}</span>}
            {cur.more > 0 && <span className="mt-1 block text-micro font-bold text-brand">+{cur.more} more</span>}
          </span>

          {cur.image && (
            <span className="relative shrink-0">
              <img src={cur.image} alt="" className="size-[52px] rounded-[14px] object-cover" />
              {cur.video && (
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-6 place-items-center rounded-full bg-black/55 text-white">
                    <svg viewBox="0 0 24 24" className="size-3 translate-x-[0.5px]" fill="currentColor" aria-hidden="true">
                      <path d="M8 5.5v13l11-6.5z" />
                    </svg>
                  </span>
                </span>
              )}
            </span>
          )}
        </div>

        <button
          type="button"
          data-no-drag
          aria-label="Dismiss"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="absolute right-1.5 top-1.5 hidden size-6 place-items-center rounded-full bg-bg/70 text-muted opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 md:grid"
        >
          <Icon name="close" className="size-3" />
        </button>

        <span
          key={cur.seq}
          className="anaija-banner-bar absolute inset-x-0 bottom-0 h-[3px] origin-left bg-brand/70"
          style={{ animationPlayState: paused ? "paused" : "running" }}
          onAnimationEnd={dismiss}
        />
      </div>
    </div>
  );
}
