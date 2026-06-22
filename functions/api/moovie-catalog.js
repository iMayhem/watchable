// Moovie catalogue stream resolver + player HTML proxy.

const CATALOG_SECRET = 'net###@@sss';
const CATALOG_API = 'https://api2.imdb3.shop/api';
const CATALOG_REFERER = 'https://netmirror.global/';
const CATALOG_ORIGIN = 'https://netmirror.global';

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
    enc.encode(CATALOG_SECRET),
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

function rewritePlayerHtml(html, server) {
  const host = resolvePlayerHost(server);
  const playerBase = `https://${host}/play/`;

  let rewritten = html;

  if (!/<base\s/i.test(rewritten)) {
    rewritten = rewritten.replace(/<head([^>]*)>/i, `<head$1><base href="${playerBase}">`);
  }

  return rewritten;
}

const QUALITY_RANK = { '1080P': 0, '720P': 1, '480P': 2, '360P': 3, unknown: 4 };

function isValidStreamUrl(url) {
  const normalized = String(url || '').trim();
  if (!normalized || !/^https?:\/\//i.test(normalized)) return false;
  if (/notfound|placeholder|\/404\b/i.test(normalized)) return false;
  return /\.(mp4|mkv)(\?|$)/i.test(normalized);
}

function streamFormatRank(url) {
  if (/\.mp4/i.test(url)) return 0;
  if (/\.mkv/i.test(url)) return 1;
  return 2;
}

function sortStreams(streams) {
  streams.sort((a, b) => {
    const qualityDiff =
      (QUALITY_RANK[a.quality] ?? 5) - (QUALITY_RANK[b.quality] ?? 5);
    if (qualityDiff !== 0) return qualityDiff;
    return streamFormatRank(a.url) - streamFormatRank(b.url);
  });
  return streams;
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
    if (!isValidStreamUrl(url) || seen.has(url)) continue;
    seen.add(url);
    streams.push({ quality, url });
  }

  if (!streams.length) {
    const mediaMatches = html.matchAll(
      /https?:\/\/[^\s"'<>]+\.(?:mp4|mkv)[^\s"'<>]*/gi
    );
    for (const match of mediaMatches) {
      const url = match[0];
      if (!isValidStreamUrl(url) || seen.has(url)) continue;
      seen.add(url);
      streams.push({ quality: 'unknown', url });
    }
  }

  return sortStreams(streams);
}

const LANGUAGE_PATTERN = /\[([^\]]+)\]/g;
const SEASON_PATTERN = /\bS(\d+)(?:-S\d+)?\b/i;

function parseCatalogTitle(raw) {
  const languages = [];
  let match;
  const source = String(raw || '');

  while ((match = LANGUAGE_PATTERN.exec(source)) !== null) {
    const tag = match[1].trim();
    if (tag && !languages.includes(tag)) languages.push(tag);
  }

  const seasonMatch = source.match(SEASON_PATTERN);
  const season = seasonMatch ? parseInt(seasonMatch[1], 10) : null;
  const displayTitle = source
    .replace(LANGUAGE_PATTERN, '')
    .replace(/\bS\d+(?:-S\d+)?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { displayTitle, languages, season };
}

const CATALOG_FEATURE_FILM_PATTERN =
  /\b(film|the movie|movie:|movie -|ova\b|episode of|stampede|strong world|gekijouban|geki jouban)\b/i;

const CATALOG_SERIES_PATTERN =
  /\b(series|web series|miniseries|limited series)\b/i;

function parseCatalogDurationMinutes(duration) {
  const n = parseInt(String(duration ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Upstream catalogue stores runtime in seconds (e.g. 6120 = 102 min).
  if (n > 500) return Math.round(n / 60);
  return n;
}

/** Standalone films mis-tagged as tv: feature-length runtime, no season marker. */
function looksLikeFeatureFilm(item) {
  const raw = String(item?.title || '');
  const parsed = parseCatalogTitle(raw);
  if (parsed.season != null || /\bS\d{1,2}(?:-S\d+)?\b/i.test(raw)) {
    return false;
  }

  const minutes = parseCatalogDurationMinutes(item?.duration);
  return minutes >= 75 && minutes <= 200;
}

function isEmbedOnlyCatalogFilm(item) {
  const hasSubject = Boolean(String(item?.subjectid || '').trim());
  if (hasSubject) return false;

  const hasEmbed = Boolean(String(item?.embed || '').trim());
  if (hasEmbed) return true;

  return String(item?.embed_en || '').trim() === '1';
}

function hasCatalogSeasonData(season) {
  if (Array.isArray(season) && season.length > 0) return true;
  if (season && typeof season === 'object') return true;
  if (typeof season === 'string' && season.trim()) return true;
  return false;
}

/** Resolve movie vs TV — season hints first, then API tags; demote mis-tagged films. */
function inferCatalogMediaType(item) {
  const raw = String(item?.title || '');
  const parsed = parseCatalogTitle(raw);

  if (parsed.season != null || /\bS\d{1,2}(?:-S\d+)?\b/i.test(raw)) {
    return 'tv';
  }

  const mt = String(item?.media_type || '').toLowerCase();
  if (mt === 'movie') return 'movie';

  if (CATALOG_SERIES_PATTERN.test(raw)) {
    return 'tv';
  }

  if (mt === 'tv') {
    if (isEmbedOnlyCatalogFilm(item)) return 'movie';
    if (CATALOG_FEATURE_FILM_PATTERN.test(raw)) return 'movie';
    if (hasCatalogSeasonData(item?.season)) return 'tv';
    if (/\bS\d{1,2}(?:-S\d+)?\b/i.test(raw) || CATALOG_SERIES_PATTERN.test(raw)) {
      return 'tv';
    }
    if (Boolean(String(item?.subjectid || '').trim())) return 'movie';
    if (looksLikeFeatureFilm(item)) return 'movie';
    return 'tv';
  }

  return 'movie';
}

function canonicalMediaType(meta, fallbackType) {
  if (!meta?.title && !meta?.media_type) return fallbackType;
  return inferCatalogMediaType(meta);
}

function titleSuggestsAnime(title) {
  const t = String(title || '').toLowerCase();
  return /\banime\b|kimetsu|naruto|one piece|demon slayer|gachiakuta|jujutsu|solo leveling|dragon ball|bleach\b|hunter x hunter|attack on titan/.test(
    t
  );
}

function streamLooksAnimeOnly(url) {
  return /\/animekai\//i.test(url);
}

function streamsLookCorrupt(meta, streams) {
  if (!streams.length) return false;
  const allAnimeCdn = streams.every((s) => streamLooksAnimeOnly(s.url));
  if (!allAnimeCdn) return false;
  return !titleSuggestsAnime(meta.title);
}

function trailerStream(meta) {
  const trailer = meta?.trailer;
  if (!trailer || !/\.mp4/i.test(trailer)) return null;
  return {
    quality: '720P',
    url: trailer,
  };
}

async function fetchMetadata(type, id) {
  const resp = await fetch(`${CATALOG_API}/${type}/${id}`, {
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

function decodeEmbedFilesdlUrl(embedUrl) {
  if (!embedUrl) return null;
  try {
    const normalized = String(embedUrl).replace(/&amp;/g, '&');
    const url = new URL(normalized);
    const encoded = url.searchParams.get('url');
    if (!encoded) return null;
    return atob(encoded);
  } catch {
    return null;
  }
}

async function fetchFilesdlStreams(filesdlUrl) {
  const resp = await fetch(filesdlUrl, {
    headers: {
      'User-Agent': UA,
      Referer: CDN_REFERER,
    },
  });

  if (!resp.ok) {
    throw new Error(`FilesDL request failed (${resp.status})`);
  }

  const html = await resp.text();
  const streams = [];
  const seen = new Set();

  const hrefMatches = html.matchAll(
    /href=['"](https?:\/\/[^'"]+\.(?:mp4|mkv)(?:\?[^'"]*)?)['"]/gi
  );
  for (const match of hrefMatches) {
    const url = match[1].replace(/&amp;/g, '&');
    if (!isValidStreamUrl(url) || seen.has(url)) continue;
    seen.add(url);

    let quality = 'unknown';
    if (/1080/i.test(url)) quality = '1080P';
    else if (/720/i.test(url)) quality = '720P';
    else if (/480/i.test(url)) quality = '480P';

    streams.push({
      quality,
      url,
    });
  }

  return sortStreams(streams);
}

async function resolveEmbedStreams(meta) {
  const filesdlUrl = decodeEmbedFilesdlUrl(meta?.embed);
  if (!filesdlUrl) return [];
  try {
    return await fetchFilesdlStreams(filesdlUrl);
  } catch {
    return [];
  }
}

async function fetchWatchboxHtml(watchboxUrl) {
  const resp = await fetch(watchboxUrl, {
    headers: {
      'User-Agent': UA,
      Referer: CATALOG_REFERER,
      Origin: CATALOG_ORIGIN,
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

function buildResolveAttempts(requestType, season, episode, canonicalType) {
  const attempts = [];
  const push = (type, se, ep) => {
    const key = `${type}:${se}:${ep}`;
    if (attempts.some((a) => a.key === key)) return;
    attempts.push({ key, type, season: se, episode: ep });
  };

  push(requestType, season, episode);
  if (canonicalType !== requestType) {
    push(canonicalType, season, episode);
  }
  if (canonicalType === 'tv' && season === 0 && episode === 0) {
    push('tv', 1, 1);
  }

  return attempts;
}

async function tryResolveAttempt(meta, attempt, server) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = await signTimestamp(ts);
  const watchboxUrl = buildWatchboxUrl(
    meta,
    ts,
    sig,
    server,
    attempt.season,
    attempt.episode
  );
  const html = await fetchWatchboxHtml(watchboxUrl);
  const streams = extractStreams(html);
  if (!streams.length || streamsLookCorrupt(meta, streams)) {
    return null;
  }

  return {
    streams,
    auth: { timestamp: ts, signature: sig },
    watchboxUrl,
    resolveType: attempt.type,
    season: attempt.season,
    episode: attempt.episode,
    server,
  };
}

async function resolveCatalogStream(type, id, season, episode, server) {
  let meta = await fetchMetadata(type, id);
  let canonicalType = canonicalMediaType(meta, type);

  if (canonicalType !== type) {
    try {
      meta = await fetchMetadata(canonicalType, id);
      canonicalType = canonicalMediaType(meta, canonicalType);
    } catch {
      /* keep primary meta */
    }
  }

  let attemptSeason = season;
  let attemptEpisode = episode;
  if (canonicalType === 'movie') {
    attemptSeason = 0;
    attemptEpisode = 0;
  }

  const attempts = buildResolveAttempts(type, attemptSeason, attemptEpisode, canonicalType);
  const servers = [...new Set([server, 1, 2, 3, 5])];

  let resolved = null;
  const hasSubjectId = Boolean(String(meta?.subjectid || '').trim());

  if (hasSubjectId) {
    for (const attempt of attempts) {
      for (const srv of servers) {
        try {
          const hit = await tryResolveAttempt(meta, attempt, srv);
          if (hit) {
            resolved = hit;
            break;
          }
        } catch {
          /* try next server / attempt */
        }
      }
      if (resolved) break;
    }
  }

  let streamWarning = '';
  let streams = resolved?.streams || [];

  if (!streams.length && meta?.embed) {
    const embedStreams = await resolveEmbedStreams(meta);
    if (embedStreams.length) {
      streams = embedStreams;
      resolved = {
        streams: embedStreams,
        auth: null,
        watchboxUrl: null,
        resolveType: canonicalType,
        season: 0,
        episode: 0,
        server,
      };
    }
  }

  if (!streams.length) {
    const preview = trailerStream(meta);
    if (preview) {
      streams = [preview];
      streamWarning =
        'Full stream unavailable for this title — playing the catalogue preview instead.';
    } else {
      throw new Error(
        'Stream mismatch — the catalogue returned the wrong video for this title. Try another entry or search again.'
      );
    }
  }

  const resolveType = resolved?.resolveType || canonicalType;
  const resolveSeason = resolved?.season ?? attemptSeason;
  const resolveEpisode = resolved?.episode ?? attemptEpisode;
  const resolveServer = resolved?.server ?? server;

  return {
    meta: {
      id: meta.id,
      title: (meta.title || '').trim(),
      subjectid: meta.subjectid,
      media_type: canonicalType,
      season: meta.season || null,
      trailer: meta.trailer || null,
      backdrop_path: meta.backdrop_path || null,
    },
    auth: resolved?.auth || null,
    watchboxUrl: resolved?.watchboxUrl || null,
    playerProxyUrl: `/api/moovie-catalog?action=player&type=${resolveType}&id=${id}&se=${resolveSeason}&ep=${resolveEpisode}&server=${resolveServer}`,
    streams,
    defaultStream: streams[0] || null,
    streamWarning: streamWarning || null,
    resolveType,
    resolveSeason,
    resolveEpisode,
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
    if (action === 'search' || action === 'browse' || action === 'filter') {
      const page = parseInt(searchParams.get('page') || '0', 10);
      const upstream = new URLSearchParams();
      upstream.set('page', String(Number.isFinite(page) ? page : 0));
      for (const key of [
        'dubbing',
        'country',
        'type',
        'genre',
        'sort_by',
        'countryNot',
        'countryNot2',
        'countryNotParam'
      ]) {
        const value = searchParams.get(key);
        if (value) upstream.set(key, value);
      }
      for (const value of searchParams.getAll('title_not[]')) {
        upstream.append('title_not[]', value);
      }
      for (const value of searchParams.getAll('genre_ids[]')) {
        upstream.append('genre_ids[]', value);
      }
      for (const value of searchParams.getAll('genre_id[]')) {
        upstream.append('genre_id[]', value);
      }

      let url;
      if (action === 'filter') {
        url = `https://api2.imdb4.shop/api/movies/filter?${upstream}`;
      } else {
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
        const encoded = encodeURIComponent(query.trim()).replace(/%20/g, '+');
        url = `https://api2.imdb4.shop/api/search2/${encoded}?${upstream}`;
      }

      const resp = await fetch(
        url,
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
          media_type: inferCatalogMediaType({
            title: meta.title,
            media_type: meta.media_type || type,
            duration: meta.duration,
            embed: meta.embed,
            subjectid: meta.subjectid,
            embed_en: meta.embed_en || meta.field_embed_en,
            season: meta.season,
          }),
          season: meta.season || null,
          duration: meta.duration || null,
          trailer: meta.trailer || null,
          backdrop_path: meta.backdrop_path || null,
          dp: meta.dp || null,
          embed: meta.embed || null,
          embed_en: meta.embed_en || meta.field_embed_en || null,
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

      return new Response(rewritePlayerHtml(html, server), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          ...corsHeaders(),
        },
      });
    }

    const result = await resolveCatalogStream(type, id, season, episode, server);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message || 'Moovie stream resolve failed' }, 500);
  }
}