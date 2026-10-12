const CACHE = 'aviario-admin-v1';
const urls = [
  '/admin.html',
  '/manifest-admin.json',
  '/css/style.css',
  '/js/config.js',
  '/js/firebase.js',
  '/js/admin.js',
  '/icons/admin-192.png',
  '/icons/admin-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(urls).catch(err => console.log('Cache parcial:', err)))
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
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return response;
      }).catch(() => caches.match('/admin.html'));
    })
  );
});
