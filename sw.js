// Built by publish.py. VERSION is a hash of the site files, so each release replaces the cached shell.
const VERSION = 'recipe-083f62045a8f';
const DATA_CACHE = 'recipe-data';
const SHELL = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== VERSION && key !== DATA_CACHE).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Recipes and photos prefer the network so a new publish shows at once, and fall back to the last copy offline.
function networkFirst(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request, { ignoreSearch: true }));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const { pathname } = new URL(event.request.url);
  if (pathname.includes('/data/') || pathname.includes('/photos/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then((cached) => cached || fetch(event.request)),
  );
});
