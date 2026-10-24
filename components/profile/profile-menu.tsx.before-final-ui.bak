"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { usersApi, type UserProfile } from "@/lib/api/users";

export function ProfileMenu({
  profile,
  following,
  onClose,
  onUnfollow,
  onBlocked,
  onToast,
}: {
  profile: UserProfile;
  following: boolean;
  onClose: () => void;
  onUnfollow: () => void;
  onBlocked: () => void;
  onToast: (m: string) => void;
}) {
  const [notify, setNotify] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    usersApi
      .blockedIds()
      .then((ids) => {
        if (!off) setBlocked(ids.has(profile.id));
      })
      .catch(() => {});
    if (following) {
      usersApi
        .notifyGet(profile.id)
        .then((v) => {
          if (!off) setNotify(v);
        })
        .catch(() => {});
    }
    return () => {
      off = true;
    };
  }, [profile.id, following]);

  async function toggleNotify() {
    if (busy) return;
    const prev = notify ?? false;
    setNotify(!prev);
    setBusy(true);
    try {
      const v = await usersApi.notifyToggle(profile.id);
      setNotify(v);
      onToast(v ? `You'll be notified when @${profile.username} posts` : `Post notifications off for @${profile.username}`);
    } catch (e) {
      setNotify(prev);
      onToast(e instanceof ApiError ? e.message : "Couldn't update");
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    if (!window.confirm(`Block @${profile.username}? You'll stop following each other and your conversation with them will be hidden.`)) return;
    onClose();
    try {
      await usersApi.toggleBlock(profile.id);
      onToast(`Blocked @${profile.username}`);
      onBlocked();
    } catch (e) {
      onToast(e instanceof ApiError ? e.message : "Couldn't block");
    }
  }

  async function unblock() {
    onClose();
    try {
      if (await usersApi.toggleBlock(profile.id)) await usersApi.toggleBlock(profile.id);
      onToast(`Unblocked @${profile.username}`);
    } catch (e) {
      onToast(e instanceof ApiError ? e.message : "Couldn't unblock");
    }
  }

  const row = "flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-semibold text-white transition hover:bg-white/10 active:bg-white/15";
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-xs" />
      <div
        role="menu"
        className="glass absolute right-3 w-[252px] overflow-hidden rounded-card border border-white/15 bg-black/80 py-1.5 backdrop-blur-xl shadow-2xl"
        style={{ top: "calc(60px + env(safe-area-inset-top))" }}
      >
        {following && (
          <>
            <button
              type="button"
              role="menuitem"
              className={row}
              onClick={() => {
                onClose();
                onUnfollow();
              }}
            >
              <Icon name="userCross" className="size-5 text-white" />
              Unfollow
            </button>
            <button type="button" role="menuitem" className={row} onClick={() => void toggleNotify()}>
              <Icon name="bell" filled={notify === true} className={`size-5 ${notify ? "text-amber-400" : "text-white"}`} />
              <span className="flex-1">Notify me of posts</span>
              <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-all ${notify ? "justify-end bg-amber-400" : "justify-start bg-white/25"}`}>
                <span className={`size-4 rounded-full ${notify ? "bg-black" : "bg-white"}`} />
              </span>
            </button>
            <div className="mx-3.5 my-1 h-px bg-white/12" />
          </>
        )}
        {blocked === true ? (
          <button type="button" role="menuitem" className={row} onClick={() => void unblock()}>
            <Icon name="forbidden" className="size-5 text-white" />
            Unblock @{profile.username}
          </button>
        ) : (
          <button type="button" role="menuitem" className={`${row} !text-rose-500`} onClick={() => void block()}>
            <Icon name="forbidden" className="size-5 text-rose-500" />
            Block @{profile.username}
          </button>
        )}
      </div>
    </div>
  );
}
