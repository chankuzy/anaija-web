"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import type { Message } from "@/lib/api/messaging";

export interface MessageMenuProps {
  m: Message;
  mine: boolean;
  canEdit: boolean;
  canDeleteEveryone: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onDeleteEveryone: () => void;
  onCopy: () => void;
  onRetry?: () => void;
  onSaveSticker?: () => void;
  onClose: () => void;
  position?: { x: number; y: number } | null;
}

export function MessageMenu({
  m,
  canEdit,
  canDeleteEveryone,
  onReply,
  onEdit,
  onDeleteForMe,
  onDeleteEveryone,
  onCopy,
  onRetry,
  onSaveSticker,
  onClose,
  position,
}: MessageMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [onClose]);

  const hasCopy = m.type === "text" && !!m.body && !m.is_deleted;
  const isFailed = m.status === "failed";

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Message options"
      className="glass z-50 flex min-w-[180px] flex-col overflow-hidden rounded-[20px] bg-card-elevated/95 p-1.5 shadow-2xl backdrop-blur-xl border border-white/10 text-fg animate-in fade-in zoom-in-95 duration-100"
      style={
        position
          ? {
              position: "fixed",
              left: Math.min(position.x, window.innerWidth - 200),
              top: Math.min(position.y, window.innerHeight - 260),
            }
          : undefined
      }
    >
      {/* Reply */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onReply();
          onClose();
        }}
        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-semibold text-fg hover:bg-white/10 active:bg-white/15 transition text-left"
      >
        <Icon name="reply" className="size-4 text-muted" />
        <span>Reply</span>
      </button>

      {/* Edit (if eligible) */}
      {canEdit && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onEdit();
            onClose();
          }}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-semibold text-fg hover:bg-white/10 active:bg-white/15 transition text-left"
        >
          <Icon name="pen" className="size-4 text-muted" />
          <span>Edit</span>
        </button>
      )}

      {/* Copy */}
      {hasCopy && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onCopy();
            onClose();
          }}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-semibold text-fg hover:bg-white/10 active:bg-white/15 transition text-left"
        >
          <Icon name="copy" className="size-4 text-muted" />
          <span>Copy text</span>
        </button>
      )}

      {/* Save sticker */}
      {m.type === "sticker" && onSaveSticker && !m.is_deleted && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onSaveSticker();
            onClose();
          }}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-semibold text-fg hover:bg-white/10 active:bg-white/15 transition text-left"
        >
          <Icon name="plus" className="size-4 text-muted" />
          <span>Save to favourites</span>
        </button>
      )}

      {/* Retry if failed */}
      {isFailed && onRetry && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onRetry();
            onClose();
          }}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-semibold text-brand hover:bg-white/10 active:bg-white/15 transition text-left"
        >
          <Icon name="refresh" className="size-4 text-brand" />
          <span>Retry sending</span>
        </button>
      )}

      <div className="my-1 h-px bg-white/10" />

      {/* Delete for me */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onDeleteForMe();
          onClose();
        }}
        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-semibold text-danger hover:bg-danger/10 active:bg-danger/20 transition text-left"
      >
        <Icon name="trash" className="size-4 text-danger" />
        <span>Delete for me</span>
      </button>

      {/* Delete for everyone */}
      {canDeleteEveryone && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onDeleteEveryone();
            onClose();
          }}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-semibold text-danger hover:bg-danger/10 active:bg-danger/20 transition text-left"
        >
          <Icon name="trash" filled className="size-4 text-danger" />
          <span>Delete for everyone</span>
        </button>
      )}
    </div>
  );
}
