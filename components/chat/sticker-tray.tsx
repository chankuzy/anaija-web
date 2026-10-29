/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { getMediaProvider } from "@/lib/chat/media-provider";
import { useBlobUrl } from "@/lib/chat/use-blob-url";
import { addCustom, listCustom, removeCustom, type CustomSticker } from "@/lib/stickers/custom";
import { PACKS } from "@/lib/stickers/packs";
import { getFavourites, getRecents, pushRecent, toggleFavourite } from "@/lib/stickers/store";
import { EMOJI } from "@/lib/emoji/packs";
import { EmojiGlyph } from "./emoji";
import { StickerMaker } from "./sticker-maker";
import { StickerView } from "./sticker-view";

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
        <Icon name="star" filled={fav} className="size-3.5" />
      </button>
    </div>
  );
}

function CustomTile({ s, onPick, onRemove }: { s: CustomSticker; onPick: () => void; onRemove: () => void }) {
  const url = useBlobUrl(s.blob);
  return (
    <div className="relative">
      <button type="button" aria-label="Send sticker" onClick={onPick} className="grid aspect-square w-full place-items-center rounded-2xl p-1 transition hover:bg-white/8 active:scale-95">
        {url && <img src={url} alt="" draggable={false} className="size-[72px] select-none object-contain" />}
      </button>
      <button type="button" aria-label="Delete sticker" onClick={onRemove} className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-black/55 text-white">
        <Icon name="close" className="size-3" />
      </button>
    </div>
  );
}

export function StickerTray({
  onPick,
  onPickCustom,
  onEmoji,
}: {
  onPick: (packId: string, stickerId: string) => void;
  /** When provided, the tray shows a "Mine" tab where people can create their own stickers. */
  onPickCustom?: (blob: Blob) => void;
  /** When provided, the tray shows an Emoji tab; tapping one hands back its ":id:" code. */
  onEmoji?: (code: string) => void;
}) {
  const [recents] = useState(() => getRecents());
  const [favs, setFavs] = useState(() => getFavourites());
  const [tab, setTab] = useState<string>(() => (recents.length ? "recent" : PACKS[0].id));
  const [hint, setHint] = useState<string | null>(null);
  const [mine, setMine] = useState<CustomSticker[]>([]);
  const [making, setMaking] = useState<File | null>(null);
  const hintTimer = useRef<number | null>(null);
  const canMake = !!onPickCustom;

  useEffect(() => {
    if (!canMake) return;
    let dead = false;
    listCustom()
      .then((l) => !dead && setMine(l))
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [canMake]);

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

  // The system picker must open straight from the tap, so this is not async before pick().
  function create() {
    void getMediaProvider()
      .pick({ multiple: false, video: false })
      .then((files) => {
        if (files[0]) setMaking(files[0]);
      });
  }
  async function save(blob: Blob) {
    setMaking(null);
    try {
      const s = await addCustom(blob);
      setMine((m) => [s, ...m]);
      setTab("mine");
      flash("Sticker saved");
    } catch {
      flash("Couldn't save that sticker");
    }
  }
  async function remove(id: string) {
    setMine((m) => m.filter((x) => x.id !== id));
    try {
      await removeCustom(id);
    } catch {}
  }

  const codes =
    tab === "recent" ? recents : tab === "fav" ? favs : (PACKS.find((p) => p.id === tab)?.stickers.map((s) => `${tab}/${s.id}`) ?? []);
  const pill = (active: boolean) =>
    `flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-colors ${active ? "bg-surface-elevated text-fg" : "text-muted hover:text-fg"}`;

  return (
    <div className="flex h-[264px] flex-col overflow-hidden rounded-[22px] bg-surface-subtle">
      <div className="no-scrollbar flex gap-1 overflow-x-auto p-1.5" role="tablist" aria-label="Sticker packs">
        <button type="button" role="tab" aria-selected={tab === "recent"} onClick={() => setTab("recent")} className={pill(tab === "recent")}>
          <Icon name="clockCircle" filled={tab === "recent"} className="size-4" />
          Recent
        </button>
        <button type="button" role="tab" aria-selected={tab === "fav"} onClick={() => setTab("fav")} className={pill(tab === "fav")}>
          <Icon name="star" filled={tab === "fav"} className="size-4" />
          Favourites
        </button>
        {onEmoji && (
          <button type="button" role="tab" aria-selected={tab === "emoji"} onClick={() => setTab("emoji")} className={pill(tab === "emoji")}>
            <Icon name="smileCircle" filled={tab === "emoji"} className="size-4" />
            Emoji
          </button>
        )}
        {canMake && (
          <button type="button" role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")} className={pill(tab === "mine")}>
            <Icon name="user" filled={tab === "mine"} className="size-4" />
            Mine
          </button>
        )}
        {PACKS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={tab === p.id} onClick={() => setTab(p.id)} className={pill(tab === p.id)}>
            <StickerView code={`${p.id}/${p.stickers[0].id}`} size={20} />
            {p.name}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {tab === "emoji" && onEmoji ? (
          <div className="grid grid-cols-6 gap-1 pt-1 sm:grid-cols-8 md:grid-cols-9">
            {EMOJI.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-label={e.label}
                onClick={() => onEmoji(`:${e.id}:`)}
                className="grid aspect-square place-items-center rounded-xl transition hover:bg-white/8 active:scale-90"
              >
                <EmojiGlyph code={`:${e.id}:`} size={34} />
              </button>
            ))}
          </div>
        ) : tab === "mine" && canMake ? (
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-5 md:grid-cols-6">
            <button type="button" onClick={create} className="grid aspect-square w-full place-items-center rounded-2xl bg-white/6 text-fg transition hover:bg-white/10 active:scale-95">
              <span className="flex flex-col items-center gap-1">
                <Icon name="galleryAdd" filled className="size-6" />
                <span className="text-[11px] font-bold">Create</span>
              </span>
            </button>
            {mine.map((s) => (
              <CustomTile key={s.id} s={s} onPick={() => onPickCustom?.(s.blob)} onRemove={() => void remove(s.id)} />
            ))}
          </div>
        ) : codes.length === 0 ? (
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
      <p role="status" className="h-6 shrink-0 px-4 text-center text-[11.5px] text-muted">
        {hint ?? (tab === "emoji" ? "Tap to add to your message" : tab === "mine" ? "Turn any photo into a sticker" : "Press and hold to favourite")}
      </p>
      {making && <StickerMaker file={making} onCancel={() => setMaking(null)} onSave={(b) => void save(b)} />}
    </div>
  );
}
