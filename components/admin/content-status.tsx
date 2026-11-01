import type { ContentStatus } from "@/lib/api/platform-content";

const MAP: Record<ContentStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-white/8 text-white/70" },
  scheduled: { label: "Scheduled", cls: "bg-info/15 text-info" },
  publishing: { label: "Publishing", cls: "bg-white/8 text-white/70" },
  published: { label: "Live", cls: "bg-brand text-brand-fg" },
  archived: { label: "Archived", cls: "bg-white/8 text-white/40" },
};

export function ContentStatusPill({ status }: { status: ContentStatus }) {
  const s = MAP[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-supporting font-bold ${s.cls}`}>{s.label}</span>;
}

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
