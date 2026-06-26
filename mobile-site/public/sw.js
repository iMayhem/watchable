const CACHE_NAME = 'moovie-mobile-cache-v2';
const API_TTL = 24 * 60 * 60 * 1000;
const IMAGE_TTL = 7 * 24 * 60 * 60 * 1000;
const PRECACHE_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.json',
  '/artplayer-compact.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline mobile assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old mobile cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

function isFresh(timestamp, ttl) {
  return Date.now() - timestamp < ttl;
}

function cacheWithTimestamp(cache, request, response) {
  const headers = new Headers(response.headers);
  headers.append('x-sw-cache-time', String(Date.now()));
  const cached = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
  cache.put(request, cached);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  const isVideo =
    url.pathname.match(/\.(mp4|webm|m3u8|ts|mp3|m4a|aac|wav|ogg)$/i) ||
    event.request.headers.get('range') ||
    url.hostname.includes('animeplay') ||
    url.hostname.includes('cinestream') ||
    url.pathname.includes('/stream/') ||
    url.pathname.includes('/api/stream');

  if (isVideo) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/', clone);
          });
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.includes('/assets/') ||
     url.pathname.includes('/icons/') ||
     url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.woff2') ||
     url.pathname.endsWith('.png') ||
     url.pathname.endsWith('.svg'));

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  const isTmdbImage = url.hostname.includes('image.tmdb.org');
  const isExternalApi =
    url.hostname.includes('graphql.anilist.co') ||
    url.hostname.includes('api.themoviedb.org');

  if (!isTmdbImage && !isExternalApi) return;

  const ttl = isTmdbImage ? IMAGE_TTL : API_TTL;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const cacheTime = cachedResponse?.headers?.get('x-sw-cache-time');
        if (cachedResponse && cacheTime && isFresh(Number(cacheTime), ttl)) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cacheWithTimestamp(cache, event.request, networkResponse);
          }
          return networkResponse;
        }).catch(() => cachedResponse);
      });
    })
  );
});
