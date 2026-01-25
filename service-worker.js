const CACHE_VERSION = "ironai-v18";
const ASSETS = [
  "index.html",
  "styles.css",
  "script.js",
  "manifest.json",
  "assets/chart.min.js",
  "assets/icon-any.svg",
  "assets/icon-maskable.svg",
  "assets/inter.ttf",

];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const results = await Promise.allSettled(ASSETS.map((asset) => cache.add(asset)));
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.warn("[sw] precache failed", ASSETS[index], result.reason);
        }
      });
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("index.html");
        return cached || Response.error();
      })
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "GET_VERSION") {
    event.source?.postMessage({ type: "CACHE_VERSION", version: CACHE_VERSION });
  }
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
