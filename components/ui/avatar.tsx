/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

function AvatarImg({ url, name, size, className }: { url: string; name: string; size: number; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Initial name={name} size={size} className={className} />;
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`rounded-full bg-card object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function Initial({ name, size, className }: { name: string; size: number; className: string }) {
  const c = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-card-elevated font-semibold text-fg ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {c}
    </span>
  );
}

export function Avatar({
  url,
  name,
  size = 34,
  className = "",
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  if (!url) return <Initial name={name ?? "?"} size={size} className={className} />;
  return <AvatarImg key={url} url={url} name={name ?? "?"} size={size} className={className} />;
}
