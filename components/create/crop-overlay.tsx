"use client";

// Port of free_crop_overlay.dart. Lives inside a box exactly the size of the displayed image (w x h px);
// `crop` is normalized 0..1 relative to the image. `ratio` (width/height in image pixels) locks the box shape.
import { useRef } from "react";
import { isFullCrop, type Crop } from "@/lib/create/image-pipeline";

type Mode = "none" | "move" | "tl" | "tr" | "bl" | "br";
type Pt = { x: number; y: number };

const HIT = 34;
const MIN = 0.08;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function CropOverlay({
  w,
  h,
  crop,
  ratio,
  interactive,
  onChange,
}: {
  w: number;
  h: number;
  crop: Crop;
  ratio: number | null;
  interactive: boolean;
  onChange: (c: Crop) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: Mode; start: Crop; p0: Pt; anchor: Pt; grab: Pt }>({
    mode: "none",
    start: crop,
    p0: { x: 0, y: 0 },
    anchor: { x: 0, y: 0 },
    grab: { x: 0, y: 0 },
  });

  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    return { px, py, n: { x: px / r.width, y: py / r.height } };
  };

  function down(e: React.PointerEvent) {
    if (!interactive) return;
    const { px, py, n } = local(e);
    const c = crop;
    const L = c.left * w;
    const T = c.top * h;
    const R = c.right * w;
    const B = c.bottom * h;
    const near = (x: number, y: number) => Math.hypot(x - px, y - py) <= HIT;
    const d = drag.current;
    d.start = c;
    d.p0 = n;
    d.grab = { x: 0, y: 0 };
    if (near(L, T)) {
      d.mode = "tl";
      d.anchor = { x: c.right, y: c.bottom };
      d.grab = { x: c.left - n.x, y: c.top - n.y };
    } else if (near(R, T)) {
      d.mode = "tr";
      d.anchor = { x: c.left, y: c.bottom };
      d.grab = { x: c.right - n.x, y: c.top - n.y };
    } else if (near(L, B)) {
      d.mode = "bl";
      d.anchor = { x: c.right, y: c.top };
      d.grab = { x: c.left - n.x, y: c.bottom - n.y };
    } else if (near(R, B)) {
      d.mode = "br";
      d.anchor = { x: c.left, y: c.top };
      d.grab = { x: c.right - n.x, y: c.bottom - n.y };
    } else if (px >= L - 8 && px <= R + 8 && py >= T - 8 && py <= B + 8) {
      d.mode = "move";
    } else {
      d.mode = "none";
    }
    if (d.mode !== "none") e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (d.mode === "none") return;
    const { n } = local(e);

    if (d.mode === "move") {
      const dx = n.x - d.p0.x;
      const dy = n.y - d.p0.y;
      const s = d.start;
      let r: Crop = { left: s.left + dx, top: s.top + dy, right: s.right + dx, bottom: s.bottom + dy };
      const sx = r.left < 0 ? -r.left : r.right > 1 ? 1 - r.right : 0;
      const sy = r.top < 0 ? -r.top : r.bottom > 1 ? 1 - r.bottom : 0;
      r = { left: r.left + sx, top: r.top + sy, right: r.right + sx, bottom: r.bottom + sy };
      onChange(r);
      return;
    }

    const pt = { x: clamp(n.x + d.grab.x, 0, 1), y: clamp(n.y + d.grab.y, 0, 1) };
    const sx = pt.x >= d.anchor.x ? 1 : -1;
    const sy = pt.y >= d.anchor.y ? 1 : -1;
    let cw = Math.abs(pt.x - d.anchor.x);
    let ch = Math.abs(pt.y - d.anchor.y);

    if (ratio !== null) {
      const a = w / h; // normalized h = w * a / ratio
      cw = Math.max(cw, (ch * ratio) / a);
      ch = (cw * a) / ratio;
      const maxW = sx > 0 ? 1 - d.anchor.x : d.anchor.x;
      const maxH = sy > 0 ? 1 - d.anchor.y : d.anchor.y;
      if (ch > maxH) {
        ch = maxH;
        cw = (ch * ratio) / a;
      }
      if (cw > maxW) {
        cw = maxW;
        ch = (cw * a) / ratio;
      }
    }
    if (cw < MIN || ch < MIN) return;

    const x2 = d.anchor.x + sx * cw;
    const y2 = d.anchor.y + sy * ch;
    onChange({
      left: Math.min(d.anchor.x, x2),
      top: Math.min(d.anchor.y, y2),
      right: Math.max(d.anchor.x, x2),
      bottom: Math.max(d.anchor.y, y2),
    });
  }

  const up = () => {
    drag.current.mode = "none";
  };

  if (!interactive && isFullCrop(crop)) return null;

  const box = { left: crop.left * w, top: crop.top * h, width: (crop.right - crop.left) * w, height: (crop.bottom - crop.top) * h };
  const corner = "absolute size-[18px] border-white";
  return (
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: interactive ? "none" : undefined, pointerEvents: interactive ? "auto" : "none" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="absolute border border-white" style={{ ...box, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }}>
        {interactive && (
          <>
            <span className="absolute inset-y-0 left-1/3 w-px bg-white/35" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-white/35" />
            <span className="absolute inset-x-0 top-1/3 h-px bg-white/35" />
            <span className="absolute inset-x-0 top-2/3 h-px bg-white/35" />
            <span className={`${corner} -left-px -top-px border-l-[3.5px] border-t-[3.5px]`} />
            <span className={`${corner} -right-px -top-px border-r-[3.5px] border-t-[3.5px]`} />
            <span className={`${corner} -bottom-px -left-px border-b-[3.5px] border-l-[3.5px]`} />
            <span className={`${corner} -bottom-px -right-px border-b-[3.5px] border-r-[3.5px]`} />
          </>
        )}
      </div>
    </div>
  );
}
