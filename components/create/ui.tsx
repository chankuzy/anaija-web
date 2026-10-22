"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import type { ToastMsg } from "@/lib/create/use-composer";

export function Spinner({ dark = false, size = 20 }: { dark?: boolean; size?: number }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 ${dark ? "border-black/25 border-t-black" : "border-white/25 border-t-white"}`}
      style={{ width: size, height: size }}
    />
  );
}

export function RoundButton({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-[38px] shrink-0 place-items-center rounded-full bg-card text-fg transition active:scale-95 disabled:opacity-50"
    >
      <Icon name={icon} className="size-[18px]" />
    </button>
  );
}

export function WhitePill({ label, onClick, enabled = true, loading = false }: { label: string; onClick: () => void; enabled?: boolean; loading?: boolean }) {
  return (
    <button
      type="button"
      disabled={!enabled || loading}
      onClick={onClick}
      className={`inline-flex min-w-[96px] items-center justify-center rounded-full bg-white px-6 py-3 text-[14px] font-bold text-black transition-opacity ${enabled ? "" : "opacity-30"}`}
    >
      {loading ? <Spinner dark size={14} /> : label}
    </button>
  );
}

export function PrimaryButton({ label, onClick, loading = false, disabled = false, className = "" }: { label: string; onClick: () => void; loading?: boolean; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={`flex h-[50px] items-center justify-center rounded-full bg-white text-[15px] font-bold text-black transition active:scale-[0.99] disabled:opacity-50 ${className}`}
    >
      {loading ? <Spinner dark /> : label}
    </button>
  );
}

export function GhostButton({ label, icon, onClick, disabled }: { label: string; icon: IconName; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-[50px] shrink-0 items-center gap-2 rounded-full bg-card px-5 text-[14.5px] font-bold text-fg transition active:scale-[0.99] disabled:opacity-50"
    >
      <Icon name={icon} filled className="size-[18px]" />
      {label}
    </button>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-white/16"}`}
    >
      <span className={`absolute top-[3px] size-6 rounded-full bg-white shadow transition-[left] duration-150 ${on ? "left-[23px]" : "left-[3px]"}`} />
    </button>
  );
}

export function SettingsRow({
  icon,
  label,
  value,
  highlight = false,
  trailing,
  onClick,
}: {
  icon: IconName;
  label: string;
  value?: string | null;
  highlight?: boolean;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex cursor-pointer items-center gap-3.5 px-5 py-4 transition-colors hover:bg-white/3"
    >
      <Icon name={icon} filled className="size-[22px] shrink-0 text-white" />
      <span className="shrink-0 text-[15.5px] text-fg">{label}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        {value ? (
          <>
            {highlight && <span className="size-1.5 rounded-full bg-warm" />}
            <span className={`truncate text-secondary font-semibold ${highlight ? "text-white" : "text-muted"}`}>{value}</span>
          </>
        ) : null}
      </span>
      {trailing ?? <Icon name="chevronRight" className="size-[22px] shrink-0 text-muted" />}
    </div>
  );
}

export function Toast({ toast }: { toast: ToastMsg | null }) {
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      className={`pointer-events-none fixed left-1/2 z-[80] max-w-[90vw] -translate-x-1/2 rounded-full bg-card-elevated px-4 py-2.5 text-secondary font-semibold shadow-[0_8px_28px_rgba(0,0,0,0.5)] ${
        toast.kind === "err" ? "text-danger" : "text-fg"
      }`}
      style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
    >
      {toast.text}
    </div>
  );
}

/** Bottom sheet (glass, 30px top radius, drag handle). Mount it to open it. */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(r);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 cursor-default bg-black/55 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`glass absolute inset-x-0 bottom-0 mx-auto w-full max-w-[520px] rounded-t-sheet transition-transform duration-300 ease-out ${shown ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line" />
        {children}
      </div>
    </div>
  );
}

export function Dialog({
  title,
  onClose,
  onSave,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-5" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/60" />
      <div className="relative w-full max-w-sm rounded-floating border border-line bg-card p-5">
        <p className="text-[17px] font-bold text-fg">{title}</p>
        <div className="mt-4">{children}</div>
        <div className="mt-5 flex justify-end gap-1">
          <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-sm font-semibold text-muted hover:bg-white/8">
            Cancel
          </button>
          <button type="button" onClick={onSave} className="h-10 rounded-full px-4 text-sm font-bold text-white hover:bg-white/8">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExitSheet({ onSave, onDiscard, onKeep }: { onSave: () => void; onDiscard: () => void; onKeep: () => void }) {
  const opt = (label: string, cls: string, fn: () => void) => (
    <button type="button" onClick={fn} className={`w-full border-t border-line py-4 text-[15px] hover:bg-white/4 ${cls}`}>
      {label}
    </button>
  );
  return (
    <Sheet onClose={onKeep}>
      <div className="px-6 pb-4 pt-[18px] text-center">
        <p className="text-base font-bold text-fg">Leave without posting?</p>
        <p className="mt-1.5 text-[12.5px] leading-[1.4] text-muted">Save it as a draft and pick up right where you stopped.</p>
      </div>
      {opt("Save draft", "font-bold text-fg", onSave)}
      {opt("Discard", "font-semibold text-danger", onDiscard)}
      {opt("Keep editing", "font-semibold text-muted", onKeep)}
      <div className="h-2" />
    </Sheet>
  );
}
