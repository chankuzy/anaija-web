/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/settings/settings-kit";
import { Icon, type IconName } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { conversationInfoApi, seenLabel, type ConversationInfo, type SharedItem } from "@/lib/api/conversation-info";
import { convAvatar, convName, isInquiry, type Conversation, type Message } from "@/lib/api/messaging";
import { settingsApi, type BlockedUser } from "@/lib/api/settings";
import { usersApi } from "@/lib/api/users";
import { useCached } from "@/lib/cache/swr";
import { useMessagesUnread } from "@/lib/messaging/unread-context";
import { useCommunityOf } from "@/lib/messaging/use-community-of";
import { useProfile } from "@/lib/profile/use-profile";
import { useMessages } from "./messages-context";
import { RingAvatar } from "./ring-avatar";

const PAGE = 60;
type Tab = "media" | "shared";
const msgOf = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

// What the thread already has in memory: shown instantly while the full history loads from the server.
function fromMessages(msgs: Message[]): SharedItem[] {
  const out: SharedItem[] = [];
  for (const m of [...msgs].reverse()) {
    if (m.is_deleted || m.id <= 0) continue;
    if (m.shared_post && !m.shared_post.unavailable) {
      out.push({
        kind: "post",
        url: null,
        name: null,
        postId: m.shared_post.id,
        postType: m.shared_post.type,
        thumb: m.shared_post.image,
        postIsVideo: m.shared_post.is_video,
        createdAt: m.created_at,
      });
    } else if (m.media_url && (m.type === "image" || m.type === "video")) {
      out.push({ kind: m.type, url: m.media_url, name: null, postId: null, postType: null, thumb: null, postIsVideo: false, createdAt: m.created_at });
    }
  }
  return out;
}

function ToggleRow({
  icon,
  label,
  hint,
  on,
  busy,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  on: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy || disabled}
      onClick={onClick}
      className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/4 disabled:opacity-60"
    >
      <Icon name={icon} className="size-5 shrink-0 text-white/85" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-fg">{label}</span>
        {hint && <span className="block truncate text-supporting text-muted">{hint}</span>}
      </span>
      <span aria-hidden="true" className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors ${on ? "bg-brand" : "bg-surface-elevated"}`}>
        <span
          className={`absolute left-[3px] top-[3px] size-5 rounded-full transition-transform duration-200 ${
            on ? "translate-x-5 bg-brand-fg" : "translate-x-0 bg-white/80"
          }`}
        />
      </span>
    </button>
  );
}

function Tile({ it }: { it: SharedItem }) {
  const box = "relative block aspect-square overflow-hidden rounded-[10px] bg-card";
  if (it.kind === "post") {
    const href = `${it.postType === "listing" ? "/l" : "/p"}/${it.postId}`;
    return (
      <Link href={href} className={box}>
        {it.thumb ? (
          <img src={it.thumb} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <span className="absolute inset-0" style={{ background: "linear-gradient(160deg,#1d1d24 0%,#0b0b0f 100%)" }} />
        )}
        {it.postIsVideo && (
          <span className="icon-shadow absolute inset-0 grid place-items-center text-white">
            <Icon name="play" filled className="size-7" />
          </span>
        )}
        <Icon name="link" filled className="icon-shadow absolute right-1.5 top-1.5 size-3.5 text-white" />
      </Link>
    );
  }
  return (
    <a href={it.url ?? "#"} target="_blank" rel="noreferrer" className={box}>
      {it.kind === "image" ? (
        <img src={it.url ?? undefined} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <>
          <video src={it.url ?? undefined} preload="metadata" muted className="size-full object-cover" />
          <span className="icon-shadow absolute inset-0 grid place-items-center text-white">
            <Icon name="play" filled className="size-7" />
          </span>
        </>
      )}
    </a>
  );
}

// Details for one conversation. variant "dock" = right-hand column (xl+); "sheet" = full-screen over the thread.
export function ConversationDetails({
  conv,
  messages,
  ring,
  variant,
  onClose,
}: {
  conv: Conversation;
  messages: Message[];
  ring: boolean;
  variant: "dock" | "sheet";
  onClose: () => void;
}) {
  const { patchConversation, reloadInbox } = useMessages();
  const unread = useMessagesUnread();
  const { toast, show } = useToast();
  const community = useCommunityOf(conv);
  const [tab, setTab] = useState<Tab>("media");
  const [limit, setLimit] = useState(PAGE);
  const [muting, setMuting] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const name = convName(conv);
  const otherId = conv.other_user?.id ?? null;
  const username = conv.other_user?.username || null;
  const direct = otherId !== null && conv.type !== "group";
  const handle = username ? `@${username}` : name;
  const kind = conv.type === "group" ? "Group" : isInquiry(conv) ? "Marketplace inquiry" : "Direct message";

  useEffect(() => {
    if (variant !== "sheet") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant, onClose]);

  // ── last seen ──
  const { data: info } = useCached<ConversationInfo>(`convinfo:${conv.id}`, () => conversationInfoApi.info(conv.id), {
    staleMs: 60_000,
    persist: false,
  });
  const seen = direct && info?.peerLastSeen ? seenLabel(info.peerLastSeen) : "";

  // ── shared items (memory only: chat content never goes to disk) ──
  const { data: items, loading: itemsLoading, error: itemsError, refresh: refreshItems } = useCached<SharedItem[]>(
    `convmedia:${conv.id}`,
    () => conversationInfoApi.media(conv.id),
    { staleMs: 30_000, persist: false },
  );
  const fallback = useMemo(() => fromMessages(messages), [messages]);
  const all = items ?? fallback;
  const media = all.filter((i) => i.kind === "image" || i.kind === "video");
  const shared = all.filter((i) => i.kind === "post");
  const list = tab === "media" ? media : shared;
  const waiting = items === undefined && fallback.length === 0 && itemsLoading;
  const failed = items === undefined && !!itemsError && fallback.length === 0;

  // ── mute (instant, rolls back on failure) ──
  async function toggleMute() {
    if (muting) return;
    setMuting(true);
    const next = !conv.is_muted;
    patchConversation(conv.id, { is_muted: next });
    try {
      const now = await conversationInfoApi.setMuted(conv.id, next);
      if (now !== next) patchConversation(conv.id, { is_muted: now });
      unread.refresh();
      show(now ? "Messages muted" : "Messages unmuted");
    } catch (e) {
      patchConversation(conv.id, { is_muted: !next });
      show(msgOf(e, "Couldn't update"));
    } finally {
      setMuting(false);
    }
  }

  // ── post notifications (only for people you follow) ──
  const { profile } = useProfile(username ?? "", direct && !!username);
  const following = profile?.is_following === true;
  const { data: notify, mutate: mutateNotify } = useCached<boolean>(
    direct && following && otherId !== null ? `notify:${otherId}` : null,
    () => usersApi.notifyGet(otherId as number),
    { staleMs: 120_000 },
  );
  async function toggleNotify() {
    if (otherId === null || notify === undefined) return;
    const cur = notify;
    mutateNotify(() => !cur);
    try {
      const now = await usersApi.notifyToggle(otherId);
      mutateNotify(() => now);
      show(now ? `You'll be notified when ${handle} posts` : "Post notifications off");
    } catch (e) {
      mutateNotify(() => cur);
      show(msgOf(e, "Couldn't update"));
    }
  }

  // ── block (shares its list with Settings → Blocked accounts) ──
  const { data: blocked, refresh: refreshBlocked } = useCached<BlockedUser[]>(
    direct ? "settings:blocked" : null,
    () => settingsApi.blocked(),
    { staleMs: 60_000 },
  );
  const isBlocked = !!blocked && otherId !== null && blocked.some((u) => u.id === otherId);
  async function setBlocked(want: boolean) {
    if (otherId === null || blockBusy) return;
    setBlockBusy(true);
    try {
      const now = await conversationInfoApi.setBlocked(otherId, want);
      await refreshBlocked();
      reloadInbox();
      show(now ? `Blocked ${handle}` : `Unblocked ${handle}`);
    } catch (e) {
      show(msgOf(e, "Couldn't update"));
    } finally {
      setBlockBusy(false);
      setConfirm(false);
    }
  }

  const tabs: [Tab, string, number][] = [
    ["media", "Media", media.length],
    ["shared", "Shared", shared.length],
  ];

  const content = (
    <>
      <div className="flex flex-col items-center pt-6 text-center">
        <RingAvatar url={convAvatar(conv)} name={name} size={96} ring={ring} />
        <p className="mt-4 max-w-full truncate text-[19px] font-bold tracking-tight text-fg">{name}</p>
        {username && <p className="mt-0.5 max-w-full truncate text-secondary text-muted">@{username}</p>}
        <p className="mt-1.5 text-supporting text-muted">{seen || kind}</p>
        {community && (
          <Link
            href={`/c/${community.slug}`}
            className="mt-4 inline-flex h-10 items-center rounded-full bg-surface-interactive px-5 text-secondary font-bold text-fg transition-colors hover:bg-surface-elevated"
          >
            View community
          </Link>
        )}
        {!community && username && (
          <Link
            href={`/u/${username}`}
            className="mt-4 inline-flex h-10 items-center rounded-full bg-surface-interactive px-5 text-secondary font-bold text-fg transition-colors hover:bg-surface-elevated"
          >
            View profile
          </Link>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-[20px] bg-surface-subtle">
        <ToggleRow
          icon={conv.is_muted ? "bellOff" : "bell"}
          label="Mute messages"
          hint={conv.is_muted ? "Muted" : undefined}
          on={conv.is_muted}
          busy={muting}
          onClick={() => void toggleMute()}
        />
        {direct && following && (
          <>
            <div className="h-0.5" />
            <ToggleRow
              icon="bell"
              label="Post notifications"
              hint={`Get notified when ${handle} posts`}
              on={notify === true}
              disabled={notify === undefined}
              onClick={() => void toggleNotify()}
            />
          </>
        )}
      </div>

      <div className="mt-7 flex gap-6 px-1">
        {tabs.map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setLimit(PAGE);
            }}
            className={`relative pb-2.5 text-[14.5px] ${tab === id ? "font-bold text-white" : "font-medium text-muted"}`}
          >
            {label}
            {n > 0 && <span className="ml-1.5 text-supporting font-semibold text-muted">{n}</span>}
            {tab === id && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-brand" />}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {waiting ? (
          <div className="grid grid-cols-3 gap-1" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="sk-block aspect-square rounded-[10px]" />
            ))}
          </div>
        ) : failed ? (
          <div className="py-8 text-center">
            <p className="text-secondary text-muted">Couldn&apos;t load shared items.</p>
            <button type="button" onClick={() => void refreshItems()} className="mt-3 h-9 rounded-full bg-brand px-5 text-[13px] font-extrabold text-brand-fg">
              Try again
            </button>
          </div>
        ) : list.length === 0 ? (
          <p className="rounded-2xl bg-white/5 px-4 py-8 text-center text-secondary text-muted">
            {tab === "media" ? "No photos or videos yet" : "No shared posts yet"}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1">
              {list.slice(0, limit).map((it, i) => (
                <Tile key={`${it.kind}-${it.postId ?? it.url ?? i}-${i}`} it={it} />
              ))}
            </div>
            {list.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="mx-auto mt-4 block h-9 rounded-full bg-surface-interactive px-5 text-secondary font-bold text-fg hover:bg-surface-elevated"
              >
                Show more
              </button>
            )}
          </>
        )}
      </div>

      {direct && (
        <div className="mt-8 pt-2">
          <button
            type="button"
            disabled={blockBusy || blocked === undefined}
            onClick={() => (isBlocked ? void setBlocked(false) : setConfirm(true))}
            className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-[15px] font-semibold text-danger transition-colors hover:bg-white/4 disabled:opacity-50"
          >
            <Icon name="forbidden" className="size-5 shrink-0" />
            {isBlocked ? `Unblock ${handle}` : `Block ${handle}`}
          </button>
        </div>
      )}
    </>
  );

  const dialogs = (
    <>
      {confirm && (
        <div className="fixed inset-0 z-[70] grid place-items-center px-6" role="alertdialog" aria-modal="true" aria-label="Block">
          <button type="button" aria-label="Cancel" onClick={() => setConfirm(false)} className="absolute inset-0 cursor-default bg-black/60" />
          <div className="glass relative w-full max-w-sm rounded-floating p-5">
            <p className="text-base font-bold text-fg">Block {handle}?</p>
            <p className="mt-1 text-sm text-muted">You can undo this any time from Settings.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="h-10 rounded-full px-4 text-sm font-semibold text-fg hover:bg-white/8">
                Cancel
              </button>
              <button
                type="button"
                disabled={blockBusy}
                onClick={() => void setBlocked(true)}
                className="h-10 rounded-full px-4 text-sm font-semibold text-danger hover:bg-white/8 disabled:opacity-50"
              >
                {blockBusy ? "Blocking…" : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast}
    </>
  );

  if (variant === "dock") {
    return (
      <aside className="flex w-[340px] shrink-0 flex-col" aria-label="Conversation details">
        <div className="flex items-center gap-2 px-4 py-3.5">
          <h2 className="flex-1 text-[15px] font-bold text-fg">Details</h2>
          <button type="button" aria-label="Close details" onClick={onClose} className="grid size-9 place-items-center rounded-full text-white/60 hover:bg-white/8 hover:text-white">
            <Icon name="close" className="size-[18px]" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{content}</div>
        {dialogs}
      </aside>
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-bg" role="dialog" aria-label="Conversation details">
      <div className="flex items-center gap-1 px-2 pb-2" style={{ paddingTop: "calc(8px + env(safe-area-inset-top))" }}>
        <button type="button" aria-label="Back" onClick={onClose} className="grid size-10 place-items-center rounded-full text-fg hover:bg-white/8">
          <Icon name="back" className="size-6" />
        </button>
        <h2 className="text-[16px] font-bold text-fg">Details</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5" style={{ paddingBottom: "calc(32px + env(safe-area-inset-bottom))" }}>
        {content}
      </div>
      {dialogs}
    </div>
  );
}
