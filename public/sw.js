// Solo se almacena una página pública de desconexión, nunca inventario o sesiones.
const CACHE = "pizza-republic-offline-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add("/offline.html")));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("pizza-republic-offline-") && key !== CACHE).map((key) => caches.delete(key)))));
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate" && new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
  }
});
