const CACHE = 'speakback-v1';
const SHELL = ['/', '/style.css', '/script.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
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
  const { request } = e;
  // Network-first for API calls — never serve stale AI responses
  if (request.url.includes('/api/')) {
    e.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'You are offline' }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // Cache-first for static shell assets
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(res => {
      if (res.ok && SHELL.some(s => request.url.endsWith(s))) {
        caches.open(CACHE).then(c => c.put(request, res.clone()));
      }
      return res;
    }))
  );
});
