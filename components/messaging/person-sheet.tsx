"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StoryRingAvatar } from "@/components/profile/story-ring-avatar";
import { useToast } from "@/components/settings/settings-kit";
import { Icon, type IconName } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { conversationInfoApi, seenLabel, type ConversationInfo } from "@/lib/api/conversation-info";
import { convAvatar, convName, type Conversation } from "@/lib/api/messaging";
import { usersApi } from "@/lib/api/users";
import { useCached } from "@/lib/cache/swr";
import { useMessagesUnread } from "@/lib/messaging/unread-context";
import { useProfile } from "@/lib/profile/use-profile";
import { useStoryHost } from "@/lib/stories/story-host";
import { useStoryRing } from "@/lib/stories/use-story-ring";
import { confirmDialog } from "@/lib/ui/dialog";
import { useMessages } from "./messages-context";

const msgOf = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function Row({
  icon,
  label,
  hint,
  danger,
  busy,
  onClick,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  danger?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-[15px] font-semibold transition-colors hover:bg-white/5 active:bg-white/8 disabled:opacity-50 ${
        danger ? "text-danger" : "text-fg"
      }`}
    >
      <Icon name={icon} className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint && <span className="block truncate text-supporting font-normal text-muted">{hint}</span>}
      </span>
    </button>
  );
}

// Bottom sheet for the person you are chatting with: picture on top, then what you can do with them.
export function PersonSheet({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const router = useRouter();
  const { patchConversation, reloadInbox } = useMessages();
  const unread = useMessagesUnread();
  const host = useStoryHost();
  const { toast, show } = useToast();
  const [muting, setMuting] = useState(false);

  const other = conv.other_user;
  const otherId = other?.id ?? null;
  const username = other?.username || null;
  const name = convName(conv);
  const handle = username ? `@${username}` : name;
  const ring = useStoryRing(otherId ?? undefined, otherId !== null);
  const hasStory = ring !== "none";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { data: info } = useCached<ConversationInfo>(`convinfo:${conv.id}`, () => conversationInfoApi.info(conv.id), {
    staleMs: 60_000,
    persist: false,
  });
  const seen = info?.peerLastSeen ? seenLabel(info.peerLastSeen) : "";

  const { profile } = useProfile(username ?? "", !!username);
  const following = profile?.is_following === true;
  const { data: notify, mutate: mutateNotify } = useCached<boolean>(
    following && otherId !== null ? `notify:${otherId}` : null,
    () => usersApi.notifyGet(otherId as number),
    { staleMs: 120_000 },
  );

  function viewStory() {
    if (otherId === null) return;
    onClose();
    if (!host.openById(otherId)) show("No story right now");
  }

  function viewProfile() {
    if (!username) return;
    onClose();
    router.push(`/u/${username}`);
  }

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

  async function shareProfile() {
    if (!username) return;
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin).replace(/\/+$/, "");
    const url = `${base}/u/${username}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: name, url });
        return;
      }
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      show("Profile link copied");
    } catch {
      show("Couldn't copy the link");
    }
  }

  function report() {
    if (!username) return;
    onClose();
    router.push(`/settings/report?about=${encodeURIComponent(username)}`);
  }

  async function block() {
    if (otherId === null) return;
    const ok = await confirmDialog({
      title: `Block ${handle}?`,
      message: "You'll stop following each other and this conversation will be hidden. You can undo it any time from Settings.",
      confirmLabel: "Block",
      danger: true,
    });
    if (!ok) return;
    try {
      await conversationInfoApi.setBlocked(otherId, true);
      reloadInbox();
      onClose();
      router.push("/messages");
    } catch (e) {
      show(msgOf(e, "Couldn't block"));
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={name}>
      <button type="button" aria-label="Close" onClick={onClose} className="sv-overlay absolute inset-0 cursor-default bg-black/55" />
      <div
        className="sv-rise relative w-full max-w-md overflow-hidden rounded-t-sheet bg-surface-subtle md:rounded-floating"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <span className="mx-auto mt-2 block h-1 w-9 rounded-full bg-white/20 md:hidden" />
        <div className="flex flex-col items-center px-6 pt-5 text-center">
          <button
            type="button"
            aria-label={hasStory ? "View story" : "Profile picture"}
            disabled={!hasStory}
            onClick={viewStory}
            className="rounded-full transition-transform active:scale-95 disabled:active:scale-100"
          >
            <StoryRingAvatar url={convAvatar(conv)} name={name} size={96} ring={ring} />
          </button>
          <p className="mt-4 max-w-full truncate text-[19px] font-extrabold tracking-tight text-fg">{name}</p>
          {username && <p className="mt-0.5 max-w-full truncate text-secondary text-muted">@{username}</p>}
          {seen && <p className="mt-1 text-supporting text-muted">{seen}</p>}
        </div>

        <div className="mt-4 px-2 pb-1">
          {hasStory && <Row icon="play" label="View story" hint={ring === "unseen" ? "New" : undefined} onClick={viewStory} />}
          {username && <Row icon="user" label="View profile" onClick={viewProfile} />}
          <Row
            icon={conv.is_muted ? "bellOff" : "bell"}
            label={conv.is_muted ? "Unmute messages" : "Mute messages"}
            busy={muting}
            onClick={() => void toggleMute()}
          />
          {following && notify !== undefined && (
            <Row
              icon="bell"
              label={notify ? "Turn off post notifications" : "Notify me when they post"}
              onClick={() => void toggleNotify()}
            />
          )}
          {username && <Row icon="link" label="Share profile" onClick={() => void shareProfile()} />}
          {username && <Row icon="infoCircle" label={`Report ${handle}`} danger onClick={report} />}
          <Row icon="forbidden" label={`Block ${handle}`} danger onClick={() => void block()} />
        </div>
      </div>
      {toast}
    </div>
  );
}
