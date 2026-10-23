// Unread count: flat solid pill, thin cut-out ring so it separates from the icon. No glow, no pulse.
// The number does one short scale-in when the count changes.
export function UnreadBadge({
  count,
  label,
  flat = false,
  className = "",
}: {
  count: number;
  label: string;
  flat?: boolean;
  className?: string;
}) {
  if (count <= 0) return null;
  const text = count > 99 ? "99+" : String(count);
  return (
    <span
      role="img"
      aria-label={`${count} ${label}`}
      className={`unread-badge ${flat ? "unread-badge--flat" : ""} ${className}`.trim()}
    >
      <span key={count} className="unread-badge__num" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
