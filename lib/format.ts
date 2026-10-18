export function formatCount(n: number): string {
  if (n <= 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    const s = k.toFixed(1);
    return s.endsWith(".0") ? `${k.toFixed(0)}K` : `${s}K`;
  }
  const m = n / 1_000_000;
  const s = m.toFixed(1);
  return s.endsWith(".0") ? `${m.toFixed(0)}M` : `${s}M`;
}

// Compact relative time. Assumption: Flutter's TimeAgo widget wasn't read yet, so wording may differ.
export function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(t).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}
