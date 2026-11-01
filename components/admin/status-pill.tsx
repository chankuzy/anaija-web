import type { AccountStatus } from "@/lib/api/platform";

const STATUS: Record<AccountStatus, { label: string; cls: string }> = {
  provisioned: { label: "Not live", cls: "bg-white/8 text-white/70" },
  active: { label: "Live", cls: "bg-brand text-brand-fg" },
  suspended: { label: "Suspended", cls: "bg-danger/15 text-danger" },
};

export function StatusPill({ status }: { status: AccountStatus }) {
  const s = STATUS[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-supporting font-bold ${s.cls}`}>{s.label}</span>;
}
