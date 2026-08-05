const http = require('http');
const https = require('https');
const PORT = 3456;

const cache = new Map();

function fetchSeed(mediaId) {
    return new Promise((resolve, reject) => {
        const url = `https://api.speedracelight.com/seed?mediaId=${mediaId}`;
        https.get(url, {
            headers: {
                'Referer': 'https://player.videasy.to/',
                'Origin': 'https://player.videasy.to',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000,
        }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${d}`));
                try { resolve(JSON.parse(d)); } catch(e) { reject(e); }
            });
        }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
    });
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.end();

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const mediaId = url.searchParams.get('mediaId');
    if (!mediaId) {
        res.writeHead(400);
        return res.end('{"error":"mediaId required"}');
    }

    const cached = cache.get(mediaId);
    if (cached && cached.expiresAt > Date.now()) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ seed: cached.seed, ttlMs: cached.ttlMs, source: 'cache' }));
    }

    try {
        const result = await fetchSeed(mediaId);
        const ttl = result.ttlMs || 30000;
        cache.set(mediaId, { seed: result.seed, ttlMs: ttl, expiresAt: Date.now() + ttl });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ seed: result.seed, ttlMs: ttl, source: 'proxy' }));
    } catch (e) {
        res.writeHead(502);
        res.end(JSON.stringify({ error: e.message }));
    }
});

server.listen(PORT, () => {
    console.log(`Seed proxy running on http://0.0.0.0:${PORT}`);
});
