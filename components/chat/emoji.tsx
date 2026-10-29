/* eslint-disable @next/next/no-img-element */
import { Fragment } from "react";
import { emojiUrl, isEmojiId, splitRich } from "@/lib/emoji/packs";

/** One emoji from a ":id:" code. Unknown codes (and old unicode reactions) render as plain text. */
export function EmojiGlyph({ code, size = 20, className = "" }: { code: string; size?: number; className?: string }) {
  const id = code.length > 2 && code.startsWith(":") && code.endsWith(":") ? code.slice(1, -1) : null;
  if (!id || !isEmojiId(id)) return <span className={className}>{code}</span>;
  return (
    <img
      src={emojiUrl(id)}
      alt={code}
      draggable={false}
      className={`inline-block select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Message text with :shortcodes: drawn as our emoji. One to three emoji on their own render big. */
export function RichText({ text }: { text: string }) {
  const parts = splitRich(text);
  if (!parts.some((p) => typeof p !== "string")) return <>{text}</>;
  const count = parts.filter((p) => typeof p !== "string").length;
  const jumbo = count <= 3 && parts.every((p) => typeof p !== "string" || p.trim() === "");
  const size = jumbo ? "2.6em" : "1.3em";
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <img
            key={i}
            src={emojiUrl(p.id)}
            alt={`:${p.id}:`}
            draggable={false}
            className="inline-block select-none align-[-0.28em]"
            style={{ width: size, height: size }}
          />
        ),
      )}
    </>
  );
}
