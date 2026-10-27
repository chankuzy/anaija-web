/* eslint-disable */
"use client";
import { useEffect, useState } from "react";

const KEY = "pick-trace";
const push = (m: string) => {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || "[]");
    a.push(new Date().toISOString().slice(11, 23) + " " + m);
    localStorage.setItem(KEY, JSON.stringify(a.slice(-80)));
  } catch {}
};

export default function Pick() {
  const [log, setLog] = useState<string[]>([]);
  const read = () => {
    try { setLog(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {}
  };

  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const d = document as unknown as { wasDiscarded?: boolean };
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    push(`MOUNT discarded=${d.wasDiscarded} nav=${nav?.type} standalone=${matchMedia("(display-mode: standalone)").matches} heapMB=${mem ? Math.round(mem.usedJSHeapSize / 1048576) : "n/a"}`);
    read();
    const docEv = ["visibilitychange", "freeze", "resume"].map((n) => {
      const f = () => push(`${n} vis=${document.visibilityState}`);
      document.addEventListener(n, f);
      return () => document.removeEventListener(n, f);
    });
    const winEv = ["pagehide", "pageshow"].map((n) => {
      const f = () => push(n);
      window.addEventListener(n, f);
      return () => window.removeEventListener(n, f);
    });
    const onErr = (e: ErrorEvent) => push("ERROR " + e.message);
    const onRej = (e: PromiseRejectionEvent) => push("REJECTION " + String(e.reason));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      docEv.forEach((c) => c());
      winEv.forEach((c) => c());
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  const onPick = (label: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    push(`CHANGE[${label}] ${f ? `${f.name} ${f.size}b type=${f.type || "?"}` : "none"}`);
    e.target.value = "";
    read();
  };

  return (
    <div className="p-4 text-fg">
      <p className="mb-3 text-lg font-bold">Picker test</p>
      <label className="mb-3 block rounded-xl bg-surface-interactive p-3">
        1. Documents (same accept as the app)
        <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt" onChange={onPick("docs")} className="mt-2 block" />
      </label>
      <label className="mb-3 block rounded-xl bg-surface-interactive p-3">
        2. Any file (no accept filter)
        <input type="file" onChange={onPick("any")} className="mt-2 block" />
      </label>
      <label className="mb-3 block rounded-xl bg-surface-interactive p-3">
        3. Images
        <input type="file" accept="image/*" onChange={onPick("img")} className="mt-2 block" />
      </label>
      <div className="mb-2 flex gap-2">
        <button className="rounded-full bg-brand px-4 py-2 font-bold text-brand-fg" onClick={read}>Refresh log</button>
        <button className="rounded-full bg-surface-interactive px-4 py-2 font-bold" onClick={() => { localStorage.removeItem(KEY); setLog([]); }}>Clear</button>
      </div>
      <pre className="whitespace-pre-wrap text-[11px] leading-[1.4] text-muted">{log.join("\n")}</pre>
    </div>
  );
}
