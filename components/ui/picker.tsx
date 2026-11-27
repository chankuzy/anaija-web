"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface PickerOption {
  value: string;
  label: string;
  hint?: string;
}

const Chevron = () => (
  <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m5 8 5 5 5-5" />
  </svg>
);
const Check = () => (
  <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </svg>
);
const Glass = () => (
  <svg viewBox="0 0 20 20" className="size-[18px] shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <circle cx="9" cy="9" r="5.5" />
    <path d="m13.2 13.2 3.3 3.3" />
  </svg>
);
const Cross = () => (
  <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="m5.5 5.5 9 9m0-9-9 9" />
  </svg>
);

// A designed replacement for <select>: a field that opens a bottom sheet on phones and a centred card on desktop.
// Search appears once the list is long, rows wrap instead of truncating, and the keyboard works end to end.
export function Picker({
  label, value, options, onChange, placeholder = "Select", disabled = false, disabledText, searchable, searchPlaceholder,
}: {
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledText?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;
  const canSearch = searchable ?? options.length > 8;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => btn.current?.focus());
  }

  const shown = selected?.label ?? (disabled && disabledText ? disabledText : placeholder);

  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected?.label ?? "not selected"}`}
        onClick={() => setOpen(true)}
        className="flex h-14 w-full items-center gap-3 rounded-input bg-card px-5 text-left text-[15px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/60 enabled:hover:bg-card-elevated disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "font-semibold text-fg" : "text-muted"}`}>{shown}</span>
        <Chevron />
      </button>
      {open &&
        createPortal(
          <Sheet
            label={label}
            options={options}
            value={value}
            searchable={canSearch}
            searchPlaceholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
            onPick={(v) => {
              onChange(v);
              close();
            }}
            onClose={close}
          />,
          document.body,
        )}
    </>
  );
}

function Sheet({
  label, options, value, searchable, searchPlaceholder, onPick, onClose,
}: {
  label: string;
  options: PickerOption[];
  value: string;
  searchable: boolean;
  searchPlaceholder: string;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const rows = useRef<(HTMLLIElement | null)[]>([]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(s)) : options;
  }, [q, options]);
  const at = Math.min(active, Math.max(0, list.length - 1));

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    (searchable && desktop ? search.current : root.current)?.focus();
  }, [searchable]);

  useEffect(() => {
    rows.current[at]?.scrollIntoView({ block: "nearest" });
  }, [at, list]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(at + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(at - 1, 0));
    } else if (e.key === "Enter" && list[at] && (e.target as HTMLElement).tagName !== "BUTTON") {
      e.preventDefault();
      onPick(list[at].value);
    }
  }

  return (
    <div
      ref={root}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={onKey}
      className="fixed inset-0 z-[70] flex items-end justify-center outline-none md:items-center"
    >
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="ob-fade absolute inset-0 cursor-default bg-black/65" />
      <div
        className="ob-sheet relative flex max-h-[min(82dvh,640px)] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] bg-[var(--sheet-bg)] text-fg shadow-[0_-10px_36px_rgba(0,0,0,0.2)] md:rounded-[28px] md:shadow-[0_18px_48px_rgba(0,0,0,0.25)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-fg/20 md:hidden" />
        <div className="flex items-center justify-between px-6 pb-2 pt-4">
          <h2 className="text-[18px] font-extrabold tracking-tight">{label}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="-mr-2 grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-fg/8 hover:text-fg">
            <Cross />
          </button>
        </div>
        {searchable && (
          <div className="px-5 pb-2 pt-1">
            <div className="flex h-12 items-center gap-2.5 rounded-full bg-card px-4 focus-within:ring-2 focus-within:ring-brand/60">
              <Glass />
              <input
                ref={search}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-muted"
              />
            </div>
          </div>
        )}
        <ul role="listbox" aria-label={label} className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4 pt-1">
          {list.length === 0 ? (
            <li className="px-4 py-10 text-center text-body text-muted">Nothing matches &ldquo;{q.trim()}&rdquo;</li>
          ) : (
            list.map((o, k) => {
              const sel = o.value === value;
              return (
                <li
                  key={o.value}
                  ref={(el) => {
                    rows.current[k] = el;
                  }}
                  role="option"
                  aria-selected={sel}
                  onMouseMove={() => k !== at && setActive(k)}
                  onClick={() => onPick(o.value)}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors ${k === at ? "bg-fg/8" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[15px] leading-snug text-fg ${sel ? "font-extrabold" : "font-semibold"}`}>{o.label}</span>
                    {o.hint && <span className="mt-0.5 block text-supporting text-muted">{o.hint}</span>}
                  </span>
                  {sel && (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-brand-fg">
                      <Check />
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
