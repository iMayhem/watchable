/**
 * Cloudflare Pages Function: /api/img  (mobile-site)
 *
 * Mirrors the main-site proxy so that m.moovie.fun can serve TMDB images
 * through its own domain — no cross-origin hop required.
 *
 * Usage: /api/img?path=/w500/abc.jpg
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const path = url.searchParams.get('path');
  if (!path) {
    return new Response('Missing path param', { status: 400 });
  }

  if (!/^\/(w\d+|h\d+|original|best_quality)\/.+\.(jpg|jpeg|png|webp|gif)$/i.test(path)) {
    return new Response('Invalid image path', { status: 400 });
  }

  const tmdbUrl = `https://image.tmdb.org/t/p${path}`;

  try {
    const imageRes = await fetch(tmdbUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Moovie/1.0)',
        'Accept': 'image/webp,image/*,*/*;q=0.8',
      },
      cf: {
        cacheTtl: 604800,
        cacheEverything: true,
      },
    });

    if (!imageRes.ok) {
      return new Response('Image not found', { status: 404 });
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await imageRes.arrayBuffer();

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, immutable',
        'Access-Control-Allow-Origin': '*',
        'X-Proxied-By': 'Moovie/1.0',
      },
    });
  } catch (err) {
    return new Response('Proxy error', { status: 502 });
  }
}
