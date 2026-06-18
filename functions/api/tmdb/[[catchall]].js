/**
 * Cloudflare Pages Function: /api/tmdb/[[catchall]]
 *
 * Proxies all TMDB API requests from the frontend.
 * In production, VITE_API_URL=/api/tmdb/3/ so every useAxios() call
 * (e.g. GET trending/movie/day) routes here as:
 *   /api/tmdb/3/trending/movie/day?api_key=...&language=en-US
 *
 * This function strips /api/tmdb/ and forwards to api.themoviedb.org.
 */

const TMDB_ORIGIN = 'https://api.themoviedb.org';

export async function onRequest(context) {
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

    if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // catchall holds the path segments after /api/tmdb/
    // e.g. /api/tmdb/3/trending/movie/day → catchall = ["3","trending","movie","day"]
    const segments = Array.isArray(params.catchall)
        ? params.catchall
        : [params.catchall].filter(Boolean);

    const tmdbPath = segments.join('/');

    // Carry all original query params (api_key, language, region, sort_by, etc.)
    const originalUrl = new URL(request.url);
    const targetUrl = new URL(`/${tmdbPath}`, TMDB_ORIGIN);
    originalUrl.searchParams.forEach((value, key) => {
        targetUrl.searchParams.set(key, value);
    });

    try {
        const resp = await fetch(targetUrl.toString(), {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Moovie/1.0',
            },
        });

        const body = await resp.arrayBuffer();

        return new Response(body, {
            status: resp.status,
            headers: {
                'Content-Type': resp.headers.get('Content-Type') || 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300, s-maxage=300',
            },
        });
    } catch (err) {
        return new Response(
            JSON.stringify({ error: 'TMDB proxy error', message: String(err) }),
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
