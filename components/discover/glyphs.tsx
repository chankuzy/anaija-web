// Small stroke glyphs used only by Discover until these names are added to scripts/gen-solar.mjs.
type P = { className?: string };
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const SearchGlyph = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
export const ChevronDownGlyph = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const CheckGlyph = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const RefreshGlyph = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M20 11a8 8 0 10-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </svg>
);
export const PlayGlyph = ({ className = "size-3" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
  </svg>
);
export const LayersGlyph = ({ className = "size-3" }: P) => (
  <svg {...base} className={className}>
    <rect x="8" y="3" width="13" height="13" rx="3" />
    <path d="M5 8a3 3 0 00-2 2.8V18a3 3 0 003 3h7.2A3 3 0 0016 19" />
  </svg>
);
export const BagGlyph = ({ className = "size-3" }: P) => (
  <svg {...base} className={className}>
    <path d="M5 8h14l-1 12H6L5 8z" fill="currentColor" />
    <path d="M9 8V6a3 3 0 016 0v2" />
  </svg>
);
