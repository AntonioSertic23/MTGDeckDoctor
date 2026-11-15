/* MTG Deck Doctor — installable PWA service worker. */
const VERSION = "v2";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const IMAGES = "card-images-v1";
const KNOWN = [PAGES, STATIC, IMAGES];

/** Card art and mana symbols. Both CDNs send CORS headers, so responses are readable. */
const IMAGE_HOSTS = new Set(["cards.scryfall.io", "svgs.scryfall.io"]);
const MAX_IMAGES = 600;

const PRECACHE = ["/", "/decks", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !KNOWN.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (IMAGE_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  if (url.origin !== self.location.origin) return;
  // API routes and auth must always hit the network.
  if (url.pathname.startsWith("/api/")) return;

  // Hashed build assets never change for a given URL.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staleWhileRevalidate(request, STATIC));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});

async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGES);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // Opaque (no-CORS) responses report ok=false and are skipped: they cost a
  // lot of quota and cannot be inspected.
  if (response.ok) {
    await cache.put(request, response.clone());
    void trimCache(cache, MAX_IMAGES);
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached ?? Response.error());
  return cached ?? network;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) void cache.put(request, response.clone());
    return response;
  } catch {
    // Pages visited online are served from cache; anything else falls back to
    // the cached home page rather than the browser's offline error.
    return (await cache.match(request)) ?? (await cache.match("/")) ?? Response.error();
  }
}

/** Drop the oldest entries (insertion order) once the cache grows past `max`. */
async function trimCache(cache, max) {
  const keys = await cache.keys();
  const excess = keys.length - max;
  for (let index = 0; index < excess; index += 1) {
    await cache.delete(keys[index]);
  }
}
