const VERSION = "v2";
const CACHE = `anaija-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("anaija-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) => hit || fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
      ),
    );
  }
});

const FALLBACK_ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png";

function parsePush(event) {
  if (!event.data) return { d: {}, n: {} };
  let raw;
  try { raw = event.data.json(); } catch { return { d: {}, n: {} }; }
  return { d: raw.data || (raw.notification && raw.notification.data) || raw, n: raw.notification || {} };
}

async function showPush(event) {
  const { d, n } = parsePush(event);
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
