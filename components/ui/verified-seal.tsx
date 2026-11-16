import { useId } from "react";

// A 10-lobed seal drawn once at module load. Polar curve: r = 10.6 + 1.1·cos(10θ), centred in a 24×24 box.
const LOBES = 10;
const SEAL_PATH = (() => {
  const steps = 160;
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = 10.6 + 1.1 * Math.cos(LOBES * t);
    const a = t - Math.PI / 2;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
})();

// The mark. Brand yellow with a soft top-left sheen, a hairline inner ring and a dark check.
// `decorative` hides it from screen readers when a text label sits beside it.
export function VerifiedSeal({
  size = 18,
  title = "Verified by Anaija",
  decorative = false,
  className = "",
}: {
  size?: number;
  title?: string;
  decorative?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 text-brand ${className}`}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": title })}
    >
      {!decorative && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}g`} x1="5" y1="2" x2="19" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <path d={SEAL_PATH} fill="currentColor" />
      <path d={SEAL_PATH} fill={`url(#${id}g)`} />
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.6" />
      <g className="text-brand-fg">
        <path d="M8 12.3l2.9 2.9 5.2-5.9" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// The labelled form: desk header and invite landing only.
export function VerifiedPill({ label = "Verified", className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex h-9 items-center gap-1.5 rounded-full bg-brand/15 pl-2 pr-3.5 text-secondary font-extrabold text-brand-ink ${className}`}>
      <VerifiedSeal size={20} decorative />
      {label}
    </span>
  );
}
