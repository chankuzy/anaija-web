/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Icon } from "@/components/ui/icon";
import {
  convAvatar,
  convName,
  isPending,
  messagingApi,
  waitingOnOther,
  type Message,
} from "@/lib/api/messaging";
import { useAuth } from "@/lib/auth/auth-context";
import { useThread } from "@/lib/messaging/use-thread";
import { typingLabel, useTyping } from "@/lib/messaging/use-typing";
import { useOnline } from "@/lib/realtime/presence";
import { OnlineDot } from "@/components/ui/online-dot";
import { TypingBubble } from "./typing-bubble";
import { ChatIntro } from "./chat-intro";
import { trackScroll, useRenders } from "@/lib/dev/perf";
import {
  useVoiceRecorder,
  type VoiceRecordingResult,
} from "@/lib/messaging/use-voice-recorder";
import { Avatar } from "@/components/ui/avatar";
import { useMessages } from "./messages-context";
import { RingAvatar } from "./ring-avatar";
import { ConversationDetails } from "./conversation-details";
import { PersonSheet } from "./person-sheet";
import { SharedPostCard } from "./shared-post-card";
import { VoicePlayer } from "./voice-player";
import { VoiceRecorderBar } from "./voice-recorder-bar";
import { MessageMenu } from "./message-menu";
import { ReplyChip, ReplyThumb, replyLabel } from "./reply-preview";
import { DeleteDialog } from "./delete-dialog";
import { AttachmentStrip } from "@/components/chat/attachment-strip";
import { MediaPicker } from "@/components/chat/media-picker";
import { StickerGlyph, StickerView } from "@/components/chat/sticker-view";
import { StickerTray } from "@/components/chat/sticker-tray";
import { EmojiGlyph, RichText } from "@/components/chat/emoji";
import { QUICK_REACTIONS, emojiOnly, toPlain } from "@/lib/emoji/packs";
import type { PickedFile } from "@/lib/chat/types";
import { uploadAttachment } from "@/lib/chat/upload-attachment";
import { addFavourite } from "@/lib/stickers/store";
import { CUSTOM_STICKER_BODY, isCustomSticker, uploadCustomSticker } from "@/lib/stickers/custom";
import { MediaViewer, type ViewerItem } from "@/components/chat/media-viewer";
import { ForwardSheet } from "./forward-sheet";
import { useCommunityOf } from "@/lib/messaging/use-community-of";

const MAX_ATTACH = 6;

const QUICK = QUICK_REACTIONS;
const GAP_MS = 15 * 60 * 1000;
const SWIPE_MAX = 64;
const SWIPE_TRIGGER = 42;
const EDGE_GUARD = 24;
const EASE = "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)";

// The docked details column only fits on wide screens; below that, details open full-screen over the thread.
const XL = "(min-width: 1280px)";
function useXl() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(XL);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(XL).matches,
    () => true,
  );
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((midnight(now) - midnight(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
  });
}

function bubbleCorners(mine: boolean, first: boolean, last: boolean): string {
  if (mine) {
    if (first && last) return "rounded-[18px] rounded-br-[6px]";
    if (first) return "rounded-[18px] rounded-br-[4px]";
    if (last) return "rounded-[18px] rounded-tr-[4px] rounded-br-[6px]";
    return "rounded-[18px] rounded-r-[4px]";
  }
  if (first && last) return "rounded-[18px] rounded-bl-[6px]";
  if (first) return "rounded-[18px] rounded-bl-[4px]";
  if (last) return "rounded-[18px] rounded-tl-[4px] rounded-bl-[6px]";
  return "rounded-[18px] rounded-l-[4px]";
}

const isAudioMsg = (m: Message) =>
  m.type === "audio" ||
  (m.media_type?.startsWith("audio/") ?? false) ||
  (m.media_url?.includes("voice_") ?? false) ||
  /\.(webm|m4a|mp3|ogg|wav)(\?|$)/i.test(m.media_url ?? "");

function Media({
  m,
  mine,
  firstInBlock,
  lastInBlock,
  onRetry,
  onOpen,
}: {
  m: Message;
  mine: boolean;
  firstInBlock: boolean;
  lastInBlock: boolean;
  onRetry: () => void;
  onOpen: () => void;
}) {
  if (m.is_deleted || !m.media_url) return null;

  if (isAudioMsg(m)) {
    return (
      <div
        onClick={m.status === "failed" ? onRetry : undefined}
        className={`max-w-full p-1 transition-opacity ${bubbleCorners(mine, firstInBlock, lastInBlock)} ${
          mine ? "bubble-sent text-brand-fg" : "bg-card-elevated text-fg"
        } ${m.status === "sending" ? "opacity-70" : ""}`}
      >
        <VoicePlayer src={m.media_url} mine={mine} />
      </div>
    );
  }

  if (m.type === "image")
    return (
      <img
        src={m.media_url}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onClick={onOpen}
        className={`max-h-80 max-w-full cursor-zoom-in object-cover ${bubbleCorners(mine, firstInBlock, lastInBlock)}`}
      />
    );
  if (m.type === "video")
    return (
      <div className="relative">
        <video
          src={m.media_url}
          controls
          preload="metadata"
          className={`max-h-80 max-w-full ${bubbleCorners(mine, firstInBlock, lastInBlock)}`}
        />
        <button
          type="button"
          aria-label="Open video"
          onClick={onOpen}
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/55 text-white"
        >
          <Icon name="galleryWide" filled className="size-4" />
        </button>
      </div>
    );
  return (
    <a
      href={m.media_url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-2xl bg-card-elevated px-3 py-2 text-body text-fg hover:bg-surface-elevated"
    >
      <Icon name="paperclip" className="size-5" />
      Attachment
    </a>
  );
}

function Bubble({
  m,
  mine,
  showAvatar,
  firstInBlock,
  lastInBlock,
  showSeen,
  myId,
  pickerOpen,
  onPicker,
  onReact,
  onRetry,
  onReply,
  onOpenMenu,
  onNavigateToMessage,
  onAvatarTap,
  onOpenMedia,
}: {
  m: Message;
  mine: boolean;
  showAvatar: boolean;
  firstInBlock: boolean;
  lastInBlock: boolean;
  showSeen: boolean;
  myId: number | undefined;
  pickerOpen: boolean;
  onPicker: () => void;
  onReact: (emoji: string) => void;
  onRetry: () => void;
  onReply: (m: Message) => void;
  onOpenMenu: (m: Message, pos?: { x: number; y: number }) => void;
  onNavigateToMessage: (id: number) => void;
  onAvatarTap: () => void;
  onOpenMedia: (id: number) => void;
}) {
  useRenders("Bubble");
  const text = m.is_deleted ? "This message was deleted" : (m.body ?? "");
  const audio = isAudioMsg(m);
  const hasMedia =
    !!m.media_url && !m.is_deleted && (["image", "video", "audio", "file"].includes(m.type) || audio);
  const isSticker = m.type === "sticker" && !m.is_deleted && !!m.body;
  const customSticker = isCustomSticker(m) && !m.is_deleted && !!m.media_url;
  const showText = !isSticker && !customSticker && text.trim() !== "" && !(hasMedia && (m.type === "file" || audio));
  const jumboN = (() => {
    if (m.is_deleted || m.type !== "text" || m.shared_post) return 0;
    const n = emojiOnly(text);
    return n >= 1 && n <= 3 ? n : 0;
  })();
  const reacts = Object.entries(m.reactions).filter(([, ids]) => ids.length > 0);
  const canReact = m.id > 0 && !m.is_deleted && !m.status;

  // Gesture state lives in refs and writes straight to the DOM, so dragging never re-renders the bubble.
  const slideRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const mode = useRef<"idle" | "swipe" | "scroll">("idle");
  const offset = useRef(0);
  const armed = useRef(false);
  const raf = useRef<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const settleTimer = useRef<number | null>(null);

  const clearPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const paint = () => {
    raf.current = null;
    const el = slideRef.current;
    const hint = hintRef.current;
    if (el) el.style.transform = offset.current > 0 ? `translate3d(${offset.current}px,0,0)` : "";
    if (hint) {
      const p = Math.min(1, offset.current / SWIPE_TRIGGER);
      hint.style.opacity = String(p);
      hint.style.transform = `translate3d(0,-50%,0) scale(${0.6 + 0.4 * p})`;
    }
  };

  const settle = () => {
    clearPress();
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    const el = slideRef.current;
    const hint = hintRef.current;
    if (el) {
      el.style.transition = reducedMotion() ? "none" : EASE;
      el.style.transform = "";
    }
    if (hint) hint.style.opacity = "0";
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (slideRef.current) slideRef.current.style.transition = "none";
    }, 260);
    offset.current = 0;
    armed.current = false;
    mode.current = "idle";
    start.current = null;
  };

  useEffect(
    () => () => {
      clearPress();
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    },
    [],
  );

  const onTouchStart = (e: React.TouchEvent) => {
    if (m.is_deleted) return;
    const t = e.touches[0];
    // Leave the screen edge to the browser's own back gesture.
    if (t.clientX < EDGE_GUARD) return;
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    if (slideRef.current) slideRef.current.style.transition = "none";
    start.current = { x: t.clientX, y: t.clientY };
    mode.current = "idle";
    armed.current = false;
    clearPress();
    const sx = t.clientX;
    const sy = t.clientY;
    pressTimer.current = window.setTimeout(() => {
      if (mode.current !== "idle" || !start.current) return;
      try {
        navigator.vibrate?.(18);
      } catch {}
      start.current = null;
      onOpenMenu(m, { x: sx, y: sy });
    }, 450);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;

    if (mode.current === "idle") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      clearPress();
      // Decide once per gesture: mostly-horizontal rightward drags reply, anything else is scrolling.
      mode.current = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.4 ? "swipe" : "scroll";
    }
    if (mode.current !== "swipe") return;

    // Rubber-band past the trigger so it feels elastic, not hard-stopped.
    const raw = Math.max(0, dx);
    const eased = raw <= SWIPE_TRIGGER ? raw : SWIPE_TRIGGER + (raw - SWIPE_TRIGGER) * 0.35;
    offset.current = Math.min(SWIPE_MAX, eased);
    const nowArmed = offset.current >= SWIPE_TRIGGER;
    if (nowArmed && !armed.current) {
      try {
        navigator.vibrate?.(10);
      } catch {}
    }
    armed.current = nowArmed;
    if (raf.current === null) raf.current = requestAnimationFrame(paint);
  };

  const onTouchEnd = () => {
    const fire = mode.current === "swipe" && armed.current;
    settle();
    if (fire) onReply(m);
  };

  if (m.type === "system") {
    return <p className="my-2 text-center text-supporting text-muted">{text}</p>;
  }

  return (
    <div
      id={m.id > 0 ? `msg-${m.id}` : undefined}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={settle}
      onContextMenu={(e) => {
        if (m.is_deleted) return;
        e.preventDefault();
        onOpenMenu(m, { x: e.clientX, y: e.clientY });
      }}
      className={`group/msg relative flex touch-pan-y items-end gap-1.5 transition-colors duration-300 ${
        mine ? "justify-end" : "justify-start"
      } ${lastInBlock ? "mb-2" : "mb-[2px]"}`}
    >
      {!mine &&
        (showAvatar ? (
          <button type="button" aria-label="Open contact" onClick={onAvatarTap} className="shrink-0 rounded-full transition-transform active:scale-95">
            <Avatar url={m.sender?.avatar} name={m.sender?.name} size={28} />
          </button>
        ) : (
          <span className="w-7 shrink-0" />
        ))}

      {mine && canReact && (
        <div className="mb-1 hidden items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 md:flex">
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onOpenMenu(m, { x: rect.left, y: rect.bottom + 4 });
            }}
            aria-label="Message options"
            className="grid size-7 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-fg"
          >
            <Icon name="menuDots" className="size-4" />
          </button>
          <button
            type="button"
            onClick={onPicker}
            aria-label="React"
            className="grid size-7 place-items-center rounded-full text-sm transition hover:bg-white/10"
          >
            <Icon name="smileCircle" className="size-[18px]" />
          </button>
        </div>
      )}

      <div className="relative min-w-0 max-w-[78%]">
        <div
          ref={hintRef}
          aria-hidden="true"
          className="pointer-events-none absolute -left-9 top-1/2 opacity-0"
          style={{ transform: "translate3d(0,-50%,0) scale(0.6)" }}
        >
          <div className="grid size-7 place-items-center rounded-full bg-brand/20 text-brand">
            <Icon name="reply" className="size-4" />
          </div>
        </div>

        <div ref={slideRef} className="will-change-transform">
          <div className={`flex min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
            {pickerOpen && (
              <div
                className={`glass absolute bottom-full z-20 mb-1 flex gap-1 rounded-full px-2 py-1.5 ${
                  mine ? "right-0" : "left-0"
                }`}
              >
                {QUICK.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => onReact(e)}
                    className="grid size-9 place-items-center rounded-full text-xl transition-transform hover:scale-125 hover:bg-white/10"
                  >
                    <EmojiGlyph code={e} size={26} />
                  </button>
                ))}
              </div>
            )}

            {m.reply_to && <ReplyChip reply={m.reply_to} onClick={() => m.reply_to && onNavigateToMessage(m.reply_to.id)} />}

            {m.shared_post && <SharedPostCard post={m.shared_post} />}
            {isSticker && (
              <div
                onClick={m.status === "failed" ? onRetry : undefined}
                className={`transition-opacity ${m.status === "sending" ? "opacity-70" : ""} ${m.status === "failed" ? "cursor-pointer rounded-2xl ring-1 ring-danger/70" : ""}`}
              >
                <StickerView code={m.body ?? ""} size={144} />
              </div>
            )}
            {customSticker ? (
              <div
                onClick={m.status === "failed" ? onRetry : undefined}
                className={`transition-opacity ${m.status === "sending" ? "opacity-70" : ""} ${m.status === "failed" ? "cursor-pointer rounded-2xl ring-1 ring-danger/70" : ""}`}
              >
                <img src={m.media_url ?? ""} alt="Sticker" draggable={false} loading="lazy" className="size-36 select-none object-contain" />
              </div>
            ) : (
              <Media
                m={m}
                mine={mine}
                firstInBlock={firstInBlock}
                lastInBlock={lastInBlock}
                onRetry={onRetry}
                onOpen={() => onOpenMedia(m.id)}
              />
            )}

            {showText && jumboN > 0 && (
              <div
                onClick={m.status === "failed" ? onRetry : undefined}
                className={`px-1 py-0.5 transition-opacity ${m.status === "sending" ? "opacity-70" : ""} ${m.status === "failed" ? "cursor-pointer rounded-2xl ring-1 ring-danger/70" : ""}`}
              >
                <RichText text={text} jumbo={jumboN} />
              </div>
            )}
            {showText && jumboN === 0 && (
              <div
                onClick={m.status === "failed" ? onRetry : undefined}
                className={`whitespace-pre-wrap break-words ${bubbleCorners(
                  mine,
                  firstInBlock,
                  lastInBlock,
                )} px-3 py-[7px] text-[14.5px] font-medium leading-[1.4] transition-opacity ${
                  mine ? "bubble-sent" : "bg-card-elevated text-fg"
                } ${m.is_deleted ? "italic opacity-60" : ""} ${
                  m.status === "sending" ? "opacity-70" : ""
                } ${m.status === "failed" ? "cursor-pointer ring-1 ring-danger/70" : ""}`}
              >
                <RichText text={text} />
              </div>
            )}

            {reacts.length > 0 && !m.is_deleted && (
              <span className="mt-1 flex flex-wrap gap-1">
                {reacts.map(([emoji, ids]) => {
                  const own = myId !== undefined && ids.includes(myId);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onReact(emoji)}
                      className={`flex items-center gap-1 rounded-xl px-2 py-[2px] text-[13px] transition-colors ${
                        own ? "bg-brand/25" : "bg-card-elevated"
                      }`}
                    >
                      <EmojiGlyph code={emoji} size={16} />
                      {ids.length > 1 && (
                        <span className="text-[11.5px] font-bold text-fg">{ids.length}</span>
                      )}
                    </button>
                  );
                })}
              </span>
            )}

          </div>
        </div>
      </div>

      {!mine && canReact && (
        <div className="mb-1 hidden items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 md:flex">
          <button
            type="button"
            onClick={onPicker}
            aria-label="React"
            className="grid size-7 place-items-center rounded-full text-sm transition hover:bg-white/10"
          >
            <Icon name="smileCircle" className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onOpenMenu(m, { x: rect.left, y: rect.bottom + 4 });
            }}
            aria-label="Message options"
            className="grid size-7 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-fg"
          >
            <Icon name="menuDots" className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function EmptyThread() {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <span className="mx-auto grid size-24 place-items-center rounded-full bg-surface-interactive text-brand">
          <Icon name="message" className="size-11" />
        </span>
        <p className="mt-5 text-xl font-semibold text-fg">Your messages</p>
        <p className="mt-1 text-secondary text-muted">Pick a conversation to start chatting.</p>
      </div>
    </div>
  );
}

export function ThreadPane({ conversationId, embedded = false, communityDetail = null }: { conversationId: number; embedded?: boolean; communityDetail?: object | null }) {
  const router = useRouter();
  const { user } = useAuth();
  const myId = user?.id;
  useRenders("ThreadPane");
  const { conversations, patchConversation, upsertLast, reloadInbox, ringFor } = useMessages();
  const conv = conversations?.find((c) => c.id === conversationId) ?? null;
  const t = useThread(conversationId, myId);
  const community = useCommunityOf(conv);
  const typing = useTyping(conversationId, myId, user?.name);
  const online = useOnline(conv && conv.type !== "group" ? conv.other_user?.id : null);

  const [text, setText] = useState("");
  const [picker, setPicker] = useState<number | null>(null);
  const [responding, setResponding] = useState(false);
  const [details, setDetails] = useState(!embedded);
  const [sheet, setSheet] = useState(false);
  const [person, setPerson] = useState(false);
  const openPerson = () => (conv && conv.other_user && conv.type !== "group" ? setPerson(true) : setSheet(true));
  const openHeader = () => (community ? router.push(`/c/${community.slug}`) : openPerson());

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [menuTarget, setMenuTarget] = useState<{
    m: Message;
    pos?: { x: number; y: number } | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    m: Message;
    scope: "me" | "everyone";
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PickedFile[]>([]);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [activeAtt, setActiveAtt] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<number | null>(null);
  const [forwardTarget, setForwardTarget] = useState<Message | null>(null);
  const captioning = attachments.length > 0 && !editingMessage;
  const activeItem = attachments.find((a) => a.id === activeAtt) ?? attachments[0] ?? null;
  const [notice, setNotice] = useState<string | null>(null);

  const voiceRecorder = useVoiceRecorder();

  const xl = useXl();
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const anchor = useRef<number | null>(null);
  const lastRead = useRef(0);
  const primed = useRef(false);
  const lastCount = useRef(0);

  const msgs = t.messages;
  const last = msgs[msgs.length - 1];
  const viewerItems = useMemo<ViewerItem[]>(
    () =>
      msgs
        .filter((m) => (m.type === "image" || m.type === "video") && !!m.media_url && !m.is_deleted && !isCustomSticker(m))
        .map((m) => ({
          id: m.id,
          kind: m.type as "image" | "video",
          url: m.media_url as string,
          caption: m.body,
          by: m.sender_id === myId ? "You" : (m.sender?.name ?? m.sender?.username ?? ""),
          at: m.created_at,
        })),
    [msgs, myId],
  );

  // Reset per-thread scroll state when switching conversations.
  useEffect(() => {
    primed.current = false;
    lastCount.current = 0;
    stick.current = true;
  }, [conversationId]);

  // Keep the newest message in view unless the reader scrolled up; hold position when older pages prepend.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (anchor.current !== null) {
      el.scrollTop += el.scrollHeight - anchor.current;
      anchor.current = null;
      lastCount.current = msgs.length;
      return;
    }
    const grew = msgs.length > lastCount.current;
    lastCount.current = msgs.length;
    if (!stick.current) return;
    if (!primed.current || reducedMotion()) {
      el.scrollTop = el.scrollHeight;
      if (msgs.length > 0) primed.current = true;
    } else if (grew || last?.status) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [msgs.length, last?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard opening or closing resizes the viewport: stay pinned to the newest message while that happens.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const pin = () => {
      const el = scroller.current;
      if (el && stick.current) el.scrollTop = el.scrollHeight;
    };
    vv.addEventListener("resize", pin);
    return () => vv.removeEventListener("resize", pin);
  }, []);

  function onScroll() {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  }

  useEffect(() => trackScroll(scroller.current), []);

  // The typing bubble grows the list; keep it in view when the reader is at the bottom.
  useEffect(() => {
    const el = scroller.current;
    if (el && typing.typing && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [typing.typing]);

  const newestOther = useMemo(
    () => [...msgs].reverse().find((m) => m.sender_id !== myId && m.id > 0) ?? null,
    [msgs, myId],
  );

  // "Seen" only appears under my most recent delivered message, and only once the other person has replied after it.
  const lastMineId = useMemo(
    () => [...msgs].reverse().find((m) => m.sender_id === myId && m.id > 0 && !m.is_deleted)?.id ?? 0,
    [msgs, myId],
  );

  useEffect(() => {
    if (!newestOther || newestOther.id <= lastRead.current) return;
    lastRead.current = newestOther.id;
    void messagingApi
      .markRead(conversationId, newestOther.id)
      .then(() => patchConversation(conversationId, { unread_count: 0 }));
  }, [newestOther, conversationId, patchConversation]);

  const navigateToMessage = useCallback((id: number) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
    el.classList.add("msg-highlight");
    window.setTimeout(() => el.classList.remove("msg-highlight"), 1600);
  }, []);

  async function submit() {
    if (attachments.length > 0 && !editingMessage) return sendAttachments();
    const body = text.trim();
    if (!body) return;
    setSendError(null);

    if (editingMessage) {
      const editId = editingMessage.id;
      const original = editingMessage;
      setEditingMessage(null);
      setText("");
      if (area.current) area.current.style.height = "auto";
      try {
        await t.editMessage(editId, body);
      } catch {
        // Rolled back by the hook; hand the text back so nothing is lost.
        setEditingMessage(original);
        setText(body);
        setSendError("Couldn't save your edit. Try again.");
      }
      return;
    }

    setText("");
    if (area.current) area.current.style.height = "auto";
    stick.current = true;
    typing.stop();
    upsertLast(conversationId, body);
    if (conv && isPending(conv)) patchConversation(conversationId, { request_status: "accepted" });

    const currentReply = replyingTo;
    setReplyingTo(null);

    await t.send({
      body,
      replyTo: currentReply ? replyRef(currentReply) : undefined,
    });
  }

  async function handleSendVoice(result: VoiceRecordingResult) {
    stick.current = true;
    setSendError(null);
    upsertLast(conversationId, "Voice message");
    if (conv && isPending(conv)) patchConversation(conversationId, { request_status: "accepted" });

    const currentReply = replyingTo;
    setReplyingTo(null);

    // Backends commonly allow-list "audio/webm" but reject "audio/webm;codecs=opus".
    const cleanType = result.mediaType?.split(";")[0].trim() || "audio/webm";

    const sent = await t.send({
      type: "audio",
      mediaKey: result.mediaKey,
      mediaType: cleanType,
      mediaUrl: result.blobUrl,
      replyTo: currentReply ? replyRef(currentReply) : undefined,
    });
    if (!sent) console.error("[voice] send failed", { mediaKey: result.mediaKey, mediaType: cleanType });
  }

  async function react(m: Message, emoji: string) {
    setPicker(null);
    try {
      t.setReactions(m.id, await messagingApi.react(m.conversation_id, m.id, emoji));
    } catch {
      setNotice("Couldn't add that reaction");
    }
  }

  function respond(action: "accept" | "decline" | "block") {
    if (responding) return;
    setResponding(true);
    messagingApi
      .respond(conversationId, action)
      .then(() => {
        if (action === "accept") patchConversation(conversationId, { request_status: "accepted" });
        else router.push("/messages");
        reloadInbox();
      })
      .catch(() => {})
      .finally(() => setResponding(false));
  }

  function startEdit(m: Message) {
    setReplyingTo(null);
    setEditingMessage(m);
    setText(m.body ?? "");
    requestAnimationFrame(() => {
      const a = area.current;
      if (!a) return;
      a.focus();
      a.style.height = "auto";
      a.style.height = `${Math.min(a.scrollHeight, 128)}px`;
    });
  }

  function copyText(m: Message) {
    if (m.body) navigator.clipboard?.writeText(toPlain(m.body)).catch(() => {});
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await t.deleteMessage(deleteTarget.m.id, deleteTarget.scope);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete message", err);
      setSendError("Couldn't delete that message. Try again.");
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  // ── attachments + stickers (shared by direct and community chat) ──
  useEffect(() => {
    setAttachments([]);
    setTrayOpen(false);
    setMediaOpen(false);
  }, [conversationId]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(id);
  }, [notice]);

  const openMedia = () => {
    if (attachments.length >= MAX_ATTACH) {
      setNotice(`You can attach up to ${MAX_ATTACH} at a time`);
      return;
    }
    area.current?.blur();
    setTrayOpen(false);
    setMediaOpen(true);
  };
  const toggleTray = () => {
    area.current?.blur();
    setTrayOpen((o) => !o);
  };
  const labelOf = (m: Message) => (m.type === "sticker" || isCustomSticker(m) ? "Sticker" : m.body);
  const replyRef = (m: Message) => ({ id: m.id, body: labelOf(m), type: m.type, media_url: m.media_url });

  function sendSticker(packId: string, stickerId: string) {
    setSendError(null);
    stick.current = true;
    upsertLast(conversationId, "Sticker");
    if (conv && isPending(conv)) patchConversation(conversationId, { request_status: "accepted" });
    const reply = replyingTo;
    setReplyingTo(null);
    void t.send({
      type: "sticker",
      body: `${packId}/${stickerId}`,
      replyTo: reply ? replyRef(reply) : undefined,
    });
  }

  function sendCustomSticker(blob: Blob) {
    setSendError(null);
    stick.current = true;
    upsertLast(conversationId, "Sticker");
    if (conv && isPending(conv)) patchConversation(conversationId, { request_status: "accepted" });
    const reply = replyingTo;
    setReplyingTo(null);
    const url = URL.createObjectURL(blob);
    void t
      .send({
        type: "image",
        body: CUSTOM_STICKER_BODY,
        replyTo: reply ? replyRef(reply) : undefined,
        mediaUrl: url,
        prepare: () => uploadCustomSticker(blob),
      })
      .then((res) => {
        if (res) URL.revokeObjectURL(url);
      });
  }

  function saveSticker(code: string) {
    addFavourite(code);
    setNotice("Saved to favourites");
  }

  function insertEmoji(code: string) {
    const el = area.current;
    const cur = captioning && activeItem ? (activeItem.caption ?? "") : text;
    const a = el?.selectionStart ?? cur.length;
    const b = el?.selectionEnd ?? cur.length;
    const next = cur.slice(0, a) + code + cur.slice(b);
    if (captioning && activeItem) setAttachments((list) => list.map((x) => (x.id === activeItem.id ? { ...x, caption: next } : x)));
    else setText(next);
    requestAnimationFrame(() => {
      if (!el) return;
      const at = a + code.length;
      el.setSelectionRange(at, at);
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    });
  }

  async function sendAttachments() {
    const items = attachments;
    if (items.length === 0) return;
    const caption = (items[0].caption ?? "").trim();
    const reply = replyingTo;
    setAttachments([]);
    setText("");
    if (area.current) area.current.style.height = "auto";
    setReplyingTo(null);
    setSendError(null);
    setTrayOpen(false);
    stick.current = true;
    upsertLast(conversationId, caption || (items[0].kind === "video" ? "Video" : "Photo"));
    if (conv && isPending(conv)) patchConversation(conversationId, { request_status: "accepted" });

    // Bubbles show at once with the local file; uploads then run strictly one at a time.
    let chain: Promise<unknown> = Promise.resolve();
    const queued = <T,>(fn: () => Promise<T>): Promise<T> => {
      const run = chain.then(fn, fn);
      chain = run.catch(() => undefined);
      return run;
    };
    await Promise.all(
      items.map((a, i) => {
        const url = URL.createObjectURL(a.file);
        return t
          .send({
            type: a.kind,
            body: (a.caption ?? "").trim() || undefined,
            replyTo: i === 0 && reply ? replyRef(reply) : undefined,
            mediaUrl: url,
            prepare: () => queued(() => uploadAttachment(a)),
          })
          .then((res) => {
            if (res) URL.revokeObjectURL(url);
          });
      }),
    );
  }

  const name = conv ? convName(conv) : "";
  const username = conv?.other_user?.username;
  const isRoom = !!community || conv?.type === "group";
  const introCommunity: object | null = communityDetail ?? community;

  const canEdit = useCallback(
    (m: Message) =>
      m.sender_id === myId &&
      !m.is_deleted &&
      m.type === "text" &&
      m.id > 0 &&
      Date.now() - Date.parse(m.created_at) < 15 * 60 * 1000,
    [myId],
  );

  const canDeleteEveryone = useCallback(
    (m: Message) =>
      m.sender_id === myId &&
      !m.is_deleted &&
      m.id > 0 &&
      Date.now() - Date.parse(m.created_at) < 5 * 60 * 1000,
    [myId],
  );

  return (
    <div className="relative flex h-full min-h-0">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        {!embedded && (
        <header className="flex items-center gap-3 px-3 py-2.5">
          <Link
            href="/messages"
            aria-label="Back"
            className="grid size-10 place-items-center rounded-full text-fg hover:bg-white/8 md:hidden"
          >
            <Icon name="back" className="size-6" />
          </Link>
          {conv ? (
            <>
              <span className="relative shrink-0 cursor-pointer" onClick={openHeader}>
                <RingAvatar
                  url={convAvatar(conv)}
                  name={name}
                  size={36}
                  ring={ringFor(conv.other_user?.id)}
                />
                {online && <OnlineDot size={11} className="absolute bottom-[1px] right-[1px]" />}
              </span>
              <div className="min-w-0 cursor-pointer" onClick={openHeader}>
                <p className="truncate text-[15px] font-bold text-fg">{name}</p>
                {typing.typing ? (
                  <p className="truncate text-supporting font-semibold text-brand">{typingLabel(typing.names, !community && conv.type !== "group")}</p>
                ) : community ? (
                  <p className="truncate text-supporting text-muted">Community · {community.members_count} {community.members_count === 1 ? "member" : "members"}</p>
                ) : (
                  typing.typing ? (
                    <p className="truncate text-supporting font-semibold text-brand">typing…</p>
                  ) : online ? (
                    <p className="truncate text-supporting font-semibold text-[#22c55e]">Online</p>
                  ) : (
                    username && <p className="truncate text-supporting text-muted">@{username}</p>
                  )
                )}
              </div>
            </>
          ) : (
            <>
              <span aria-hidden="true" className="sk-block size-[46px] rounded-full" />
              <span aria-hidden="true" className="sk-block h-4 w-32 rounded-full" />
            </>
          )}
          <button
            type="button"
            aria-label={xl && details ? "Hide details" : "Show details"}
            aria-pressed={xl ? details : sheet}
            onClick={() => (xl ? setDetails((d) => !d) : setSheet(true))}
            className={`ml-auto grid size-10 place-items-center rounded-full transition-colors hover:bg-white/8 ${
              xl && details ? "text-brand" : "text-white/60"
            }`}
          >
            <Icon name="infoCircle" filled={xl && details} className="size-6" />
          </button>
        </header>
        )}

        <div
          ref={scroller}
          onScroll={onScroll}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
        >
          {!t.hasOlder && !t.loading && (conv || introCommunity) && (
            <ChatIntro conv={conv} community={introCommunity} online={online} ring={ringFor(conv?.other_user?.id)} />
          )}
          {t.hasOlder && (
            <div className="mb-3 text-center">
              <button
                type="button"
                disabled={t.loadingOlder}
                onClick={() => {
                  anchor.current = scroller.current?.scrollHeight ?? null;
                  t.loadOlder();
                }}
                className="h-9 rounded-full bg-card-elevated px-4 text-secondary font-bold text-fg hover:bg-surface-elevated disabled:opacity-50"
              >
                {t.loadingOlder ? (
                  <span
                    role="status"
                    aria-label="Loading earlier messages"
                    className="sk-block inline-block h-3 w-28 rounded-full align-middle"
                  />
                ) : (
                  "Load earlier messages"
                )}
              </button>
            </div>
          )}

          {t.loading && (
            <div className="space-y-3 py-6" aria-hidden="true">
              {[60, 40, 70, 45].map((w, i) => (
                <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}>
                  <span className="sk-block h-9 rounded-[18px]" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          )}

          {!t.loading && t.error && msgs.length === 0 && (
            <p className="py-16 text-center text-secondary text-muted">{t.error}</p>
          )}

          {!t.loading && !t.error && msgs.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-[15px] font-bold text-fg">Say hello 👋</p>
              <p className="mt-1 text-secondary text-muted">Start the conversation</p>
            </div>
          )}

          {msgs.map((m, i) => {
            const prev = msgs[i - 1];
            const nextM = msgs[i + 1];
            const mine = m.sender_id === myId;
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            const firstInBlock =
              !prev ||
              prev.sender_id !== m.sender_id ||
              dayKey(prev.created_at) !== dayKey(m.created_at) ||
              Math.abs(Date.parse(m.created_at) - Date.parse(prev.created_at)) >= GAP_MS;
            const lastInBlock =
              !nextM ||
              nextM.sender_id !== m.sender_id ||
              dayKey(nextM.created_at) !== dayKey(m.created_at) ||
              Math.abs(Date.parse(nextM.created_at) - Date.parse(m.created_at)) >= GAP_MS;

            const showSeen = mine && m.id === lastMineId && !!newestOther && newestOther.id > m.id;

            return (
              <div key={m.local_id ?? m.id}>
                {newDay && m.created_at && (
                  <p className="my-3 text-center">
                    <span className="rounded-full bg-card px-3 py-1 text-[11.5px] font-semibold text-muted">
                      {dayLabel(m.created_at)}
                    </span>
                  </p>
                )}
                {conv?.type === "group" && !mine && firstInBlock && (
                  <p className="mb-0.5 ml-9 text-supporting font-semibold text-muted">{m.sender?.name ?? m.sender?.username}</p>
                )}
                <Bubble
                  m={m}
                  mine={mine}
                  showAvatar={!mine && lastInBlock}
                  firstInBlock={firstInBlock}
                  lastInBlock={lastInBlock}
                  showSeen={showSeen}
                  myId={myId}
                  pickerOpen={picker === m.id}
                  onPicker={() => setPicker((p) => (p === m.id ? null : m.id))}
                  onReact={(e) => void react(m, e)}
                  onRetry={() => m.local_id && void t.retry(m.local_id)}
                  onReply={(target) => {
                    setEditingMessage(null);
                    setReplyingTo(target);
                    area.current?.focus();
                  }}
                  onOpenMenu={(target, pos) => setMenuTarget({ m: target, pos })}
                  onNavigateToMessage={navigateToMessage}
                  onOpenMedia={setViewerId}
                  onAvatarTap={() => (conv && conv.type !== "group" && conv.other_user ? setPerson(true) : m.sender?.username ? router.push(`/u/${m.sender.username}`) : undefined)}
                />
              </div>
            );
          })}

          {typing.typing && <TypingBubble label={isRoom ? typingLabel(typing.names, false) : undefined} />}

          {conv && isPending(conv) && (
            <div className="mx-auto my-3 max-w-sm rounded-[20px] bg-surface p-4">
              <p className="text-body font-bold text-fg">This is a message request.</p>
              <p className="mt-1 text-secondary text-muted">
                You can accept the conversation or decline it.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={responding}
                  onClick={() => respond("accept")}
                  className="h-10 flex-1 rounded-full bg-brand text-secondary font-extrabold text-brand-fg disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={responding}
                  onClick={() => respond("decline")}
                  className="h-10 flex-1 rounded-full bg-card-elevated text-secondary font-bold text-fg hover:bg-surface-elevated disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
              <button
                type="button"
                disabled={responding}
                onClick={() => respond("block")}
                className="mt-2 w-full text-center text-supporting font-semibold text-danger disabled:opacity-50"
              >
                Block
              </button>
            </div>
          )}
          {conv && waitingOnOther(conv) && !isPending(conv) && (
            <p className="mx-auto my-3 max-w-sm rounded-2xl bg-surface px-4 py-3 text-supporting text-muted">
              Message request sent — they need to accept before you can chat freely.
            </p>
          )}
        </div>

        <div
          className="px-3 pb-3 pt-2"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
        >
          {sendError && (
            <p role="alert" className="mb-2 px-2 text-[12px] font-medium text-danger">
              {sendError}
            </p>
          )}

          {replyingTo && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-surface-subtle px-3 py-2 text-supporting text-fg animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex min-w-0 items-center gap-2">
                <Icon name="reply" className="size-4 shrink-0 text-brand" />
                <ReplyThumb reply={replyRef(replyingTo)} size={36} />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-brand">
                    Replying to{" "}
                    {replyingTo.sender?.name ||
                      (replyingTo.sender_id === myId ? "yourself" : "message")}
                  </p>
                  <p className="truncate text-[13px] text-muted">
                    {replyLabel(replyRef(replyingTo), isAudioMsg(replyingTo))}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                aria-label="Cancel reply"
                className="grid size-7 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-fg"
              >
                <Icon name="close" className="size-4" />
              </button>
            </div>
          )}

          {editingMessage && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-surface-subtle px-3 py-2 text-supporting text-fg animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex min-w-0 items-center gap-2">
                <Icon name="pen" className="size-4 shrink-0 text-brand" />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-brand">Editing message</p>
                  <p className="truncate text-[13px] text-muted">{editingMessage.body}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingMessage(null);
                  setText("");
                }}
                aria-label="Cancel editing"
                className="grid size-7 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-fg"
              >
                <Icon name="close" className="size-4" />
              </button>
            </div>
          )}

          {notice && (
            <p role="status" className="mb-2 px-2 text-[12px] font-medium text-muted">
              {notice}
            </p>
          )}
          {attachments.length > 0 && (
            <AttachmentStrip items={attachments} activeId={activeItem?.id ?? null} onSelect={setActiveAtt} onRemove={(id) => setAttachments((a) => a.filter((x) => x.id !== id))} />
          )}

          {voiceRecorder.status !== "idle" ? (
            <VoiceRecorderBar
              recorder={voiceRecorder}
              onSend={handleSendVoice}
              onCancel={() => voiceRecorder.discard()}
            />
          ) : (
            <div className="flex items-end gap-1 rounded-[26px] bg-surface-subtle p-1.5 pl-1.5">
              {!editingMessage && (
                <>
                  <button
                    type="button"
                    aria-label="Add photos or videos"
                    onClick={openMedia}
                    className="grid size-11 shrink-0 place-items-center rounded-full text-[#38bdf8] transition hover:bg-white/10 active:scale-95"
                  >
                    <Icon name="gallery" filled className="size-[26px]" />
                  </button>
                  <button
                    type="button"
                    aria-label={trayOpen ? "Close stickers" : "Open stickers"}
                    aria-pressed={trayOpen}
                    onClick={toggleTray}
                    className={`grid size-11 shrink-0 place-items-center rounded-full text-[#fbbf24] transition hover:bg-white/10 active:scale-95 ${trayOpen ? "bg-white/10" : ""}`}
                  >
                    <StickerGlyph filled className="size-[26px]" />
                  </button>
                </>
              )}
              <textarea
                ref={area}
                value={captioning && activeItem ? (activeItem.caption ?? "") : text}
                onFocus={() => setTrayOpen(false)}
                rows={1}
                placeholder={editingMessage ? "Edit message…" : attachments.length > 1 ? "Add a caption to this one…" : attachments.length > 0 ? "Add a caption…" : "Message"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (captioning && activeItem) setAttachments((a) => a.map((x) => (x.id === activeItem.id ? { ...x, caption: v } : x)));
                  else setText(v);
                  if (sendError) setSendError(null);
                  if (v.trim()) typing.ping();
                  else typing.stop();
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && editingMessage) {
                    setEditingMessage(null);
                    setText("");
                  } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-[1.35] text-fg outline-none placeholder:text-muted"
              />

              {text.trim().length > 0 || editingMessage || attachments.length > 0 ? (
                <button
                  type="button"
                  aria-label={editingMessage ? "Save edit" : "Send"}
                  disabled={!text.trim() && attachments.length === 0}
                  onClick={() => void submit()}
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-brand-fg transition active:scale-95 disabled:bg-surface-interactive disabled:text-muted/50"
                >
                  <Icon name={editingMessage ? "check" : "send"} filled className="size-[22px]" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Record voice message"
                  onClick={() => void voiceRecorder.start()}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-[#fb7185] transition hover:bg-white/10 active:scale-95"
                >
                  <Icon name="microphone" filled className="size-[26px]" />
                </button>
              )}
            </div>
          )}
          {trayOpen && voiceRecorder.status === "idle" && (
            <div className="mt-2">
              <StickerTray onPick={sendSticker} onPickCustom={sendCustomSticker} onEmoji={insertEmoji} />
            </div>
          )}
        </div>
      </div>

      {conv && (xl ? details : sheet) && (
        <ConversationDetails
          conv={conv}
          messages={msgs}
          ring={ringFor(conv.other_user?.id)}
          variant={xl ? "dock" : "sheet"}
          onClose={() => (xl ? setDetails(false) : setSheet(false))}
        />
      )}

      {conv && person && conv.other_user && <PersonSheet conv={conv} onClose={() => setPerson(false)} />}

      {mediaOpen && (
        <MediaPicker
          max={Math.max(1, MAX_ATTACH - attachments.length)}
          onClose={() => setMediaOpen(false)}
          onDone={(items) => {
            const typed = text.trim();
            const merged = [...attachments, ...items].slice(0, MAX_ATTACH);
            if (typed && attachments.length === 0 && merged[0]) {
              merged[0] = { ...merged[0], caption: typed };
              setText("");
              if (area.current) area.current.style.height = "auto";
            }
            setAttachments(merged);
            setMediaOpen(false);
          }}
        />
      )}

      {viewerId !== null && viewerItems.length > 0 && (
        <MediaViewer items={viewerItems} startId={viewerId} onClose={() => setViewerId(null)} />
      )}

      {forwardTarget && <ForwardSheet message={forwardTarget} onClose={() => setForwardTarget(null)} flash={setNotice} />}

      {menuTarget && (
        <MessageMenu
          m={menuTarget.m}
          mine={menuTarget.m.sender_id === myId}
          canEdit={canEdit(menuTarget.m)}
          canDeleteEveryone={canDeleteEveryone(menuTarget.m)}
          position={menuTarget.pos}
          onReply={() => {
            setEditingMessage(null);
            setReplyingTo(menuTarget.m);
            area.current?.focus();
          }}
          onEdit={() => startEdit(menuTarget.m)}
          onCopy={() => copyText(menuTarget.m)}
          onForward={menuTarget.m.type === "sticker" || isCustomSticker(menuTarget.m) ? () => setForwardTarget(menuTarget.m) : undefined}
          onSaveSticker={menuTarget.m.type === "sticker" && menuTarget.m.body ? () => saveSticker(menuTarget.m.body ?? "") : undefined}
          onRetry={() => menuTarget.m.local_id && void t.retry(menuTarget.m.local_id)}
          onDeleteForMe={() => setDeleteTarget({ m: menuTarget.m, scope: "me" })}
          onDeleteEveryone={() => setDeleteTarget({ m: menuTarget.m, scope: "everyone" })}
          onClose={() => setMenuTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          isOpen={true}
          scope={deleteTarget.scope}
          busy={deleteBusy}
          onConfirm={handleConfirmDelete}
          onClose={() => !deleteBusy && setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
