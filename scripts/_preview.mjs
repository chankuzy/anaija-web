// Temporary: renders candidate icons to /tmp/solar-send.html so we can pick the paper plane visually.
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const D = new URL("../node_modules/@solar-icons/react/dist/icons/", import.meta.url).pathname;
const names = ["plane", "plane-2", "plane-3", "send-square", "send-twice-square"];
let cells = "";
for (const n of names) {
  let row = `<div class="n">${n}</div>`;
  for (const s of ["bold", "outline"]) {
    const mod = await import(pathToFileURL(join(D, s, `${n}.mjs`)).href);
    const C = Object.values(mod)[0];
    row += `<div class="i">${renderToStaticMarkup(createElement(C, { size: 64, color: "currentColor" }))}<small>${s}</small></div>`;
  }
  cells += `<div class="r">${row}</div>`;
}
writeFileSync(
  "/tmp/solar-send.html",
  `<!doctype html><meta charset=utf-8><style>body{background:#111;color:#fff;font:14px system-ui;padding:24px}.r{display:flex;align-items:center;gap:32px;margin:14px 0}.n{width:170px;font-weight:700}.i{text-align:center}small{display:block;opacity:.5;margin-top:4px}</style>${cells}`,
);
console.log("wrote /tmp/solar-send.html");
