const TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
const API_BASE = 'https://api.speedracelight.com';
const TIMEOUT_MS = 15000;

// videasy custom stream cipher constants
const f = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580];
const MAGIC = [109, 118, 109, 49]; // "mvm1"

const I = e => (e * (e + 1) & 1) === 1;
const b = e => (e * (e + 1) & 1) === 0;

const v = e => { let t = e >>> 0; t ^= t >>> 16; t = Math.imul(t, 2246822507) >>> 0; t ^= t >>> 13; t = Math.imul(t, 3266489909) >>> 0; return (t ^= t >>> 16) >>> 0; };
const w = (e, t) => { let r = e >>> 0; const s = t & 31; return s === 0 ? r : ((r << s) | (r >>> (32 - s))) >>> 0; };

function fnv1a(str) {
    let t = 2166136261;
    for (let i = 0; i < str.length; i++) t = Math.imul(t ^ str.charCodeAt(i), 16777619) >>> 0;
    return v(t);
}

function makeState(seed, mediaId) {
    const S = Array(61);
    let a = v(fnv1a(seed) ^ v((parseInt(mediaId) >>> 0) ^ 2654435769)) >>> 0;
    for (let i = 0; i < 8; i++) {
        const t = a % 61;
        a = w((a + 2654435769) >>> 0, 7 + (7 & i));
        S[t] = (a ^ v(a)) >>> 0;
        a = v((a + t) >>> 0);
    }
    return { S, acc: v(2779096485 ^ a) >>> 0 };
}

function generateKeyStream(state, len) {
    const out = new Uint8Array(len);
    let ctr = 0;
    for (let i = 0; i < len;) {
        const arr = state.S;
        const acc = state.acc;
        const n = acc % 61;
        const idx = 0 - Number(n in arr);
        const l = (arr[n] !== undefined ? arr[n] : 0) >>> 0;
        const a2 = (l ^ Math.imul(2654435769, ctr + 1) >>> 0) >>> 0;
        let d = (((acc ^ a2) >>> 0) | ((acc & a2 & idx) >>> 0)) >>> 0;
        d = (w((d + acc) >>> 0, 31 & n) ^ w(acc, 31 & Math.imul(n, 7))) >>> 0;
        state.acc = v((d + 2654435769) >>> 0);
        arr[n] = state.acc >>> 0;
        const val = state.acc;
        out[i++] = val & 255;
        if (i < len) out[i++] = (val >>> 8) & 255;
        if (i < len) out[i++] = (val >>> 16) & 255;
        if (i < len) out[i++] = (val >>> 24) & 255;
        ctr++;
    }
    return out;
}

function b64decode(str) {
    const s = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(4 * Math.ceil(str.length / 4), '=');
    return new Uint8Array(Buffer.from(s, 'base64'));
}

function decrypt(encryptedB64, seed, mediaId) {
    const payload = b64decode(encryptedB64);
    const keyStream = generateKeyStream(makeState(seed, mediaId), payload.length);
    for (let i = 0; i < payload.length; i++) payload[i] ^= keyStream[i];
    for (let i = 0; i < 4; i++) if (payload[i] !== MAGIC[i]) throw new Error('decrypt failed');
    return Buffer.from(payload.slice(4)).toString('utf-8');
}

async function tmdbFetch(tmdbId, mediaType) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    const d = await res.json();
    if (d.success === false) throw new Error('TMDB not found');
    return {
        title: d.title || d.name,
        year: (d.release_date || d.first_air_date || '').split('-')[0],
        imdbId: d.imdb_id || '',
    };
}

async function fetchSeed(mediaId) {
    const res = await fetch(`${API_BASE}/seed?mediaId=${mediaId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'Referer': 'https://player.videasy.to/', 'Origin': 'https://player.videasy.to' },
    });
    if (!res.ok) throw new Error(`seed ${res.status}`);
    const d = await res.json();
    return d.seed;
}

async function fetchSources(endpoint, params) {
    const url = `${API_BASE}${endpoint}?${new URLSearchParams(params)}`;
    const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'Referer': 'https://player.videasy.to/', 'Origin': 'https://player.videasy.to' },
    });
    if (!res.ok) throw new Error(`sources ${res.status}`);
    return res.text();
}

async function getStreams(id, type, season, episode) {
    try {
        const mediaType = type === 'tv' ? 'tv' : 'movie';
        const tmdbData = await tmdbFetch(id, mediaType);
        const seed = await fetchSeed(id);

        const params = {
            title: encodeURIComponent(tmdbData.title),
            mediaType: type === 'tv' ? 'TV Series' : 'Movie',
            year: tmdbData.year,
            episodeId: episode || '1',
            seasonId: season || '1',
            tmdbId: String(id),
            imdbId: tmdbData.imdbId,
            enc: '2',
            seed,
        };

        // Primary server: Yoru (cdn) - fastest, most reliable
        const encrypted = await fetchSources('/cdn/sources-with-title', params);
        const jsonStr = decrypt(encrypted, seed, String(id));
        const data = JSON.parse(jsonStr);

        if (!data.sources || !data.sources.length) return [];

        return data.sources.map((s, i) => ({
            name: 'Odin',
            title: `Odin · ${s.quality || 'HD'}`,
            url: s.url || s.file,
            quality: s.quality || 'Auto',
            headers: {
                Referer: 'https://player.videasy.to/',
                Origin: 'https://player.videasy.to',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            },
        }));
    } catch (e) {
        console.error('[Odin]', e.message);
        return [];
    }
}

module.exports = { getStreams, name: 'Odin', supportedTypes: ['movie', 'tv'] };
