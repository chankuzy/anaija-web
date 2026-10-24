"use client";

import { useEffect, useState } from "react";
import { AppLogo } from "@/components/ui/app-logo";
import { useCacheReady, warmCache } from "@/lib/cache/swr";

// A cover over the app until the persisted cache is in memory (normally a few ms), so nobody sees a skeleton
// frame for data we already have. It is a sibling, not a wrapper: the page tree and its server HTML are untouched.
// Capped so a broken IndexedDB can never block the app.
export function CacheCurtain() {
  const ready = useCacheReady();
  const [late, setLate] = useState(false);

  useEffect(() => {
    void warmCache();
    const t = window.setTimeout(() => setLate(true), 400);
    return () => window.clearTimeout(t);
  }, []);

  if (ready || late) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-bg">
      <AppLogo size={56} showWordmark={false} />
    </div>
  );
}
