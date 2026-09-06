const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const analytics = require('./analytics');
const { setupWebSocket } = require('./watch-together');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const USER_PROVIDERS_PATH = path.join(__dirname, 'providers.json');
const LOCAL_PROVIDERS_DIR = path.join(__dirname, 'deobfuscated');
const LEGACY_PROVIDERS_DIR = path.join(__dirname, '..', 'deobfuscated');
const MANIFEST_PATH = path.join(__dirname, '..', 'manifest.json');

const PORT = parseInt(process.env.PORT, 10) || null;

const DEFAULT_STARRED_PROVIDER_IDS = [
  'vaplayer',
  'poseidon',
  'moovie-catalog',
  'vidsuper-oneroom',
  'vidsuper-insertunit',
  'vidsuper-flixhq',
  'vidsuper-castle',
  'vidsuper-cinesu',
  'vidsuper-vidnest',
  'vidsuper-vidrock',
  'vidsuper-vixsrc',
];

// These are the public playback embeds shown in Moovie's server switcher.
// They are intentionally separate from scraper/provider sources.
const EMBED_SERVERS = [
  ['moovie', 'Moovie']
].map(([id, name], index) => ({ id, name, priority: index + 1 }));

let config = loadConfig();
let providers = {};
let providerMeta = {};
const streamStore = new Map();
let streamIdCounter = 0;

function getProviderDisplayName(id) {
  return config.providers[id]?.customName || providerMeta[id]?.name || id;
}

function getProviderFiles() {
  const dirs = [LEGACY_PROVIDERS_DIR, LOCAL_PROVIDERS_DIR].filter((dir) => fs.existsSync(dir));
  const seen = new Set();
  const files = [];
  for (const dir of dirs) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.js') || file === 'vidsuper-bridge.js') continue;
      const id = path.basename(file, '.js');
      if (seen.has(id)) continue;
      seen.add(id);
      files.push({ id, filePath: path.join(dir, file) });
    }
  }
  return files;
}

function generateStreamId() {
  return (++streamIdCounter).toString(36) + crypto.randomBytes(4).toString('hex');
}

function toProxyUrl(url, headers, type) {
  return url;
}

function makeStreamUrlsAbsolute(mwStream, host) {
  if (!host) return;
  const base = `https://${host}`;
  if (mwStream.playlist && mwStream.playlist.startsWith('/')) {
    mwStream.playlist = base + mwStream.playlist;
  }
  if (mwStream.qualities) {
    for (const entry of Object.values(mwStream.qualities)) {
      if (entry.url && entry.url.startsWith('/')) {
        entry.url = base + entry.url;
      }
    }
  }
}

// Stream store auto-cleanup every 60s + LRU cap to prevent OOM (fixes VPS hang requiring restart)
const STREAM_TTL = 5 * 60 * 1000;
const STREAM_MAX_ENTRIES = 2000;
function pruneStreamStore() {
  const now = Date.now();
  for (const [key, entry] of streamStore) {
    if (now - entry.ts > STREAM_TTL) streamStore.delete(key);
  }
  // LRU cap: delete oldest entries if over limit (prevents unbounded growth under load)
  if (streamStore.size > STREAM_MAX_ENTRIES) {
    const sorted = [...streamStore.entries()].sort((a, b) => a[1].ts - b[1].ts);
    const toDelete = streamStore.size - STREAM_MAX_ENTRIES;
    for (let i = 0; i < toDelete; i++) streamStore.delete(sorted[i][0]);
  }
}
setInterval(pruneStreamStore, 60 * 1000);

// Helper: wrap provider getStreams with timeout so one hung scraper doesn't block the hub
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function loadConfig() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    cfg = { port: 3000, tmdbApiKey: '', autoplay: true, introSkip: false, streamProxy: false, proxy: { enabled: false }, globalTimeout: 12000, maxResultsPerProvider: 20, providers: {}, qualityFilter: { '4k': true, '1080': true, '720': true, 'sd': true, 'unknown': true } };
  }
  if (!cfg.providers) cfg.providers = {};
  if (!cfg.embedServers || typeof cfg.embedServers !== 'object') cfg.embedServers = {};
  for (const server of EMBED_SERVERS) {
    if (!cfg.embedServers[server.id]) cfg.embedServers[server.id] = { enabled: true, priority: server.priority };
    if (typeof cfg.embedServers[server.id].enabled !== 'boolean') cfg.embedServers[server.id].enabled = true;
    if (typeof cfg.embedServers[server.id].priority !== 'number') cfg.embedServers[server.id].priority = server.priority;
  }
  if (!Array.isArray(cfg.starredProviders)) cfg.starredProviders = [...DEFAULT_STARRED_PROVIDER_IDS];
  // Merge user's provider overrides from gitignored file
  try {
    const user = JSON.parse(fs.readFileSync(USER_PROVIDERS_PATH, 'utf8'));
    if (user && typeof user === 'object') {
      for (const [id, p] of Object.entries(user)) {
        if (cfg.providers[id]) {
          if (typeof p.enabled === 'boolean') cfg.providers[id].enabled = p.enabled;
          if (typeof p.priority === 'number') cfg.providers[id].priority = p.priority;
          if (typeof p.starred === 'boolean') cfg.providers[id].starred = p.starred;
          if (typeof p.customName === 'string') cfg.providers[id].customName = p.customName.trim().slice(0, 80);
          if (typeof p.proxyMode === 'string') cfg.providers[id].proxyMode = p.proxyMode;
          if (Array.isArray(p.disabledServers)) cfg.providers[id].disabledServers = p.disabledServers;
        } else {
          // Provider exists in user file but not in defaults — add it
          cfg.providers[id] = {
            enabled: p.enabled !== false,
            priority: p.priority || Object.keys(cfg.providers).length + 1,
            starred: typeof p.starred === 'boolean' ? p.starred : DEFAULT_STARRED_PROVIDER_IDS.includes(id),
            proxyMode: typeof p.proxyMode === 'string' ? p.proxyMode : 'inherit',
            disabledServers: p.disabledServers || [],
            customName: typeof p.customName === 'string' ? p.customName.trim().slice(0, 80) : '',
          };
        }
      }
    }
  } catch {}
  for (const id of cfg.starredProviders) {
    if (!cfg.providers[id]) continue;
    if (typeof cfg.providers[id].starred !== 'boolean') cfg.providers[id].starred = true;
  }
  return cfg;
}

function saveConfig() {
  const providersOnly = {};
  for (const [id, p] of Object.entries(config.providers || {})) {
    providersOnly[id] = {
      enabled: p.enabled,
      priority: p.priority,
      starred: Boolean(p.starred),
      proxyMode: p.proxyMode || 'inherit',
      disabledServers: p.disabledServers || [],
      customName: p.customName || ''
    };
  }
  fs.writeFileSync(USER_PROVIDERS_PATH, JSON.stringify(providersOnly, null, 2));
}

function saveNonProviderSettings() {
  const cfgClean = { ...config };
  delete cfgClean.providers;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfgClean, null, 2));
}

function getEmbedServers() {
  return EMBED_SERVERS
    .map((server) => ({ ...server, ...(config.embedServers?.[server.id] || {}) }))
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));
}

function getProviderFilePath(id) {
  const candidates = [
    path.join(LOCAL_PROVIDERS_DIR, `${id}.js`),
    path.join(LEGACY_PROVIDERS_DIR, `${id}.js`)
  ];
  return candidates.find((filePath) => fs.existsSync(filePath)) || null;
}

function getProviderProxyMode(id) {
  return config.providers[id]?.proxyMode || 'inherit';
}

function shouldUseProviderProxy(id) {
  const mode = getProviderProxyMode(id);
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return Boolean(config.streamProxy);
}

const CLIENT_PROVIDERS = [
  { id: 'icefy', name: 'icefy', supportedTypes: ['movie', 'tv'] },
  { id: 'yp-hdbox-1', name: 'yp-hdbox-1', supportedTypes: ['movie', 'tv'] },
  { id: 'yp-hdbox-2', name: 'yp-hdbox-2', supportedTypes: ['movie', 'tv'] },
  { id: 'yp-flixhq-1', name: 'yp-flixhq-1', supportedTypes: ['movie', 'tv'] },
  { id: 'yp-flixhq-2', name: 'yp-flixhq-2', supportedTypes: ['movie', 'tv'] },
  { id: 'yp-moviebox-1', name: 'yp-moviebox-1', supportedTypes: ['movie', 'tv'] },
  { id: 'yp-moviebox-2', name: 'yp-moviebox-2', supportedTypes: ['movie', 'tv'] },
  { id: 'tugaflix', name: 'tugaflix', supportedTypes: ['movie', 'tv'] },
  { id: 'fsonline', name: 'fsonline', supportedTypes: ['movie', 'tv'] },
  { id: 'animeflv', name: 'animeflv', supportedTypes: ['tv'] },
  { id: 'cuevana3', name: 'cuevana3', supportedTypes: ['movie', 'tv'] },
  { id: 'fullhdfilmizle', name: 'fullhdfilmizle', supportedTypes: ['movie', 'tv'] }
];

function initProviderConfig() {
  const allIds = [
    ...getProviderFiles().map((file) => file.id),
    ...CLIENT_PROVIDERS.map(p => p.id)
  ];
  for (const id of allIds) {
    if (!config.providers[id]) {
      config.providers[id] = {
        enabled: true,
        priority: Object.keys(config.providers).length + 1,
        starred: DEFAULT_STARRED_PROVIDER_IDS.includes(id),
        proxyMode: 'inherit',
        disabledServers: [],
      };
    } else if (typeof config.providers[id].starred !== 'boolean') {
      config.providers[id].starred = DEFAULT_STARRED_PROVIDER_IDS.includes(id);
    }
    if (!config.providers[id].proxyMode) config.providers[id].proxyMode = 'inherit';
  }
  saveConfig();
}

async function loadProviders() {
  for (const { id, filePath } of getProviderFiles()) {
    try {
      delete require.cache[require.resolve(filePath)];
      const mod = require(filePath);
      if (mod && typeof mod.getStreams === 'function') {
        providers[id] = mod;
        providerMeta[id] = {
          name: mod.name || id,
          supportedTypes: mod.supportedTypes || ['movie', 'tv'],
        };
      }
    } catch (e) {
      console.error(`Failed to load provider ${id}:`, e);
    }
  }

  for (const cp of CLIENT_PROVIDERS) {
    providerMeta[cp.id] = {
      name: cp.name,
      supportedTypes: cp.supportedTypes,
      file: 'Client-side Scraper',
      isClientSide: true
    };
  }
}

function createProxyAgent(targetUrl) {
  if (!config.proxy || !config.proxy.enabled || !config.proxy.host) return null;
  const proxyUrl = `http://${config.proxy.host}:${config.proxy.port}`;
  const isHttps = targetUrl.startsWith('https');
  const Agent = isHttps ? HttpsProxyAgent : HttpProxyAgent;
  return new Agent(proxyUrl);
}

async function fetchWithProxy(url, opts = {}) {
  const agent = createProxyAgent(url);
  if (agent) {
    opts.agent = agent;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.globalTimeout || 12000);
  opts.signal = controller.signal;
  try {
    const res = await fetch(url, opts);
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// Patch global fetch for providers to use proxy
const originalFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.globalTimeout || 12000,
  );
  const upstreamSignal = opts.signal;
  const abortFromUpstream = () => controller.abort();
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
  }
  const agent = createProxyAgent(typeof url === 'string' ? url : url.url);
  if (agent) {
    opts.agent = agent;
  }
  try {
    return await originalFetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  }
};

function extractStreamServers(streams) {
  const servers = new Set();
  for (const s of streams) {
    if (s.name) servers.add(s.name);
  }
  return [...servers].sort();
}

const NON_STREAMABLE_EXTS = /\.(zip|rar|7z|tar|gz|mkv|avi|mov|wmv|flv|iso|torrent)(\?|$)/i;

function isStreamableUrl(url) {
  if (!url) return false;
  // Reject download archive extensions
  if (NON_STREAMABLE_EXTS.test(url.split('?')[0])) return false;
  return true;
}

function filterStreams(streams, providerId) {
  const pConfig = config.providers[providerId];
  let filtered = streams;
  if (pConfig && pConfig.disabledServers && pConfig.disabledServers.length > 0) {
    filtered = filtered.filter(s => !pConfig.disabledServers.some(d => s.name && s.name.includes(d)));
  }
  // Remove streams whose URL is a non-streamable download archive
  filtered = filtered.filter(s => isStreamableUrl(s.url));
  return filtered;
}

function attachAudioVariants(streams, providerId) {
  const variants = [];
  const seen = new Set();
  for (const stream of streams || []) {
    const raw = stream?.audio ?? stream?.language ?? stream?.lang ?? stream?.dub;
    const entries = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    for (const entry of entries) {
      const language = typeof entry === 'string'
        ? entry.trim()
        : String(entry?.language ?? entry?.lang ?? entry?.name ?? entry?.label ?? '').trim();
      const url = typeof entry === 'object' ? (entry.url ?? entry.file ?? entry.streamUrl) : stream?.url;
      if (!language || /^unknown|und$/i.test(language) || !url) continue;
      const key = `${language.toLowerCase()}|${url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      variants.push({
        language,
        label: language,
        url,
        type: typeof entry === 'object' ? (entry.type || stream.type) : stream.type,
        provider: providerId,
        id: `${providerId}-audio-${variants.length}`,
      });
    }
  }
  if (variants.length <= 1) return streams;
  return (streams || []).map((stream, index) => index === 0
    ? { ...stream, _languageVariants: [...(stream._languageVariants || []), ...variants] }
    : stream);
}

function isTruthyQuery(value) {
  return value === true || value === '1' || value === 'true' || value === 'yes' || value === 'starred';
}

function getEnabledProvidersSorted(options = {}) {
  const starredOnly = Boolean(options.starredOnly);
  let list = Object.entries(config.providers)
    .filter(([id, p]) => p.enabled && providers[id])
    .sort((a, b) => (a[1].priority || 999) - (b[1].priority || 999));
  if (starredOnly) {
    const starred = list.filter(([, p]) => p.starred);
    list = starred;
  }
  return list;
}

const app = express();
app.use(cors());
app.use(express.json());

const ADMIN_PASSWORD = "passwords";
const authSessions = new Set();

function isReqAuthenticated(req) {
  const authHeader = req.headers["authorization"];
  const token = (authHeader && authHeader.startsWith("Bearer ")) ? authHeader.slice(7) : req.headers["x-admin-token"];
  return token && authSessions.has(token);
}

app.post("/api/auth/login", (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString("hex");
    authSessions.add(token);
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, error: "Invalid password" });
});

app.get("/api/auth/check", (req, res) => {
  res.json({ authenticated: Boolean(isReqAuthenticated(req)) });
});

app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = (authHeader && authHeader.startsWith("Bearer ")) ? authHeader.slice(7) : req.headers["x-admin-token"];
  if (token) authSessions.delete(token);
  res.json({ success: true });
});

// ============ movie-web SSE Provider API (before static to ensure priority) ============

function parseQuality(q) {
  if (!q) return -1;
  q = q.toLowerCase().replace(/p$/, '');
  if (q === 'auto' || q === 'adaptive' || q === 'multi') return -1;
  const n = parseInt(q);
  return isNaN(n) ? -1 : n;
}

function sortStreamsByQuality(streams) {
  return (streams || []).sort((a, b) => {
    const aQ = parseQuality(a.quality);
    const bQ = parseQuality(b.quality);
    if (aQ !== bQ) return bQ - aQ; // desc
    // Fall back: check qualities object
    const aKeys = a.qualities ? Object.keys(a.qualities).map(parseQuality).filter(v => v > 0) : [];
    const bKeys = b.qualities ? Object.keys(b.qualities).map(parseQuality).filter(v => v > 0) : [];
    const aBest = aKeys.length ? Math.max(...aKeys) : -1;
    const bBest = bKeys.length ? Math.max(...bKeys) : -1;
    return bBest - aBest;
  });
}

// Convert a scraper stream to movie-web Stream format
function scraperStreamToMwStream(stream, sourceId, providerId = sourceId) {
  const hasHeaders = stream.headers && typeof stream.headers === 'object' && Object.keys(stream.headers).length > 0;
  const useProxy = shouldUseProviderProxy(providerId);
  const flags = useProxy || !hasHeaders ? ['cors-allowed'] : ['ip-locked'];
  const mwHeaders = useProxy ? undefined : (hasHeaders ? stream.headers : undefined);
  const captions = Array.isArray(stream.captions) ? stream.captions : [];
  const languageVariants = Array.isArray(stream._languageVariants) ? stream._languageVariants : [];

  // Handle multi-quality streams (object with quality keys)
  if (stream.qualities && typeof stream.qualities === 'object') {
    const qualities = {};
    for (const [q, entry] of Object.entries(stream.qualities)) {
      if (!entry || !entry.url) continue;
      if (!isStreamableUrl(entry.url)) {
        console.log(`[scraperStreamToMwStream] Skipping non-streamable quality "${q}": ${entry.url.slice(0, 80)}`);
        continue;
      }
      qualities[q] = { type: entry.type || 'mp4', url: toProxyUrl(entry.url, stream.headers, entry.type) };
    }
    if (Object.keys(qualities).length === 0) return null; // all qualities filtered
    return {
      type: 'file',
      id: sourceId + '-' + Date.now(),
      providerId: providerId,
      proxyMode: getProviderProxyMode(providerId),
      flags,
      captions,
      qualities,
      headers: mwHeaders,
      ...(languageVariants.length ? { _languageVariants: languageVariants } : {}),
    };
  }

  const isHls = stream.type === 'm3u8' || stream.type === 'hls' || (stream.url && stream.url.includes('.m3u8'));
  if (isHls) {
    return {
      type: 'hls',
      playlist: toProxyUrl(stream.url, stream.headers, 'm3u8'),
      id: sourceId + '-' + Date.now(),
      providerId: providerId,
      proxyMode: getProviderProxyMode(providerId),
      flags,
      captions,
      headers: mwHeaders,
      ...(languageVariants.length ? { _languageVariants: languageVariants } : {}),
    };
  }

  // Single URL stream — reject non-streamable
  if (!isStreamableUrl(stream.url)) {
    console.log(`[scraperStreamToMwStream] Skipping non-streamable stream url: ${(stream.url || '').slice(0, 80)}`);
    return null;
  }

  const quality = stream.quality || 'unknown';
  const qualities = {};
  qualities[quality] = { type: stream.type === 'mpd' || stream.type === 'dash' ? 'mpd' : 'mp4', url: toProxyUrl(stream.url, stream.headers, stream.type) };
  return {
    type: 'file',
    id: sourceId + '-' + Date.now(),
    providerId: providerId,
    proxyMode: getProviderProxyMode(providerId),
    flags,
    captions,
    qualities,
    headers: mwHeaders,
    ...(languageVariants.length ? { _languageVariants: languageVariants } : {}),
  };
}

// GET /metadata - Return all providers in MetaOutput format
app.get('/metadata', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const result = [];
  const starredOnly = isTruthyQuery(req.query.starred);
  const sorted = Object.entries(providerMeta)
    .sort((a, b) => (config.providers[a[0]]?.priority || 999) - (config.providers[b[0]]?.priority || 999));
  for (const [id, meta] of sorted) {
    const pConfig = config.providers[id];
    if (!pConfig || pConfig.enabled === false) continue;
    if (starredOnly && !pConfig.starred) continue;
    result.push([{
      id,
      name: getProviderDisplayName(id),
      type: 'source',
      rank: pConfig.priority || 999,
      flags: [],
      mediaTypes: meta.supportedTypes || ['movie', 'tv'],
    }]);
  }
  res.json(result);
});

function sendSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.flushHeaders();
  let cancelled = false;
  req.on('close', () => { cancelled = true; });
  function emit(event, data) {
    if (cancelled) return;
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) {}
  }
  return { emit, cancelled: () => cancelled };
}

// GET /scrape - SSE endpoint that runs all scrapers (movie-web runAll)
app.get('/scrape', async (req, res) => {
  const { type, tmdbId, season, episode, seasonNumber, episodeNumber } = req.query;
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId required' });
  const sse = sendSSE(req, res);
  if (sse.cancelled()) return;

  const enabledProviders = getEnabledProvidersSorted({ starredOnly: isTruthyQuery(req.query.starred) });
  const sourceIds = enabledProviders.map(([id]) => id);

  let completedAny = false;
  sse.emit('init', {
    sourceIds,
    sources: sourceIds.map((id) => ({ id, name: getProviderDisplayName(id) })),
  });

  const mediaType = type || 'movie';
  const sNum = season || seasonNumber || null;
  const eNum = episode || episodeNumber || null;
  const CONCURRENCY = Math.max(1, Math.min(Number(process.env.SCRAPE_CONCURRENCY || 4), 6));
  let cursor = 0;

  async function processProvider(id) {
    if (sse.cancelled()) return;
    let progressTimer = null;
    try {
      sse.emit('start', id);

      let progress = 0;
      progressTimer = setInterval(() => {
        if (sse.cancelled()) { clearInterval(progressTimer); return; }
        progress = Math.min(progress + 4, 85);
        sse.emit('update', { id, percentage: progress, status: 'pending' });
      }, 400);

      const mod = providers[id];
      const streams = await withTimeout(mod.getStreams(tmdbId, mediaType, sNum, eNum), config.globalTimeout || 12000, `provider:${id}`);
      clearInterval(progressTimer);
      progressTimer = null;
      if (sse.cancelled()) return;

      const filtered = sortStreamsByQuality(attachAudioVariants(filterStreams(streams || [], id), id));

      if (filtered && filtered.length > 0) {
        let foundValid = false;
        for (let i = 0; i < filtered.length; i++) {
          const stream = filtered[i];
          const mwStream = scraperStreamToMwStream(stream, id, id);
          if (!mwStream) continue;
          foundValid = true;
          const pct = Math.round(85 + ((i + 1) / filtered.length) * 15);
          sse.emit('update', { id, percentage: pct, status: 'success' });
          makeStreamUrlsAbsolute(mwStream, req.headers.host);
          const output = { sourceId: id, providerName: getProviderDisplayName(id), stream: mwStream };
          sse.emit('completed', output);
          completedAny = true;
          break; // Go to next provider
        }
        if (!foundValid) {
          sse.emit('update', { id, percentage: 100, status: 'notfound', reason: 'No streamable qualities/sources found' });
        }
      } else {
        sse.emit('update', { id, percentage: 100, status: 'notfound', reason: 'No streams returned' });
      }
    } catch (e) {
      if (progressTimer) clearInterval(progressTimer);
      sse.emit('update', { id, percentage: 100, status: 'failure', error: e.message });
    }
  }

  async function worker() {
    while (!sse.cancelled()) {
      const next = enabledProviders[cursor++];
      if (!next) return;
      await processProvider(next[0]);
    }
  }

  await Promise.allSettled(
    Array.from({ length: Math.min(CONCURRENCY, enabledProviders.length) }, () => worker())
  );

  if (!sse.cancelled() && !completedAny) {
    sse.emit('noOutput', '');
  }
  res.end();
});

// GET /scrape/source - SSE endpoint for a single source
// Supports fallback=true: tries next enabled provider if requested one fails
app.get('/scrape/source', async (req, res) => {
  const { id, type, tmdbId, season, episode, seasonNumber, episodeNumber, fallback } = req.query;
  if (!id || !tmdbId) return res.status(400).json({ error: 'id and tmdbId required' });
  const sse = sendSSE(req, res);
  if (sse.cancelled()) return;

  const mediaType = type || 'movie';
  const sNum = season || seasonNumber || null;
  const eNum = episode || episodeNumber || null;

  // Build fallback chain: requested provider first, then all enabled in priority order
  const enabled = getEnabledProvidersSorted({ starredOnly: isTruthyQuery(req.query.starred) });
  const seen = new Set();
  const chain = [];
  if (providers[id]) chain.push([id, config.providers[id]]);
  seen.add(id);
  for (const [pid, pcfg] of enabled) {
    if (!seen.has(pid)) chain.push([pid, pcfg]);
    seen.add(pid);
  }

  let completedAny = false;

  for (const [currentId, pConfig] of chain) {
    if (sse.cancelled()) break;
    if (completedAny) break;
    // If not the first provider in the chain, emit a skip notice
    if (currentId !== id && fallback === 'false') break;
    if (currentId !== id) {
      sse.emit('update', { id: currentId, percentage: 5, status: 'pending', note: `fallback from ${id}` });
    }

    const mod = providers[currentId];
    if (!mod) continue;

    try {
      sse.emit('start', currentId);

      let progress = 0;
      const progressTimer = setInterval(() => {
        if (sse.cancelled()) { clearInterval(progressTimer); return; }
        progress = Math.min(progress + 4, 85);
        sse.emit('update', { id: currentId, percentage: progress, status: 'pending' });
      }, 400);

      const streams = await withTimeout(mod.getStreams(tmdbId, mediaType, sNum, eNum), config.globalTimeout || 12000, `provider:${currentId}`);
      clearInterval(progressTimer);
      if (sse.cancelled()) break;

      const filtered = sortStreamsByQuality(attachAudioVariants(filterStreams(streams || [], currentId), currentId));

      if (filtered && filtered.length > 0) {
        const mwStreams = filtered
          .map((s, i) => scraperStreamToMwStream(s, currentId + '-' + i, currentId))
          .filter(Boolean);
        if (mwStreams.length > 0) {
          sse.emit('update', { id: currentId, percentage: 100, status: 'success' });
          mwStreams.forEach(s => makeStreamUrlsAbsolute(s, req.headers.host));
          const output = { embeds: [], providerName: getProviderDisplayName(currentId), stream: mwStreams };
          sse.emit('completed', output);
          completedAny = true;
          break;
        } else {
          sse.emit('update', { id: currentId, percentage: 100, status: 'notfound', reason: 'No streamable qualities/sources found' });
        }
      } else {
        sse.emit('update', { id: currentId, percentage: 100, status: 'notfound', reason: 'No streams returned' });
      }
    } catch (e) {
      sse.emit('update', { id: currentId, percentage: 100, status: 'failure', error: e.message });
    }
  }

  if (!sse.cancelled() && !completedAny) {
    sse.emit('noOutput', '');
  }
  res.end();
});

// GET /scrape/embed - SSE endpoint for a single embed (not supported by these scrapers)
app.get('/scrape/embed', async (req, res) => {
  const { id, url } = req.query;
  const sse = sendSSE(req, res);
  if (sse.cancelled()) return;

  sse.emit('start', id || 'embed');
  sse.emit('update', { id: id || 'embed', percentage: 100, status: 'notfound', reason: 'Embed scraping not supported' });
  sse.emit('noOutput', '');
  res.end();
});

app.use(express.static(path.join(__dirname, 'public')));

// ============ API Routes ============

function registerProviderRoutes(basePath) {
  // List all providers with config
  app.get(basePath, (req, res) => {
    const result = {};
    for (const [id, meta] of Object.entries(providerMeta)) {
      result[id] = {
        ...meta,
        name: getProviderDisplayName(id),
        enabled: config.providers[id]?.enabled ?? true,
        priority: config.providers[id]?.priority ?? 999,
        starred: Boolean(config.providers[id]?.starred),
        hasFile: Boolean(getProviderFilePath(id)),
        disabledServers: config.providers[id]?.disabledServers || [],
      };
    }
    res.json(result);
  });

  app.get(`${basePath}/starred`, (req, res) => {
    const result = getEnabledProvidersSorted({ starredOnly: true }).map(([id, p]) => ({
      id,
      name: getProviderDisplayName(id),
      priority: p.priority || 999,
    }));
    res.json({ providers: result });
  });

  // Bulk reorder providers — atomic, single request
  app.post(`${basePath}/reorder`, (req, res) => {
    const { order } = req.body;
    if (!Array.isArray(order) || !order.length) return res.status(400).json({ error: 'Missing order array' });
    for (let i = 0; i < order.length; i++) {
      if (config.providers[order[i]]) {
        config.providers[order[i]].priority = i + 1;
      }
    }
    saveConfig();
    res.json({ ok: true });
  });

  // Toggle provider
  app.post(`${basePath}/:id/toggle`, (req, res) => {
    const { id } = req.params;
    if (!config.providers[id]) return res.status(404).json({ error: 'Provider not found' });
    config.providers[id].enabled = !config.providers[id].enabled;
    saveConfig();
    res.json({ id, enabled: config.providers[id].enabled });
  });

  app.post(`${basePath}/:id/starred`, (req, res) => {
    const { id } = req.params;
    if (!config.providers[id]) return res.status(404).json({ error: 'Provider not found' });
    const requested = req.body && typeof req.body.starred === 'boolean' ? req.body.starred : !config.providers[id].starred;
    config.providers[id].starred = requested;
    saveConfig();
    res.json({ id, starred: config.providers[id].starred });
  });

  app.post(`${basePath}/:id/rename`, (req, res) => {
    const { id } = req.params;
    if (!config.providers[id] || !providerMeta[id]) return res.status(404).json({ error: 'Provider not found' });
    const name = String(req.body?.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: 'Name is required' });
    config.providers[id].customName = name;
    saveConfig();
    res.json({ id, name });
  });

  app.post(`${basePath}/:id/proxy-mode`, (req, res) => {
    const { id } = req.params;
    if (!config.providers[id]) return res.status(404).json({ error: 'Provider not found' });
    const valid = new Set(['inherit', 'on', 'off']);
    const requested = String(req.body?.proxyMode || 'inherit').toLowerCase();
    if (!valid.has(requested)) return res.status(400).json({ error: 'Invalid proxyMode' });
    config.providers[id].proxyMode = requested;
    saveConfig();
    res.json({ id, proxyMode: config.providers[id].proxyMode });
  });

  app.get(`${basePath}/:id/file`, (req, res) => {
    const { id } = req.params;
    const filePath = getProviderFilePath(id);
    if (!filePath) return res.status(404).json({ error: 'Provider file not found' });
    res.setHeader('Content-Type', 'application/json');
    res.json({
      id,
      filePath,
      content: fs.readFileSync(filePath, 'utf8')
    });
  });

  app.put(`${basePath}/:id/file`, async (req, res) => {
    const { id } = req.params;
    const filePath = getProviderFilePath(id);
    if (!filePath) return res.status(404).json({ error: 'Provider file not found' });
    const content = req.body?.content;
    if (typeof content !== 'string') return res.status(400).json({ error: 'Missing content' });
    fs.writeFileSync(filePath, content, 'utf8');
    await loadProviders();
    res.json({ id, filePath, ok: true });
  });

  app.delete(`${basePath}/:id/file`, async (req, res) => {
    const { id } = req.params;
    const filePath = getProviderFilePath(id);
    if (!filePath) return res.status(404).json({ error: 'Provider file not found' });
    fs.unlinkSync(filePath);
    delete config.providers[id];
    delete providers[id];
    delete providerMeta[id];
    saveConfig();
    await loadProviders();
    res.json({ id, deleted: true });
  });

  // Toggle all providers
  app.post(`${basePath}/toggle-all`, (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'Missing enabled boolean' });
    for (const id of Object.keys(config.providers)) {
      if (providerMeta[id]) config.providers[id].enabled = enabled;
    }
    saveConfig();
    res.json({ enabled });
  });

  // Update provider priority
  app.post(`${basePath}/:id/priority`, (req, res) => {
    const { id } = req.params;
    const { priority } = req.body;
    if (!config.providers[id]) return res.status(404).json({ error: 'Provider not found' });
    config.providers[id].priority = priority;
    saveConfig();
    res.json({ id, priority });
  });

  // Update disabled servers for a provider
  app.post(`${basePath}/:id/servers`, (req, res) => {
    const { id } = req.params;
    const { disabledServers } = req.body;
    if (!config.providers[id]) return res.status(404).json({ error: 'Provider not found' });
    config.providers[id].disabledServers = disabledServers || [];
    saveConfig();
    res.json({ id, disabledServers: config.providers[id].disabledServers });
  });
}

// List all providers with config
registerProviderRoutes('/api/providers');
registerProviderRoutes('/providers');

// Public playback embed controls. This is deliberately not tied to scraper providers.
app.get('/api/embed-servers', (req, res) => {
  res.json(getEmbedServers());
});

app.post('/api/embed-servers/:id/toggle', (req, res) => {
  const server = EMBED_SERVERS.find((entry) => entry.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Embed server not found' });
  const current = config.embedServers[server.id] || {};
  current.enabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : !current.enabled;
  config.embedServers[server.id] = current;
  saveNonProviderSettings();
  res.json({ id: server.id, enabled: current.enabled });
});

app.post('/api/embed-servers/reorder', (req, res) => {
  if (!Array.isArray(req.body?.order) || !req.body.order.length) return res.status(400).json({ error: 'Missing order array' });
  req.body.order.forEach((id, index) => {
    if (EMBED_SERVERS.some((entry) => entry.id === id)) {
      config.embedServers[id] = { ...(config.embedServers[id] || {}), priority: index + 1 };
    }
  });
  saveNonProviderSettings();
  res.json({ ok: true, servers: getEmbedServers() });
});

// Subtitles endpoint
app.get('/api/subtitles', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { tmdbId, type, season, episode } = req.query;

  if (!tmdbId || !type) {
    return res.status(400).json({ error: 'Missing tmdbId or type' });
  }

  try {
    // 1. Get IMDB ID from TMDB
    const mediaType = type === 'show' || type === 'tv' ? 'tv' : 'movie';
    const tmdbKey = '439c478a771f35c05022f9feabcca01c';
    const extUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${tmdbKey}`;
    const extResp = await fetch(extUrl);
    const extData = await extResp.json();
    const imdbId = extData?.imdb_id;

    if (!imdbId) {
      return res.json({ captions: [] });
    }

    // 2. Query Stremio OpenSubtitles v3 Addon
    let stremioUrl = `https://opensubtitles-v3.strem.io/subtitles/movie/${imdbId}.json`;
    if (mediaType === 'tv' && season && episode) {
      stremioUrl = `https://opensubtitles-v3.strem.io/subtitles/series/${imdbId}:${season}:${episode}.json`;
    }

    const subResp = await fetch(stremioUrl);
    if (!subResp.ok) {
      return res.json({ captions: [] });
    }

    const subData = await subResp.json();
    if (!subData || !Array.isArray(subData.subtitles)) {
      return res.json({ captions: [] });
    }

    const lang3to2 = {
      'eng': 'en', 'fre': 'fr', 'fra': 'fr', 'spa': 'es', 'ger': 'de', 'deu': 'de',
      'ita': 'it', 'por': 'pt', 'rus': 'ru', 'chi': 'zh', 'zho': 'zh', 'jpn': 'ja',
      'kor': 'ko', 'ara': 'ar', 'hin': 'hi', 'dut': 'nl', 'nld': 'nl', 'pol': 'pl',
      'tur': 'tr', 'vie': 'vi', 'tha': 'th', 'swe': 'sv', 'nor': 'no', 'dan': 'da',
      'fin': 'fi', 'gre': 'el', 'ell': 'el', 'heb': 'he', 'ind': 'id', 'msa': 'ms',
      'may': 'ms', 'rum': 'ro', 'ron': 'ro', 'hun': 'hu', 'cze': 'cs', 'ces': 'cs',
      'slo': 'sk', 'slk': 'sk', 'ukr': 'uk', 'fil': 'fil', 'ben': 'bn', 'tel': 'te',
      'tam': 'ta', 'kan': 'kn', 'mal': 'ml', 'mar': 'mr', 'guj': 'gu', 'pan': 'pa',
      'srp': 'sr', 'hrv': 'hr', 'bul': 'bg', 'slv': 'sl', 'lav': 'lv', 'est': 'et',
      'lit': 'lt', 'per': 'fa', 'fas': 'fa', 'aze': 'az', 'kat': 'ka', 'sqi': 'sq', 'alb': 'sq'
    };

    const captions = [];

    for (const item of subData.subtitles) {
      if (!item.url) continue;
      
      const rawLang = (item.lang || 'eng').toLowerCase();
      const langCode = lang3to2[rawLang] || rawLang.slice(0, 2);

      captions.push({
        id: item.url,
        language: langCode,
        url: item.url,
        type: 'srt',
        needsProxy: true,
        opensubtitles: true,
      });
    }

    const uniqueCaptions = [];
    const seenLangs = new Set();
    for (const cap of captions) {
      if (!seenLangs.has(cap.language)) {
        seenLangs.add(cap.language);
        uniqueCaptions.push(cap);
      }
    }

    return res.json({ captions: uniqueCaptions });
  } catch (err) {
    console.error('Error fetching subtitles:', err.message);
    return res.json({ captions: [] });
  }
});

// Search endpoint
app.get('/api/search', async (req, res) => {
  let { q: query, type = 'movie', season, episode, provider, providers: providerList, tmdbId } = req.query;
  if (type === 'show') type = 'tv';
  if (!query) return res.status(400).json({ error: 'Missing query' });

  const resolveProviderId = (requested) => {
    if (!requested) return null;
    if (providers[requested]) return requested;
    const needle = String(requested).trim().toLowerCase();
    const match = Object.entries(providerMeta).find(([id, meta]) => {
      const names = [id, meta?.name, getProviderDisplayName(id)]
        .filter(Boolean)
        .map((name) => String(name).trim().toLowerCase());
      return names.includes(needle);
    });
    return match?.[0] || null;
  };

  let enabledProviders = [];
  const requestedProviders = [
    ...(provider ? [provider] : []),
    ...(providerList ? String(providerList).split(',') : []),
  ]
    .map(resolveProviderId)
    .filter((id, index, ids) => id && ids.indexOf(id) === index);
  if (requestedProviders.length) {
    enabledProviders = requestedProviders.map((id) => [id, config.providers[id] || { priority: 999 }]);
  } else {
    enabledProviders = getEnabledProvidersSorted({ starredOnly: isTruthyQuery(req.query.starred) });
  }
  const results = [];
  const errors = [];

  await Promise.allSettled(enabledProviders.map(async ([id, pConfig]) => {
    try {
      const mod = providers[id];
      const streams = await mod.getStreams(tmdbId || query, type, season || null, episode || null, query);
      if (streams && streams.length > 0) {
        const filtered = attachAudioVariants(filterStreams(streams, id), id);
        if (filtered.length > 0) {
          const sliced = filtered.slice(0, config.maxResultsPerProvider || 20).map((stream) => {
            if (!stream.type) {
              if (stream.url.includes('.m3u8')) stream.type = 'm3u8';
              else if (stream.url.includes('.mpd')) stream.type = 'mpd';
              else if (stream.url.includes('.ts')) stream.type = 'ts';
              else if (stream.url.includes('.mp4')) stream.type = 'mp4';
              else if (stream.url.includes('.mkv')) stream.type = 'mkv';
              else stream.type = 'mp4';
            }
            const storeId = generateStreamId();
            streamStore.set(storeId, { ts: Date.now(),
              url: stream.url,
              headers: stream.headers || {},
              type: stream.type,
            });
            return {
              ...stream,
              providerId: id,
              proxyMode: getProviderProxyMode(id),
              proxyUrl: shouldUseProviderProxy(id) ? `/proxy?id=${storeId}` : '',
            };
          });
          results.push({
            provider: id,
            providerName: providerMeta[id]?.name || id,
            priority: pConfig.priority,
            proxyMode: getProviderProxyMode(id),
            count: filtered.length,
            servers: extractStreamServers(filtered),
            streams: sliced,
          });
        }
      }
    } catch (e) {
      errors.push({ provider: id, error: e.message });
    }
  }));

  results.sort((a, b) => a.priority - b.priority);
  res.json({ query, type, results, errors, totalStreams: results.reduce((s, r) => s + r.streams.length, 0) });
});

// Streaming search (SSE) — for real-time test panel
app.get('/api/search/stream', async (req, res) => {
  const { q: query, type = 'movie', season, episode, provider, providers: providerList } = req.query;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.flushHeaders();

  let cancelled = false;
  req.on('close', () => { cancelled = true; });

  function emit(event, data) {
    if (cancelled) return;
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) {}
  }

  // Flush after every emit to ensure real-time delivery
  const origWrite = res.write.bind(res);
  res.write = function(chunk) {
    const ret = origWrite(chunk);
    if (typeof res.flush === 'function') res.flush();
    return ret;
  };

  const resolveProviderId = (requested) => {
    if (!requested) return null;
    if (providers[requested]) return requested;
    const needle = String(requested).trim().toLowerCase();
    const match = Object.entries(providerMeta).find(([id, meta]) => {
      const names = [id, meta?.name, getProviderDisplayName(id)]
        .filter(Boolean)
        .map((name) => String(name).trim().toLowerCase());
      return names.includes(needle);
    });
    return match?.[0] || null;
  };
  const requestedProviders = [
    ...(provider ? [provider] : []),
    ...(providerList ? String(providerList).split(',') : []),
  ]
    .map(resolveProviderId)
    .filter((id, index, ids) => id && ids.indexOf(id) === index);
  const enabledProviders = requestedProviders.length
    ? requestedProviders.map((id) => [id, config.providers[id] || { priority: 999 }])
    : getEnabledProvidersSorted({ starredOnly: isTruthyQuery(req.query.starred) });
  const results = [];
  const errors = [];
  const CONCURRENCY = 6;

  emit('start', { total: enabledProviders.length });

  async function processProvider(id, pConfig) {
    if (cancelled) return;
    const name = providerMeta[id]?.name || id;
    emit('provider-start', { provider: id, name });
    try {
      const mod = providers[id];
      const streams = await mod.getStreams(query, type, season || null, episode || null);
      if (cancelled) return;
      if (streams && streams.length > 0) {
        const filtered = attachAudioVariants(filterStreams(streams, id), id);
        const sliced = filtered.slice(0, config.maxResultsPerProvider || 20).map((stream) => {
          if (cancelled) return;
          if (!stream.type) {
            if (stream.url.includes('.m3u8')) stream.type = 'm3u8';
            else if (stream.url.includes('.mpd')) stream.type = 'mpd';
            else if (stream.url.includes('.ts')) stream.type = 'ts';
            else if (stream.url.includes('.mp4')) stream.type = 'mp4';
            else if (stream.url.includes('.mkv')) stream.type = 'mkv';
            else stream.type = 'mp4';
          }
          const storeId = generateStreamId();
          streamStore.set(storeId, {
            ts: Date.now(),
            url: stream.url,
            headers: stream.headers || {},
            type: stream.type,
          });
          const proxyUrl = shouldUseProviderProxy(id) ? `/proxy?id=${storeId}` : '';
          const output = {
            ...stream,
            providerId: id,
            proxyMode: getProviderProxyMode(id),
            proxyUrl,
          };
          emit('stream', { provider: id, name, quality: output.quality || 'Auto', url: output.url, proxyUrl: output.proxyUrl || '', type: output.type, title: output.title || '', proxyMode: output.proxyMode });
          return output;
        });
        emit('provider-done', { provider: id, name, count: filtered.length, servers: extractStreamServers(filtered) });
        results.push({ provider: id, providerName: name, priority: pConfig.priority, proxyMode: getProviderProxyMode(id), count: filtered.length, servers: extractStreamServers(filtered), streams: sliced });
      } else {
        emit('provider-empty', { provider: id, name });
      }
    } catch (e) {
      emit('provider-error', { provider: id, name, error: e.message });
      errors.push({ provider: id, error: e.message });
    }
  }

  // Process providers in parallel batches
  for (let i = 0; i < enabledProviders.length && !cancelled; i += CONCURRENCY) {
    const batch = enabledProviders.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map(([id, pConfig]) => processProvider(id, pConfig)));
  }

  if (!cancelled) {
    emit('done', { results, errors, totalStreams: results.reduce((s, r) => s + r.streams.length, 0) });
  }
  res.end();
});

// Get settings
app.get('/api/settings', (req, res) => {
  res.json(config);
});

// Update settings
app.put('/api/settings', (req, res) => {
  const { port, tmdbApiKey, globalTimeout, maxResultsPerProvider, proxy, autoplay, introSkip, qualityFilter, streamProxy } = req.body;
  if (port) config.port = port;
  if (tmdbApiKey) config.tmdbApiKey = tmdbApiKey;
  if (globalTimeout) config.globalTimeout = globalTimeout;
  if (maxResultsPerProvider) config.maxResultsPerProvider = maxResultsPerProvider;
  if (proxy) config.proxy = { ...config.proxy, ...proxy };
  if (typeof autoplay === 'boolean') config.autoplay = autoplay;
  if (typeof introSkip === 'boolean') config.introSkip = introSkip;
  if (typeof streamProxy === 'boolean') config.streamProxy = streamProxy;
  if (qualityFilter) config.qualityFilter = qualityFilter;
  saveNonProviderSettings();
  res.json(config);
});

// Intro/credits timestamps via theintrodb.org
app.get('/api/intro-timestamps', async (req, res) => {
  const { tmdb_id, type, season, episode, duration_ms } = req.query;
  if (!tmdb_id) return res.status(400).json({ error: 'tmdb_id required' });
  try {
    var apiUrl = 'https://api.theintrodb.org/v3/media?tmdb_id=' + encodeURIComponent(tmdb_id) + '&type=' + encodeURIComponent(type || 'movie');
    if (season) apiUrl += '&season=' + encodeURIComponent(season);
    if (episode) apiUrl += '&episode=' + encodeURIComponent(episode);
    if (duration_ms) apiUrl += '&duration_ms=' + encodeURIComponent(duration_ms);
    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) return res.status(apiRes.status).json({ error: 'introdb fetch failed' });
    const data = await apiRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Discover servers for a provider (run a test search)
app.get('/api/providers/:id/discover', async (req, res) => {
  const { id } = req.params;
  const { q = '550', type = 'movie' } = req.query;
  if (!providers[id]) return res.status(404).json({ error: 'Provider not found' });
  try {
    const mod = providers[id];
    const streams = await mod.getStreams(q, type, null, null);
    const servers = extractStreamServers(streams || []);
    res.json({ provider: id, servers, count: (streams || []).length });
  } catch (e) {
    res.json({ provider: id, servers: [], count: 0, error: e.message });
  }
});

// Get server IP / connection info
app.get('/api/info', (req, res) => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  res.json({
    hostname: os.hostname(),
    ips,
    port: config.port,
    platform: os.platform(),
    serverUrl: `http://${ips[0] || 'localhost'}:${config.port}`,
  });
});

// ============ Stream Proxy ============

function encodeB64url(str) {
  return Buffer.from(str).toString('base64url');
}

function decodeB64url(str) {
  return Buffer.from(str, 'base64url').toString();
}

function rewriteHlsPlaylist(playlist, baseUrl, headers, host) {
  const headerB64 = encodeB64url(JSON.stringify(headers));
  const prefix = host ? `https://${host}` : '';

  // Reorder master playlist variants by bandwidth descending so highest quality plays first
  const lines = playlist.split('\n');
  if (playlist.includes('#EXT-X-STREAM-INF:')) {
    const variants = [];
    const otherLines = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
        const urlLine = i + 1 < lines.length ? lines[i + 1] : '';
        const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/i);
        variants.push({ bandwidth: bwMatch ? parseInt(bwMatch[1]) : 0, header: lines[i], url: urlLine });
        i++;
      } else {
        otherLines.push(lines[i]);
      }
    }
    if (variants.length > 1) {
      variants.sort((a, b) => b.bandwidth - a.bandwidth);
      const reordered = [...otherLines];
      // Insert sorted variants at the position of the first variant
      const insertAt = otherLines.length;
      for (const v of variants) {
        reordered.push(v.header);
        reordered.push(v.url);
      }
      playlist = reordered.join('\n');
    }
  }

  // Rewrite non-comment lines and URI tags to proxy URLs
  return playlist.split('\n').map(line => {
    let rewrittenLine = line;
    
    // Rewrite URI attributes (e.g. inside EXT-X-MEDIA or EXT-X-KEY tags)
    const uriAttrRe = /URI="([^"]+)"/gi;
    rewrittenLine = rewrittenLine.replace(uriAttrRe, (match, url) => {
      try {
        const absoluteUrl = new URL(url, baseUrl).href;
        const urlB64 = encodeB64url(absoluteUrl);
        return `URI="${prefix}/proxy?u=${urlB64}&h=${headerB64}"`;
      } catch {
        return match;
      }
    });

    const trimmed = rewrittenLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return rewrittenLine;
    try {
      const absoluteUrl = new URL(trimmed, baseUrl).href;
      const urlB64 = encodeB64url(absoluteUrl);
      return `${prefix}/proxy?u=${urlB64}&h=${headerB64}`;
    } catch {
      return rewrittenLine;
    }
  }).join('\n');
}

function bodyStreamFromReader(reader, firstChunk) {
  let first = true;
  return new Readable({
    read() {
      if (first) { first = false; this.push(firstChunk); return; }
      reader.read().then(({ done, value }) => {
        if (done) { this.push(null); return; }
        this.push(value);
      });
    }
  });
}

// Proxy endpoint - supports both ID-based lookup and inline URL+headers
app.options('/proxy', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Cookie, X-Referer, X-Origin, X-User-Agent, X-Token, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, X-Final-Destination, X-Set-Cookie');
  res.status(204).end();
});

app.get('/proxy', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  const { id, u, h, destination } = req.query;

  let targetUrl, targetHeaders, targetType;

  if (id && streamStore.has(id)) {
    const entry = streamStore.get(id);
    targetUrl = entry.url;
    targetHeaders = entry.headers;
    targetType = entry.type;
  } else if (u) {
    targetUrl = decodeB64url(u);
    targetHeaders = h ? JSON.parse(decodeB64url(h)) : {};
  } else if (destination) {
    targetUrl = destination;
    targetHeaders = {};
    // Forward all original request headers (except hop-by-hop and connection-specific ones)
    const skipHeaders = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'upgrade', 'proxy-connection', 'x-token']);
    // First, copy all original headers
    for (const [key, value] of Object.entries(req.headers)) {
      if (!skipHeaders.has(key.toLowerCase()) && typeof value === 'string') {
        targetHeaders[key] = value;
      }
    }
    // Then override with provider-specific mapped headers (for @movie-web/providers compatibility)
    if (req.headers['x-cookie']) targetHeaders['Cookie'] = req.headers['x-cookie'];
    if (req.headers['x-referer']) targetHeaders['Referer'] = req.headers['x-referer'];
    if (req.headers['x-origin']) targetHeaders['Origin'] = req.headers['x-origin'];
    if (req.headers['x-user-agent']) targetHeaders['User-Agent'] = req.headers['x-user-agent'];
  } else {
    return res.status(400).send('Missing id or url parameter');
  }

  const fetchHeaders = { ...targetHeaders };
  if (req.headers.range) {
    fetchHeaders.Range = req.headers.range;
  }
  if (!fetchHeaders['User-Agent'] && !fetchHeaders['user-agent']) {
    fetchHeaders['User-Agent'] = req.headers['user-agent'] || 'Mozilla/5.0';
  }

  try {
    const agent = createProxyAgent(targetUrl);
    const opts = { headers: fetchHeaders };
    if (agent) opts.agent = agent;

    const response = await fetch(targetUrl, opts);

    if (!response.ok && response.status !== 206) {
      return res.status(response.status).send(`Provider returned ${response.status}`);
    }

    const forwardHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    for (const [key, value] of response.headers) {
      if (forwardHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }
    if (destination) res.setHeader('X-Final-Destination', response.url || targetUrl);
    res.status(response.status);

    const contentType = response.headers.get('content-type') || '';

    // Detect HLS by peeking at first bytes of body
    const reader = response.body.getReader();
    const first = await reader.read();
    if (first.done) { res.end(); return; }

    const firstHead = Buffer.from(first.value).toString('utf8', 0, Math.min(first.value.length, 30));

    if (firstHead.startsWith('#EXTM3U') && targetUrl) {
      const allChunks = [first.value];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        allChunks.push(value);
      }
      const bodyText = Buffer.concat(allChunks).toString('utf8');
      try {
        const baseUrl = new URL(targetUrl);
        const rewritten = rewriteHlsPlaylist(bodyText, baseUrl, targetHeaders, req.headers.host);
        res.setHeader('Content-Type', contentType || 'application/vnd.apple.mpegurl');
        res.setHeader('Content-Length', Buffer.byteLength(rewritten));
        res.end(rewritten);
      } catch (e) {
        console.error('HLS rewrite error:', e.message);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', Buffer.byteLength(bodyText));
        res.end(bodyText);
      }
    } else {
      // Stream the response through — only block if non-video content (for media streaming contexts)
      const ct = contentType.toLowerCase();
      if (ct.includes('json')) {
        // JSON content should always pass through (needed for CORS proxy use cases)
        const allChunks = [first.value];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          allChunks.push(value);
        }
        const body = Buffer.concat(allChunks);
        res.setHeader('Content-Type', ct);
        res.setHeader('Content-Length', body.length);
        res.end(body);
        return;
      }
      if (ct.includes('html')) {
        const allChunks = [first.value];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          allChunks.push(value);
        }
        const body = Buffer.concat(allChunks);
        // Check for mislabeled video (CDNs serve TS/MP4 with text/html Content-Type)
        const firstBytes = body.slice(0, 16);
        const isMpegTs = firstBytes.length > 0 && firstBytes[0] === 0x47;
        const isMp4 = firstBytes.slice(4, 8).toString() === 'ftyp' || firstBytes.slice(0, 4).toString() === 'ftyp';
        const isWebm = firstBytes.slice(0, 4).toString() === '\x1a\x45\xdf\xa3';
        if (isMpegTs || isMp4 || isWebm) {
          const mime = isMpegTs ? 'video/mp2t' : isMp4 ? 'video/mp4' : 'video/webm';
          res.setHeader('Content-Type', mime);
          res.setHeader('Content-Length', body.length);
          res.end(body);
          return;
        }
        // Check if it's actual HTML page content (not mislabeled binary)
        const textStart = body.toString('utf8', 0, Math.min(body.length, 100)).trim();
        if (textStart.startsWith('<!') || textStart.startsWith('<html') || textStart.startsWith('<?xml')) {
          const preview = body.toString('utf8', 0, Math.min(body.length, 300));
          console.error(`Proxy: non-video content "${ct}" for ${targetUrl}: ${preview}`);
          if (!res.headersSent) res.status(502).send(`Bad content type: ${ct}`);
          return;
        }
        // Not actual HTML — likely mislabeled binary, pass through
        res.setHeader('Content-Type', ct);
        res.setHeader('Content-Length', body.length);
        res.end(body);
        return;
      }
    // Pass through all other content types (video, image, octet-stream, etc.)
    const nodeStream = bodyStreamFromReader(reader, first.value);
    req.on('close', () => nodeStream.destroy());
    nodeStream.pipe(res);
    }
  } catch (e) {
    console.error('Proxy error:', e.message);
    if (!res.headersSent) {
      if (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED') {
        res.status(502).send('Provider unreachable');
      } else if (e.name === 'AbortError') {
        res.status(504).send('Proxy timeout');
      } else {
        res.status(502).send('Proxy error');
      }
    }
  }
});

// Resolve a known catalogue variant (language-dubbed stream)
app.get('/api/resolve-variant', async (req, res) => {
  let { provider: providerId, id, type = 'movie', season, episode } = req.query;
  if (type === 'show') type = 'tv';
  if (!providerId || !id) return res.status(400).json({ error: 'Missing provider or id' });

  const mod = providers[providerId];
  if (!mod || typeof mod.resolveVariant !== 'function') {
    return res.status(400).json({ error: 'Provider does not support variant resolution' });
  }

  try {
    const result = await mod.resolveVariant(id, type, season || null, episode || null);
    if (!result) return res.status(404).json({ error: 'No stream found for variant' });

    if (!result.type) {
      if (result.url.includes('.m3u8')) result.type = 'm3u8';
      else if (result.url.includes('.mpd')) result.type = 'mpd';
      else if (result.url.includes('.ts')) result.type = 'ts';
      else if (result.url.includes('.mp4')) result.type = 'mp4';
      else if (result.url.includes('.mkv')) result.type = 'mkv';
      else result.type = 'mp4';
    }

    const storeId = generateStreamId();
    streamStore.set(storeId, {
      ts: Date.now(),
      url: result.url,
      headers: result.headers || {},
      type: result.type,
    });
    result.proxyUrl = `/proxy?id=${storeId}`;

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/variants/zh', async (req, res) => {
  let { tmdbId, type = 'movie', title } = req.query;
  if (!tmdbId) return res.status(400).json({ error: 'Missing tmdbId' });

  const mod = providers['iyf'];
  if (!mod || typeof mod.resolveVariant !== 'function') {
    return res.status(400).json({ error: 'iyf.tv provider not loaded' });
  }

  try {
    const result = await mod.resolveVariant(tmdbId, type, null, null);
    if (!result) return res.json({ variants: [] });

    const storeId = generateStreamId();
    streamStore.set(storeId, {
      ts: Date.now(),
      url: result.url,
      headers: result.headers || {},
      type: result.type || 'm3u8',
    });

    res.json({
      variants: [{
        language: 'chinese',
        label: 'Chinese',
        id: tmdbId,
        proxyUrl: `/proxy?id=${storeId}`,
      }],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Language variant endpoints for scrapers not exposed via search
app.get('/api/variants/fss', async (req, res) => {
  let { tmdbId, type = 'movie', title } = req.query;
  if (!tmdbId || !title) return res.status(400).json({ error: 'Missing tmdbId or title' });

  const mod = providers['fss'];
  if (!mod || typeof mod.resolveVariant !== 'function') {
    return res.status(400).json({ error: 'FSS provider not loaded' });
  }

  const langKeys = ['default', 'vff', 'vfq', 'vostfr'];
  const langLabels = { default: 'French 1', vff: 'French 2', vfq: 'French 3', vostfr: 'French 4' };

  try {
    const variants = [];
    for (const langKey of langKeys) {
      const result = await mod.resolveVariant(`${tmdbId}:${langKey}`, type, null, null);
      if (result) {
        const storeId = generateStreamId();
        streamStore.set(storeId, {
          ts: Date.now(),
          url: result.url,
          headers: result.headers || {},
          type: result.type || 'm3u8',
        });
        variants.push({
          language: 'french',
          label: langLabels[langKey] || langKey,
          id: `${tmdbId}:${langKey}`,
          proxyUrl: `/proxy?id=${storeId}`,
        });
      }
    }
    res.json({ variants });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/variants/de', async (req, res) => {
  let { tmdbId, type = 'movie', title } = req.query;
  if (!tmdbId) return res.status(400).json({ error: 'Missing tmdbId' });

  const mod = providers['streamkiste'];
  if (!mod || typeof mod.resolveVariant !== 'function') {
    return res.status(400).json({ error: 'StreamKiste provider not loaded' });
  }

  try {
    const result = await mod.resolveVariant(tmdbId, type, null, null);
    if (!result) return res.json({ variants: [] });

    const storeId = generateStreamId();
    streamStore.set(storeId, {
      ts: Date.now(),
      url: result.url,
      headers: result.headers || {},
      type: result.type || 'mp4',
    });

    res.json({
      variants: [{
        language: 'german',
        label: 'German',
        id: tmdbId,
        proxyUrl: `/proxy?id=${storeId}`,
      }],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Analytics Routes ============

app.post('/api/analytics/event', analytics.handleEvent);
app.get('/api/analytics/stats', analytics.handleStats);
app.get('/api/analytics/events', analytics.handleEventsList);
app.get('/api/analytics/realtime', analytics.handleRealtime);

// Health endpoint - for uptime monitoring & prevents false Hub Error from marking healthy hub as down
app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    memory: { rss: Math.round(mem.rss / 1024 / 1024) + 'MB', heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB' },
    providers: Object.keys(providers).length,
    streamStoreSize: streamStore.size,
    timestamp: Date.now(),
  });
});
app.get('/api/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    memory: { rss: Math.round(mem.rss / 1024 / 1024) + 'MB', heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB' },
    providers: Object.keys(providers).length,
    streamStoreSize: streamStore.size,
    timestamp: Date.now(),
  });
});

// Documentation page
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

// SPA fallback - serve index.html for non-matching routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/proxy') || req.path.startsWith('/docs') || req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/metadata') || req.path.startsWith('/scrape') || req.path.startsWith('/health')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'), err => { if (err) next(); });
});

// Prevent unhandled rejections from crashing hub (common cause of Hub Error requiring restart)
process.on('unhandledRejection', (reason) => {
  console.error('[hub] unhandledRejection:', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[hub] uncaughtException:', err.message, err.stack);
});

async function start() {
  await loadProviders();
  initProviderConfig();
  analytics.init();
  const port = PORT || config.port;
  console.log(`Loaded ${Object.keys(providers).length} providers`);

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: '/ws' });
  setupWebSocket(wss);
  console.log('  WebSocket: /ws');

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
    console.log(`  Proxy: /proxy  |  Docs: /docs`);
    const os = require('os');
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`  Network: http://${net.address}:${port}`);
        }
      }
    }
  });
}

start().catch(console.error);
