// Shareable Verdict result card, drawn client-side. Carries no identities: question, options, percentages, link.
type Opt = { label: string; pct: number };

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > max && line) { out.push(line); line = w; } else line = next;
  }
  if (line) out.push(line);
  return out;
}
function fit(g: CanvasRenderingContext2D, s: string, max: number) {
  if (g.measureText(s).width <= max) return s;
  let t = s;
  while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export async function shareOutcome(o: { title: string; community: string; options: Opt[]; total: number; url: string }): Promise<"shared" | "saved" | "failed"> {
  const W = 1080, H = 1350;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d");
  if (!g) return "failed";
  const font = (w: number, s: number) => `${w} ${s}px Inter, system-ui, -apple-system, sans-serif`;
  g.fillStyle = "#09090b";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#4c8dff";
  g.font = font(800, 30);
  g.fillText("COMMUNITY VERDICT", 80, 120);
  g.fillStyle = "#85858f";
  g.font = font(600, 30);
  g.fillText(fit(g, o.community, W - 160), 80, 165);
  g.fillStyle = "#f4f4f6";
  g.font = font(800, 62);
  let y = 270;
  for (const line of wrap(g, o.title, W - 160).slice(0, 5)) {
    g.fillText(line, 80, y);
    y += 78;
  }
  y = Math.max(y + 40, 520);
  const top = Math.max(0, ...o.options.map((x) => x.pct));
  for (const op of o.options.slice(0, 6)) {
    g.fillStyle = "#19191d";
    rr(g, 80, y, W - 160, 96, 28);
    g.fill();
    const w = ((W - 160) * op.pct) / 100;
    if (w > 0) {
      g.fillStyle = op.pct === top ? "#4c8dff" : "#3a3a42";
      rr(g, 80, y, Math.max(w, 56), 96, 28);
      g.fill();
    }
    g.fillStyle = "#f4f4f6";
    g.font = font(700, 34);
    g.fillText(fit(g, op.label, 640), 112, y + 60);
    g.textAlign = "right";
    g.fillText(`${op.pct}%`, W - 112, y + 60);
    g.textAlign = "left";
    y += 120;
  }
  g.fillStyle = "#85858f";
  g.font = font(600, 30);
  g.fillText(`${o.total} ${o.total === 1 ? "vote" : "votes"}`, 80, H - 120);
  g.fillStyle = "#f4f4f6";
  g.font = font(800, 34);
  g.fillText("anaija", 80, H - 70);
  g.textAlign = "right";
  g.fillStyle = "#85858f";
  g.font = font(600, 28);
  g.fillText(o.url.replace(/^https?:\/\//, ""), W - 80, H - 70);

  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], "verdict.png", { type: "image/png" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: `${o.title}\n${o.url}` });
      return "shared";
    }
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return "failed";
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "verdict.png";
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "saved";
}
