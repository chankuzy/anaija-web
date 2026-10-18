const KEY = "recent_searches";
const EVT = "anaija:recents";
const MAX = 10;

export function recentsSubscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}
export function recentsSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
export const recentsServerSnapshot = () => "[]";

export function parseRecents(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: recents just don't persist */
  }
  window.dispatchEvent(new Event(EVT));
}

export function addRecent(term: string) {
  const t = term.trim();
  if (t.length < 2) return;
  const cur = parseRecents(recentsSnapshot()).filter((x) => x.toLowerCase() !== t.toLowerCase());
  write([t, ...cur].slice(0, MAX));
}
export function removeRecent(term: string) {
  write(parseRecents(recentsSnapshot()).filter((x) => x !== term));
}
export function clearRecents() {
  write([]);
}
