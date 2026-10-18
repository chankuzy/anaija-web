type P = { className?: string; filled?: boolean };
const svg = (filled?: boolean) => ({
  viewBox: "0 0 24 24",
  fill: filled ? "currentColor" : "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const GridGlyph = ({ className = "size-[22px]", filled }: P) => (
  <svg {...svg(filled)} className={className}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </svg>
);

export const ReelGlyph = ({ className = "size-[22px]", filled }: P) => (
  <svg {...svg(filled)} className={className}>
    <rect x="3" y="5" width="18" height="14" rx="3.5" />
    <path d="M10.5 9.5v5l4-2.5z" fill={filled ? "var(--color-bg)" : "currentColor"} stroke="none" />
  </svg>
);
