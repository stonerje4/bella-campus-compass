/* Bella's Campus Compass — offline support.
   Strategy: network-first for the app shell (updates always win, cache is the
   backup when campus wifi dies); cache-first for photos/icons/leaflet; never
   cache live data (tiles, routing, weather, overpass). */
const CACHE = 'bcc-v3';   /* bumped: new live feeds must never be served from cache */
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'wolfline.json',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];
const LIVE_ONLY = ['tile.openstreetmap.org', 'routing.openstreetmap.de', 'api.open-meteo.com',
                   'overpass', 'passio3.com', 'calendar.ncsu.edu', 'api.weather.gov',
                   'wellrec.dasa.ncsu.edu', 'gbfs.spin.pm', 'dining.ncsu.edu',
                   'gopack.com', 'site.api.espn.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;
  if (LIVE_ONLY.some(h => url.includes(h))) return; // always hit the network, never cache

  // app shell + anything navigational + semester data: network-first, cache fallback
  if (e.request.mode === 'navigate' || url.endsWith('index.html') || url.endsWith('/') || url.endsWith('wolfline.json')) {
    e.respondWith(
      fetch(e.request)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request).then(m => m || caches.match('index.html')))
    );
    return;
  }
  // everything else (pics, icons, leaflet): cache-first, populate on miss
  e.respondWith(
    caches.match(e.request).then(m => m || fetch(e.request).then(r => {
      if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    }))
  );
});
