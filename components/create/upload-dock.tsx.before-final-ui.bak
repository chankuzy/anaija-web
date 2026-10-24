"use client";

// Port of UploadProgressStrip: thin, non-blocking, driven by the app-level upload manager.
// Mounted once in the root layout; also boots the manager (resumes leftovers) as soon as a user is known.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth/auth-context";
import { isActive, uploadLabel, uploadManager, type UploadTask } from "@/lib/create/upload-manager";
import { useUploads } from "@/lib/create/use-uploads";

function Bar({ value }: { value: number | null }) {
  return (
    <div className="relative h-0.5 overflow-hidden bg-white/12">
      {value === null ? (
        <div className="absolute inset-y-0 w-[35%] animate-pulse bg-white/70" />
      ) : (
        <div className="h-full bg-white transition-[width] duration-[600ms] ease-out" style={{ width: `${Math.round(value * 100)}%` }} />
      )}
    </div>
  );
}

function Strip({ t, others }: { t: UploadTask; others: number }) {
  const failed = t.phase === "failed";
  const published = t.phase === "published";
  const cancellable = t.phase === "queued" || isActive(t);
  const pct = t.phase === "uploading" && t.progress != null ? ` · ${Math.floor(t.progress * 100)}%` : "";
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#070B09]/94 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <Bar value={published ? 1 : failed ? 0 : t.progress} />
      <div className="flex items-center gap-2.5 py-2 pl-4 pr-2">
        <span className="grid size-[18px] shrink-0 place-items-center">
          {published ? (
            <Icon name="check" className="size-[17px] text-white" />
          ) : failed ? (
            <Icon name="dangerCircle" className="size-[17px] text-warm" />
          ) : (
            <span className="size-3.5 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
          )}
        </span>
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-white">
          {uploadLabel(t)}
          {pct}
          {others > 0 ? `  (+${others} more)` : ""}
        </p>
        {failed && t.retryable && (
          <button type="button" onClick={() => uploadManager.retry(t.id)} className="px-2.5 py-1 text-[12.5px] font-bold text-warm">
            Retry
          </button>
        )}
        {(failed || cancellable) && (
          <button
            type="button"
            aria-label={failed ? "Dismiss" : "Cancel upload"}
            onClick={() => (failed ? uploadManager.dismiss(t.id) : uploadManager.cancel(t.id))}
            className="grid size-8 place-items-center text-muted"
          >
            <Icon name="close" className="size-[18px]" />
          </button>
        )}
      </div>
    </div>
  );
}

export function UploadDock() {
  const { user } = useAuth();
  const pathname = usePathname();
  const tasks = useUploads();
  const uid = user?.id;

  useEffect(() => {
    if (uid != null) void uploadManager.start(uid);
  }, [uid]);

  if (!tasks.length || pathname.startsWith("/create")) return null;
  const t =
    tasks.find((x) => x.phase === "failed") ?? tasks.find((x) => x.phase !== "published") ?? tasks[0];
  const others = tasks.filter((x) => x.id !== t.id && x.phase !== "published").length;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 z-[45] md:inset-x-auto md:bottom-5 md:left-1/2 md:w-[420px] md:-translate-x-1/2"
      style={{ bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom) + 8px)" }}
    >
      <div className="pointer-events-auto">
        <Strip t={t} others={others} />
      </div>
    </div>
  );
}
