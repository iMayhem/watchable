import type { PagesFunction } from '@cloudflare/workers-types';

const TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

interface StreamResult {
  url: string;
  quality: string;
  type: 'hls' | 'mp4';
  provider: string;
  headers?: Record<string, string>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': '*',
    },
  });
}

// ── VidLink Provider ──────────────────────────────────────────────
async function resolveVidLink(tmdbId: string, type: string, season?: number, episode?: number): Promise<StreamResult | null> {
  try {
    const encResp = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`, {
      headers: { 'User-Agent': UA },
    });
    const encData = await encResp.json() as any;
    const key = encData.result || encData.key;
    if (!key) return null;

    const ep = type === 'tv'
      ? `https://vidlink.pro/api/b/tv/${key}/${season}/${episode}`
      : `https://vidlink.pro/api/b/movie/${key}`;

    const resolveResp = await fetch(ep, { headers: { 'User-Agent': UA } });
    const data = await resolveResp.json() as any;
    const playlist = data?.stream?.playlist;
    if (!playlist) return null;

    return { url: playlist, quality: 'auto', type: 'hls', provider: 'vidlink' };
  } catch { return null; }
}

// ── VidEasy Provider ──────────────────────────────────────────────
const VIDEASY_SERVERS = ['cdn', '1movies', 'moviebox', 'primewire', 'm4uhd', 'hdmovie', 'primesrcme'];

async function resolveVidEasy(tmdbId: string, type: string, title: string, year: string, season?: number, episode?: number): Promise<StreamResult | null> {
  for (const server of VIDEASY_SERVERS) {
    try {
      const params = new URLSearchParams({
        title: encodeURIComponent(title),
        mediaType: type,
        year, tmdbId,
      });
      if (type === 'tv') {
        params.set('episodeId', String(episode ?? 1));
        params.set('seasonId', String(season ?? 1));
      }

      const url = `https://api.videasy.net/${server}/sources-with-title?${params}`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Origin': 'https://www.cineby.sc',
          'Referer': 'https://www.cineby.sc/',
        },
      });
      const encrypted = await resp.text();
      if (!encrypted || encrypted.length < 20) continue;

      const decResp = await fetch('https://enc-dec.app/api/dec-videasy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: encrypted, id: Number(tmdbId) }),
      });
      const decData = await decResp.json() as any;
      const result = decData?.result;
      if (result?.sources?.length) {
        const src = result.sources[0];
        return { url: src.url, quality: src.quality || 'auto', type: src.url.includes('.m3u8') ? 'hls' : 'mp4', provider: `videasy-${server}` };
      }
    } catch { continue; }
  }
  return null;
}

// ── Multi-provider resolve ────────────────────────────────────────
async function resolveStream(tmdbId: string, type: string, title?: string, year?: string, season?: number, episode?: number): Promise<StreamResult[]> {
  const results: StreamResult[] = [];

  // Try VidLink first
  const vl = await resolveVidLink(tmdbId, type, season, episode);
  if (vl) results.push(vl);

  // Try VidEasy
  if (title) {
    const ve = await resolveVidEasy(tmdbId, type, title, year || '', season, episode);
    if (ve) results.push(ve);
  }

  return results;
}

// ── HLS Playlist Proxy ────────────────────────────────────────────
async function proxyPlaylist(url: string): Promise<Response> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Referer': 'https://megacloud.live/',
      'Origin': 'https://megacloud.live',
    },
  });
  if (!resp.ok) return new Response('Upstream error', { status: 502 });

  const text = await resp.text();
  // Rewrite relative segment URLs to go through our proxy
  const baseUrl = new URL(url);
  const baseOrigin = baseUrl.origin;
  const baseDir = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

  const rewritten = text.replace(/^(https?:\/\/[^\s]+\.ts)/gm, (match) => {
    return `/api/dedicated/segment?url=${encodeURIComponent(match)}`;
  });
  // Also rewrite relative paths
  const rewritten2 = rewritten.replace(/^([a-zA-Z0-9_\-]+\d*\.ts)/gm, (match) => {
    return `/api/dedicated/segment?url=${encodeURIComponent(baseOrigin + baseDir + match)}`;
  });

  return new Response(rewritten2, {
    headers: {
      'content-type': 'application/vnd.apple.mpegurl',
      'access-control-allow-origin': '*',
      'cache-control': 'no-cache',
    },
  });
}

// ── Segment Proxy ─────────────────────────────────────────────────
async function proxySegment(url: string): Promise<Response> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Referer': 'https://megacloud.live/',
      'Origin': 'https://megacloud.live',
    },
  });
  if (!resp.ok) return new Response('Segment error', { status: 502 });

  const headers = new Headers(resp.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('cache-control', 'public, max-age=86400, s-maxage=86400');

  return new Response(resp.body, {
    status: resp.status,
    headers,
  });
}

// ── Player Page ───────────────────────────────────────────────────
function playerPage(tmdbId: string, type: string, season?: number, episode?: number): Response {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Moovie</title>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;overflow:hidden}
video{width:100vw;height:100vh;object-fit:contain}
#loading{position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:sans-serif;font-size:1.2rem;z-index:10}
#error{position:fixed;top:0;left:0;width:100%;height:100%;display:none;align-items:center;justify-content:center;background:#000;color:#ff4444;font-family:sans-serif;font-size:1rem;z-index:10;padding:2rem;text-align:center}
</style>
</head>
<body>
<div id="loading">Loading stream...</div>
<div id="error"></div>
<video id="video" controls autoplay></video>
<script>
const video = document.getElementById('video');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');

async function loadStream() {
  try {
    const params = new URLSearchParams({ type: '${type}', id: '${tmdbId}'${type === 'tv' ? `, season: '${season}', episode: '${episode}'` : ''} });
    const resolveResp = await fetch('/api/dedicated?action=resolve&' + params);
    const data = await resolveResp.json();

    if (!data.streams || !data.streams.length) {
      throw new Error('No streams available');
    }

    const stream = data.streams[0];

    if (stream.type === 'hls' && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource('/api/dedicated?action=playlist&url=' + encodeURIComponent(stream.url));
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        loading.style.display = 'none';
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, ev) => {
        if (ev.fatal) {
          errorDiv.textContent = 'Playback error: ' + ev.type;
          errorDiv.style.display = 'flex';
        }
      });
    } else if (stream.url) {
      video.src = stream.url;
      loading.style.display = 'none';
      video.play().catch(() => {});
    } else {
      throw new Error('Unsupported stream type');
    }
  } catch (e) {
    loading.style.display = 'none';
    errorDiv.textContent = 'Failed to load: ' + e.message;
    errorDiv.style.display = 'flex';
  }
}
loadStream();
</script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'access-control-allow-origin': '*',
    },
  });
}

// ── Main Handler ──────────────────────────────────────────────────
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const action = url.searchParams.get('action') || 'player';
  const type = url.searchParams.get('type') || 'movie';
  const id = url.searchParams.get('id') || '';
  const title = url.searchParams.get('title') || '';
  const year = url.searchParams.get('year') || '';
  const season = parseInt(url.searchParams.get('season') || '1', 10);
  const episode = parseInt(url.searchParams.get('episode') || '1', 10);

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': '*' },
    });
  }

  switch (action) {
    case 'resolve': {
      if (!id) return json({ error: 'Missing id' }, 400);
      const streams = await resolveStream(id, type, title, year, season, episode);
      return json({ streams, type, id });
    }
    case 'playlist': {
      const playlistUrl = url.searchParams.get('url');
      if (!playlistUrl) return json({ error: 'Missing url' }, 400);
      return proxyPlaylist(playlistUrl);
    }
    case 'segment': {
      const segmentUrl = url.searchParams.get('url');
      if (!segmentUrl) return json({ error: 'Missing url' }, 400);
      return proxySegment(segmentUrl);
    }
    default:
      return playerPage(id, type, season, episode);
  }
};
