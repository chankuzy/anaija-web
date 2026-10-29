"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { useCached } from "@/lib/cache/swr";
import type { Desig, Role } from "@/lib/api/communities";

export const messageOf = (e: unknown): string => {
  if (e instanceof ApiError) {
    const v = e.errors ? Object.values(e.errors).map(String).join(" ") : "";
    return v || e.message;
  }
  return "Something went wrong.";
};

export const AREA =
  "min-h-[104px] w-full resize-none rounded-input bg-surface-interactive px-5 py-4 text-[15px] font-medium text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand/60";

export const CATEGORIES: [string, string][] = [
  ["class", "Class"], ["department", "Department"], ["faculty", "Faculty"], ["campus", "Campus"],
  ["interest", "Interest"], ["creator", "Creator"], ["professional", "Professional"], ["seller", "Seller"], ["other", "Other"],
];
export const categoryLabel = (c: string) => CATEGORIES.find(([id]) => id === c)?.[1] ?? "Community";
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", moderator: "Moderator", member: "Member" };
export const ROLE_RANK: Record<string, number> = { member: 1, moderator: 2, admin: 3, owner: 4 };
export const DESIG_LABEL: Record<string, string> = {
  class_rep: "Class Representative", course_rep: "Course Representative",
  dept_exec: "Departmental Executive", contributor: "Community Contributor",
};

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");

export async function shareLink(url: string, title: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return "shared";
    }
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

// Keyed loader on the persistent SWR cache: last-seen data paints at once (offline and after a cold start),
// a quiet fetch reconciles it, and a failed refresh never replaces data we already have.
export function useFetch<T>(key: string | null, load: () => Promise<T>, opts: { persist?: boolean } = {}) {
  const r = useCached<T>(key ? `f:${key}` : null, load, { staleMs: 20_000, persist: opts.persist ?? true });
  const { refresh, mutate } = r;
  const reload = useCallback(() => void refresh(), [refresh]);
  const patch = useCallback((fn: (d: T) => T) => mutate(fn), [mutate]);
  return { data: r.data, error: r.error, loading: r.loading, reload, patch };
}

export function Sheet({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="sv-overlay absolute inset-0 cursor-default bg-black/60" />
      <div
        className={`sv-rise no-scrollbar relative max-h-[90dvh] w-full ${wide ? "max-w-[600px]" : "max-w-[460px]"} overflow-y-auto rounded-t-[30px] border-t border-white/[0.08] bg-bg px-4 pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] md:rounded-[30px] md:border md:pt-6`}
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
      >
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/20 md:hidden" />
        <div className="mb-3 flex items-center">
          <p className="min-w-0 flex-1 truncate px-1 text-[20px] font-extrabold tracking-tight text-fg">{title}</p>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-surface-interactive text-fg">
            <Icon name="close" className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Chip({ active, onClick, children, disabled }: { active?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full px-4 text-secondary font-bold transition-colors disabled:opacity-50 ${
        active ? "bg-brand text-brand-fg" : "bg-surface-interactive text-fg hover:bg-surface-elevated"
      }`}
    >
      {children}
    </button>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <p className="px-1 pb-2 pt-5 text-micro font-semibold uppercase tracking-[0.08em] text-muted">
      {children}
      {hint ? <span className="ml-2 font-medium normal-case tracking-normal">{hint}</span> : null}
    </p>
  );
}

export function ChoiceList<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; title: string; desc: string }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-2xl px-4 py-3 text-left transition-colors ${value === o.id ? "bg-brand text-brand-fg" : "bg-surface-interactive text-fg hover:bg-surface-elevated"}`}
        >
          <span className="block text-[14px] font-bold">{o.title}</span>
          <span className={`mt-0.5 block text-supporting ${value === o.id ? "text-brand-fg/70" : "text-muted"}`}>{o.desc}</span>
        </button>
      ))}
    </div>
  );
}

// A visible responsibility. It does not by itself grant admin power.
export function DesigBadge({ d }: { d: Desig }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-brand/15 px-2.5 py-1 text-micro font-bold text-brand">
      <Icon name="verifiedCheck" filled className="size-3.5" />
      {DESIG_LABEL[d.kind] ?? d.kind}
      {d.scope_label ? ` · ${d.scope_label}` : ""}
    </span>
  );
}

export function StatusChip({ status }: { status: "scheduled" | "live" | "ended" }) {
  const cls = status === "live" ? "bg-brand text-brand-fg" : "bg-surface-interactive text-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-micro font-extrabold uppercase tracking-wide ${cls}`}>
      {status === "live" && <span className="size-1.5 animate-pulse rounded-full bg-brand-fg" />}
      {status}
    </span>
  );
}

const REASONS: [string, string][] = [
  ["spam", "Spam"], ["harassment", "Harassment or bullying"], ["hate", "Hate speech"], ["sexual", "Sexual content"],
  ["violence", "Violence or threats"], ["misinformation", "Misinformation"], ["privacy", "Shares private info"], ["other", "Something else"],
];

export function ReportSheet({ title = "Report", onSubmit, onClose }: { title?: string; onSubmit: (reason: string) => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run(reason: string) {
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(reason);
      onClose();
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="px-1 pb-3 text-secondary text-muted">Why are you reporting this? Moderators will review it.</p>
      <div className="flex flex-col gap-2">
        {REASONS.map(([id, label]) => (
          <button key={id} type="button" disabled={busy} onClick={() => void run(id)} className="rounded-2xl bg-surface-interactive px-4 py-3.5 text-left text-[15px] font-semibold text-fg hover:bg-surface-elevated disabled:opacity-50">
            {label}
          </button>
        ))}
      </div>
      {err && <p role="alert" className="mt-3 px-1 text-secondary text-danger">{err}</p>}
    </Sheet>
  );
}

export function Empty({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[16px] font-bold text-fg">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-[320px] text-secondary leading-[1.4] text-muted">{body}</p>}
      {children && <div className="mt-5 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

export function ImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sv-overlay fixed inset-0 z-[70] grid place-items-center bg-black/90 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white" style={{ top: "max(16px, env(safe-area-inset-top))" }}>
        <Icon name="close" className="size-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-full max-w-full rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

export function MenuRow({ icon, label, hint, onClick, danger = false }: { icon: React.ComponentProps<typeof Icon>["name"]; label: string; hint?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-white/[0.05] ${danger ? "text-danger" : "text-fg"}`}>
      <Icon name={icon} className="size-[22px] shrink-0 opacity-80" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        {hint && <span className="block truncate text-supporting font-normal text-muted">{hint}</span>}
      </span>
    </button>
  );
}
