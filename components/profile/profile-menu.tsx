"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { usersApi, type UserProfile } from "@/lib/api/users";
import { Icon } from "@/components/ui/icon";

// Port of _ProfileMoreMenu (other people's profiles): Unfollow, Notify me of posts, Block / Unblock.
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
      // The endpoint toggles; if our view was stale and it re-blocked, toggle once more.
      if (await usersApi.toggleBlock(profile.id)) await usersApi.toggleBlock(profile.id);
      onToast(`Unblocked @${profile.username}`);
    } catch (e) {
      onToast(e instanceof ApiError ? e.message : "Couldn't unblock");
    }
  }

  const row = "flex w-full items-center gap-3 px-4 py-3 text-left text-[14.5px] font-semibold text-white";
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 cursor-default bg-black/25" />
      <div
        role="menu"
        className="glass absolute right-3 w-[252px] overflow-hidden rounded-[20px] py-1.5"
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
              <Icon name="userPlus" className="size-5" />
              Unfollow
            </button>
            <button type="button" role="menuitem" className={row} onClick={() => void toggleNotify()}>
              <Icon name="bell" filled={notify === true} className="size-5" />
              <span className="flex-1">Notify me of posts</span>
              <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-all ${notify ? "justify-end bg-white" : "justify-start bg-white/25"}`}>
                <span className={`size-4 rounded-full ${notify ? "bg-black" : "bg-white/70"}`} />
              </span>
            </button>
            <div className="mx-3.5 my-1 h-px bg-white/12" />
          </>
        )}
        {blocked === true ? (
          <button type="button" role="menuitem" className={row} onClick={() => void unblock()}>
            <Icon name="close" className="size-5" />
            Unblock @{profile.username}
          </button>
        ) : (
          <button type="button" role="menuitem" className={`${row} !text-danger`} onClick={() => void block()}>
            <Icon name="close" className="size-5" />
            Block @{profile.username}
          </button>
        )}
      </div>
    </div>
  );
}
