"use client";

import { useRef, useState } from "react";
import { PACKS } from "@/lib/stickers/packs";
import { getFavourites, getRecents, pushRecent, toggleFavourite } from "@/lib/stickers/store";
import { StickerView } from "./sticker-view";

function Star({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />
    </svg>
  );
}

function Tile({ code, fav, onPick, onToggleFav }: { code: string; fav: boolean; onPick: () => void; onToggleFav: () => void }) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return (
    <div className="group/s relative">
      <button
        type="button"
        aria-label="Send sticker"
        onPointerDown={() => {
          fired.current = false;
          clear();
          timer.current = window.setTimeout(() => {
            fired.current = true;
            try {
              navigator.vibrate?.(12);
            } catch {}
            onToggleFav();
          }, 450);
        }}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (fired.current) {
            fired.current = false;
            return;
          }
          onPick();
        }}
        className="grid aspect-square w-full place-items-center rounded-2xl p-1 transition [-webkit-touch-callout:none] hover:bg-white/8 active:scale-95"
      >
        <StickerView code={code} size={72} />
      </button>
      <button
        type="button"
        aria-label={fav ? "Remove from favourites" : "Add to favourites"}
        aria-pressed={fav}
        onClick={onToggleFav}
        className={`absolute right-0.5 top-0.5 hidden size-6 place-items-center rounded-full bg-black/55 md:group-hover/s:grid ${fav ? "text-brand" : "text-white"}`}
      >
        <Star on={fav} />
      </button>
    </div>
  );
}

export function StickerTray({ onPick }: { onPick: (packId: string, stickerId: string) => void }) {
  const [recents] = useState(() => getRecents());
  const [favs, setFavs] = useState(() => getFavourites());
  const [tab, setTab] = useState<string>(() => (recents.length ? "recent" : PACKS[0].id));
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<number | null>(null);

  const flash = (m: string) => {
    setHint(m);
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 1600);
  };
  const toggle = (code: string) => {
    const on = toggleFavourite(code);
    setFavs(getFavourites());
    flash(on ? "Added to favourites" : "Removed from favourites");
  };
  const pick = (code: string) => {
    const [p, s] = code.split("/");
    pushRecent(code);
    onPick(p, s);
  };

  const codes =
    tab === "recent" ? recents : tab === "fav" ? favs : (PACKS.find((p) => p.id === tab)?.stickers.map((s) => `${tab}/${s.id}`) ?? []);
  const pill = (active: boolean) =>
    `flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-colors ${active ? "bg-surface-elevated text-fg" : "text-muted hover:text-fg"}`;

  return (
    <div className="flex h-[264px] flex-col overflow-hidden rounded-[22px] bg-surface-subtle">
      <div className="no-scrollbar flex gap-1 overflow-x-auto p-1.5" role="tablist" aria-label="Sticker packs">
        <button type="button" role="tab" aria-selected={tab === "recent"} onClick={() => setTab("recent")} className={pill(tab === "recent")}>Recent</button>
        <button type="button" role="tab" aria-selected={tab === "fav"} onClick={() => setTab("fav")} className={pill(tab === "fav")}>Favourites</button>
        {PACKS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={tab === p.id} onClick={() => setTab(p.id)} className={pill(tab === p.id)}>
            <StickerView code={`${p.id}/${p.stickers[0].id}`} size={20} />
            {p.name}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {codes.length === 0 ? (
          <p className="px-4 py-10 text-center text-secondary text-muted">
            {tab === "fav" ? "Press and hold a sticker to add it to your favourites." : "Stickers you send show up here."}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-5 md:grid-cols-6">
            {codes.map((code) => (
              <Tile key={code} code={code} fav={favs.includes(code)} onPick={() => pick(code)} onToggleFav={() => toggle(code)} />
            ))}
          </div>
        )}
      </div>
      <p role="status" className="h-6 shrink-0 px-4 text-center text-[11.5px] text-muted">{hint ?? "Press and hold to favourite"}</p>
    </div>
  );
}
