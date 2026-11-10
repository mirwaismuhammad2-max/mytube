const C = 'mytube-v3', A = ['./', './style.css', './app.js', './manifest.webmanifest', './icon-192.png', './icon-maskable-512.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(A)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
