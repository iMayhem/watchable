// NetMirror stream resolver + player HTML proxy for internal testing.

const NM_SECRET = 'net###@@sss';
const NM_API = 'https://api2.imdb3.shop/api';
const NM_REFERER = 'https://netmirror.global/';
const NM_ORIGIN = 'https://netmirror.global';

const PLAYER_HOSTS = {
  1: 'spedostream2.shop',
  2: 'play.watch22.shop',
  3: 'play.watch21.shop',
  5: 'test.watch22.shop',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const CDN_REFERER = 'https://fmoviesunblocked.net/';
const CDN_ORIGIN = 'https://h5.aoneroom.com';

const CDN_HOST_PATTERN =
  /https?:\/\/(?:bcdnxw\.hakunaymatata\.com|(?:sa|b)cdn\.watch2[12]\.shop)[^\s"'<>]*/g;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function encodeTitle(title) {
  const bytes = new TextEncoder().encode(title);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function signTimestamp(ts) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(NM_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(ts)));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function resolvePlayerHost(server) {
  return PLAYER_HOSTS[server] || PLAYER_HOSTS[1];
}

function buildWatchboxUrl(meta, ts, sig, server, season, episode) {
  const host = resolvePlayerHost(server);
  const title = (meta.title || '').trim();
  const na = encodeURIComponent(encodeTitle(title));
  const dp = encodeURIComponent(meta.dp || '');
  const subjectid = meta.subjectid || '';

  let url =
    `https://${host}/play/watchbox.php` +
    `?id=${subjectid}&se=${season}&ep=${episode}&dp=${dp}&na=${na}` +
    `&ts=${ts}&sig=${sig}&exten=0`;

  if (server !== 1 && server !== 2 && server !== 3 && server !== 5) {
    url = url.replace('watchbox', 'watchbox2');
  }

  return url;
}

function buildProxyUrl(targetUrl, referer = CDN_REFERER, origin = CDN_ORIGIN) {
  const params = new URLSearchParams({
    url: targetUrl,
    referer,
    origin,
    user_agent: UA,
  });
  return `/api/proxy?${params.toString()}`;
}

function rewritePlayerHtml(html, server, { proxyStreams = false } = {}) {
  const host = resolvePlayerHost(server);
  const playerBase = `https://${host}/play/`;

  let rewritten = html;

  if (!/<base\s/i.test(rewritten)) {
    rewritten = rewritten.replace(/<head([^>]*)>/i, `<head$1><base href="${playerBase}">`);
  }

  // NetMirror fast path: extension + exten=true plays direct CDN URLs.
  // Rewriting to /api/proxy forces a Cloudflare hop and breaks that path.
  if (proxyStreams) {
    rewritten = rewritten.replace(CDN_HOST_PATTERN, (url) => buildProxyUrl(url));
  }

  return rewritten;
}

function extractStreams(html) {
  const streams = [];
  const seen = new Set();

  const qualityBlocks = html.matchAll(
    /html:\s*'(\d+P)'[\s\S]*?url:\s*'(https?:\/\/[^']+\.mp4[^']*)'/g
  );
  for (const match of qualityBlocks) {
    const quality = match[1];
    const url = match[2];
    if (!seen.has(url)) {
      seen.add(url);
      streams.push({ quality, url, proxiedUrl: buildProxyUrl(url) });
    }
  }

  if (!streams.length) {
    const mp4Matches = html.matchAll(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/g);
    for (const match of mp4Matches) {
      const url = match[0];
      if (url.includes('notfound') || seen.has(url)) continue;
      seen.add(url);
      streams.push({ quality: 'unknown', url, proxiedUrl: buildProxyUrl(url) });
    }
  }

  const qualityRank = { '1080P': 0, '720P': 1, '480P': 2, '360P': 3, unknown: 4 };
  streams.sort(
    (a, b) => (qualityRank[a.quality] ?? 5) - (qualityRank[b.quality] ?? 5)
  );

  return streams;
}

async function fetchMetadata(type, id) {
  const resp = await fetch(`${NM_API}/${type}/${id}`, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
    },
  });

  if (!resp.ok) {
    throw new Error(`Metadata request failed (${resp.status})`);
  }

  const data = await resp.json();
  const meta = data?.results?.[0];
  if (!meta) {
    throw new Error('No metadata found for this ID');
  }

  return meta;
}

async function fetchWatchboxHtml(watchboxUrl) {
  const resp = await fetch(watchboxUrl, {
    headers: {
      'User-Agent': UA,
      Referer: NM_REFERER,
      Origin: NM_ORIGIN,
    },
  });

  const html = await resp.text();

  if (!resp.ok) {
    throw new Error(`Watchbox request failed (${resp.status})`);
  }

  if (html.includes('Come from listed Website')) {
    throw new Error('Watchbox rejected request (referer not whitelisted)');
  }

  if (html.includes('Not Found')) {
    throw new Error('Watchbox returned not found for this title/episode');
  }

  return html;
}

async function resolveNetmirror(type, id, season, episode, server) {
  const meta = await fetchMetadata(type, id);
  const ts = Math.floor(Date.now() / 1000);
  const sig = await signTimestamp(ts);
  const watchboxUrl = buildWatchboxUrl(meta, ts, sig, server, season, episode);
  const html = await fetchWatchboxHtml(watchboxUrl);
  const streams = extractStreams(html);

  return {
    meta: {
      id: meta.id,
      title: (meta.title || '').trim(),
      subjectid: meta.subjectid,
      media_type: meta.media_type || type,
      season: meta.season || null,
      trailer: meta.trailer || null,
      backdrop_path: meta.backdrop_path || null,
    },
    auth: { timestamp: ts, signature: sig },
    watchboxUrl,
    playerProxyUrl: `/api/netmirror?action=player&type=${type}&id=${id}&se=${season}&ep=${episode}&server=${server}`,
    streams,
    defaultStream: streams[streams.length - 1] || streams[0] || null,
  };
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (context.request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const { searchParams } = new URL(context.request.url);
  const action = searchParams.get('action') || 'resolve';
  const type = searchParams.get('type') || 'movie';
  const id = searchParams.get('id') || '';
  const season = parseInt(searchParams.get('se') || searchParams.get('season') || '0', 10);
  const episode = parseInt(searchParams.get('ep') || searchParams.get('episode') || '0', 10);
  const server = parseInt(searchParams.get('server') || '1', 10);

  try {
    if (action === 'search' || action === 'browse') {
      const query =
        action === 'browse'
          ? searchParams.get('category') || ''
          : searchParams.get('q') || '';
      if (!query.trim()) {
        return jsonResponse(
          { error: action === 'browse' ? 'Missing category parameter' : 'Missing q parameter' },
          400
        );
      }
      const page = parseInt(searchParams.get('page') || '0', 10);
      const encoded = encodeURIComponent(query.trim()).replace(/%20/g, '+');
      const resp = await fetch(
        `https://api2.imdb4.shop/api/search2/${encoded}?page=${Number.isFinite(page) ? page : 0}`,
        { headers: { 'User-Agent': UA } }
      );
      const data = await resp.json();
      return jsonResponse({
        results: data?.results || [],
        pager: data?.pager || null,
      });
    }

    if (action === 'meta') {
      if (!id) {
        return jsonResponse({ error: 'Missing id parameter' }, 400);
      }
      if (!['movie', 'tv'].includes(type)) {
        return jsonResponse({ error: 'type must be movie or tv' }, 400);
      }
      const meta = await fetchMetadata(type, id);
      return jsonResponse({
        meta: {
          id: meta.id,
          title: (meta.title || '').trim(),
          subjectid: meta.subjectid,
          media_type: meta.media_type || type,
          season: meta.season || null,
          trailer: meta.trailer || null,
          backdrop_path: meta.backdrop_path || null,
          dp: meta.dp || null,
          vote_average: meta.vote_average || null,
          release_date: meta.release_date || null,
          channel: meta.channel || null,
          cn: meta.cn || null,
        },
      });
    }

    if (!id) {
      return jsonResponse({ error: 'Missing id parameter' }, 400);
    }

    if (!['movie', 'tv'].includes(type)) {
      return jsonResponse({ error: 'type must be movie or tv' }, 400);
    }

    if (action === 'player') {
      const meta = await fetchMetadata(type, id);
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signTimestamp(ts);
      const watchboxUrl = buildWatchboxUrl(meta, ts, sig, server, season, episode);
      const html = await fetchWatchboxHtml(watchboxUrl);

      const proxyStreams = searchParams.get('proxy') === '1';
      return new Response(rewritePlayerHtml(html, server, { proxyStreams }), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          ...corsHeaders(),
        },
      });
    }

    const result = await resolveNetmirror(type, id, season, episode, server);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message || 'NetMirror resolve failed' }, 500);
  }
}