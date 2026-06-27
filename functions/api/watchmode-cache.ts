const WATCHMODE_KEY = 'wr6fJOVgJsUyexE1otCdyajF06PW6zTibu2yOWnR';

async function tryCacheMatch(key: Request): Promise<Response | null> {
    try {
        const cache = (caches as any)?.default;
        if (!cache) return null;
        return await cache.match(key);
    } catch {
        return null;
    }
}

async function tryCachePut(key: Request, response: Response, ctx: any): Promise<void> {
    try {
        const cache = (caches as any)?.default;
        if (!cache) return;
        if (ctx?.waitUntil) {
            ctx.waitUntil(cache.put(key, response));
        } else {
            await cache.put(key, response);
        }
    } catch {}
}

export async function onRequest(context: any) {
    const { request } = context;
    const url = new URL(request.url);
    const sourceId = url.searchParams.get('sourceId');
    const page = url.searchParams.get('page') || '1';
    const regions = url.searchParams.get('regions');

    if (!sourceId) {
        return new Response(JSON.stringify({ error: 'Missing sourceId' }), {
            status: 400,
            headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
        });
    }

    const cachedResponse = await tryCacheMatch(request);
    if (cachedResponse) {
        const headers = new Headers(cachedResponse.headers);
        headers.set('X-Cache', 'HIT');
        headers.set('access-control-allow-origin', '*');
        return new Response(cachedResponse.body, {
            status: cachedResponse.status,
            headers
        });
    }

    const apiUrl = `https://api.watchmode.com/v1/list-titles/?apiKey=${WATCHMODE_KEY}&source_ids=${sourceId}&page=${page}&limit=50${regions ? `&regions=${regions}` : ''}`;
    const res = await fetch(apiUrl);
    if (!res.ok) {
        return new Response(JSON.stringify({ 
            titles: [],
            total_pages: 0,
            total_results: 0,
            error: 'Watchmode API error'
        }), {
            status: 200,
            headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
        });
    }

    const data = await res.json();
    const response = new Response(JSON.stringify(data), {
        headers: {
            'content-type': 'application/json',
            'access-control-allow-origin': '*',
            'X-Cache': 'MISS',
            'cache-control': 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400',
            'cdn-cache-control': 'max-age=2592000',
            'cloudflare-cdn-cache-control': 'max-age=2592000'
        }
    });

    await tryCachePut(request, response.clone(), context);

    return response;
}
