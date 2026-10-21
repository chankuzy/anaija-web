import { Icon } from "./icon";

// Posts with at least this many images get the copy badge.
export const MULTI_MIN = 2;

export function MultiBadge({ className = "right-3 top-3", small = false }: { className?: string; small?: boolean }) {
  return (
    <span
      aria-label="Multiple images"
      className={`pointer-events-none absolute z-10 grid place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm ${
        small ? "size-6" : "size-8"
      } ${className}`}
    >
      <Icon name="copy" filled className={small ? "size-[14px]" : "size-[18px]"} />
    </span>
  );
}
