"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";

export interface DeleteDialogProps {
  isOpen: boolean;
  scope: "me" | "everyone";
  busy: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function DeleteDialog({
  isOpen,
  scope,
  busy,
  onConfirm,
  onClose,
}: DeleteDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const isEveryone = scope === "everyone";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-[24px] bg-card-elevated border border-white/10 p-5 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-danger/15 text-danger">
            <Icon name="trash" className="size-5" />
          </span>
          <div>
            <h3 id="delete-dialog-title" className="text-[16px] font-bold text-fg">
              {isEveryone ? "Delete for everyone?" : "Delete for you?"}
            </h3>
            <p className="text-supporting text-muted mt-0.5">
              {isEveryone
                ? "This will remove the message for all participants in this chat."
                : "This message will only be removed from your view."}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-10 flex-1 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-fg hover:bg-white/10 active:scale-95 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className="h-10 flex-1 rounded-full bg-danger px-4 text-secondary font-extrabold text-white hover:brightness-110 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? (
              <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
