/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ingest, makeThumb } from "@/lib/chat/ingest";
import { getMediaProvider } from "@/lib/chat/media-provider";
import { sessionMedia } from "@/lib/chat/session-media";
import type { PickedFile } from "@/lib/chat/types";
import { useBlobUrl } from "@/lib/chat/use-blob-url";
import { ChatEditor } from "./chat-editor";

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

function Tile({ item, order, onToggle }: { item: PickedFile; order: number; onToggle: () => void }) {
  const url = useBlobUrl(item.thumb);
  const on = order > 0;
  return (
    <button type="button" aria-pressed={on} aria-label={on ? `Deselect, number ${order}` : "Select"} onClick={onToggle} className="relative aspect-square bg-card">
      {url ? (
        <img src={url} alt="" draggable={false} loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-muted"><Icon name="videocamera" filled className="size-6" /></span>
      )}
      {on && <span className="absolute inset-0 bg-black/35 ring-2 ring-inset ring-brand" />}
      {item.kind === "video" && item.durationMs != null && (
        <span className="absolute bottom-1 left-1.5 text-[11.5px] font-bold text-white text-shadow">{fmt(item.durationMs)}</span>
      )}
      <span className={`absolute right-1.5 top-1.5 grid size-[22px] place-items-center rounded-full text-[12px] font-extrabold ${on ? "bg-brand text-brand-fg" : "border-2 border-white/80 bg-black/20"}`}>
        {on ? order : null}
      </span>
    </button>
  );
}

export function MediaPicker({ max, onClose, onDone }: { max: number; onClose: () => void; onDone: (items: PickedFile[]) => void }) {
  const provider = useMemo(() => getMediaProvider(), []);
  const [pool, setPool] = useState<readonly PickedFile[]>(() => sessionMedia.list());
  const [lib, setLib] = useState<PickedFile[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<PickedFile[] | null>(null);

  useEffect(() => {
    if (!provider.library) return;
    let dead = false;
    setBusy(true);
    provider
      .library({ limit: 60 })
      .then((r) => !dead && setLib(r.items))
      .catch(() => !dead && setErr("Couldn't open your library."))
      .finally(() => !dead && setBusy(false));
    return () => {
      dead = true;
    };
  }, [provider]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !editItems && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editItems]);

  const all = useMemo(() => {
    const seen = new Set<string>();
    return [...lib, ...pool].filter((i) => !seen.has(i.id) && !!seen.add(i.id));
  }, [lib, pool]);
  const selected = sel.map((id) => all.find((i) => i.id === id)).filter((i): i is PickedFile => !!i);
  const images = selected.filter((i) => i.kind === "image");

  function toggle(id: string) {
    setErr(null);
    setSel((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= max) {
        setErr(`You can add up to ${max} at a time.`);
        return s;
      }
      return [...s, id];
    });
  }

  async function browse() {
    if (busy) return;
    setErr(null);
    const picking = provider.pick({ multiple: max > 1, video: true }); // called straight from the tap
    setBusy(true);
    try {
      const files = await picking;
      if (!files.length) return;
      const r = await ingest(files);
      sessionMedia.add(r.items);
      setPool(sessionMedia.list());
      setSel((s) => [...s, ...r.items.map((i) => i.id)].slice(0, max));
      if (r.errors.length) setErr(r.errors[0]);
    } finally {
      setBusy(false);
    }
  }

  async function applyEdits(result: Record<string, File>) {
    setEditItems(null);
    setBusy(true);
    const next: PickedFile[] = [];
    for (const it of selected) {
      const f = result[it.id];
      if (!f) {
        next.push(it);
        continue;
      }
      let thumb: Blob | null = it.thumb;
      try {
        thumb = await makeThumb(f);
      } catch {}
      next.push({ ...it, file: f, thumb, edited: true });
    }
    setBusy(false);
    onDone(next);
  }

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label="Add photos and videos">
      <header className="flex items-center gap-2 px-2 pb-1" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
        <button type="button" aria-label="Close" onClick={onClose} className="grid size-11 place-items-center rounded-full text-fg transition-colors hover:bg-white/8">
          <Icon name="close" className="size-6" />
        </button>
        <h2 className="flex-1 text-[16px] font-bold text-fg">Add photos &amp; videos</h2>
        {sel.length > 0 && (
          <button type="button" onClick={() => setSel([])} className="h-10 rounded-full px-3 text-[13px] font-bold text-brand">Clear</button>
        )}
      </header>

      {provider.scope === "session" && (
        <p className="px-4 pb-2 text-[12px] leading-[1.4] text-muted">
          Browsers don&apos;t let apps see your whole gallery. Use Browse to pick from your device. What you add stays here only until you close Anaija.
        </p>
      )}
      {err && <p role="alert" className="px-4 pb-2 text-[12.5px] font-medium text-danger">{err}</p>}

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-0.5 md:grid-cols-5">
          <button type="button" onClick={() => void browse()} disabled={busy} className="grid aspect-square place-items-center bg-surface-subtle text-fg transition-colors hover:bg-surface-interactive disabled:opacity-60">
            <span className="flex flex-col items-center gap-1.5">
              {busy ? (
                <span role="status" aria-label="Loading" className="size-6 animate-spin rounded-full border-2 border-white/25 border-t-white" />
              ) : (
                <Icon name="plus" className="size-7" />
              )}
              <span className="text-[12.5px] font-bold">Browse</span>
            </span>
          </button>
          {all.map((it) => (
            <Tile key={it.id} item={it} order={sel.indexOf(it.id) + 1} onToggle={() => toggle(it.id)} />
          ))}
        </div>
        {all.length === 0 && !busy && (
          <p className="px-8 py-10 text-center text-secondary text-muted">Nothing added yet. Tap Browse to choose photos or videos.</p>
        )}
      </div>

      <div className="flex items-center gap-2 bg-bg px-4 pt-2.5" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
        <p className="flex-1 text-[13.5px] font-bold text-fg">{sel.length > 0 ? `${sel.length} selected` : `Up to ${max}`}</p>
        <button type="button" disabled={images.length === 0 || busy} onClick={() => setEditItems(images)} className="h-11 rounded-full bg-card px-5 text-[14px] font-bold text-fg disabled:opacity-40">
          Edit
        </button>
        <button type="button" disabled={selected.length === 0 || busy} onClick={() => onDone(selected)} className="h-11 rounded-full bg-brand px-6 text-[14px] font-extrabold text-brand-fg disabled:opacity-40">
          {selected.length > 0 ? `Add (${selected.length})` : "Add"}
        </button>
      </div>

      {editItems && <ChatEditor items={editItems} onCancel={() => setEditItems(null)} onDone={(r) => void applyEdits(r)} />}
    </div>
  );
}
