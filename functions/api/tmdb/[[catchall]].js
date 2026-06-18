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

    // Attempt cache match using Cloudflare Cache API
    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;
    
    try {
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
            // Clone the response to add custom headers for debug visibility
            const response = new Response(cachedResponse.body, cachedResponse);
            response.headers.set('X-Proxy-Cache', 'HIT');
            return response;
        }
    } catch (cacheErr) {
        // Log cache match errors but do not fail the request
        console.error('Cache match error:', cacheErr);
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

        // Configure cache lifetime based on endpoint type
        // e.g. details, configurations, genres are highly static; trends/lists can change slightly
        let maxAge = 3600; // 1 hour client max-age
        let sMaxAge = 14400; // 4 hours Cloudflare edge cache max-age

        const pathLower = tmdbPath.toLowerCase();
        if (pathLower.includes('/search/') || pathLower.includes('search')) {
            // Searches can be shorter-lived
            maxAge = 600;
            sMaxAge = 1800;
        } else if (pathLower.includes('genre') || pathLower.includes('configuration')) {
            // Genres/configurations almost never change
            maxAge = 86400;
            sMaxAge = 604800;
        }

        const responseHeaders = {
            'Content-Type': resp.headers.get('Content-Type') || 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': `public, max-age=${maxAge}, s-maxage=${sMaxAge}`,
            'X-Proxy-Cache': 'MISS',
        };

        const response = new Response(body, {
            status: resp.status,
            headers: responseHeaders,
        });

        // Store successful GET responses in cache
        if (resp.status === 200) {
            try {
                // cache.put requires response to be cloned
                context.waitUntil(cache.put(cacheKey, response.clone()));
            } catch (cachePutErr) {
                console.error('Cache put error:', cachePutErr);
            }
        }

        return response;
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
