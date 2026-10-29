const VERSION = "v4";
const STATIC = `anaija-static-${VERSION}`;
const PAGES = `anaija-pages-${VERSION}`;
const IMAGES = `anaija-img-${VERSION}`;
const KEEP = [STATIC, PAGES, IMAGES];
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];
const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/emoji/", "/stickers/", "/brand/"];
const MAX_IMAGES = 400;
const corsBlocked = new Set();

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("anaija-") && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Sign-out: nothing from the previous account may survive offline.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "anaija:clear-pages") {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(IMAGES)]));
  }
});

async function cacheFirst(name, req) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

// Network first, but never make someone wait on a bad connection when we already have the page.
async function page(event, req) {
  const cache = await caches.open(PAGES);
  const hit = await cache.match(req, { ignoreVary: true, ignoreSearch: true });
  const net = fetch(req).then((res) => {
    if (res.ok && !res.redirected && res.type === "basic") cache.put(req, res.clone());
    return res;
  });
  if (!hit) {
    try {
      return await net;
    } catch {
      return caches.match(OFFLINE_URL);
    }
  }
  event.waitUntil(net.catch(() => {}));
  return Promise.race([net, new Promise((r) => setTimeout(() => r(hit), 2500))]).catch(() => hit);
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_IMAGES; i++) await cache.delete(keys[i]);
}

// Avatars and post/chat images from the CDN. A CORS fetch gives a real (cheap) cacheable response; if the CDN
// refuses CORS we stop trying for that origin and just pass the request through.
async function image(req) {
  const origin = new URL(req.url).origin;
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  let tried = false;
  if (!corsBlocked.has(origin)) {
    tried = true;
    try {
      const res = await fetch(req.url, { mode: "cors", credentials: "omit" });
      if (res.ok) {
        cache.put(req.url, res.clone());
        if (Math.random() < 0.1) trim(cache);
        return res;
      }
    } catch {}
  }
  const res = await fetch(req);
  if (tried) corsBlocked.add(origin);
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/")) return;
    if (req.mode === "navigate") {
      event.respondWith(page(event, req));
      return;
    }
    if (STATIC_PREFIXES.some((p) => url.pathname.startsWith(p))) event.respondWith(cacheFirst(STATIC, req));
    return;
  }
  if (req.destination === "image" && url.protocol === "https:") event.respondWith(image(req));
});

const FALLBACK_ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png";

function parsePush(event) {
  if (!event.data) return { d: {}, n: {} };
  let raw;
  try { raw = event.data.json(); } catch { return { d: {}, n: {} }; }
  return { d: raw.data || (raw.notification && raw.notification.data) || raw, n: raw.notification || {} };
}

// Chromium lets a page that is visible and focused skip the system notification (the in-app banner takes over).
// Safari and iOS require a system notification for every push, so they never skip.
function canSkipSystemNotification() {
  const ua = self.navigator.userAgent || "";
  return /(Chrome|Edg)\//.test(ua) && !/(iPhone|iPad|iPod)/.test(ua);
}

async function showPush(event) {
  const { d, n } = parsePush(event);
  const allWins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const live = allWins.find((w) => w.visibilityState === "visible" && w.focused);
  if (live && canSkipSystemNotification()) {
    live.postMessage({ type: "anaija:banner", data: d });
    for (const w of allWins) w.postMessage({ type: "anaija:push", kind: d.type || "" });
    return;
  }
  const title = d.title || n.title || "Anaija";
  const options = {
    body: d.body || n.body || "",
    icon: d.avatar || FALLBACK_ICON,
    badge: BADGE,
    timestamp: Date.now(),
    data: d,
  };
  if (d.image) options.image = d.image;
  if (d.tag) { options.tag = d.tag; options.renotify = true; }
  await self.registration.showNotification(title, options);

  try {
    const open = await self.registration.getNotifications();
    if (self.navigator.setAppBadge) await self.navigator.setAppBadge(open.length);
  } catch {}

  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const w of wins) w.postMessage({ type: "anaija:push", kind: d.type || "" });
}

self.addEventListener("push", (event) => { event.waitUntil(showPush(event)); });

const num = (v) => (/^\d{1,12}$/.test(String(v || "")) ? String(v) : null);
const uname = (v) => (/^[A-Za-z0-9_.]{2,30}$/.test(String(v || "")) ? String(v) : null);

function routeFor(d) {
  const post = num(d.post_id);
  const conv = num(d.conversation_id);
  const user = uname(d.username || d.actor_username);
  const viewer = uname(d.viewer_username);
  switch (d.dest) {
    case "post": case "comment": if (post) return `/p/${post}`; break;
    case "listing": if (post) return `/l/${post}`; break;
    case "profile": if (user) return `/u/${user}`; break;
    case "followers": if (viewer) return `/u/${viewer}/followers`; break;
    case "conversation": if (conv) return `/messages/${conv}`; break;
    case "chats": return "/messages";
  }
  return "/?panel=notifications"; // story, milestones, anything without a page: open the notifications panel
}

async function openApp(path) {
  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const w of wins) {
    if (new URL(w.url).origin === self.location.origin) {
      await w.focus();
      w.postMessage({ type: "anaija:navigate", url: path });
      return;
    }
  }
  await self.clients.openWindow(new URL(path, self.location.origin).href);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openApp(routeFor(event.notification.data || {})));
});
