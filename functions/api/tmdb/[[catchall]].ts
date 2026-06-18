/**
 * Cloudflare Pages Function: /api/tmdb/[[catchall]]
 *
 * Acts as a server-side proxy for all TMDB API requests.
 * VITE_API_URL is set to "/api/tmdb/3/" in production, so every
 * useAxios() call (e.g. "trending/movie/day") is routed here as
 * /api/tmdb/3/trending/movie/day?api_key=...&language=en-US&...
 *
 * This function:
 *   1. Strips the /api/tmdb/ prefix to get the raw TMDB path
 *   2. Forwards the request (with all query params) to api.themoviedb.org
 *   3. Returns the JSON response with CORS headers
 */

const TMDB_BASE = 'https://api.themoviedb.org';

export async function onRequest(context: {
    request: Request;
    params: Record<string, string | string[]>;
}) {
    const { request, params } = context;

    // CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    // Only allow GET
    if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // params.catchall is the path segments after /api/tmdb/
    // e.g. for /api/tmdb/3/trending/movie/day  →  catchall = ["3","trending","movie","day"]
    const catchall = params.catchall;
    const segments = Array.isArray(catchall) ? catchall : [catchall];
    const tmdbPath = segments.filter(Boolean).join('/');

    // Preserve all original query params (api_key, language, region, sort_by, etc.)
    const originalUrl = new URL(request.url);
    const targetUrl = new URL(`/${tmdbPath}`, TMDB_BASE);
    originalUrl.searchParams.forEach((value, key) => {
        targetUrl.searchParams.set(key, value);
    });

    try {
        const resp = await fetch(targetUrl.toString(), {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Moovie/1.0',
            },
            // @ts-ignore — Cloudflare-specific cache hint
            cf: { cacheTtl: 300 }, // Cache TMDB responses for 5 minutes at the edge
        });

        const data = await resp.text();

        return new Response(data, {
            status: resp.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300, s-maxage=300',
            },
        });
    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: 'TMDB proxy error', message: err.message }),
            {
                status: 502,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    }
}
