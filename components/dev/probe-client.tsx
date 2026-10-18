"use client";

import { useState } from "react";
import { api, ApiError, type Query } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";

// Keeps pasted output small: arrays are cut to the first N items, recursively.
function trim(v: unknown, n: number): unknown {
  if (Array.isArray(v)) return v.slice(0, n).map((x) => trim(x, n));
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x, n)]));
  }
  return v;
}

export function ProbeClient() {
  const [target, setTarget] = useState("feed-public");
  const [keep, setKeep] = useState(2);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const [fn, qs = ""] = target.split("?");
    const query: Query = Object.fromEntries(new URLSearchParams(qs));
    try {
      const body = await api.get<unknown>(fn.trim(), query);
      setOut(JSON.stringify({ status: 200, body: trim(body, keep) }, null, 2));
    } catch (e) {
      setOut(
        e instanceof ApiError
          ? JSON.stringify({ status: e.status, message: e.message, errors: e.errors }, null, 2)
          : String(e),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">API probe (dev only)</h1>
      <p className="mt-1 text-sm text-muted">
        GET any function through the proxy, e.g. <code>feed-public</code> or{" "}
        <code>feed?scope=for_you</code>.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)} />
        <input
          className={`${inputClass} sm:w-24`}
          type="number"
          min={1}
          value={keep}
          onChange={(e) => setKeep(Math.max(1, Number(e.target.value) || 1))}
          aria-label="Array items to keep"
        />
        <Button onClick={() => void run()} disabled={busy}>
          {busy ? "…" : "Fetch"}
        </Button>
      </div>
      {out && (
        <>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void navigator.clipboard.writeText(out)}
          >
            Copy
          </Button>
          <pre className="mt-3 max-h-[70dvh] overflow-auto rounded-card border border-line bg-card p-4 text-xs leading-relaxed">
            {out}
          </pre>
        </>
      )}
    </div>
  );
}
