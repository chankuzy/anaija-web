"use client";

// Small round indicator that drops in from the top while you pull; it spins while refreshing.
export function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  if (pull <= 0 && !refreshing) return null;
  const p = Math.min(1, pull / 64);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
      style={{
        top: "calc(env(safe-area-inset-top) + 64px)",
        transform: `translateY(${pull - 40}px)`,
        opacity: Math.max(0.15, p),
        transition: refreshing ? "transform 200ms ease, opacity 200ms ease" : "none",
      }}
    >
      <span className="grid size-9 place-items-center rounded-full bg-brand text-brand-fg shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <svg
          viewBox="0 0 24 24"
          className={`size-[18px] ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${p * 270}deg)` }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4v5h-5" />
        </svg>
      </span>
    </div>
  );
}
