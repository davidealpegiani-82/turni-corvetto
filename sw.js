/* Turni Corvetto PWA SW v8.1.0 */
const CACHE_CORE = 'corvetto-core-v8.1.0';
const CACHE_CDN = 'corvetto-cdn-v8.1.0';
const CORE_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
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
    self.skipWaiting();
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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url || '';
  if (url.indexOf('firebaseio.com') !== -1 || url.indexOf('googleapis.com') !== -1) return;

  if (url.indexOf('cdnjs.cloudflare.com') !== -1 || url.indexOf('gstatic.com') !== -1) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cdn = await caches.open(CACHE_CDN);
          cdn.put(req, res.clone());
        }
        return res;
      } catch (e) {
        return cached || Response.error();
      }
    })());
    return;
  }

  if (url.startsWith(self.location.origin)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok && (req.mode === 'navigate' || url.indexOf('index.html') !== -1 || url.endsWith(self.location.origin + '/') || url.endsWith('/'))) {
          const core = await caches.open(CACHE_CORE);
          try { core.put(req, res.clone()); } catch (e) {}
        }
        return res;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fallback = await caches.match('/index.html');
        return fallback || Response.error();
      }
    })());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          try { client.navigate(target); } catch (e) {}
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
