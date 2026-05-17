const CACHE_NAME = "medterm-cache-v5";

// Generate all chapter paths
const chapterPaths = Array.from({length: 27}, (_, i) => `./database/chapter${i+1}.json`);

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  ...chapterPaths
];

// INSTALL - cache everything including all database files
self.addEventListener("install", (event) => {
  console.log("Service Worker Installing - caching all chapters...");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache static assets first
      return cache.addAll([
        "./",
        "./index.html",
        "./manifest.webmanifest",
        "./icons/icon-192.png",
        "./icons/icon-512.png"
      ]).then(() => {
        // Then cache each chapter individually (don't fail if one missing)
        return Promise.allSettled(
          chapterPaths.map(path =>
            fetch(path).then(res => {
              if (res.ok) return cache.put(path, res);
            }).catch(() => {})
          )
        );
      });
    })
  );

  self.skipWaiting();
});

// ACTIVATE - delete old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker Activated");

  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

// FETCH - cache first for database, network first for HTML
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Database files: cache first (offline support)
  if (url.pathname.includes("/database/")) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML/manifest: network first, fallback cache
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      fetch(request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Everything else: cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
