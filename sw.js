/* Turni Corvetto PWA SW v9.11.41 */
const CACHE_CORE = 'corvetto-core-v9.11.41-r1';
const CACHE_CDN = 'corvetto-cdn-v9.11.41-r1';
const APP_SW_VERSION = '9.11.41';

const CORE_ASSETS = [
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const core = await caches.open(CACHE_CORE);
    for (const url of CORE_ASSETS) {
      try { await core.add(url); } catch (err) { console.warn('core skip', url, err); }
    }
    const cdn = await caches.open(CACHE_CDN);
    for (const url of CDN_ASSETS) {
      try { await cdn.add(url); } catch (err) { console.warn('cdn skip', url); }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k !== CACHE_CORE && k !== CACHE_CDN) return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isNav || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith((async () => {
      try { return await fetch(req); }
      catch (e) {
        const cache = await caches.open(CACHE_CORE);
        return (await cache.match('./index.html')) || (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }
  if (req.url.includes('cdnjs.cloudflare.com') || req.url.includes('gstatic.com/firebasejs')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_CDN);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const net = await fetch(req);
        try { cache.put(req, net.clone()); } catch (e) {}
        return net;
      } catch (e) { if (hit) return hit; throw e; }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_CORE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const net = await fetch(req);
      try { cache.put(req, net.clone()); } catch (e) {}
      return net;
    } catch (e) { if (hit) return hit; throw e; }
  })());
});
