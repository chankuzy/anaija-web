/* eslint-disable @next/next/no-img-element */
import { Fragment } from "react";
import { customFor, emojiById, emojiUrl, richParts } from "@/lib/emoji/packs";

/** One emoji: ":id:" code or a unicode emoji. Custom art when we have it, native glyph otherwise. */
export function EmojiGlyph({ code, size = 20, className = "" }: { code: string; size?: number; className?: string }) {
  const isCode = code.length > 2 && code.startsWith(":") && code.endsWith(":");
  const d = isCode ? emojiById(code.slice(1, -1)) : customFor(code);
  if (!d) {
    return (
      <span className={`inline-block select-none ${className}`} style={{ fontSize: size * 0.88, lineHeight: 1 }}>
        {code}
      </span>
    );
  }
  return (
    <img src={emojiUrl(d.id)} alt={d.u} draggable={false} className={`inline-block select-none ${className}`} style={{ width: size, height: size }} />
  );
}

const JUMBO = [0, 72, 60, 52];

/** Message text with emoji drawn properly. jumbo = 1..3 renders emoji-only messages large. */
export function RichText({ text, jumbo = 0 }: { text: string; jumbo?: number }) {
  const parts = richParts(text);
  if (!parts.some((p) => p.k !== "text")) return <>{text}</>;
  const px = jumbo ? JUMBO[Math.min(3, jumbo)] : 0;
  return (
    <>
      {parts.map((p, i) => {
        if (p.k === "text") return <Fragment key={i}>{p.s}</Fragment>;
        if (p.k === "native")
          return px ? (
            <span key={i} className="inline-block select-none" style={{ fontSize: px * 0.85, lineHeight: 1.1 }}>
              {p.s}
            </span>
          ) : (
            <Fragment key={i}>{p.s}</Fragment>
          );
        return (
          <img
            key={i}
            src={emojiUrl(p.id)}
            alt={p.u}
            draggable={false}
            className={`inline-block select-none ${px ? "mx-0.5" : "align-[-0.28em]"}`}
            style={px ? { width: px, height: px } : { width: "1.3em", height: "1.3em" }}
          />
        );
      })}
    </>
  );
}
