/* ============================================================
   ARFACE — service worker
   Small core assets are precached on install; heavy files
   (MediaPipe wasm + model + photos) are cached on first use.
   Pages: network-first with cache fallback (so updates land,
   but the app still opens offline). Bump CACHE to ship updates.
   ============================================================ */
const CACHE = 'arface-v29';

const CORE = [
  'index.html',
  'scan.html',
  'result.html',
  'ba.html',
  'analyze.html',
  'tips.html',
  'article.html',
  'clinics.html',
  'pricing.html',
  'login.html',
  'account.html',
  'trial.html',
  'profile.html',
  'manifest.json',
  'assets/fonts.css',
  'assets/arface.css',
  'assets/fit.js',
  'assets/ui.js',
  'assets/store.js',
  'assets/face-engine.js',
  'assets/scan.js',
  'assets/result.js',
  'assets/ba.js',
  'assets/analyze.js',
  'assets/profile.js',
  'assets/articles.js',
  'assets/tips.js',
  'assets/article.js',
  'assets/clinics.js',
  'assets/pricing.js',
  'assets/api.js',
  'assets/auth.js',
  'assets/account.js',
  'assets/trial.js',
  'assets/sw-register.js',
  'assets/install.js',
  'assets/fonts/NotoSansThai-thai.woff2',
  'assets/fonts/NotoSansThai-latin.woff2',
  'assets/fonts/NotoSansThai-latin-ext.woff2',
  'assets/fonts/Inter-latin.woff2',
  'assets/fonts/Inter-latin-ext.woff2',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
  'assets/logo-clean.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // heavy, effectively-immutable files: cache-first (wasm 11MB, model 3.7MB, fonts, images)
  const HEAVY = /\/assets\/(mediapipe|models|fonts|icons)\/|\.(png|webp|jpg|jpeg|woff2)$/;

  // pages + small code files: network-first so updates always land; cache fallback offline.
  // (Cache-first on code caused stale-module import crashes right after updates.)
  if (req.mode === 'navigate' || !HEAVY.test(url.pathname)) {
    const key = req.mode === 'navigate' ? url.pathname : req;
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(key, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(key).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
        )
    );
    return;
  }

  // heavy assets: cache-first, fill cache on first fetch
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && (res.type === 'basic' || res.type === 'default')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
