/* Turni Corvetto PWA SW v8.7.0 — force update */
const CACHE_CORE = 'corvetto-core-v8.7.10';
const CACHE_CDN = 'corvetto-cdn-v8.7.10';

const CORE_ASSETS = [
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
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
    // Avvisa le pagine aperte di ricaricare
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: '8.7.1' }));
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // HTML / navigazione: SEMPRE network-first, non usare cache se la rete risponde
  const isHTML = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/') ||
    (req.headers.get('accept') || '').includes('text/html');
  if (url.origin === self.location.origin && isHTML) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-store' });
        return res;
      } catch (e) {
        const cache = await caches.open(CACHE_CORE);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  if (CDN_ASSETS.some((u) => req.url.startsWith(u.split('?')[0]) || req.url.includes('cdnjs.cloudflare.com') || req.url.includes('gstatic.com/firebasejs'))) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_CDN);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return hit || Response.error();
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok && !url.pathname.endsWith('sw.js')) {
          const cache = await caches.open(CACHE_CORE);
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        const cache = await caches.open(CACHE_CORE);
        const hit = await cache.match(req);
        return hit || Response.error();
      }
    })());
  }
});
