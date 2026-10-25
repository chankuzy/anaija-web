/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePlayback } from "@/components/feed/playback-context";
import { Avatar } from "@/components/ui/avatar";
import { AppLogo } from "@/components/ui/app-logo";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { postsApi } from "@/lib/api/posts";
import { coverOfGroup, storiesApi, type StoryGroup, type StoryItem } from "@/lib/api/stories";
import { timeAgo } from "@/lib/format";
import { RingFrame } from "./ring-avatar";
import { FrameSlides, SourceFrame, frameCaption, sourceHref, type FrameHold } from "./story-source-frame";

const IMAGE_MS = 5000;
const REACTIONS = ["❤️", "🔥", "😂", "😮", "😢", "👏"];
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");
const startOf = (g: StoryGroup | undefined) => Math.max(0, (g?.stories ?? []).findIndex((s) => !s.seen));
const fade = (hidden: boolean) => `transition-opacity duration-200 ${hidden ? "opacity-0" : ""}`;

type Like = { liked: boolean; count: number };

function HeaderBtn({
  label,
  onClick,
  className = "",
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-full text-white transition-[background,transform] hover:bg-white/15 active:scale-90 ${className}`}
    >
      {children}
    </button>
  );
}

// Static face of a group: what the neighbouring cards show, and what the live slide fades in over.
function Cover({ group }: { group: StoryGroup }) {
  const { url, color } = coverOfGroup(group);
  const s = group.stories.find((x) => !x.seen) ?? group.stories[0];
  return (
    <>
      <div className="sv-cover absolute inset-0" style={{ backgroundColor: color ?? "#101012" }}>
        {url && <img src={url} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />}
      </div>
      <div className="sv-dim absolute inset-0" />
      <div className="sv-meta pointer-events-none absolute inset-0 grid place-items-center">
        <div className="sv-meta-inner flex flex-col items-center gap-1.5 text-center">
          <RingFrame size={64} ring={group.has_unseen}>
            <Avatar url={group.author.avatar} name={group.author.name} size={64} />
          </RingFrame>
          <span className="max-w-[120px] truncate text-[14px] font-semibold text-white">
            {group.author.name || group.author.username}
          </span>
          {s && <span className="text-[14px] text-white/90">{timeAgo(s.created_at)}</span>}
        </div>
      </div>
    </>
  );
}

function Slide({
  group,
  story,
  index,
  halted,
  chromeHidden,
  manualPause,
  onTogglePause,
  onCreate,
  onClose,
  onDone,
  hold,
  onCardTap,
}: {
  group: StoryGroup;
  story: StoryItem;
  index: number;
  halted: boolean;
  chromeHidden: boolean;
  manualPause: boolean;
  onTogglePause: () => void;
  onCreate: () => void;
  onClose: () => void;
  onDone: () => void;
  hold: FrameHold;
  onCardTap: () => void;
}) {
  const m = story.media[0];
  const isVideo = m?.type === "video";
  const url = isVideo ? m?.url : (m?.url ?? m?.thumbnail);
  const backdrop = isVideo ? m?.thumbnail : url;
  const vref = useRef<HTMLVideoElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const { muted, toggleMute, forceMute } = usePlayback();
  // Images only start their timer once they are on screen, like Instagram.
  const [ready, setReady] = useState(!url || isVideo);
  // 9:16-ish media fills the card; anything wider sits centred over a blurred copy of itself.
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const judge = (w: number, h: number) => {
    if (w > 0 && h > 0) setFit(w / h <= 0.66 ? "cover" : "contain");
  };
  const bg = m?.dominant_color ? `#${m.dominant_color.replace("#", "")}` : "#0a0a0a";
  const fitClass = fit === "cover" ? "object-cover" : "object-contain";

  // A story made from a post ("add to story") is drawn as the post's frame, like the Flutter app.
  const router = useRouter();
  const source = m?.type === "audio" ? null : (story.source ?? null);
  const framed = source !== null;
  const frameImages = (source?.media ?? []).filter((x) => x.type !== "video" && x.type !== "audio" && !!x.url);
  const slides = framed && !isVideo && frameImages.length > 1 && !!source?.slideshow.enabled;
  const slideMs = source?.slideshow.interval_ms ?? 2800;
  const durationMs = slides ? Math.min(20000, Math.max(5000, frameImages.length * slideMs)) : IMAGE_MS;
  const [measured, setMeasured] = useState<number | null>(null);
  const frameRatio = Math.min(1.5, Math.max(0.6, m?.aspect_ratio ?? frameImages[0]?.aspect_ratio ?? measured ?? 0.8));
  const openSource = () => {
    if (!source) return;
    const href = sourceHref(source);
    onClose();
    router.push(href);
  };
  const content =
    source === null ? null : isVideo && url ? (
      <video
        ref={vref}
        src={url}
        muted
        playsInline
        preload="auto"
        onEnded={onDone}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth > 0 && v.videoHeight > 0) setMeasured(v.videoWidth / v.videoHeight);
        }}
        className="absolute inset-0 size-full object-cover"
      />
    ) : slides ? (
      <FrameSlides
        urls={frameImages.map((x) => x.url as string)}
        intervalMs={slideMs}
        active={!halted && ready}
        onReady={(r) => {
          if (r) setMeasured(r);
          setReady(true);
        }}
      />
    ) : (
      <img
        src={frameImages[0]?.url ?? url ?? undefined}
        alt=""
        decoding="async"
        draggable={false}
        onLoad={(e) => {
          const i = e.currentTarget;
          if (i.naturalHeight > 0) setMeasured(i.naturalWidth / i.naturalHeight);
          setReady(true);
        }}
        onError={() => setReady(true)}
        className="absolute inset-0 size-full object-cover"
      />
    );

  useEffect(() => {
    const el = vref.current;
    if (el) el.muted = muted;
  }, [muted]);

  useEffect(() => {
    const el = vref.current;
    if (!el) return;
    if (halted) {
      el.pause();
      return;
    }
    const p = el.play();
    if (p)
      p.catch((err: unknown) => {
        if ((err as DOMException)?.name !== "NotAllowedError" || el.muted) return;
        el.muted = true;
        forceMute();
        el.play().catch(() => {});
      });
    return () => el.pause();
  }, [halted, forceMute]);

  // Video progress follows the real playhead (buffering, pauses, seeks) instead of a guessed timer.
  useEffect(() => {
    if (!isVideo) return;
    const el = vref.current;
    const bar = fillRef.current;
    if (!el || !bar) return;
    let raf = 0;
    const tick = () => {
      const d = el.duration;
      bar.style.transform = `scaleX(${d > 0 && Number.isFinite(d) ? Math.min(1, el.currentTime / d) : 0})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isVideo]);

  return (
    <>
      <div className="sv-in absolute inset-0 overflow-hidden" style={{ backgroundColor: bg }}>
        {backdrop && (fit === "contain" || framed) && (
          <img
            src={backdrop}
            alt=""
            aria-hidden="true"
            decoding="async"
            draggable={false}
            className="absolute inset-0 size-full scale-125 object-cover opacity-80 blur-[36px]"
          />
        )}
        {framed ? (
          <div className="absolute inset-0 bg-black/60" />
        ) : isVideo && url ? (
          <video
            ref={vref}
            src={url}
            muted
            playsInline
            preload="auto"
            onEnded={onDone}
            onLoadedMetadata={(e) => judge(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
            className={`absolute inset-0 size-full ${fitClass}`}
          />
        ) : url ? (
          <img
            src={url}
            alt=""
            decoding="async"
            draggable={false}
            onLoad={(e) => {
              judge(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
              setReady(true);
            }}
            onError={() => setReady(true)}
            className={`absolute inset-0 size-full ${fitClass}`}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <p className="px-8 text-center text-xl font-semibold text-fg">{story.caption}</p>
          </div>
        )}
      </div>
      {framed && source && (
        <SourceFrame
          ratio={frameRatio}
          src={source}
          caption={frameCaption(story.caption, source)}
          multi={frameImages.length > 1}
          tip={manualPause}
          hold={hold}
          onTap={onCardTap}
          onOpen={openSource}
        >
          {content}
        </SourceFrame>
      )}
      <div className={`sv-shade-top pointer-events-none absolute inset-x-0 top-0 h-28 ${fade(chromeHidden)}`} />
      <div className={`sv-shade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-36 ${fade(chromeHidden)}`} />
      {story.caption && url && !framed && (
        <p className="text-shadow pointer-events-none absolute inset-x-4 bottom-[84px] text-body text-white">{story.caption}</p>
      )}

      <div
        className={`pointer-events-none absolute inset-x-4 z-10 flex gap-[3px] ${fade(chromeHidden)}`}
        style={{ top: "calc(20px + env(safe-area-inset-top))" }}
      >
        {Array.from({ length: group.stories.length }, (_, i) => (
          <div key={i} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/35">
            {i < index && <div className="h-full w-full bg-white" />}
            {i === index &&
              (isVideo ? (
                <div ref={fillRef} className="h-full origin-left bg-white" style={{ transform: "scaleX(0)" }} />
              ) : (
                <div
                  className="sv-fill h-full bg-white"
                  style={{ animationDuration: `${durationMs}ms`, animationPlayState: halted || !ready ? "paused" : "running" }}
                  onAnimationEnd={onDone}
                />
              ))}
          </div>
        ))}
      </div>

      <div
        className={`pointer-events-none absolute left-4 z-10 flex h-8 items-center gap-2 ${fade(chromeHidden)}`}
        style={{ top: "calc(33px + env(safe-area-inset-top))" }}
      >
        <Avatar url={group.author.avatar} name={group.author.name} size={32} />
        <span className="text-shadow text-[14px] font-extrabold text-white">{group.author.name || group.author.username}</span>
        <span className="text-shadow text-[14px] text-white/60">{timeAgo(story.created_at)}</span>
      </div>

      <div
        className={`absolute right-2 z-20 flex h-8 items-center ${fade(chromeHidden)}`}
        style={{ top: "calc(33px + env(safe-area-inset-top))" }}
      >
        {isVideo && (
          <HeaderBtn label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
            <Icon name={muted ? "volumeOff" : "volumeOn"} weight="regular" className="size-[22px]" />
          </HeaderBtn>
        )}
        {manualPause && (
          <HeaderBtn label="Resume" onClick={onTogglePause}>
            <Icon name="play" filled className="size-5" />
          </HeaderBtn>
        )}
        <HeaderBtn label="Add to your story" onClick={onCreate}>
          <Icon name="plus" weight="regular" className="size-[22px]" />
        </HeaderBtn>
        <HeaderBtn label="Close" onClick={onClose} className="md:hidden">
          <Icon name="close" weight="regular" className="size-[22px]" />
        </HeaderBtn>
      </div>
    </>
  );
}

function ReplyBar({
  username,
  like,
  shared,
  hidden,
  onLike,
  onReshare,
  onSend,
  onTyping,
}: {
  username: string;
  like: Like;
  shared: boolean;
  hidden: boolean;
  onLike: () => void;
  onReshare: () => void;
  onSend: (text: string) => Promise<boolean>;
  onTyping: (v: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => () => onTyping(false), [onTyping]);

  const submit = async (msg: string) => {
    if (!msg.trim()) return;
    if (await onSend(msg)) {
      setText("");
      ref.current?.blur();
    }
  };
  const has = text.trim().length > 0;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 px-4 ${fade(hidden)}`}
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      {focus && (
        <div onMouseDown={(e) => e.preventDefault()} className="sv-rise mb-3 flex justify-between px-1">
          {REACTIONS.map((r) => (
            <button key={r} type="button" onClick={() => void submit(r)} className="text-[26px] transition-transform hover:scale-125 active:scale-90">
              {r}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <input
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            setFocus(true);
            onTyping(true);
          }}
          onBlur={() => {
            setFocus(false);
            onTyping(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) void submit(text);
          }}
          placeholder={`Reply to ${username}...`}
          maxLength={500}
          enterKeyHint="send"
          className="h-11 min-w-0 flex-1 rounded-full bg-black/40 px-4 text-[14px] font-medium text-white outline-none transition-colors placeholder:text-white/70 focus:bg-black/55 focus-visible:ring-2 focus-visible:ring-brand/60"
        />
        {has ? (
          <button type="button" onClick={() => void submit(text)} className="text-[14px] font-extrabold text-brand">
            Send
          </button>
        ) : (
          <>
            <button
              type="button"
              aria-label={like.liked ? "Unlike" : "Like"}
              onClick={onLike}
              className="grid size-7 place-items-center text-white transition-transform active:scale-90"
            >
              <span key={like.liked ? "on" : "off"} className={like.liked ? "sv-pop text-like" : ""}>
                <Icon name="heart" filled={like.liked} weight="regular" className="size-6" />
              </span>
            </button>
            <button
              type="button"
              aria-label={shared ? "Added to your story" : "Reshare to your story"}
              onClick={onReshare}
              className={`grid size-7 place-items-center transition-transform active:scale-90 ${shared ? "text-brand" : "text-white"}`}
            >
              <Icon name="repeat" weight="regular" className="size-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function OwnBar({ like, hidden, onCreate }: { like: Like; hidden: boolean; onCreate: () => void }) {
  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 px-4 ${fade(hidden)}`}
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <span className="flex items-center gap-2 text-[14px] font-semibold text-white">
        <Icon name="heart" filled weight="regular" className="size-6" />
        <span className="tabular-nums">{like.count}</span>
      </span>
      <button
        type="button"
        onClick={onCreate}
        className="ml-auto flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-extrabold text-brand-fg transition-[background,transform] hover:bg-brand-hover active:scale-95"
      >
        <Icon name="plus" weight="regular" className="size-[18px]" />
        Add to story
      </button>
    </div>
  );
}

// Instagram-desktop style viewer: the live story in the centre, neighbouring groups either side (click to jump).
// Works on a snapshot of the groups so the inbox poll never shifts it underneath the viewer.
export function StoryViewer({
  groups,
  start,
  startStoryId,
  myId,
  onClose,
}: {
  groups: StoryGroup[];
  start: number;
  startStoryId?: number;
  myId?: number;
  onClose: (seenIds: number[]) => void;
}) {
  const router = useRouter();
  const { focused } = usePlayback();
  const [pos, setPos] = useState(() => {
    const list = groups[start]?.stories ?? [];
    const byId = startStoryId !== undefined ? list.findIndex((x) => x.id === startStoryId) : -1;
    return { g: start, s: byId >= 0 ? byId : startOf(groups[start]) };
  });
  const [held, setHeld] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const [typing, setTyping] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [likes, setLikes] = useState<Record<number, Like>>({});
  const [shared, setShared] = useState<ReadonlySet<number>>(() => new Set());
  const seen = useRef(new Set<number>());
  const holdAt = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const busy = useRef(new Set<string>());
  const group = groups[pos.g];
  const story = group?.stories[pos.s];
  const halted = held || manualPause || typing || !focused;

  const go = (p: { g: number; s: number }) => {
    setPos(p);
    setManualPause(false);
  };
  const goGroup = (g: number) => {
    if (g < 0 || g >= groups.length || g === pos.g) return;
    go({ g, s: startOf(groups[g]) });
  };
  const finish = () => onClose([...seen.current]);
  const next = () => {
    if (!group) return finish();
    if (pos.s + 1 < group.stories.length) go({ g: pos.g, s: pos.s + 1 });
    else if (pos.g + 1 < groups.length) go({ g: pos.g + 1, s: startOf(groups[pos.g + 1]) });
    else finish();
  };
  const prev = () => {
    if (pos.s > 0) go({ g: pos.g, s: pos.s - 1 });
    else if (pos.g > 0) go({ g: pos.g - 1, s: 0 });
  };
  const togglePause = () => setManualPause((v) => !v);
  const create = () => {
    finish();
    router.push("/create/new?mode=story");
  };
  const flash = (text: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };

  const actions = useRef({ next, prev, finish, togglePause });
  useEffect(() => {
    actions.current = { next, prev, finish, togglePause };
  });

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const inField = t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
      if (e.key === "Escape") {
        if (inField) (t as HTMLElement).blur();
        else actions.current.finish();
        return;
      }
      if (inField) return;
      if (e.key === "ArrowRight") actions.current.next();
      else if (e.key === "ArrowLeft") actions.current.prev();
      else if (e.key === " ") {
        e.preventDefault();
        actions.current.togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  // Mark viewed on the server (not your own). The local ring is cleared when the viewer closes.
  useEffect(() => {
    if (!story || !group || group.author.id === myId || seen.current.has(story.id)) return;
    seen.current.add(story.id);
    void storiesApi.view(story.id).catch(() => {});
  }, [story, group, myId]);

  // Warm the next image so the cross-fade never waits on the network.
  useEffect(() => {
    const g = groups[pos.g];
    if (!g) return;
    const nx = g.stories[pos.s + 1] ?? groups[pos.g + 1]?.stories[0];
    const m = nx?.media[0];
    if (m && m.type !== "video" && m.url) new Image().src = m.url;
  }, [groups, pos]);

  if (!group || !story) return null;

  const mine = group.author.id === myId;
  const likeOf = (s: StoryItem): Like => likes[s.id] ?? { liked: s.is_liked, count: s.likes_count };

  const toggleLike = async (s: StoryItem) => {
    const key = `like-${s.id}`;
    if (busy.current.has(key)) return;
    busy.current.add(key);
    const cur = likeOf(s);
    const guess: Like = { liked: !cur.liked, count: Math.max(0, cur.count + (cur.liked ? -1 : 1)) };
    setLikes((p) => ({ ...p, [s.id]: guess }));
    try {
      const r = await postsApi.toggleLike(s.id);
      setLikes((p) => ({ ...p, [s.id]: { liked: r.liked, count: r.likes_count ?? guess.count } }));
    } catch (e) {
      setLikes((p) => ({ ...p, [s.id]: cur }));
      flash(messageOf(e));
    } finally {
      busy.current.delete(key);
    }
  };

  const reshare = async (s: StoryItem) => {
    const key = `share-${s.id}`;
    if (shared.has(s.id) || busy.current.has(key)) return;
    busy.current.add(key);
    try {
      const r = await storiesApi.reshare(s.id);
      setShared((p) => new Set(p).add(s.id));
      flash(r.message ?? "Added to your story");
    } catch (e) {
      flash(messageOf(e));
    } finally {
      busy.current.delete(key);
    }
  };

  const sendReply = async (s: StoryItem, text: string) => {
    try {
      await storiesApi.reply(s.id, text.trim());
      flash("Sent");
      return true;
    } catch (e) {
      flash(messageOf(e));
      return false;
    }
  };

  const hold = {
    onPointerDown: () => {
      holdAt.current = Date.now();
      setHeld(true);
    },
    onPointerUp: () => setHeld(false),
    onPointerLeave: () => setHeld(false),
    onPointerCancel: () => setHeld(false),
  };
  const tap = (direction: "next" | "prev") => () => {
    if (Date.now() - holdAt.current < 220) actions.current[direction]();
  };
  const cardTap = () => {
    if (Date.now() - holdAt.current < 220) actions.current.togglePause();
  };
  const arrow =
    "absolute top-1/2 z-10 hidden size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface-interactive text-white/85 transition-colors hover:bg-surface-elevated md:grid";

  return (
    <div className="sv-stage sv-overlay fixed inset-0 z-[60] overflow-hidden bg-surface-canvas" role="dialog" aria-modal="true" aria-label="Stories">
      <button type="button" aria-label="Close" onClick={finish} className="absolute inset-0 cursor-default" />

      <div className="pointer-events-none absolute left-4 top-[18px] z-20 hidden md:block">
        <AppLogo size={30} />
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={finish}
        className="absolute right-3 top-3 z-20 hidden size-12 place-items-center rounded-full text-white transition-colors hover:bg-white/10 md:grid"
      >
        <Icon name="close" weight="regular" className="size-7" />
      </button>

      {groups.map((g, gi) => {
        const o = gi - pos.g;
        if (Math.abs(o) > 3) return null;
        const active = o === 0;
        return (
          <div key={g.author.id} className="sv-card" data-o={o} aria-hidden={!active} onClick={active ? undefined : () => goGroup(gi)}>
            <Cover group={g} />
            {active && (
              <>
                <Slide
                  key={`${g.author.id}-${story.id}`}
                  group={g}
                  story={story}
                  index={pos.s}
                  halted={halted}
                  chromeHidden={held}
                  manualPause={manualPause}
                  onTogglePause={togglePause}
                  onCreate={create}
                  onClose={finish}
                  onDone={next}
                  hold={hold}
                  onCardTap={cardTap}
                />
                <button type="button" aria-label="Previous" onClick={tap("prev")} {...hold} className="absolute bottom-24 left-0 top-16 z-10 w-[35%]" />
                <button type="button" aria-label="Next" onClick={tap("next")} {...hold} className="absolute bottom-24 right-0 top-16 z-10 w-[65%]" />
                {mine ? (
                  <OwnBar like={likeOf(story)} hidden={held} onCreate={create} />
                ) : (
                  <ReplyBar
                    key={story.id}
                    username={g.author.username || g.author.name}
                    like={likeOf(story)}
                    shared={shared.has(story.id)}
                    hidden={held}
                    onLike={() => void toggleLike(story)}
                    onReshare={() => void reshare(story)}
                    onSend={(t) => sendReply(story, t)}
                    onTyping={setTyping}
                  />
                )}
              </>
            )}
          </div>
        );
      })}

      {pos.g > 0 && (
        <button
          type="button"
          aria-label="Previous person"
          onClick={() => goGroup(pos.g - 1)}
          className={arrow}
          style={{ left: "calc(50% - var(--w) * 0.5 - 28px)" }}
        >
          <Icon name="chevronRight" weight="strong" className="size-3.5 rotate-180" />
        </button>
      )}
      {pos.g < groups.length - 1 && (
        <button
          type="button"
          aria-label="Next person"
          onClick={() => goGroup(pos.g + 1)}
          className={arrow}
          style={{ left: "calc(50% + var(--w) * 0.5 + 28px)" }}
        >
          <Icon name="chevronRight" weight="strong" className="size-3.5" />
        </button>
      )}

      {toast && (
        <div
          key={toast.id}
          role="status"
          className="sv-toast pointer-events-none fixed left-1/2 z-[70] max-w-[85vw] truncate rounded-full bg-surface-elevated px-4 py-2 text-secondary font-bold text-white shadow-lg"
          style={{ bottom: "calc(28px + env(safe-area-inset-bottom))" }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
