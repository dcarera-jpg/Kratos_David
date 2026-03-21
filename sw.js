// ── Kratos Training — Service Worker ─────────────────────────
const CACHE = 'kratos-v5';
const BASE  = '/Kratos_David';

const PRECACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kratos — Offline</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0a0a0a;color:#fff;font-family:-apple-system,sans-serif;
       display:flex;flex-direction:column;align-items:center;justify-content:center;
       min-height:100vh;padding:24px;text-align:center}
  .logo{font-family:Georgia,serif;font-size:3rem;font-weight:900;color:#e8111a;
        letter-spacing:.12em;margin-bottom:24px}
  h1{font-size:1.1rem;font-weight:700;margin-bottom:10px}
  p{font-size:.85rem;color:#888;line-height:1.6;max-width:280px}
  button{margin-top:28px;padding:12px 28px;border-radius:12px;border:none;
         background:#e8111a;color:#fff;font-size:.9rem;font-weight:700;
         cursor:pointer;-webkit-tap-highlight-color:transparent}
</style>
</head>
<body>
  <div class="logo">K</div>
  <h1>You're offline</h1>
  <p>Reconnect to sync your training data and access your program.</p>
  <button onclick="location.reload()">Try again</button>
</body>
</html>`;

// ── Install: pre-cache static assets ─────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', function(e) {
  const url = e.request.url;

  // Network-first for Supabase API and Cloudflare Worker
  if (url.includes('supabase.co') || url.includes('workers.dev') ||
      url.includes('stripe.com') || url.includes('exercisedb.dev') ||
      url.includes('api.telegram.org')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        // Cache successful GET responses for same-origin assets
        if (response.ok && e.request.method === 'GET' &&
            url.startsWith(self.location.origin + BASE)) {
          const clone = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        }
        return response;
      }).catch(function() {
        // Offline fallback for navigation requests
        if (e.request.mode === 'navigate') {
          return new Response(OFFLINE_HTML, {
            headers: { 'Content-Type': 'text/html' }
          });
        }
      });
    })
  );
});
