/**
 * Cloudflare Worker entry for movieace (moovie.fun).
 * - /tmdb-image/* -> image.tmdb.org with 30d edge cache (no VPS hop)
 * - /tmdb-api/*   -> api.themoviedb.org with 1h edge cache
 * - everything else -> static SPA assets (dist/)
 */

interface Env {
  ASSETS: Fetcher;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: { ...CORS } });
}

async function handleImage(path: string, ctx: ExecutionContext): Promise<Response> {
  // Only allow real TMDB size tokens: w92..w1280, w780, original, h..., etc.
  if (!/^(w\d+|h\d+|original)\/.+/.test(path)) {
    return new Response('Invalid TMDB path', { status: 400, headers: { ...CORS } });
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://tmdb-image-cache/${path}`, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const h = new Headers(cached.headers);
    h.set('X-Cache', 'HIT');
    h.set('Access-Control-Allow-Origin', '*');
    return new Response(cached.body, { status: cached.status, headers: h });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`https://image.tmdb.org/t/p/${path}`, {
      cf: { cacheTtl: 2592000, cacheEverything: true },
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*,*/*' },
    } as RequestInit);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Proxy error';
    return new Response(msg, { status: 502, headers: { ...CORS, 'Cache-Control': 'no-cache' } });
  }

  if (!upstream.ok) {
    return new Response(`TMDB upstream ${upstream.status}`, {
      status: upstream.status,
      headers: { ...CORS, 'Cache-Control': 'no-cache' },
    });
  }

  const headers = new Headers(upstream.headers);
  headers.delete('set-cookie');
  headers.delete('cookie');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  headers.set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, immutable, stale-while-revalidate=86400');
  headers.set('CDN-Cache-Control', 'max-age=2592000');
  headers.set('Cloudflare-CDN-Cache-Control', 'max-age=2592000');
  headers.set('X-Cache', 'MISS');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Vary', 'Accept');

  const response = new Response(upstream.body, { status: upstream.status, headers });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function handleApi(path: string, search: string, ctx: ExecutionContext): Promise<Response> {
  if (!path || path.includes('..')) {
    return new Response('Invalid API path', { status: 400, headers: { ...CORS } });
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://tmdb-api-cache/${path}${search}`, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const h = new Headers(cached.headers);
    h.set('X-Cache', 'HIT');
    h.set('Access-Control-Allow-Origin', '*');
    return new Response(cached.body, { status: cached.status, headers: h });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`https://api.themoviedb.org/${path}${search}`, {
      cf: { cacheTtl: 3600, cacheEverything: true },
      headers: { Accept: 'application/json' },
    } as RequestInit);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Proxy error';
    return new Response(msg, { status: 502, headers: { ...CORS, 'Cache-Control': 'no-cache' } });
  }

  const headers = new Headers(upstream.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');
  headers.set('CDN-Cache-Control', 'max-age=3600');
  headers.set('X-Cache', 'MISS');

  const body = await upstream.text();
  const response = new Response(body, { status: upstream.status, headers });
  if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return corsPreflight();

    if (url.pathname.startsWith('/tmdb-image/')) {
      return handleImage(url.pathname.slice('/tmdb-image/'.length), ctx);
    }

    if (url.pathname.startsWith('/tmdb-api/')) {
      return handleApi(url.pathname.slice('/tmdb-api/'.length), url.search, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};
