const http = require('http');
const https = require('https');
const PORT = 3457;

const SERVERS = ['myflixerzupcloud', 'downloader2', 'm4uhd', 'hdmovie', 'cdn', 'superflix', 'lamovie', 'jett', 'tejo', 'neon2', 'ym'];

const seedCache = new Map();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
const HEADERS = { 'Referer': 'https://player.videasy.to/', 'Origin': 'https://player.videasy.to', 'User-Agent': UA };

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, { headers: HEADERS, timeout: 15000 }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
                resolve(d);
            });
        }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
    });
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.end();

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    // /seed?mediaId=X
    if (path === '/seed') {
        const mediaId = url.searchParams.get('mediaId');
        if (!mediaId) { res.writeHead(400); return res.end('{"error":"mediaId required"}'); }
        const cached = seedCache.get(mediaId);
        if (cached && cached.expiresAt > Date.now()) {
            return res.end(JSON.stringify({ seed: cached.seed, ttlMs: cached.ttlMs }));
        }
        try {
            const body = await httpGet(`https://api.speedracelight.com/seed?mediaId=${mediaId}`);
            const d = JSON.parse(body);
            seedCache.set(mediaId, { seed: d.seed, ttlMs: d.ttlMs || 30000, expiresAt: Date.now() + (d.ttlMs || 30000) });
            res.end(JSON.stringify({ seed: d.seed, ttlMs: d.ttlMs || 30000 }));
        } catch (e) {
            res.writeHead(502);
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // /sources?title=X&mediaType=X&year=X&tmdbId=X&enc=X&imdbId=X&episodeId=1&seasonId=1&seed=X
    if (path === '/sources') {
        const params = new URLSearchParams();
        for (const [k, v] of url.searchParams) params.set(k, v);
        const seed = params.get('seed');

        for (const server of SERVERS) {
            const p = new URLSearchParams(params);
            p.delete('seed');
            p.set('seed', seed);
            try {
                const body = await httpGet(`https://api.speedracelight.com/${server}/sources-with-title?${p.toString()}`);
                res.end(JSON.stringify({ encrypted: body, seed, server }));
                return;
            } catch { }
        }
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'all servers failed' }));
        return;
    }

    // /batch?title=...&mediaType=...&year=...&tmdbId=...&enc=...&imdbId=...&episodeId=...&seasonId=...
    if (path === '/batch') {
        const mediaId = url.searchParams.get('tmdbId');
        if (!mediaId) { res.writeHead(400); return res.end('{"error":"tmdbId required"}'); }

        let seed;
        const cached = seedCache.get(mediaId);
        if (cached && cached.expiresAt > Date.now()) {
            seed = cached.seed;
        } else {
            try {
                const body = await httpGet(`https://api.speedracelight.com/seed?mediaId=${mediaId}`);
                const d = JSON.parse(body);
                seed = d.seed;
                seedCache.set(mediaId, { seed, ttlMs: d.ttlMs || 30000, expiresAt: Date.now() + (d.ttlMs || 30000) });
            } catch (e) {
                res.writeHead(502);
                return res.end(JSON.stringify({ error: `seed: ${e.message}` }));
            }
        }

        const baseParams = new URLSearchParams();
        for (const [k, v] of url.searchParams) baseParams.set(k, v);
        baseParams.set('seed', seed);

        for (const server of SERVERS) {
            const p = new URLSearchParams(baseParams);
            p.delete('seed');
            p.set('seed', seed);
            try {
                const body = await httpGet(`https://api.speedracelight.com/${server}/sources-with-title?${p.toString()}`);
                return res.end(JSON.stringify({ encrypted: body, seed, server }));
            } catch { }
        }
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'all servers failed' }));
        return;
    }

    res.writeHead(404);
    res.end('{"error":"not found"}');
});

server.listen(PORT, () => console.log(`Proxy on :${PORT}, servers: ${SERVERS.join(',')}`));
