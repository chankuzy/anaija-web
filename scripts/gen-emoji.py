#!/usr/bin/env python3
"""Generates public/emoji/*.svg and lib/emoji/manifest.json. Re-run any time: python3 scripts/gen-emoji.py"""
import json, os

OUT = "public/emoji"
os.makedirs(OUT, exist_ok=True)
INK = "#3B2A14"
HEART = "M32 56C12 42 6 30 6 21C6 13 12 8 19 8C25 8 29 11 32 16C35 11 39 8 45 8C52 8 58 13 58 21C58 30 52 42 32 56Z"

def svg(body):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + body + "</svg>"

def stroke(d, w=3.4, c=INK):
    return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'

def dot(x, y, r=3.2):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{INK}"/>'

EYES = {
    "dot": dot(23, 27) + dot(41, 27),
    "happy": stroke("M18 29Q23 21 28 29M36 29Q41 21 46 29"),
    "closed": stroke("M18 27Q23 33 28 27M36 27Q41 33 46 27"),
    "wink": dot(23, 27) + stroke("M36 28Q41 22 46 28"),
    "hearts": f'<path transform="translate(15 17) scale(.24)" d="{HEART}" fill="#EF4444"/><path transform="translate(34 17) scale(.24)" d="{HEART}" fill="#EF4444"/>',
    "shades": '<path d="M12 21H52V28C52 35 47 39 41 39C36 39 33 35 32 31C31 35 28 39 23 39C17 39 12 35 12 28Z" fill="#111"/>',
    "wide": f'<circle cx="23" cy="27" r="6.5" fill="#fff" stroke="{INK}" stroke-width="2"/><circle cx="41" cy="27" r="6.5" fill="#fff" stroke="{INK}" stroke-width="2"/>' + dot(23, 27, 2.6) + dot(41, 27, 2.6),
    "angry": dot(23, 29) + dot(41, 29) + stroke("M14 19L29 25M50 19L35 25", 3.8),
}
MOUTH = {
    "smile": stroke("M20 40Q32 52 44 40"),
    "grin": '<path d="M17 38H47C47 50 40 56 32 56C24 56 17 50 17 38Z" fill="#5A1D1D"/><path d="M19 38H45V43H19Z" fill="#fff"/>',
    "open": '<ellipse cx="32" cy="47" rx="5.5" ry="7" fill="#5A1D1D"/>',
    "frown": stroke("M21 50Q32 39 43 50"),
    "flat": stroke("M23 46H41"),
    "tongue": '<path d="M18 40Q32 56 46 40Z" fill="#5A1D1D"/><path d="M27 46Q32 58 37 46Z" fill="#FB7185"/>',
    "kiss": '<ellipse cx="32" cy="46" rx="3.4" ry="4" fill="#E11D48"/>',
    "wavy": stroke("M19 45Q25.5 39 32 45T45 45"),
    "tiny": '<ellipse cx="32" cy="47" rx="3" ry="2.6" fill="#5A1D1D"/>',
    "sob": '<path d="M20 52Q32 38 44 52Z" fill="#5A1D1D"/>',
}
EXTRA = {
    "tears": '<path d="M21 33Q17 41 21 44Q25 41 21 33Z" fill="#60A5FA"/><path d="M43 33Q39 41 43 44Q47 41 43 33Z" fill="#60A5FA"/>',
    "stream": '<path d="M19 31Q14 44 20 54Q27 44 27 31Z" fill="#60A5FA"/><path d="M45 31Q50 44 44 54Q37 44 37 31Z" fill="#60A5FA"/>',
    "joytears": '<path d="M11 30Q4 32 5 39Q12 38 14 32Z" fill="#60A5FA"/><path d="M53 30Q60 32 59 39Q52 38 50 32Z" fill="#60A5FA"/>',
    "sweat": '<path d="M52 8Q45 19 52 24Q59 19 52 8Z" fill="#7DD3FC"/>',
    "blush": '<ellipse cx="15" cy="39" rx="5" ry="3" fill="#FB7185" opacity=".6"/><ellipse cx="49" cy="39" rx="5" ry="3" fill="#FB7185" opacity=".6"/>',
    "party": '<path d="M32 -1L45 17H19Z" fill="#8B5CF6"/><circle cx="32" cy="1.5" r="3.2" fill="#FBBF24"/><path d="M25 11H39" stroke="#FBBF24" stroke-width="2.5"/>',
    "zzz": stroke("M44 8H52L44 18H52", 3, "#60A5FA"),
    "brow": stroke("M16 17Q23 12 30 17", 3),
    "browsup": stroke("M15 15Q22 9 29 15M35 15Q42 9 49 15", 3),
    "kissheart": f'<path transform="translate(40 34) scale(.17)" d="{HEART}" fill="#F43F5E"/>',
}
WARM = ("#FFD84D", "#FFB820")
HOT = ("#FF9A5C", "#F0561F")

def face(eyes, mouth, extras=(), pal=WARM):
    base = (f'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{pal[0]}"/>'
            f'<stop offset="1" stop-color="{pal[1]}"/></linearGradient></defs><circle cx="32" cy="32" r="29" fill="url(#g)"/>')
    return svg(base + EYES[eyes] + MOUTH[mouth] + "".join(EXTRA[x] for x in extras))

# id, label, unicode fallback, svg
ITEMS = [
    ("smile", "Smile", "🙂", face("dot", "smile")),
    ("grin", "Grin", "😁", face("dot", "grin")),
    ("joy", "Laughing", "😂", face("happy", "grin", ["joytears"])),
    ("love", "In love", "😍", face("hearts", "smile")),
    ("cool", "Cool", "😎", face("shades", "smile")),
    ("wink", "Wink", "😉", face("wink", "tongue")),
    ("cry", "Crying", "😢", face("dot", "frown", ["tears"])),
    ("sob", "Sobbing", "😭", face("closed", "sob", ["stream"])),
    ("angry", "Angry", "😠", face("angry", "frown", pal=HOT)),
    ("shock", "Shocked", "😮", face("wide", "open", ["browsup"])),
    ("sleepy", "Sleepy", "😴", face("closed", "tiny", ["zzz"])),
    ("think", "Thinking", "🤔", face("dot", "flat", ["brow"])),
    ("kiss", "Kiss", "😘", face("wink", "kiss", ["kissheart"])),
    ("sweat", "Nervous", "😅", face("dot", "wavy", ["sweat"])),
    ("blush", "Blushing", "😊", face("happy", "smile", ["blush"])),
    ("party", "Party", "🥳", face("happy", "grin", ["party"])),
    ("heart", "Heart", "❤️", svg(f'<path d="{HEART}" fill="#F43F5E"/><path d="M16 17Q21 12 27 15" fill="none" stroke="#FDA4AF" stroke-width="3.4" stroke-linecap="round"/>')),
    ("naija", "Naija heart", "💚", svg(f'<defs><clipPath id="c"><path d="{HEART}"/></clipPath></defs><path d="{HEART}" fill="#008751"/><rect x="24" y="0" width="16" height="64" fill="#fff" clip-path="url(#c)"/>')),
    ("fire", "Fire", "🔥", svg('<path d="M32 4C34 17 49 23 49 40C49 52 41 59 32 59C23 59 15 52 15 41C15 33 20 29 24 21C26 27 28 29 30 29C31 21 29 13 32 4Z" fill="#FF6A1F"/><path d="M32 59C27 59 23 55 23 50C23 44 28 42 30 36C34 40 41 44 41 50C41 55 37 59 32 59Z" fill="#FFC83D"/>')),
    ("hundred", "100", "💯", svg('<g fill="none" stroke="#EF4444" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V44"/><rect x="21" y="16" width="14" height="28" rx="7"/><rect x="41" y="16" width="14" height="28" rx="7"/><path d="M8 52H56"/><path d="M14 59H50"/></g>')),
    ("like", "Thumbs up", "👍", svg('<rect x="6" y="28" width="13" height="29" rx="3" fill="#3B82F6"/><path d="M23 30L33 7C39 7 42 13 40 20L38 26H52C57 26 59 31 57 36L54 50C53 54 50 57 46 57H23Z" fill="#FFC83D"/>')),
    ("clap", "Clap", "👏", svg(f'<g transform="rotate(-22 32 38)"><rect x="12" y="22" width="22" height="34" rx="10" fill="#FFC83D"/></g><g transform="rotate(22 32 38)"><rect x="30" y="22" width="22" height="34" rx="10" fill="#FFB820"/></g>' + stroke("M8 12L13 18M32 4V12M56 12L51 18", 3.4))),
    ("pray", "Pray", "🙏", svg('<path d="M32 6C21 17 17 34 19 51L32 59L45 51C47 34 43 17 32 6Z" fill="#FFC83D"/><path d="M32 14V57" stroke="#E59F0B" stroke-width="3" stroke-linecap="round"/>')),
    ("jollof", "Jollof", "🍛", svg('<path d="M8 34H56C56 48 46 58 32 58C18 58 8 48 8 34Z" fill="#E5E7EB"/><path d="M11 34C11 20 21 11 32 11C43 11 53 20 53 34Z" fill="#F97316"/><g fill="#FDBA74"><circle cx="24" cy="24" r="2"/><circle cx="34" cy="19" r="2"/><circle cx="42" cy="27" r="2"/><circle cx="30" cy="29" r="2"/><circle cx="19" cy="31" r="2"/></g><circle cx="44" cy="16" r="5" fill="#DC2626"/><path d="M44 11V8" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round"/>')),
    ("crown", "Crown", "👑", svg('<path d="M8 48L12 20L24 32L32 13L40 32L52 20L56 48Z" fill="#FBBF24"/><rect x="8" y="48" width="48" height="9" rx="2" fill="#F59E0B"/><circle cx="12" cy="19" r="3.5" fill="#EF4444"/><circle cx="32" cy="12" r="3.5" fill="#22C55E"/><circle cx="52" cy="19" r="3.5" fill="#3B82F6"/>')),
    ("star", "Star", "⭐", svg('<path d="M32 5L39.5 23L59 24.5L44 37L48.5 56L32 45.5L15.5 56L20 37L5 24.5L24.5 23Z" fill="#FBBF24"/>')),
]

manifest = []
for id_, label, u, body in ITEMS:
    assert id_.isalpha() and id_.islower() and 2 <= len(id_) <= 8, id_
    with open(os.path.join(OUT, id_ + ".svg"), "w", encoding="utf-8") as f:
        f.write(body)
    manifest.append({"id": id_, "label": label, "u": u})

with open("lib/emoji/manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print(f"wrote {len(manifest)} emojis")
