/* eslint-disable @next/next/no-img-element */
"use client";

import { ProfileHoverCard } from "@/components/profile/profile-hover-card";
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
import {
  useVoiceRecorder,
  type VoiceRecordingResult,
} from "@/lib/messaging/use-voice-recorder";
import { Avatar } from "@/components/ui/avatar";
import { useMessages } from "./messages-context";
import { RingAvatar } from "./ring-avatar";
import { ConversationDetails } from "./conversation-details";
import { SharedPostCard } from "./shared-post-card";
import { VoicePlayer } from "./voice-player";
import { VoiceRecorderBar } from "./voice-recorder-bar";
import { MessageMenu } from "./message-menu";
import { DeleteDialog } from "./delete-dialog";

const QUICK = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const GAP_MS = 15 * 60 * 1000;

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
    if (first && last) return "rounded-[22px] rounded-br-[8px]";
    if (first) return "rounded-[22px] rounded-br-[4px]";
    if (last) return "rounded-[22px] rounded-tr-[4px] rounded-br-[8px]";
    return "rounded-[22px] rounded-r-[4px]";
  } else {
    if (first && last) return "rounded-[22px] rounded-bl-[8px]";
    if (first) return "rounded-[22px] rounded-bl-[4px]";
    if (last) return "rounded-[22px] rounded-tl-[4px] rounded-bl-[8px]";
    return "rounded-[22px] rounded-l-[4px]";
  }
}

function Media({
  m,
  mine,
  firstInBlock,
  lastInBlock,
  isRead,
}: {
  m: Message;
  mine: boolean;
  firstInBlock: boolean;
  lastInBlock: boolean;
  isRead: boolean;
}) {
  if (m.is_deleted || !m.media_url) return null;
  const isAudio =
    m.type === "audio" ||
    (m.media_type?.startsWith("audio/") ?? false) ||
    (m.media_url?.includes("voice_") ?? false) ||
    /\.(webm|m4a|mp3|ogg|wav)(\?|$)/i.test(m.media_url ?? "");

  if (isAudio) {
    return (
      <div
        className={`relative max-w-full ${bubbleCorners(
          mine,
          firstInBlock,
          lastInBlock,
        )} p-1.5 ${mine ? "bubble-sent text-brand-fg" : "bg-card-elevated text-fg"}`}
      >
        <VoicePlayer src={m.media_url} mine={mine} />
        {mine && (
          <div className="flex items-center justify-end px-2.5 pb-0.5 -mt-1 text-brand-fg/75">
            {m.status === "sending" ? (
              <span className="size-2.5 rounded-full border border-current border-t-transparent animate-spin ml-0.5" />
            ) : m.status === "failed" ? (
              <span className="text-danger font-bold ml-0.5">!</span>
            ) : (
              <Icon
                name={isRead ? "checkRead" : "check"}
                className={`size-3.5 ml-0.5 ${isRead ? "text-brand" : "text-current"}`}
              />
            )}
          </div>
        )}
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
        className={`mb-1 max-h-80 max-w-full ${bubbleCorners(
          mine,
          firstInBlock,
          lastInBlock,
        )} object-cover`}
      />
    );
  if (m.type === "video")
    return (
      <video
        src={m.media_url}
        controls
        preload="metadata"
        className={`mb-1 max-h-80 max-w-full ${bubbleCorners(
          mine,
          firstInBlock,
          lastInBlock,
        )}`}
      />
    );
  return (
    <a
      href={m.media_url}
      target="_blank"
      rel="noreferrer"
      className="mb-1 inline-flex items-center gap-2 rounded-2xl bg-card-elevated px-4 py-3 text-body text-fg hover:bg-surface-elevated"
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
  isRead,
  myId,
  pickerOpen,
  onPicker,
  onReact,
  onRetry,
  onReply,
  onOpenMenu,
  onNavigateToMessage,
}: {
  m: Message;
  mine: boolean;
  showAvatar: boolean;
  firstInBlock: boolean;
  lastInBlock: boolean;
  isRead: boolean;
  myId: number | undefined;
  pickerOpen: boolean;
  onPicker: () => void;
  onReact: (emoji: string) => void;
  onRetry: () => void;
  onReply: (m: Message) => void;
  onOpenMenu: (m: Message, pos?: { x: number; y: number }) => void;
  onNavigateToMessage: (id: number) => void;
}) {
  const text = m.is_deleted ? "This message was deleted" : (m.body ?? "");
  const isAudio =
    m.type === "audio" ||
    (m.media_type?.startsWith("audio/") ?? false) ||
    (m.media_url?.includes("voice_") ?? false) ||
    /\.(webm|m4a|mp3|ogg|wav)(\?|$)/i.test(m.media_url ?? "");
  const hasMedia =
    !!m.media_url && !m.is_deleted && (["image", "video", "audio", "file"].includes(m.type) || isAudio);
  const showText = text.trim() !== "" && !(hasMedia && (m.type === "file" || isAudio));
  const reacts = Object.entries(m.reactions).filter(([, ids]) => ids.length > 0);
  const canReact = m.id > 0 && !m.is_deleted && !m.status;

  // Swipe-to-reply gesture state
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const swipingRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (m.is_deleted) return;
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      swipingRef.current = false;

      longPressTimerRef.current = window.setTimeout(() => {
        if (touchStartRef.current && !swipingRef.current) {
          try {
            navigator?.vibrate?.(20);
          } catch {}
          onOpenMenu(m, { x: touchStartRef.current.x, y: touchStartRef.current.y });
          touchStartRef.current = null;
        }
      }, 450);
    },
    [m, onOpenMenu],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || m.is_deleted) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = Math.abs(touch.clientY - touchStartRef.current.y);

      if (dy > 15 && !swipingRef.current) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        touchStartRef.current = null;
        setSwipeX(0);
        return;
      }

      if (Math.abs(dx) > 10) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        swipingRef.current = true;
        const offset = Math.max(0, Math.min(55, dx));
        setSwipeX(offset);
      }
    },
    [m.is_deleted],
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (swipeX >= 38) {
      try {
        navigator?.vibrate?.(15);
      } catch {}
      onReply(m);
    }
    setSwipeX(0);
    swipingRef.current = false;
    touchStartRef.current = null;
  }, [m, onReply, swipeX]);

  if (m.type === "system") {
    return <p className="my-2 text-center text-supporting text-muted">{text}</p>;
  }

  return (
    <div
      id={m.id > 0 ? `msg-${m.id}` : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => {
        if (m.is_deleted) return;
        e.preventDefault();
        onOpenMenu(m, { x: e.clientX, y: e.clientY });
      }}
      className={`group/msg relative flex items-end gap-1.5 transition-colors duration-300 ${
        mine ? "justify-end" : "justify-start"
      } ${lastInBlock ? "mb-2" : "mb-[2px]"}`}
    >
      {!mine &&
        (showAvatar ? (
          <ProfileHoverCard username={m.sender?.username}>
            <Avatar url={m.sender?.avatar} name={m.sender?.name} size={28} />
          </ProfileHoverCard>
        ) : (
          <span className="w-7 shrink-0" />
        ))}

      {/* Action buttons on desktop hover (Left side for sent messages) */}
      {mine && canReact && (
        <div className="mb-1 hidden items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 md:flex">
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
            🙂
          </button>
        </div>
      )}

      {/* Relative container for bubble + swipe reply indicator */}
      <div
        className="relative min-w-0 max-w-[76%] transition-transform duration-75 ease-out"
        style={swipeX > 0 ? { transform: `translateX(${swipeX}px)` } : undefined}
      >
        {/* Swipe reply indicator behind bubble */}
        {swipeX > 8 && (
          <div
            className="absolute -left-9 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity"
            style={{ opacity: Math.min(1, swipeX / 35) }}
          >
            <div className="grid size-7 place-items-center rounded-full bg-brand/20 text-brand">
              <Icon name="reply" className="size-4" />
            </div>
          </div>
        )}

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
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Quoted Reply Chip */}
          {m.reply_to && (
            <button
              type="button"
              onClick={() => m.reply_to && onNavigateToMessage(m.reply_to.id)}
              className="mb-1 flex max-w-full items-center gap-1.5 truncate rounded-xl bg-white/8 px-3 py-1.5 text-left text-[12.5px] font-medium text-muted transition hover:bg-white/12"
            >
              <Icon name="reply" className="size-3.5 shrink-0 text-brand" />
              <span className="truncate">{m.reply_to.body ?? "Message"}</span>
            </button>
          )}

          {m.shared_post && <SharedPostCard post={m.shared_post} />}
          <Media
            m={m}
            mine={mine}
            firstInBlock={firstInBlock}
            lastInBlock={lastInBlock}
            isRead={isRead}
          />

          {showText && (
            <div
              onClick={m.status === "failed" ? onRetry : undefined}
              className={`relative whitespace-pre-wrap break-words ${bubbleCorners(
                mine,
                firstInBlock,
                lastInBlock,
              )} px-4 py-2.5 text-[14.5px] font-medium leading-[1.42] ${
                mine ? "bubble-sent" : "bg-card-elevated text-fg"
              } ${m.is_deleted ? "italic opacity-60" : ""} ${m.status ? "opacity-80" : ""} ${
                m.status === "failed" ? "cursor-pointer" : ""
              }`}
            >
              {text}

              {/* Edited label and delivery ticks in bubble (no timestamp) */}
              {(mine || m.is_edited) && (
                <div
                  className={`mt-0.5 flex items-center justify-end gap-1 text-[10.5px] select-none ${
                    mine ? "text-brand-fg/75" : "text-muted"
                  }`}
                >
                  {m.is_edited && <span className="italic mr-0.5">(edited)</span>}
                  {mine && (
                    <>
                      {m.status === "sending" ? (
                        <span className="size-2.5 rounded-full border border-current border-t-transparent animate-spin ml-0.5" />
                      ) : m.status === "failed" ? (
                        <span className="text-danger font-bold ml-0.5">!</span>
                      ) : (
                        <Icon
                          name={isRead ? "checkRead" : "check"}
                          className={`size-3.5 ml-0.5 ${isRead ? "text-brand" : "text-current"}`}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reactions row */}
          {reacts.length > 0 && !m.is_deleted && (
            <span className="mt-1 flex flex-wrap gap-1">
              {reacts.map(([emoji, ids]) => {
                const own = myId !== undefined && ids.includes(myId);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onReact(emoji)}
                    className={`flex items-center gap-1 rounded-xl px-2 py-[3px] text-[13px] ${
                      own ? "bg-brand/25" : "bg-card-elevated"
                    }`}
                  >
                    {emoji}
                    {ids.length > 1 && (
                      <span className="text-[11.5px] font-bold text-fg">{ids.length}</span>
                    )}
                  </button>
                );
              })}
            </span>
          )}

          {m.status === "failed" && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 px-1 text-micro font-bold text-danger hover:underline"
            >
              Tap to retry
            </button>
          )}
        </div>
      </div>

      {/* Action buttons on desktop hover (Right side for received messages) */}
      {!mine && canReact && (
        <div className="mb-1 hidden items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 md:flex">
          <button
            type="button"
            onClick={onPicker}
            aria-label="React"
            className="grid size-7 place-items-center rounded-full text-sm transition hover:bg-white/10"
          >
            🙂
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

export function ThreadPane({ conversationId }: { conversationId: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const myId = user?.id;
  const { conversations, patchConversation, upsertLast, reloadInbox, ringFor } = useMessages();
  const conv = conversations?.find((c) => c.id === conversationId) ?? null;
  const t = useThread(conversationId, myId);

  const [text, setText] = useState("");
  const [picker, setPicker] = useState<number | null>(null);
  const [responding, setResponding] = useState(false);
  const [details, setDetails] = useState(true);
  const [sheet, setSheet] = useState(false);

  // Advanced messaging state: replies, edits, context menus, deletions, voice
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

  const voiceRecorder = useVoiceRecorder();

  const xl = useXl();
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const anchor = useRef<number | null>(null);
  const lastRead = useRef(0);

  const msgs = t.messages;
  const last = msgs[msgs.length - 1];

  // Keep the newest message in view unless the reader scrolled up; hold position when older pages prepend.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (anchor.current !== null) {
      el.scrollTop += el.scrollHeight - anchor.current;
      anchor.current = null;
      return;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs.length, last?.status]);

  function onScroll() {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  }

  // Someone else's newest message counts as read the moment this thread is open.
  const newestOther = useMemo(
    () => [...msgs].reverse().find((m) => m.sender_id !== myId && m.id > 0) ?? null,
    [msgs, myId],
  );

  useEffect(() => {
    if (!newestOther || newestOther.id <= lastRead.current) return;
    lastRead.current = newestOther.id;
    void messagingApi
      .markRead(conversationId, newestOther.id)
      .then(() => patchConversation(conversationId, { unread_count: 0 }));
  }, [newestOther, conversationId, patchConversation]);

  // Navigate to quoted message and trigger pulse highlight
  const navigateToMessage = useCallback((id: number) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("msg-highlight");
      setTimeout(() => {
        el.classList.remove("msg-highlight");
      }, 1600);
    }
  }, []);

  async function submit() {
    const body = text.trim();
    if (!body) return;

    if (editingMessage) {
      const editId = editingMessage.id;
      setEditingMessage(null);
      setText("");
      if (area.current) area.current.style.height = "auto";
      await t.editMessage(editId, body);
      return;
    }

    setText("");
    if (area.current) area.current.style.height = "auto";
    stick.current = true;
    upsertLast(conversationId, body);
    if (conv && isPending(conv)) patchConversation(conversationId, { request_status: "accepted" });

    const currentReply = replyingTo;
    setReplyingTo(null);

    await t.send({
      body,
      replyTo: currentReply ? { id: currentReply.id, body: currentReply.body } : undefined,
    });
  }

  async function handleSendVoice(result: VoiceRecordingResult) {
    stick.current = true;
    upsertLast(conversationId, "🎤 Voice message");
    if (conv && isPending(conv)) patchConversation(conversationId, { request_status: "accepted" });

    const currentReply = replyingTo;
    setReplyingTo(null);

    await t.send({
      type: "audio",
      mediaKey: result.mediaKey,
      mediaType: result.mediaType,
      mediaUrl: result.blobUrl,
      replyTo: currentReply ? { id: currentReply.id, body: currentReply.body } : undefined,
    });
  }

  async function react(m: Message, emoji: string) {
    setPicker(null);
    try {
      t.setReactions(m.id, await messagingApi.react(m.conversation_id, m.id, emoji));
    } catch {
      /* keep the old reactions */
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
    if (area.current) {
      area.current.focus();
      area.current.style.height = "auto";
      area.current.style.height = `${Math.min(area.current.scrollHeight, 128)}px`;
    }
  }

  function copyText(m: Message) {
    if (m.body) {
      navigator.clipboard?.writeText(m.body).catch(() => {});
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await t.deleteMessage(deleteTarget.m.id, deleteTarget.scope);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete message", err);
    } finally {
      setDeleteBusy(false);
    }
  }

  const name = conv ? convName(conv) : "";
  const username = conv?.other_user?.username;

  // Criteria for edit and delete permissions
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
        {/* Header */}
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
              <span className="shrink-0 cursor-pointer" onClick={() => !xl && setSheet(true)}>
                <RingAvatar
                  url={convAvatar(conv)}
                  name={name}
                  size={36}
                  ring={ringFor(conv.other_user?.id)}
                />
              </span>
              <div
                className={`min-w-0 ${xl ? "" : "cursor-pointer"}`}
                onClick={() => !xl && setSheet(true)}
              >
                <p className="truncate text-[15px] font-bold text-fg">{name}</p>
                {username && <p className="truncate text-supporting text-muted">@{username}</p>}
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

        {/* Message Scroller */}
        <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
                  <span className="sk-block h-10 rounded-[22px]" style={{ width: `${w}%` }} />
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

            // Delivery / read indicator heuristic: read if other user has seen/messaged after
            const isRead = !!newestOther && newestOther.id > m.id;

            return (
              <div key={m.local_id ?? m.id}>
                {newDay && m.created_at && (
                  <p className="my-3 text-center">
                    <span className="rounded-full bg-card px-3 py-1 text-[11.5px] font-semibold text-muted">
                      {dayLabel(m.created_at)}
                    </span>
                  </p>
                )}
                <Bubble
                  m={m}
                  mine={mine}
                  showAvatar={!mine && lastInBlock}
                  firstInBlock={firstInBlock}
                  lastInBlock={lastInBlock}
                  isRead={isRead}
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
                />
              </div>
            );
          })}

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

        {/* Composer section */}
        <div
          className="px-3 pb-3 pt-2"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
        >
          {/* Replying banner */}
          {replyingTo && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-surface-subtle px-3 py-2 text-supporting text-fg animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="reply" className="size-4 text-brand shrink-0" />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-brand">
                    Replying to{" "}
                    {replyingTo.sender?.name ||
                      (replyingTo.sender_id === myId ? "yourself" : "message")}
                  </p>
                  <p className="truncate text-secondary text-muted text-[13px]">
                    {replyingTo.type === "audio"
                      ? "🎤 Voice message"
                      : (replyingTo.body ?? "Message")}
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

          {/* Editing banner */}
          {editingMessage && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-surface-subtle px-3 py-2 text-supporting text-fg animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="pen" className="size-4 text-brand shrink-0" />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-brand">Editing message</p>
                  <p className="truncate text-secondary text-muted text-[13px]">
                    {editingMessage.body}
                  </p>
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

          {/* If voice recording is in progress, show the dedicated recorder bar */}
          {voiceRecorder.status !== "idle" ? (
            <VoiceRecorderBar
              recorder={voiceRecorder}
              onSend={handleSendVoice}
              onCancel={() => voiceRecorder.discard()}
            />
          ) : (
            <div className="flex items-end gap-1 rounded-[26px] bg-surface-subtle p-1.5 pl-4">
              <textarea
                ref={area}
                value={text}
                rows={1}
                placeholder={editingMessage ? "Edit message…" : "Message"}
                onChange={(e) => {
                  setText(e.target.value);
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

              {/* Toggle between Send and Microphone */}
              {text.trim().length > 0 || editingMessage ? (
                <button
                  type="button"
                  aria-label={editingMessage ? "Save edit" : "Send"}
                  disabled={!text.trim()}
                  onClick={() => void submit()}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-fg transition active:scale-95 disabled:bg-surface-interactive disabled:text-muted/50"
                >
                  <Icon name={editingMessage ? "check" : "send"} filled className="size-[18px]" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Record voice message"
                  onClick={() => void voiceRecorder.start()}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-brand active:scale-95"
                >
                  <Icon name="microphone" className="size-[20px]" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Details drawer or dock */}
      {conv && (xl ? details : sheet) && (
        <ConversationDetails
          conv={conv}
          messages={msgs}
          ring={ringFor(conv.other_user?.id)}
          variant={xl ? "dock" : "sheet"}
          onClose={() => (xl ? setDetails(false) : setSheet(false))}
        />
      )}

      {/* Context Menu for message actions */}
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
          onRetry={() => menuTarget.m.local_id && void t.retry(menuTarget.m.local_id)}
          onDeleteForMe={() => setDeleteTarget({ m: menuTarget.m, scope: "me" })}
          onDeleteEveryone={() => setDeleteTarget({ m: menuTarget.m, scope: "everyone" })}
          onClose={() => setMenuTarget(null)}
        />
      )}

      {/* Delete confirmation modal */}
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
