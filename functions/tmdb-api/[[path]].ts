export async function onRequest(context: { request: Request; params: { path?: string[] } }) {
  const url = new URL(context.request.url);
  const pathParts = context.params.path || [];
  const apiPath = pathParts.join('/');

  if (!apiPath) {
    return new Response('Missing TMDB API path', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const qs = url.search;
  const apiKey = url.searchParams.get('api_key');
  // Use env TMDB key if not provided - fallback to public key used in VPS
  const targetUrl = `https://api.themoviedb.org/${apiPath}${qs}`;

  const cacheKey = new Request(`https://tmdb-api-cache/${apiPath}${qs}`, { method: 'GET' });
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
      cf: { cacheTtl: 3600, cacheEverything: true } as any,
      headers: { Accept: 'application/json' },
    });

    const headers = new Headers(upstream.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');
    headers.set('CDN-Cache-Control', 'max-age=3600');
    headers.set('X-Cache', 'MISS');

    const body = await upstream.text();
    const response = new Response(body, { status: upstream.status, headers });

    if (upstream.ok) {
      (context as any).waitUntil?.(cache.put(cacheKey, response.clone()));
    }

    return response;
  } catch (e: any) {
    return new Response(e.message || 'Proxy error', {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' },
    });
  }
}
