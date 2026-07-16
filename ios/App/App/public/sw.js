// Simple service worker — caches the game shell so it works offline after first load.
// Blueprint §26 (offline prototype). Cache-first for the static assets.
const CACHE = 'pullpop-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
  './js/util.js',
  './js/config.js',
  './js/audio.js',
  './js/haptics.js',
  './js/effects.js',
  './js/content.js',
  './js/physics.js',
  './js/replay.js',
  './js/input.js',
  './js/render.js',
  './js/ui.js',
  './js/game.js',
  './js/main.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const cp = res.clone();
      caches.open(CACHE).then((c) => c.put(req, cp)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
