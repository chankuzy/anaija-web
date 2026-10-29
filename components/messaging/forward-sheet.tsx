"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { mediaUrl } from "@/lib/api/feed";
import { convAvatar, convName, isPending, messagingApi, type Message } from "@/lib/api/messaging";
import { shareApi, type ShareTarget } from "@/lib/api/share";
import { useAuth } from "@/lib/auth/auth-context";
import { usePaged, type Page } from "@/lib/paged/use-paged";
import { CUSTOM_STICKER_BODY, uploadCustomSticker } from "@/lib/stickers/custom";
import { useMessages } from "./messages-context";

type Target = { key: string; name: string; sub: string; avatar: string | null; conversationId: number | null; userId: number | null };

/** Inverse of mediaUrl(): the storage key behind a media URL, or null when it can't be told. */
function keyFromUrl(url: string): string | null {
  const probe = "zzprobekey";
  const sample = mediaUrl(probe);
  if (!sample || !sample.endsWith(probe)) return null;
  const base = sample.slice(0, -probe.length);
  return base.length > 0 && url.startsWith(base) && url.length > base.length ? url.slice(base.length) : null;
}

export function ForwardSheet({ message, onClose }: { message: Message; onClose: () => void; flash?: (t: string) => void }) {
  const { user } = useAuth();
  const { conversations, upsertLast } = useMessages();
  const [query, setQuery] = useState("");
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = useRef<Promise<{ mediaKey: string; mediaType: string }> | null>(null);
  const tempIds = useRef(new Map<string, string>());
  const username = user?.username ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const load = useCallback(
    async (cursor: number | null, signal?: AbortSignal): Promise<Page<ShareTarget, number>> => {
      const page = cursor ?? 1;
      const r = await shareApi.following(username as string, page, signal);
      return { items: r.items, cursor: r.hasMore ? page + 1 : null, hasMore: r.hasMore };
    },
    [username],
  );
  const { data, loadMore } = usePaged<ShareTarget, number>({ id: `forward-following:${username ?? ""}`, enabled: !!username, load, staleMs: 120_000 });

  const targets = useMemo(() => {
    const out: Target[] = (conversations ?? [])
      .filter((c) => !isPending(c))
      .map((c) => ({
        key: `c${c.id}`,
        name: convName(c),
        sub: c.other_user ? `@${c.other_user.username}` : "Group chat",
        avatar: convAvatar(c),
        conversationId: c.id,
        userId: c.other_user?.id ?? null,
      }));
    const have = new Set(out.map((t) => t.userId).filter((x): x is number => x !== null));
    for (const t of data?.items ?? []) {
      if (have.has(t.id)) continue;
      out.push({ key: `u${t.id}`, name: t.name || t.username, sub: `@${t.username}`, avatar: t.avatar, conversationId: t.conversationId ?? null, userId: t.id });
    }
    const q = query.trim().toLowerCase();
    return q ? out.filter((t) => t.name.toLowerCase().includes(q) || t.sub.toLowerCase().includes(q)) : out;
  }, [conversations, data, query]);

  function uploadCopy() {
    if (!copy.current) {
      copy.current = (async () => {
        const r = await fetch(message.media_url as string, { mode: "cors" });
        if (!r.ok) throw new Error(`download ${r.status}`);
        const b = await r.blob();
        return uploadCustomSticker(b.type.startsWith("image/") ? b : new Blob([b], { type: "image/webp" }));
      })();
      copy.current.catch(() => {
        copy.current = null;
      });
    }
    return copy.current;
  }

  async function deliver(cid: number, tmp: string) {
    if (message.type === "sticker") {
      await messagingApi.send(cid, { type: "sticker", body: message.body ?? "", client_temp_id: tmp });
      return;
    }
    const type = message.media_type || "image/webp";
    // 1) reuse the file that is already in storage: instant, no download
    const key = message.media_url ? keyFromUrl(message.media_url) : null;
    if (key) {
      try {
        await messagingApi.send(cid, { type: "image", body: CUSTOM_STICKER_BODY, media_key: key, media_type: type, client_temp_id: tmp });
        return;
      } catch (e) {
        console.warn("[forward] reusing the stored file failed, uploading a copy", e);
      }
    }
    // 2) download once, upload a fresh copy
    const up = await uploadCopy();
    await messagingApi.send(cid, { type: "image", body: CUSTOM_STICKER_BODY, media_key: up.mediaKey, media_type: up.mediaType, client_temp_id: `${tmp}-b` });
  }

  async function send(t: Target) {
    if (busyKey || done.has(t.key)) return;
    setBusyKey(t.key);
    setError(null);
    try {
      const cid = t.conversationId ?? (await shareApi.openConversation(t.userId as number));
      let tmp = tempIds.current.get(t.key);
      if (!tmp) {
        tmp = `fwd-${message.id}-${t.key}-${crypto.randomUUID()}`;
        tempIds.current.set(t.key, tmp);
      }
      await deliver(cid, tmp);
      upsertLast(cid, "Sticker");
      setDone((s) => new Set(s).add(t.key));
    } catch (e) {
      console.error("[forward] failed", e);
      setError(e instanceof ApiError ? e.message : "Couldn't forward that sticker. Please try again.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Forward sticker">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/55" />
      <div
        className="glass relative m-2.5 flex h-[min(74dvh,600px)] w-full max-w-md flex-col overflow-hidden rounded-floating"
        style={{ marginBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        <div className="flex h-12 shrink-0 items-center justify-center">
          <h2 className="text-[16px] font-bold tracking-tight text-fg">Forward to</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="absolute right-2 grid size-9 place-items-center rounded-full text-fg hover:bg-white/8">
            <Icon name="close" className="size-5" />
          </button>
        </div>
        <div className="shrink-0 px-4 pb-2">
          <label className="flex h-11 items-center gap-2.5 rounded-full bg-surface-interactive px-3.5">
            <Icon name="search" className="size-[18px] shrink-0 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" autoComplete="off" className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-muted" />
          </label>
        </div>
        {error && <p role="alert" className="shrink-0 px-5 pb-2 text-[12.5px] font-medium text-danger">{error}</p>}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) loadMore();
          }}
        >
          {targets.length === 0 ? (
            <p className="px-6 py-10 text-center text-secondary text-muted">No one found</p>
          ) : (
            targets.map((t) => {
              const sent = done.has(t.key);
              return (
                <div key={t.key} className="flex items-center gap-3 px-5 py-2">
                  <Avatar url={t.avatar} name={t.name} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-fg">{t.name}</p>
                    <p className="truncate text-supporting text-muted">{t.sub}</p>
                  </div>
                  <button
                    type="button"
                    disabled={sent || busyKey !== null}
                    onClick={() => void send(t)}
                    className={`flex h-8 min-w-[76px] items-center justify-center gap-1 rounded-full px-4 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60 ${sent ? "bg-surface-interactive text-muted" : "bg-brand text-brand-fg"}`}
                  >
                    {sent ? (<><Icon name="check" weight="strong" className="size-3.5" />Sent</>) : busyKey === t.key ? "Sending…" : "Send"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
