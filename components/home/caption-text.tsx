// Hashtags the caption doesn't already contain get appended (same rule as the immersive caption).
export function withHashtags(caption: string | null, tags: string[] | undefined): string {
  const raw = (caption ?? "").trim();
  const have = new Set([...raw.matchAll(/#(\w+)/gu)].map((m) => m[1].toLowerCase()));
  const extra: string[] = [];
  for (const t of tags ?? []) {
    const c = t.replace(/#/g, "").trim();
    if (c && !have.has(c.toLowerCase())) {
      have.add(c.toLowerCase());
      extra.push(`#${c}`);
    }
  }
  if (!extra.length) return raw;
  return raw ? `${raw} ${extra.join(" ")}` : extra.join(" ");
}

export function CaptionText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(#\w+)/gu).map((part, i) =>
        part.length > 1 && part.startsWith("#") ? (
          <span key={i} className="font-semibold">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
