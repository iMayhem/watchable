/**
 * Proxies external poster CDNs (Moovie catalogue, AniList) through moovie.fun.
 * Optional width triggers Cloudflare image resizing when enabled on the zone.
 *
 * Usage: /api/catalog-img?url=https://pacdn.aoneroom.com/...&w=342
 */
const CATALOG_HOST_PATTERN =
  /^https?:\/\/(?:[\w-]+\.)?(?:aoneroom\.com|hakunaymatata\.com|watch2[12]\.shop|anilist\.co)\//i;

function upstreamHeaders(target: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'image/webp,image/avif,image/*,*/*;q=0.8',
  };
  if (/aoneroom\.com/i.test(target)) {
    headers.Referer = 'https://h5.aoneroom.com/';
    headers.Origin = 'https://h5.aoneroom.com';
  } else if (/anilist\.co/i.test(target)) {
    headers.Referer = 'https://anilist.co/';
    headers.Origin = 'https://anilist.co';
  }
  return headers;
}

export async function onRequest(context: { request: Request }) {
  const { request } = context;

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get('url') || '';

  if (!target || !CATALOG_HOST_PATTERN.test(target)) {
    return new Response('Invalid catalog image url', { status: 400 });
  }

  try {
    const imageRes = await fetch(target, {
      headers: upstreamHeaders(target),
      cf: {
        cacheTtl: 604800,
        cacheEverything: true,
      },
    } as RequestInit);

    if (!imageRes.ok) {
      return new Response('Image not found', { status: imageRes.status });
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await imageRes.arrayBuffer();

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, immutable',
        'Access-Control-Allow-Origin': '*',
        'X-Proxied-By': 'Moovie-Catalog/1.0',
      },
    });
  } catch {
    return new Response('Proxy error', { status: 502 });
  }
}