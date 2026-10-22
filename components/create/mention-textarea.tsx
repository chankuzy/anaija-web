"use client";

// Caption field with inline @mentions. The textarea's own text is transparent; a mirrored layer on top draws the
// same text with mentions coloured and tells us where the active "@" sits, so the dropdown can open right under it.
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { Avatar } from "@/components/ui/avatar";
import { searchApi, type SearchUser } from "@/lib/api/search";
import { activeMention, splitMentions } from "@/lib/create/mentions";

export interface MentionHandle {
  /** Inserts at the caret (adding a leading space if needed) and keeps the field focused. */
  insertAtCaret: (token: string) => void;
}

const renderRuns = (s: string, key: string) =>
  splitMentions(s).map((p, i) =>
    p.mention ? (
      <span key={key + i} className="text-accent">
        {p.text}
      </span>
    ) : (
      <span key={key + i}>{p.text}</span>
    ),
  );

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  maxLength = 500,
  ref,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  ref?: Ref<MentionHandle>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const [caret, setCaret] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [focused, setFocused] = useState(false);
  const [res, setRes] = useState<{ q: string; users: SearchUser[] } | null>(null);
  const [hi, setHi] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const active = focused ? activeMention(value, caret) : null;
  const q = active?.query ?? "";
  const start = active?.start ?? -1;
  const shown = active && active.start !== dismissed && res && res.q === q ? res.users : [];

  useEffect(() => {
    if (!q) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await searchApi.all(q, ctrl.signal);
        const lq = q.toLowerCase();
        const rank = (u: SearchUser) => ((u.username ?? "").toLowerCase().startsWith(lq) ? 0 : 1);
        const users = r.users.filter((u) => u.username).sort((a, b) => rank(a) - rank(b)).slice(0, 6);
        setRes({ q, users });
        setHi(0);
      } catch {
        /* aborted or offline: keep whatever is showing */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Anchor the dropdown under the "@" using the marker in the mirror layer.
  useLayoutEffect(() => {
    const m = marker.current;
    const w = wrap.current;
    if (!m || !w || start < 0) return;
    const left = Math.max(12, Math.min(m.offsetLeft, w.clientWidth - 272));
    const top = m.offsetTop - scroll + 26;
    setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
  }, [value, start, scroll, shown.length]);

  const focusAt = (at: number) =>
    requestAnimationFrame(() => {
      ta.current?.focus();
      ta.current?.setSelectionRange(at, at);
    });

  useImperativeHandle(
    ref,
    () => ({
      insertAtCaret(token: string) {
        const el = ta.current;
        const s = el?.selectionStart ?? value.length;
        const e = el?.selectionEnd ?? value.length;
        const ins = `${s > 0 && !/\s/.test(value[s - 1]) ? " " : ""}${token}`;
        const next = value.slice(0, s) + ins + value.slice(e);
        if (next.length > maxLength) return;
        const at = s + ins.length;
        onChange(next);
        setCaret(at);
        setDismissed(null);
        focusAt(at);
      },
    }),
    [value, onChange, maxLength],
  );

  function pick(u: SearchUser) {
    if (!active || !u.username) return;
    const tail = value.slice(caret);
    const ins = `@${u.username}${/^\s/.test(tail) ? "" : " "}`;
    const next = value.slice(0, active.start) + ins + tail;
    if (next.length > maxLength) return;
    const at = active.start + ins.length;
    onChange(next);
    setCaret(at);
    focusAt(at);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!shown.length || !active) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => (i - 1 + shown.length) % shown.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(shown[hi] ?? shown[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissed(active.start);
    }
  }

  return (
    <div ref={wrap} className="relative mt-3.5">
      <textarea
        ref={ta}
        rows={4}
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="no-scrollbar block max-h-[190px] min-h-[104px] w-full resize-none bg-transparent px-5 text-[15px] leading-[1.35] text-transparent caret-white outline-none [field-sizing:content] placeholder:text-muted"
      />

      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="relative whitespace-pre-wrap break-words px-5 text-[15px] leading-[1.35] text-fg"
          style={{ transform: `translateY(${-scroll}px)` }}
        >
          {start >= 0 ? (
            <>
              {renderRuns(value.slice(0, start), "a")}
              <span ref={marker}>{"\u200b"}</span>
              {renderRuns(value.slice(start), "b")}
            </>
          ) : (
            renderRuns(value, "a")
          )}
          {"\u200b"}
        </div>
      </div>

      {shown.length > 0 && pos && (
        <ul
          role="listbox"
          className="absolute z-20 w-[260px] overflow-hidden rounded-floating border border-line bg-card-elevated py-1 shadow-[0_8px_28px_rgba(0,0,0,0.5)]"
          style={{ left: pos.left, top: pos.top }}
        >
          {shown.map((u, i) => (
            <li key={u.id} role="option" aria-selected={i === hi}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(u)}
                onMouseEnter={() => setHi(i)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${i === hi ? "bg-white/8" : ""}`}
              >
                <Avatar url={u.avatar} name={u.name ?? u.username} size={30} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-fg">{u.username}</span>
                  {u.name && <span className="block truncate text-[12px] text-muted">{u.name}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
