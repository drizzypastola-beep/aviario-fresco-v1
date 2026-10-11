const CACHE = 'aviario-v1';
const urls = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/style.css',
  '/js/config.js',
  '/js/firebase.js',
  '/js/loja.js',
  '/js/admin.js',
  '/img/icon-192.png',
  '/img/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(urls)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request).catch(() => caches.match('/index.html')))
  );
});
