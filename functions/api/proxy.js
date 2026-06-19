// /functions/api/proxy.js

function urlJoin(base, relative) {
    try {
        return new URL(relative, base).toString();
    } catch (e) {
        return relative;
    }
}

function rewriteM3U8(content, baseUrl, referer, origin, userAgent) {
    const lines = content.split('\n');
    const rewrittenLines = [];
    
    const encodedRef = referer ? encodeURIComponent(referer) : '';
    const encodedOrig = origin ? encodeURIComponent(origin) : '';
    const encodedUa = userAgent ? encodeURIComponent(userAgent) : '';
    
    let suffix = "";
    if (encodedRef) suffix += `&referer=${encodedRef}`;
    if (encodedOrig) suffix += `&origin=${encodedOrig}`;
    if (encodedUa) suffix += `&user_agent=${encodedUa}`;
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        if (line.startsWith('#')) {
            if (line.includes('URI="')) {
                const parts = line.split('URI="');
                if (parts.length > 1) {
                    const uri = parts[1].split('"')[0];
                    const fullUri = urlJoin(baseUrl, uri);
                    const encodedUri = encodeURIComponent(fullUri);
                    const proxiedUri = `/api/proxy?url=${encodedUri}${suffix}`;
                    line = line.replace(`URI="${uri}"`, `URI="${proxiedUri}"`);
                }
            }
            rewrittenLines.push(line);
        } else {
            const fullUri = urlJoin(baseUrl, line);
            const encodedUri = encodeURIComponent(fullUri);
            const proxiedUri = `/api/proxy?url=${encodedUri}${suffix}`;
            rewrittenLines.push(proxiedUri);
        }
    }
    return rewrittenLines.join('\n');
}

export async function onRequest(context) {
    // Handle CORS preflight
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "Range, Content-Type, Referer, Origin, User-Agent",
                "Access-Control-Max-Age": "86400"
            }
        });
    }

    const { searchParams } = new URL(context.request.url);
    const targetUrl = searchParams.get('url') || '';
    const referer = searchParams.get('referer');
    const origin = searchParams.get('origin');
    const userAgent = searchParams.get('user_agent');
    
    if (!targetUrl) {
        return new Response("Missing target URL", { status: 400 });
    }
    
    const headers = new Headers();
    const isPeachifyGateway = targetUrl.includes('eat-peach.sbs') || targetUrl.includes('workers.dev');
    const isMoovieStreamCdn =
        targetUrl.includes('hakunaymatata.com') ||
        targetUrl.includes('aoneroom.com') ||
        targetUrl.includes('watch21.shop') ||
        targetUrl.includes('watch22.shop');
    
    if (isPeachifyGateway) {
        headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');
        headers.set('Referer', 'https://peachify.top/');
        headers.set('Origin', 'https://peachify.top');
    } else if (isMoovieStreamCdn) {
        headers.set('User-Agent', userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36');
        // hakunaymatata CDN only accepts this referer on direct stream hosts
        headers.set('Referer', 'https://fmoviesunblocked.net/');
        headers.set('Origin', 'https://h5.aoneroom.com');
    } else {
        headers.set('User-Agent', userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');
        if (referer) headers.set('Referer', referer);
        if (origin) headers.set('Origin', origin);
    }
    
    const method = context.request.method === 'HEAD' ? 'HEAD' : 'GET';
    const clientRange = context.request.headers.get('Range');
    const isMp4 = /\.mp4(\?|$)/i.test(targetUrl);

    if (clientRange) {
        headers.set('Range', clientRange);
    } else if (isMoovieStreamCdn && isMp4 && method !== 'HEAD') {
        // hakunaymatata often 403s on full GET; browsers may stall without an initial range
        headers.set('Range', 'bytes=0-1048575');
    }

    async function fetchUpstream() {
        return fetch(targetUrl, { method, headers, redirect: 'follow' });
    }

    try {
        let resp = await fetchUpstream();

        if (resp.status === 403 && isMoovieStreamCdn && isMp4) {
            for (const range of ['bytes=0-65535', 'bytes=0-1048575', 'bytes=0-']) {
                headers.set('Range', range);
                resp = await fetchUpstream();
                if (resp.status !== 403) break;
            }
        }

        const contentType = resp.headers.get('Content-Type') || 'application/octet-stream';
        const isPlaylist = contentType.toLowerCase().includes('mpegurl') || 
                           contentType.toLowerCase().includes('x-mpegurl') || 
                           targetUrl.includes('.m3u8');
                           
        const responseHeaders = new Headers();
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
        
        // Forward useful headers from remote target response
        for (let hName of ['Content-Range', 'Accept-Ranges', 'ETag', 'Cache-Control']) {
            const hVal = resp.headers.get(hName);
            if (hVal) responseHeaders.set(hName, hVal);
        }

        if (isMp4 && !responseHeaders.has('Accept-Ranges')) {
            responseHeaders.set('Accept-Ranges', 'bytes');
        }
        
        if (isPlaylist) {
            const text = await resp.text();
            let rewritten = text;
            try {
                rewritten = rewriteM3U8(text, targetUrl, referer, origin, userAgent);
            } catch(e) {
                console.error("Failed to rewrite m3u8:", e);
            }
            responseHeaders.set('Content-Type', 'application/x-mpegURL');
            return new Response(rewritten, {
                status: resp.status,
                headers: responseHeaders
            });
        } else {
            responseHeaders.set('Content-Type', contentType);
            const len = resp.headers.get('Content-Length');
            if (len) responseHeaders.set('Content-Length', len);
            
            // Pipe response body directly as a stream (highly optimized)
            return new Response(resp.body, {
                status: resp.status,
                headers: responseHeaders
            });
        }
    } catch(e) {
        return new Response(`Proxy connection failed: ${e.message}`, {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
