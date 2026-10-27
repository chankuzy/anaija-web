"use client";

import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const DOUBLE_MS = 260;

// One tap opens (after a short wait), a second tap inside the window likes. Keyboard: Enter / Space opens.
export function TapSurface({
  onOpen,
  onLike,
  label,
  className = "",
  style,
  children,
}: {
  onOpen: () => void;
  onLike: () => void;
  label: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const onClick = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
      onLike();
      return;
    }
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onOpen();
    }, DOUBLE_MS);
  }, [onOpen, onLike]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand/80 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
