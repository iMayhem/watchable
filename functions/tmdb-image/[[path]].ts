interface Ctx {
  request: Request;
  params: { path?: string[] };
  waitUntil(promise: Promise<unknown>): void;
}

export async function onRequest(context: Ctx) {
  const url = new URL(context.request.url);
  // Catch-all path: /tmdb-image/w500/abc.jpg -> ["w500","abc.jpg"]
  const pathParts = context.params.path || [];
  const tmdbPath = pathParts.join('/');

  if (!tmdbPath) {
    return new Response('Missing TMDB path', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  // Security: only allow TMDB image sizes
  if (!/^(w\d+|original)\/.+/.test(tmdbPath)) {
    return new Response('Invalid TMDB path', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const targetUrl = `https://image.tmdb.org/t/p/${tmdbPath}`;

  // Cloudflare cache key - normalize to ignore query
  const cacheKey = new Request(`https://tmdb-image-cache/${tmdbPath}`, { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const h = new Headers(cached.headers);
    h.set('X-Cache', 'HIT');
    h.set('Access-Control-Allow-Origin', '*');
    return new Response(cached.body, { status: cached.status, headers: h });
  }

  try {
    const upstream = await fetch(targetUrl, {
      cf: {
        cacheTtl: 2592000, // 30 days edge
        cacheEverything: true,
      } as any,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'image/*,*/*',
      },
    });

    if (!upstream.ok) {
      return new Response(`TMDB upstream ${upstream.status}`, {
        status: upstream.status,
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' },
      });
    }

    const headers = new Headers(upstream.headers);
    // Strip cookies, keep content-type/length
    headers.delete('set-cookie');
    headers.delete('cookie');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
    headers.set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400');
    headers.set('CDN-Cache-Control', 'max-age=2592000');
    headers.set('Cloudflare-CDN-Cache-Control', 'max-age=2592000');
    headers.set('X-Cache', 'MISS');
    headers.set('X-Content-Type-Options', 'nosniff');
    // Let Cloudflare cache images efficiently
    headers.set('Vary', 'Accept');

    const response = new Response(upstream.body, {
      status: upstream.status,
      headers,
    });

    // Store in edge cache (non-blocking)
    context.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch (e: any) {
    return new Response(e.message || 'Proxy error', {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' },
    });
  }
}
