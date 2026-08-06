// TMDB proxy worker — posters/backdrops + TMDB API, fully VPS-independent.
//
// Routes:
//   /t/p/{size}/{path}  → https://image.tmdb.org/t/p/{size}/{path}   (30-day cache)
//   /3/{...}            → https://api.themoviedb.org/3/{...}          (1-hour cache, api_key injected)
//
// Replaces the old VPS path proxy.moovie.fun/tmdb-image and /tmdb-api so
// artwork and catalog data keep working when the VPS is down.

const API_KEY = 'dfa4c2c7c1de1005adee824dc5593672';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    let origin, target, cacheTtl, cacheControl;
    if (url.pathname.startsWith('/t/p/')) {
      origin = 'https://image.tmdb.org';
      target = origin + url.pathname + url.search;
      cacheTtl = 2592000;
      cacheControl = 'public, max-age=2592000, immutable';
    } else if (url.pathname.startsWith('/3/')) {
      origin = 'https://api.themoviedb.org';
      const q = new URLSearchParams(url.search);
      if (!q.has('api_key')) q.set('api_key', API_KEY);
      target = origin + url.pathname + '?' + q.toString();
      cacheTtl = 3600;
      cacheControl = 'public, max-age=3600';
    } else {
      return new Response('Not found', { status: 404, headers: CORS });
    }

    const isImage = url.pathname.startsWith('/t/p/');
    const cacheKey = new Request(target, { method: 'GET' });
    const cache = caches.default;

    let res = await cache.match(cacheKey);
    if (res) {
      const h = new Headers(res.headers);
      h.set('Access-Control-Allow-Origin', '*');
      return new Response(res.body, { status: res.status, headers: h });
    }

    res = await fetch(target, {
      method: 'GET',
      headers: {
        Accept: isImage ? 'image/webp,image/avif,image/*,*/*;q=0.8' : 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; tmdb-proxy/1.0)',
        Referer: 'https://www.themoviedb.org/',
      },
      cf: { cacheTtl, cacheEverything: true },
    });

    if (res.status === 200) {
      const h = new Headers(res.headers);
      h.set('Access-Control-Allow-Origin', '*');
      h.set('Cache-Control', cacheControl);
      const out = new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
      ctx.waitUntil(cache.put(cacheKey, out.clone()));
      return out;
    }

    const h = new Headers(res.headers);
    h.set('Access-Control-Allow-Origin', '*');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  },
};
