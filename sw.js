// Sendbook service worker: works offline at the crag.
// App shell: cached, refreshed in the background. Map tiles: cached as you view them (capped).
const SHELL = 'sendbook-shell-v2';
const TILES = 'sendbook-tiles-v2';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== TILES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/arcgisonline\.com$|tile\.openstreetmap\.org$|^spatial-img\.information\.qld\.gov\.au$/.test(url.hostname)) { e.respondWith(tile(req)); return; }
  const shell = url.origin === location.origin || /^(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
  if (!shell) return;
  e.respondWith(caches.open(SHELL).then(async c => {
    const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; })
      .catch(() => hit || (req.mode === 'navigate' ? c.match('./index.html') : Response.error()));
    return hit || net;
  }));
});
async function tile(req) {
  const c = await caches.open(TILES);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trim(c); }
    return res;
  } catch (err) { return Response.error(); }
}
let trimming = false;
async function trim(c) {
  if (trimming) return;
  trimming = true;
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - 6000))) await c.delete(k);
  trimming = false;
}
