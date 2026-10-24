/* eslint-disable @next/next/no-img-element */
"use client";

import { ProfileHoverCard } from "@/components/profile/profile-hover-card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { Avatar } from "@/components/ui/avatar";
import { useMessages } from "./messages-context";
import { RingAvatar } from "./ring-avatar";
import { ConversationDetails } from "./conversation-details";
import { SharedPostCard } from "./shared-post-card";

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
  const time = d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  const date = d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
  });
  return `${date}, ${time}`;
}

function Media({ m }: { m: Message }) {
  if (m.is_deleted || !m.media_url) return null;
  if (m.type === "image") return <img src={m.media_url} alt="" loading="lazy" decoding="async" className="mb-1 max-h-80 max-w-full rounded-2xl object-cover" />;
  if (m.type === "video") return <video src={m.media_url} controls preload="metadata" className="mb-1 max-h-80 max-w-full rounded-2xl" />;
  if (m.type === "audio") return <audio src={m.media_url} controls preload="none" className="mb-1 max-w-full" />;
  return (
    <a href={m.media_url} target="_blank" rel="noreferrer" className="mb-1 inline-flex items-center gap-2 rounded-2xl bg-card-elevated px-4 py-3 text-body text-fg hover:bg-surface-elevated">
      <Icon name="paperclip" className="size-5" />
      Attachment
    </a>
  );
}

function Bubble({
  m,
  mine,
  showAvatar,
  lastInBlock,
  isLastMine,
  myId,
  pickerOpen,
  onPicker,
  onReact,
  onRetry,
}: {
  m: Message;
  mine: boolean;
  showAvatar: boolean;
  lastInBlock: boolean;
  isLastMine: boolean;
  myId: number | undefined;
  pickerOpen: boolean;
  onPicker: () => void;
  onReact: (emoji: string) => void;
  onRetry: () => void;
}) {
  const text = m.is_deleted ? "This message was deleted" : (m.body ?? "");
  const hasMedia = !!m.media_url && !m.is_deleted && ["image", "video", "audio", "file"].includes(m.type);
  const showText = text.trim() !== "" && !(hasMedia && m.type === "file");
  const reacts = Object.entries(m.reactions).filter(([, ids]) => ids.length > 0);
  const canReact = m.id > 0 && !m.is_deleted && !m.status;

  if (m.type === "system") {
    return <p className="my-2 text-center text-supporting text-muted">{text}</p>;
  }

  return (
    <div className={`group/msg flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${lastInBlock ? "mb-2" : "mb-[2px]"}`}>
      {!mine && (showAvatar ? <ProfileHoverCard username={m.sender?.username}><Avatar url={m.sender?.avatar} name={m.sender?.name} size={28} /></ProfileHoverCard> : <span className="w-7 shrink-0" />)}

      {mine && canReact && (
        <button type="button" onClick={onPicker} aria-label="React" className="mb-1 hidden size-7 place-items-center rounded-full text-sm opacity-0 transition-opacity hover:bg-white/10 group-hover/msg:opacity-100 md:grid">
          🙂
        </button>
      )}

      <div className={`relative flex min-w-0 max-w-[74%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {pickerOpen && (
          <div className={`glass absolute bottom-full z-20 mb-1 flex gap-1 rounded-full px-2 py-1.5 ${mine ? "right-0" : "left-0"}`}>
            {QUICK.map((e) => (
              <button key={e} type="button" onClick={() => onReact(e)} className="grid size-9 place-items-center rounded-full text-xl transition-transform hover:scale-125 hover:bg-white/10">
                {e}
              </button>
            ))}
          </div>
        )}
        {m.reply_to && (
          <span className="mb-1 max-w-full truncate rounded-xl bg-white/6 px-3 py-1.5 text-supporting text-muted">
            <Icon name="reply" className="mr-1 inline size-3.5 align-[-2px]" />{m.reply_to.body ?? "Message"}
          </span>
        )}
        {m.shared_post && <SharedPostCard post={m.shared_post} />}
        <Media m={m} />
        {showText && (
          <span
            onClick={m.status === "failed" ? onRetry : undefined}
            className={`whitespace-pre-wrap break-words rounded-[22px] ${lastInBlock ? (mine ? "rounded-br-[8px]" : "rounded-bl-[8px]") : ""} px-4 py-2.5 text-[14.5px] font-medium leading-[1.42] ${
              mine ? "bubble-sent" : "bg-card-elevated text-fg"
            } ${m.is_deleted ? "italic opacity-60" : ""} ${m.status ? "opacity-80" : ""} ${m.status === "failed" ? "cursor-pointer" : ""}`}
          >
            {text}
          </span>
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
                  className={`flex items-center gap-1 rounded-xl px-2 py-[3px] text-[13px] ${own ? "bg-brand/25" : "bg-card-elevated"}`}
                >
                  {emoji}
                  {ids.length > 1 && <span className="text-[11.5px] font-bold text-fg">{ids.length}</span>}
                </button>
              );
            })}
          </span>
        )}
        {(m.status === "failed" || m.status === "sending" || isLastMine) && (
          <span className="mt-1 px-1 text-micro text-muted">
            {m.status === "failed" ? "Tap to retry" : m.status === "sending" ? "Sending…" : "Sent"}
          </span>
        )}
      </div>

      {!mine && canReact && (
        <button type="button" onClick={onPicker} aria-label="React" className="mb-1 hidden size-7 place-items-center rounded-full text-sm opacity-0 transition-opacity hover:bg-white/10 group-hover/msg:opacity-100 md:grid">
          🙂
        </button>
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
  const newestOther = useMemo(() => [...msgs].reverse().find((m) => m.sender_id !== myId && m.id > 0) ?? null, [msgs, myId]);
  useEffect(() => {
    if (!newestOther || newestOther.id <= lastRead.current) return;
    lastRead.current = newestOther.id;
    void messagingApi.markRead(conversationId, newestOther.id).then(() => patchConversation(conversationId, { unread_count: 0 }));
  }, [newestOther, conversationId, patchConversation]);

  async function submit() {
    const body = text.trim();
    if (!body) return;
    setText("");
    if (area.current) area.current.style.height = "auto";
    stick.current = true;
    upsertLast(conversationId, body);
    if (conv && isPending(conv)) patchConversation(conversationId, { request_status: "accepted" });
    await t.send(body);
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

  const name = conv ? convName(conv) : "";
  const username = conv?.other_user?.username;

  return (
    <div className="relative flex h-full min-h-0">
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 px-3 py-2.5">
        <Link href="/messages" aria-label="Back" className="grid size-10 place-items-center rounded-full text-fg hover:bg-white/8 md:hidden">
          <Icon name="back" className="size-6" />
        </Link>
        {conv ? (
          <>
            <span className="shrink-0 cursor-pointer" onClick={() => !xl && setSheet(true)}>
              <RingAvatar url={convAvatar(conv)} name={name} size={36} ring={ringFor(conv.other_user?.id)} />
            </span>
            <div className={`min-w-0 ${xl ? "" : "cursor-pointer"}`} onClick={() => !xl && setSheet(true)}>
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
          className={`ml-auto grid size-10 place-items-center rounded-full transition-colors hover:bg-white/8 ${xl && details ? "text-brand" : "text-white/60"}`}
        >
          <Icon name="infoCircle" filled={xl && details} className="size-6" />
        </button>
      </header>

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
              {t.loadingOlder ? <span role="status" aria-label="Loading earlier messages" className="sk-block inline-block h-3 w-28 rounded-full align-middle" /> : "Load earlier messages"}
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
          const lastInBlock =
            !nextM ||
            nextM.sender_id !== m.sender_id ||
            dayKey(nextM.created_at) !== dayKey(m.created_at) ||
            Math.abs(Date.parse(nextM.created_at) - Date.parse(m.created_at)) >= GAP_MS;
          return (
            <div key={m.local_id ?? m.id}>
              {newDay && m.created_at && (
                <p className="my-3 text-center">
                  <span className="rounded-full bg-card px-3 py-1 text-[11.5px] font-semibold text-muted">{dayLabel(m.created_at)}</span>
                </p>
              )}
              <Bubble
                m={m}
                mine={mine}
                showAvatar={!mine && lastInBlock}
                lastInBlock={lastInBlock}
                isLastMine={mine && m === last}
                myId={myId}
                pickerOpen={picker === m.id}
                onPicker={() => setPicker((p) => (p === m.id ? null : m.id))}
                onReact={(e) => void react(m, e)}
                onRetry={() => m.local_id && void t.retry(m.local_id)}
              />
            </div>
          );
        })}

        {conv && isPending(conv) && (
          <div className="mx-auto my-3 max-w-sm rounded-[20px] bg-surface p-4">
            <p className="text-body font-bold text-fg">This is a message request.</p>
            <p className="mt-1 text-secondary text-muted">You can accept the conversation or decline it.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={responding} onClick={() => respond("accept")} className="h-10 flex-1 rounded-full bg-brand text-secondary font-extrabold text-brand-fg disabled:opacity-50">
                Accept
              </button>
              <button type="button" disabled={responding} onClick={() => respond("decline")} className="h-10 flex-1 rounded-full bg-card-elevated text-secondary font-bold text-fg hover:bg-surface-elevated disabled:opacity-50">
                Decline
              </button>
            </div>
            <button type="button" disabled={responding} onClick={() => respond("block")} className="mt-2 w-full text-center text-supporting font-semibold text-danger disabled:opacity-50">
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

      <div className="px-3 pb-3 pt-2" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
        <div className="flex items-end gap-1 rounded-[26px] bg-surface-subtle p-1.5 pl-4">
          <textarea
            ref={area}
            value={text}
            rows={1}
            placeholder="Message"
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
            className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-[1.35] text-fg outline-none placeholder:text-muted"
          />
          <button
            type="button"
            aria-label="Send"
            disabled={!text.trim()}
            onClick={() => void submit()}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-fg transition active:scale-95 disabled:bg-surface-interactive disabled:text-muted/50"
          >
            <Icon name="send" filled className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
    {conv && (xl ? details : sheet) && (
      <ConversationDetails conv={conv} messages={msgs} ring={ringFor(conv.other_user?.id)} variant={xl ? "dock" : "sheet"} onClose={() => (xl ? setDetails(false) : setSheet(false))} />
    )}
    </div>
  );
}
