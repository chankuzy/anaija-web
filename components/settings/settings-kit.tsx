"use client";
import { loginHref } from "@/lib/auth/next";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth/auth-context";

export function useRequireAuth() {
  const router = useRouter();
  const { status } = useAuth();
  useEffect(() => {
    if (status === "guest") router.replace(loginHref());
  }, [status, router]);
  return status === "authed";
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2200);
  }, []);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const toast = msg ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center">
      <span className="rounded-full bg-surface-elevated px-4 py-2 text-secondary font-bold text-white shadow-lg">{msg}</span>
    </div>
  ) : null;
  return { toast, show };
}

export function SettingsPage({
  title,
  backHref,
  action,
  onBack,
  children,
}: {
  title: string;
  backHref: string;
  action?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-12 pt-3 md:pt-8">
      <header className="mb-4 flex items-center gap-3.5 py-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="grid size-11 place-items-center rounded-full bg-surface-interactive text-white transition hover:bg-surface-elevated"
          >
            <Icon name="back" className="size-6" />
          </button>
        ) : (
          <Link
            href={backHref}
            aria-label="Back"
            className="grid size-11 place-items-center rounded-full bg-surface-interactive text-white transition hover:bg-surface-elevated"
          >
            <Icon name="back" className="size-6" />
          </Link>
        )}
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-extrabold tracking-tight text-white">{title}</h1>
        {action}
      </header>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-1.5 pb-2.5 pt-2 text-micro font-bold uppercase tracking-[0.12em] text-muted">{children}</p>;
}

export function Group({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[20px] bg-surface-subtle">{children}</div>;
}

export function Footnote({ children }: { children: ReactNode }) {
  return <p className="px-2 pt-2.5 text-secondary leading-[1.4] text-muted">{children}</p>;
}

const rowCls = "flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-white/5";

export function Tile({
  icon,
  label,
  href,
  onClick,
  trailing,
  danger = false,
}: {
  icon: IconName;
  label: string;
  href?: string;
  onClick?: () => void;
  trailing?: string;
  danger?: boolean;
}) {
  const inner = (
    <>
      <Icon name={icon} className={`size-6 shrink-0 ${danger ? "text-danger" : "text-white/75"}`} />
      <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${danger ? "text-danger" : "text-white"}`}>{label}</span>
      {trailing ? <span className="shrink-0 truncate text-secondary text-muted">{trailing}</span> : null}
      {!danger && <Icon name="chevronRight" className="size-5 shrink-0 text-muted" />}
    </>
  );
  return href ? (
    <Link href={href} className={rowCls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={rowCls}>
      {inner}
    </button>
  );
}

export function Toggle({
  icon,
  label,
  value,
  onChange,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3.5 px-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      <Icon name={icon} className="size-6 shrink-0 text-white/75" />
      <span className="min-w-0 flex-1 text-[15px] font-semibold text-white">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${value ? "bg-brand" : "bg-surface-elevated"}`}
      >
        <span className={`absolute top-0.5 size-6 rounded-full transition-all ${value ? "left-[22px] bg-brand-fg" : "left-0.5 bg-white/70"}`} />
      </button>
    </div>
  );
}
