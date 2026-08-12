"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../../../tmp/vidsuper-source/lib/scraper/index.ts
var index_exports = {};
__export(index_exports, {
  activeSources: () => activeSources,
  getSource: () => getSource,
  sourceList: () => sourceList
});
module.exports = __toCommonJS(index_exports);

// ../../../../tmp/vidsuper-source/lib/scraper/oneroom.ts
var MAIN_URL = "https://themoviebox.org";
var API_BASE = "https://h5-api.aoneroom.com";
var REFERER = "https://themoviebox.org/";
var TMDB_KEY = process.env.TMDB_API_KEY || "";
var bearerToken = null;
function clientTimeToken() {
  const crypto5 = require("crypto");
  const ts = Math.floor(Date.now() / 1e3);
  const rev = ts.toString().split("").reverse().join("");
  const md5 = crypto5.createHash("md5").update(rev).digest("hex");
  return `${ts},${md5}`;
}
function baseHeaders() {
  return {
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "X-Client-Info": JSON.stringify({ timezone: "Asia/Jakarta" }),
    "Content-Type": "application/json"
  };
}
async function getBearerToken() {
  if (bearerToken) return bearerToken;
  try {
    const resp = await fetch(
      `${API_BASE}/wefeed-h5api-bff/home?host=themoviebox.org`,
      {
        headers: {
          ...baseHeaders(),
          Authorization: "",
          "X-Request-Lang": "en",
          "X-Client-Token": clientTimeToken(),
          Referer: `${MAIN_URL}/`
        }
      }
    );
    const xUser = resp.headers.get("x-user");
    if (xUser) {
      const userData = JSON.parse(xUser);
      if (userData.token) {
        bearerToken = userData.token;
        return bearerToken;
      }
    }
  } catch {
  }
  return "";
}
async function fetchSources(tmdbId, season = 0, episode = 0) {
  const isTv = season > 0;
  const mediaType = isTv ? "tv" : "movie";
  const tmdbResp = await fetch(
    `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`
  );
  const tmdbData = await tmdbResp.json();
  const title = tmdbData.title || tmdbData.name;
  if (!title) return null;
  const token = await getBearerToken();
  const searchResp = await fetch(
    `${API_BASE}/wefeed-h5api-bff/subject/search`,
    {
      method: "POST",
      headers: {
        ...baseHeaders(),
        Authorization: token ? `Bearer ${token}` : "",
        "X-Request-Lang": "en",
        "X-Client-Token": clientTimeToken(),
        Referer: `${MAIN_URL}/`
      },
      body: JSON.stringify({ keyword: title, page: 1, perPage: 28, subjectType: 0 })
    }
  );
  const searchData = await searchResp.json();
  const items = searchData?.data?.items || [];
  const targetType = isTv ? [2, 3] : [1];
  const match = items.find(
    (item) => targetType.includes(parseInt(item.subjectType)) && item.title.toLowerCase().includes(title.toLowerCase())
  );
  if (!match) return null;
  const detailPath = match.detailPath;
  const playResp = await fetch(
    `${API_BASE}/wefeed-h5api-bff/subject/play?subjectId=${match.subjectId}&se=${season}&ep=${episode}&detailPath=${detailPath}`,
    {
      headers: {
        ...baseHeaders(),
        "X-Request-Lang": "en",
        "X-Client-Token": clientTimeToken(),
        Referer: `${MAIN_URL}/movies/${detailPath}`
      }
    }
  );
  const playData = await playResp.json();
  if (!playData?.data?.hasResource) return null;
  const streams = [
    ...playData.data.streams || [],
    ...playData.data.hls || [],
    ...playData.data.dash || []
  ];
  return streams.filter((s) => s.url?.startsWith("http")).map((item) => {
    const res = item.resolutions || "720";
    const url = item.url;
    return {
      url,
      // raw upstream URL — proxied through /api/stream below
      label: res.toString().replace("p", ""),
      type: url.includes(".m3u8") ? "hls" : url.includes(".mpd") ? "dash" : "mp4"
    };
  }).sort((a, b) => parseInt(b.label) - parseInt(a.label));
}
var oneroom = {
  id: "oneroom",
  name: "Sunny",
  label: "Multi-quality",
  active: true,
  rank: 1,
  async fetch(ctx) {
    const raw = await fetchSources(ctx.tmdbId, ctx.season, ctx.episode).catch(
      () => null
    );
    if (!raw || !raw.length) return null;
    const streams = raw.map((s) => ({
      file: ctx.proxyStream(s.url, REFERER),
      label: s.label,
      type: s.type
    }));
    return { streams };
  }
};

// ../../../../tmp/vidsuper-source/lib/scraper/insertunit.ts
var HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "accept-language": "en-GB,en;q=0.9",
  "cache-control": "max-age=0",
  "sec-ch-ua": '"Chromium";v="148", "Brave";v="148", "Not/A)Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1"
};
var INSERTUNIT_REFERER = "https://api.insertunit.ws/";
function safeJsonLoad(s) {
  try {
    return JSON.parse(s);
  } catch {
    const clean = s.replace(/,\s*}/g, "}").replace(/,\s*\]/g, "]");
    try {
      return JSON.parse(clean);
    } catch {
      return null;
    }
  }
}
var InsertunitScraper = class {
  constructor() {
    this.tmdbKey = process.env.TMDB_API_KEY || "";
  }
  async getImdbId(tmdbId, isTv) {
    const mt = isTv ? "tv" : "movie";
    try {
      const r = await fetch(
        `https://api.themoviedb.org/3/${mt}/${tmdbId}/external_ids?api_key=${this.tmdbKey}`
      );
      if (!r.ok) return null;
      const d = await r.json();
      return d.imdb_id || null;
    } catch {
      return null;
    }
  }
  // Finds the dynamic token suffix appended to media URLs to bypass 403s.
  extractDynamicToken(html) {
    const varMatch = html.match(
      /o\[k\]\s*\+=\s*'&'\s*\+\s*([a-zA-Z0-9_]+);/
    );
    if (!varMatch) return "";
    const name = varMatch[1];
    const valMatch = html.match(
      new RegExp(`${name}\\s*=\\s*"([^"]+)"`)
    );
    if (!valMatch) return "";
    return `&${valMatch[1]}`;
  }
  async fetchSources(tmdbId, season = 0, episode = 0) {
    const isTv = !!(season && episode);
    const imdb = await this.getImdbId(tmdbId, isTv);
    if (!imdb) return null;
    let html;
    try {
      const r = await fetch(`https://api.insertunit.ws/embed/imdb/${imdb}`, {
        headers: HEADERS,
        cache: "no-store"
        // fresh tokens each resolve
      });
      if (!r.ok) return null;
      html = await r.text();
    } catch {
      return null;
    }
    return isTv ? this.parseTv(html, season, episode) : this.parseMovie(html);
  }
  parseMovie(html) {
    const m = html.match(/source:\s*({[\s\S]*?})/);
    if (!m) return null;
    const src = m[1];
    const tok = this.extractDynamicToken(html);
    const dash = src.match(/dash:\s*"(.*?)"/);
    const dasha = src.match(/dasha:\s*"(.*?)"/);
    const hls = src.match(/hls:\s*"(.*?)"/);
    const audio = src.match(/audio:\s*({[\s\S]*?})/);
    const cc = src.match(/cc:\s*(\[[\s\S]*?\])/);
    return {
      dash: dash ? dash[1] + tok : null,
      dasha: dasha ? dasha[1] + tok : null,
      hls: hls ? hls[1] + tok : null,
      audio: audio ? safeJsonLoad(audio[1]) : null,
      cc: cc ? safeJsonLoad(cc[1]) : null
    };
  }
  parseTv(html, season, episode) {
    const seasonRe = new RegExp(
      `"season":\\s*${season}\\s*,\\s*"blocked"[\\s\\S]*?(?="season":\\s*\\d+\\s*,|$)`
    );
    const sm = html.match(seasonRe);
    if (!sm) return null;
    const seasonHtml = sm[0];
    const epRe = new RegExp(
      `"episode":\\s*"${episode}"[\\s\\S]*?(?="episode":\\s*"\\d+"|$)`
    );
    const em = seasonHtml.match(epRe);
    if (!em) return null;
    const eh = em[0];
    const tok = this.extractDynamicToken(html);
    const dash = eh.match(/"dash":\s*"(.*?)"/);
    const dasha = eh.match(/"dasha":\s*"(.*?)"/);
    const hls = eh.match(/"hls":\s*"(.*?)"/);
    const audio = eh.match(/"audio":\s*({[\s\S]*?})/);
    const cc = eh.match(/"cc":\s*(\[[\s\S]*?\])/);
    return {
      dash: dash ? dash[1] + tok : null,
      dasha: dasha ? dasha[1] + tok : null,
      hls: hls ? hls[1] + tok : null,
      audio: audio ? safeJsonLoad(audio[1]) : null,
      cc: cc ? safeJsonLoad(cc[1]) : null
    };
  }
};
function guessLang(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("eng") || n.includes("english")) return "en";
  if (n.includes("\u0440\u0443\u0441") || n.includes("rus")) return "ru";
  if (n.includes("\u0443\u043A\u0440") || n.includes("ukr")) return "uk";
  if (n.includes("span") || n.includes("esp")) return "es";
  if (n.includes("fr")) return "fr";
  if (n.includes("de") || n.includes("ger")) return "de";
  return "";
}
var _insertunit = new InsertunitScraper();
var insertunit = {
  id: "insertunit",
  name: "Ari",
  label: "Multi-audio \xB7 built-in subs",
  active: true,
  rank: 2,
  async fetch(ctx) {
    const r = await _insertunit.fetchSources(ctx.tmdbId, ctx.season, ctx.episode).catch(() => null);
    if (!r) return null;
    const ref = INSERTUNIT_REFERER;
    const streams = [];
    if (r.dash) {
      streams.push({
        file: ctx.proxyStream(r.dash, ref),
        label: "auto",
        type: "dash"
      });
    } else if (r.hls) {
      streams.push({
        file: ctx.proxyStream(r.hls, ref),
        label: "auto",
        type: "hls"
      });
    }
    if (!streams.length) return null;
    const subtitles = (r.cc || []).map((c) => ({
      url: ctx.proxySub(c.url, ref),
      display: c.name,
      language: guessLang(c.name),
      source: "Ari"
    }));
    return { streams, subtitles };
  }
};

// ../../../../tmp/vidsuper-source/lib/scraper/flixhq.ts
var import_crypto = __toESM(require("crypto"));
var MAIN_URL2 = "https://flixhq.one";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
function decodeB64Url(s) {
  return Buffer.from(s, "base64url");
}
function encodeB64Url(b) {
  return b.toString("base64url");
}
var BE = 512;
var LT = 511;
var DR = 2;
var LR = 2654435761;
var HR = 2246822519;
function yeFast(t) {
  t[0] = t[0] + t[1] >>> 0;
  let x = (t[3] ^ t[0]) >>> 0;
  t[3] = (x << 16 | x >>> 16) >>> 0;
  t[2] = t[2] + t[3] >>> 0;
  x = (t[1] ^ t[2]) >>> 0;
  t[1] = (x << 12 | x >>> 20) >>> 0;
  t[0] = t[0] + t[1] >>> 0;
  x = (t[3] ^ t[0]) >>> 0;
  t[3] = (x << 8 | x >>> 24) >>> 0;
  t[2] = t[2] + t[3] >>> 0;
  x = (t[1] ^ t[2]) >>> 0;
  t[1] = (x << 7 | x >>> 25) >>> 0;
}
function gr(input) {
  const e = [1779033703, 3144134277, 1013904242, 2773480762];
  for (const b of input) {
    e[0] = e[0] + b >>> 0;
    e[0] = (e[0] << 7 | e[0] >>> 25) >>> 0;
    yeFast(e);
  }
  for (let i = 0; i < 8; i++) yeFast(e);
  const r = new Array(BE);
  for (let i = 0; i < BE; i++) {
    yeFast(e);
    r[i] = (e[0] ^ e[2]) >>> 0;
  }
  for (let d = 0; d < DR; d++) {
    for (let s = 0; s < BE; s++) {
      const a = r[s] & LT;
      let c = r[s] + r[a] >>> 0;
      c = (c << 13 | c >>> 19) >>> 0;
      c = (c ^ Math.imul(r[s + 1 & LT], LR) >>> 0) >>> 0;
      r[s] = c;
      e[0] = (e[0] ^ c) >>> 0;
      yeFast(e);
    }
  }
  const n = new Array(8);
  const o = BE / 8;
  for (let i = 0; i < 8; i++) {
    yeFast(e);
    let sVal = e[0] >>> 0;
    const a = i * o;
    for (let c = 0; c < o; c++) {
      const d = r[a + c];
      sVal = sVal + d >>> 0;
      sVal = (sVal << 5 | sVal >>> 27) >>> 0;
      sVal = (sVal ^ Math.imul(d, HR) >>> 0) >>> 0;
    }
    n[i] = (sVal ^ e[2]) >>> 0;
  }
  return n;
}
function wr(t) {
  let eVal = 0;
  for (const n of t) {
    if (n === 0) eVal += 32;
    else return eVal + Math.clz32(n);
  }
  return eVal;
}
function jaro(a, b) {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const range = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const aMatch = new Array(la).fill(false);
  const bMatch = new Array(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - range);
    const end = Math.min(i + range + 1, lb);
    for (let j = start; j < end; j++) {
      if (bMatch[j] || a[i] !== b[j]) continue;
      aMatch[i] = true;
      bMatch[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!aMatch[i]) continue;
    while (!bMatch[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;
  return (matches / la + matches / lb + (matches - t) / matches) / 3;
}
function jaroWinkler(a, b) {
  const j = jaro(a, b);
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return j + prefix * 0.1 * (1 - j);
}
function guessLang2(label) {
  const n = (label || "").toLowerCase();
  if (n.includes("english")) return "en";
  if (n.includes("spanish") || n.includes("espa\xF1ol")) return "es";
  if (n.includes("french") || n.includes("fran\xE7ais")) return "fr";
  if (n.includes("german") || n.includes("deutsch")) return "de";
  if (n.includes("portuguese") || n.includes("portugu\xEAs")) return "pt";
  if (n.includes("italian")) return "it";
  if (n.includes("arabic")) return "ar";
  if (n.includes("russian")) return "ru";
  if (n.includes("japanese")) return "ja";
  if (n.includes("korean")) return "ko";
  if (n.includes("chinese") || n.includes("mandarin")) return "zh";
  if (n.includes("hindi")) return "hi";
  return "";
}
var FlixHqScraper = class {
  constructor() {
    this.tmdbKey = process.env.TMDB_API_KEY || "";
  }
  async fetchSources(tmdbId, season = 0, episode = 0) {
    try {
      const mediaType = season > 0 && episode > 0 ? "tv" : "movie";
      const tmdb = await this.fetchTmdbInfo(tmdbId, mediaType, season, episode);
      const results = await this.search(tmdb.title);
      const scored = this.scoreResults(tmdb, results);
      if (!scored.length) return null;
      let watchUrl = scored[0].link;
      if (mediaType === "tv") {
        const ep = await this.extractEpisodeLink(watchUrl, season, episode);
        if (!ep) return null;
        watchUrl = ep;
      }
      const servers = await this.getServers(watchUrl, mediaType === "tv");
      let embed = null;
      for (const srv of servers) {
        const name = String(srv?.name || "").toLowerCase();
        if (!name.includes("videasy") && !name.includes("vidking")) {
          embed = srv?.link || null;
          if (embed) break;
        }
      }
      if (!embed) return null;
      return await this.extractRabbitstream(embed);
    } catch (e) {
      console.error("FlixHqScraper Error:", e?.message || e);
      return null;
    }
  }
  // ---- internals -------------------------------------------------------
  async httpGet(url, init) {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(url, {
          ...init,
          headers: { "User-Agent": UA, ...init?.headers || {} }
        });
        if (r.ok) return await r.text();
      } catch {
      }
      await new Promise((res) => setTimeout(res, 500));
    }
    throw new Error(`Failed to fetch ${url}`);
  }
  async fetchTmdbInfo(tmdbId, mediaType, season, episode) {
    const r = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${this.tmdbKey}&language=en-US`
    );
    if (!r.ok) throw new Error("Failed to fetch data from TMDB.");
    const d = await r.json();
    const title = d.title || d.name || "";
    const dateStr = d.release_date || d.first_air_date || "";
    const year = dateStr.length >= 4 ? parseInt(dateStr.slice(0, 4), 10) : null;
    const runtime = mediaType === "movie" ? d.runtime ?? null : Array.isArray(d.episode_run_time) ? d.episode_run_time[0] ?? null : null;
    return { title, mediaType, year, runtime, season, episode };
  }
  async search(query) {
    const html = await this.httpGet(
      `${MAIN_URL2}/search?keyword=${encodeURIComponent(query)}`
    );
    const results = [];
    const chunks = html.split("flw-item");
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      const nameMatch = chunk.match(
        /class="film-name"[^>]*>\s*<a\s+href="([^"]+)"[^>]*title="([^"]*)"/
      );
      if (!nameMatch) continue;
      let link = nameMatch[1];
      const title = decodeEntities(nameMatch[2]).trim();
      if (!link.startsWith("http")) link = `${MAIN_URL2}${link}`;
      let year = 0;
      let runtime = 0;
      const infoRe = /class="fdi-item[^"]*"[^>]*>\s*([^<]+?)\s*</g;
      let m;
      while (m = infoRe.exec(chunk)) {
        const txt = m[1].trim();
        if (/^\d{4}$/.test(txt)) year = parseInt(txt, 10);
        else if (/^\d+m$/.test(txt)) runtime = parseInt(txt.slice(0, -1), 10);
      }
      const typeMatch = chunk.match(/class="fdi-type"[^>]*>\s*([^<]+?)\s*</);
      const mediaType = typeMatch ? typeMatch[1].trim().toLowerCase() : "movie";
      results.push({ title, link, year, runtime, mediaType });
    }
    return results;
  }
  scoreResults(tmdb, results) {
    const dur = tmdb.runtime || 0;
    const scored = [];
    results.forEach((res, idx) => {
      if (tmdb.mediaType === "movie" && dur > 0 && res.runtime > 0 && Math.abs(dur - res.runtime) > 60) {
        return;
      }
      let score = jaroWinkler(tmdb.title.toLowerCase(), res.title.toLowerCase()) * 2e3;
      if (tmdb.mediaType === res.mediaType) score += 500;
      score += 100 - Math.min(idx, 50);
      if (tmdb.year && res.year > 0) {
        if (tmdb.year === res.year) score += 800;
        else if (Math.abs(tmdb.year - res.year) <= 1) score += 300;
      }
      if (tmdb.mediaType === "movie" && dur > 0 && res.runtime > 0 && Math.abs(dur - res.runtime) <= 10) {
        score += 1e3;
      }
      scored.push({ score, res });
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.res);
  }
  async extractEpisodeLink(seriesUrl, season, episode) {
    const html = await this.httpGet(seriesUrl);
    const target = `s${String(season).padStart(2, "0")}-e${String(
      episode
    ).padStart(2, "0")}`;
    const re = /class="eps-item[^"]*"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*class="eps-item/g;
    let m;
    while (m = re.exec(html)) {
      const link = m[1] || m[2];
      if (link && link.includes(target)) {
        return link.startsWith("http") ? link : `${MAIN_URL2}${link}`;
      }
    }
    return null;
  }
  async getServers(watchUrl, isTv) {
    const html = await this.httpGet(watchUrl);
    let token = null;
    const sel = isTv ? "series-player" : "main-wrapper";
    const selMatch = html.match(
      new RegExp(`id="${sel}"[^>]*data-token="([^"]+)"`)
    );
    if (selMatch) token = selMatch[1];
    if (!token) {
      const generic = html.match(/data-token=["']([^"']+)["']/);
      if (generic) token = generic[1];
    }
    if (!token) throw new Error("No data-token found.");
    const body = new URLSearchParams();
    body.set(isTv ? "players_show" : "players", token);
    const r = await fetch(`${MAIN_URL2}/ajax/ajax.php`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "X-Requested-With": "XMLHttpRequest",
        Referer: watchUrl,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
    const data = await r.json();
    return Array.isArray(data) ? data : [data];
  }
  async extractRabbitstream(embedUrl) {
    const parsed = new URL(embedUrl);
    const baseApi = `${parsed.protocol}//${parsed.host}`;
    const idMatch = embedUrl.match(/\/e\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) throw new Error("No video id in embed url");
    const videoId = idMatch[1];
    const r1 = await fetch(`${baseApi}/api/videos/access/challenge`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Referer: embedUrl,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json"
      }
    });
    const j1 = await r1.json();
    const nonce = j1.nonce || "";
    const challengeId = j1.challenge_id || "";
    const { privateKey, publicKey } = import_crypto.default.generateKeyPairSync("ec", {
      namedCurve: "P-256"
    });
    const sigB64 = encodeB64Url(
      import_crypto.default.sign("sha256", Buffer.from(nonce), privateKey)
    );
    const pubJwk = publicKey.export({ format: "jwk" });
    const jwk = {
      crv: "P-256",
      ext: true,
      key_ops: ["verify"],
      kty: "EC",
      x: pubJwk.x,
      y: pubJwk.y
    };
    const ua = UA;
    const clientPayload = {
      user_agent: ua,
      architecture: "x86",
      bitness: "64",
      platform: "Windows",
      platform_version: "10.0.0",
      model: "",
      ua_full_version: "124.0.0.0",
      brand_full_versions: [{ brand: "Chromium", version: "124.0.0.0" }],
      pixel_ratio: 1,
      screen_width: 1920,
      screen_height: 1080,
      color_depth: 24,
      languages: ["en-US"],
      timezone: "UTC",
      hardware_concurrency: 8,
      device_memory: 8,
      touch_points: 0,
      webgl_vendor: "Google Inc. (Google)",
      webgl_renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      canvas_hash: "_xjcrc8La-Vnxpr6a6vNFOOdnRcHHQ0tzgT_V3atRqo",
      audio_hash: "RyBmlOc4cA7XhqmvkyO40eo8sOa5q-CFlrTnf70qADY",
      pointer_type: "fine,hover",
      extra: { vendor: "Google Inc." }
    };
    const vId = import_crypto.default.randomUUID().replace(/-/g, "");
    const dId = import_crypto.default.randomUUID().replace(/-/g, "");
    const r2 = await fetch(`${baseApi}/api/videos/access/attest`, {
      method: "POST",
      headers: {
        "User-Agent": ua,
        Referer: embedUrl,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        viewer_id: vId,
        device_id: dId,
        challenge_id: challengeId,
        nonce,
        signature: sigB64,
        public_key: jwk,
        client: clientPayload,
        storage: {},
        attributes: { entropy: "high" }
      })
    });
    const att = await r2.json();
    const token = att.token || "";
    const conf = att.confidence ?? 0;
    const avId = att.viewer_id || "";
    const adId = att.device_id || "";
    const sessionId = import_crypto.default.randomUUID().replace(/-/g, "");
    const capHeaders = {
      "User-Agent": ua,
      Origin: baseApi,
      Referer: embedUrl,
      "X-Requested-With": "XMLHttpRequest",
      "X-Playback-Session-Id": sessionId,
      "Content-Type": "application/json"
    };
    const rCap = await fetch(
      `${baseApi}/api/videos/${videoId}/embed/captcha`,
      {
        method: "POST",
        headers: capHeaders,
        body: JSON.stringify({
          fingerprint: {
            token,
            viewer_id: vId,
            device_id: dId,
            confidence: conf
          }
        })
      }
    );
    const cap = await rCap.json();
    let newToken = token;
    if (cap.pow_nonce && cap.pow_token) {
      const difficulty = cap.pow_difficulty ?? 2;
      let solution = 0;
      while (wr(gr(Buffer.from(`${cap.pow_nonce}:${solution}`))) < difficulty) {
        solution++;
      }
      const rVer = await fetch(
        `${baseApi}/api/videos/${videoId}/embed/captcha/verify`,
        {
          method: "POST",
          headers: capHeaders,
          body: JSON.stringify({
            pow_token: cap.pow_token,
            solution: String(solution),
            fingerprint: {
              token,
              viewer_id: avId,
              device_id: adId,
              confidence: conf
            }
          })
        }
      );
      const ver = await rVer.json();
      newToken = ver.token || token;
    }
    const pbHeaders = {
      "User-Agent": ua,
      Origin: baseApi,
      Referer: embedUrl,
      "X-Requested-With": "XMLHttpRequest",
      "X-Playback-Session-Id": sessionId,
      "Content-Type": "application/json"
    };
    if (newToken !== token) pbHeaders["X-Captcha-Token"] = newToken;
    const r3 = await fetch(
      `${baseApi}/api/videos/${videoId}/embed/playback`,
      {
        method: "POST",
        headers: pbHeaders,
        body: JSON.stringify({
          fingerprint: {
            token,
            viewer_id: avId,
            device_id: adId,
            confidence: conf
          }
        })
      }
    );
    const j3 = await r3.json();
    const playback = j3.playback;
    if (!playback) throw new Error("No playback in response");
    const kParts = playback.key_parts || [];
    const vStr = String(playback.version ?? "").trim();
    let keyBytes;
    if (/^\d+$/.test(vStr) && kParts.length) {
      const v = parseInt(vStr, 10);
      if (v >= 1 && v <= kParts.length && 31 - v >= 1 && 31 - v <= kParts.length) {
        keyBytes = Buffer.concat([
          decodeB64Url(kParts[v - 1]),
          decodeB64Url(kParts[31 - v - 1])
        ]);
      } else {
        keyBytes = Buffer.concat(kParts.map(decodeB64Url));
      }
    } else {
      keyBytes = Buffer.concat(kParts.map(decodeB64Url));
    }
    const iv = decodeB64Url(playback.iv || "");
    const payload = decodeB64Url(playback.payload || "");
    const tag = payload.subarray(payload.length - 16);
    const ciphertext = payload.subarray(0, payload.length - 16);
    const decipher = import_crypto.default.createDecipheriv("aes-256-gcm", keyBytes, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    const data = JSON.parse(decrypted.toString("utf-8"));
    const masterUrl = data?.sources?.[0]?.url;
    if (!masterUrl) throw new Error("No stream url in decrypted payload");
    const type = masterUrl.includes(".m3u8") ? "hls" : masterUrl.includes(".mpd") ? "dash" : "mp4";
    const subtitles = (data.tracks || []).filter((t) => t.kind === "captions" && t.file).map((t) => ({
      url: t.file,
      label: t.label || "",
      language: guessLang2(t.label || "")
    }));
    return {
      sources: [{ file: masterUrl, label: "auto", type }],
      subtitles,
      provider: "FlixHQ"
    };
  }
};
function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
var _flixhq = new FlixHqScraper();
var flixhq = {
  id: "flixhq",
  name: "Efe",
  label: "HLS \xB7 built-in subs",
  active: true,
  rank: 6,
  async fetch(ctx) {
    const r = await _flixhq.fetchSources(ctx.tmdbId, ctx.season, ctx.episode).catch(() => null);
    if (!r || !r.sources.length) return null;
    return {
      streams: r.sources,
      subtitles: r.subtitles.map((s) => ({
        url: s.url,
        display: s.label,
        language: s.language,
        source: "Efe"
      }))
    };
  }
};

// ../../../../tmp/vidsuper-source/lib/scraper/castle.ts
var import_crypto2 = __toESM(require("crypto"));
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var CASTLE_BASE = "https://api.hlowb.com";
var PKG = "com.external.castle";
var CHANNEL = "IndiaA";
var CLIENT = "1";
var LANG = "en-US";
var SUFFIX = "T!BgJB";
var APK_SIGN_KEY = "ED0955EB04E67A1D9F3305B95454FED485261475";
var WORKING_HEADERS = {
  "User-Agent": "okhttp/4.9.3",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "Keep-Alive",
  Referer: CASTLE_BASE
};
var QUALITY_MAP = { 1: "480p", 2: "720p", 3: "1080p" };
function safeJsonParse(text) {
  const safe = text.replace(/:(\s*)(-?\d{16,})(\s*[,}\]])/g, ':$1"$2"$3');
  return JSON.parse(safe);
}
var CastleScraper = class {
  constructor() {
    this.tmdbKey = process.env.CASTLE_TMDB_API_KEY || process.env.TMDB_API_KEY || "439c478a771f35c05022f9feabcca01c";
    this.securityKey = null;
  }
  // ---- AES-CBC (key derived from security key + suffix, key == IV) -------
  deriveKey(apiKeyB64) {
    const apiKeyBytes = Buffer.from(apiKeyB64, "base64");
    let keyMaterial = Buffer.concat([apiKeyBytes, Buffer.from(SUFFIX, "ascii")]);
    if (keyMaterial.length < 16) {
      keyMaterial = Buffer.concat([
        keyMaterial,
        Buffer.alloc(16 - keyMaterial.length)
      ]);
    } else if (keyMaterial.length > 16) {
      keyMaterial = keyMaterial.subarray(0, 16);
    }
    return keyMaterial;
  }
  decryptCastle(encryptedB64, securityKeyB64) {
    const aesKey = this.deriveKey(securityKeyB64);
    const iv = aesKey;
    const encrypted = Buffer.from(encryptedB64, "base64");
    const decipher = import_crypto2.default.createDecipheriv("aes-128-cbc", aesKey, iv);
    decipher.setAutoPadding(true);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString("utf-8");
  }
  // ---- HTTP -------------------------------------------------------------
  async request(url, init) {
    const r = await fetch(url, {
      ...init,
      headers: { ...WORKING_HEADERS, ...init?.headers || {} }
    });
    if (!r.ok) throw new Error(`Castle request failed ${r.status} for ${url}`);
    return r;
  }
  // Response is either {data: "<cipher>"} or a raw cipher string.
  async extractCipher(response) {
    const text = (await response.text()).trim();
    if (!text) throw new Error("Empty response");
    try {
      const j = JSON.parse(text);
      if (j && typeof j.data === "string") return j.data.trim();
    } catch {
    }
    return text;
  }
  async decryptedJson(response, securityKey) {
    const cipher = await this.extractCipher(response);
    return safeJsonParse(this.decryptCastle(cipher, securityKey));
  }
  // ---- Castle API -------------------------------------------------------
  async getSecurityKey() {
    if (this.securityKey) return this.securityKey;
    const url = `${CASTLE_BASE}/v0.1/system/getSecurityKey/1?channel=${CHANNEL}&clientType=${CLIENT}&lang=${LANG}`;
    const r = await this.request(url);
    const data = await r.json();
    if (data.code !== 200 || !data.data) {
      throw new Error(`Security key API error: ${JSON.stringify(data)}`);
    }
    this.securityKey = data.data;
    return this.securityKey;
  }
  async searchCastle(securityKey, keyword, page = 1, size = 30) {
    const params = new URLSearchParams({
      channel: CHANNEL,
      clientType: CLIENT,
      keyword,
      lang: LANG,
      mode: "1",
      packageName: PKG,
      page: String(page),
      size: String(size)
    });
    const url = `${CASTLE_BASE}/film-api/v1.1.0/movie/searchByKeyword?${params}`;
    return this.decryptedJson(await this.request(url), securityKey);
  }
  async getDetails(securityKey, movieId) {
    const url = `${CASTLE_BASE}/film-api/v1.1/movie?channel=${CHANNEL}&clientType=${CLIENT}&lang=${LANG}&movieId=${movieId}&packageName=${PKG}`;
    return this.decryptedJson(await this.request(url), securityKey);
  }
  async getVideo2(securityKey, movieId, episodeId, resolution = 2) {
    const url = `${CASTLE_BASE}/film-api/v2.0.1/movie/getVideo2?clientType=${CLIENT}&packageName=${PKG}&channel=${CHANNEL}&lang=${LANG}`;
    const body = {
      mode: "1",
      appMarket: "GuanWang",
      clientType: "1",
      woolUser: "false",
      apkSignKey: APK_SIGN_KEY,
      androidVersion: "13",
      movieId: String(movieId),
      episodeId: String(episodeId),
      isNewUser: "true",
      resolution: String(resolution),
      packageName: PKG
    };
    const r = await this.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return this.decryptedJson(r, securityKey);
  }
  async getVideoV1(securityKey, movieId, episodeId, languageId, resolution = 2) {
    const params = new URLSearchParams({
      apkSignKey: APK_SIGN_KEY,
      channel: CHANNEL,
      clientType: CLIENT,
      episodeId: String(episodeId),
      lang: LANG,
      languageId: String(languageId),
      mode: "1",
      movieId: String(movieId),
      packageName: PKG,
      resolution: String(resolution)
    });
    const url = `${CASTLE_BASE}/film-api/v1.9.1/movie/getVideo?${params}`;
    return this.decryptedJson(await this.request(url), securityKey);
  }
  // ---- helpers ----------------------------------------------------------
  extractDataBlock(obj) {
    if (obj && typeof obj.data === "object" && obj.data) return obj.data;
    return obj && typeof obj === "object" ? obj : {};
  }
  qualityValue(quality) {
    if (!quality) return 0;
    let q = String(quality).toLowerCase();
    q = q.replace(/^(sd|hd|fhd|uhd|4k)\s*/, "").replace(/p$/, "").trim();
    if (q === "4k" || q === "2160") return 2160;
    const known = [1440, 1080, 720, 480, 360, 240];
    const n = parseInt(q, 10);
    if (known.includes(n)) return n;
    return n > 0 ? n : 0;
  }
  formatSize(size) {
    if (typeof size === "number" && size > 0) {
      return size > 1e9 ? `${(size / 1e9).toFixed(2)} GB` : `${Math.round(size / 1e6)} MB`;
    }
    return "Unknown";
  }
  async getTmdbDetails(tmdbId, mediaType) {
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${this.tmdbKey}&append_to_response=external_ids`;
    const r = await this.request(url);
    const data = await r.json();
    const title = mediaType === "tv" ? data.name : data.title;
    const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
    const year = releaseDate ? parseInt(String(releaseDate).split("-")[0], 10) : null;
    return { title, year, tmdbId };
  }
  findMovieId(searchResult, tmdbInfo) {
    const data = this.extractDataBlock(searchResult);
    const rows = data.rows || [];
    if (!rows.length) throw new Error("No search results found");
    const searchTitle = (tmdbInfo.title || "").toLowerCase();
    for (const item of rows) {
      const itemTitle = String(item.title || item.name || "").toLowerCase();
      if (itemTitle && (itemTitle.includes(searchTitle) || searchTitle.includes(itemTitle))) {
        const id2 = item.id || item.redirectId || item.redirectIdStr;
        if (id2) return String(id2);
      }
    }
    const first = rows[0];
    const id = first.id || first.redirectId || first.redirectIdStr;
    if (id) return String(id);
    throw new Error("Could not extract movie ID from search results");
  }
  processVideoResponse(videoData, media, season, episode, resolution, languageInfo) {
    const streams = [];
    const data = this.extractDataBlock(videoData);
    const videoUrl = data.videoUrl;
    if (!videoUrl) return streams;
    let mediaTitle = media.title || "Unknown";
    if (media.year) mediaTitle += ` (${media.year})`;
    if (season && episode) {
      mediaTitle = `${media.title} S${String(season).padStart(2, "0")}E${String(
        episode
      ).padStart(2, "0")}`;
    }
    const quality = QUALITY_MAP[resolution] || `${resolution}p`;
    if (Array.isArray(data.videos)) {
      for (const video of data.videos) {
        let q = String(
          video.resolutionDescription || video.resolution || quality
        ).replace(/^(SD|HD|FHD)\s+/i, "");
        const name = languageInfo ? `Castle ${languageInfo} - ${q}` : `Castle - ${q}`;
        streams.push({
          name,
          title: mediaTitle,
          url: video.url || videoUrl,
          quality: q,
          size: this.formatSize(video.size),
          provider: "castle"
        });
      }
    } else {
      const name = languageInfo ? `Castle ${languageInfo} - ${quality}` : `Castle - ${quality}`;
      streams.push({
        name,
        title: mediaTitle,
        url: videoUrl,
        quality,
        size: this.formatSize(data.size),
        provider: "castle"
      });
    }
    return streams;
  }
  async fetchSources(tmdbId, season = 0, episode = 0) {
    const mediaType = season && episode ? "tv" : "movie";
    try {
      const tmdbInfo = await this.getTmdbDetails(tmdbId, mediaType);
      const securityKey = await this.getSecurityKey();
      const searchTerm = tmdbInfo.year ? `${tmdbInfo.title} ${tmdbInfo.year}` : tmdbInfo.title;
      const searchResult = await this.searchCastle(securityKey, searchTerm);
      let movieId = this.findMovieId(searchResult, tmdbInfo);
      let details = await this.getDetails(securityKey, movieId);
      if (mediaType === "tv") {
        const data2 = this.extractDataBlock(details);
        const seasons = data2.seasons || [];
        const s = seasons.find((x) => x.number === season);
        if (s && s.movieId && String(s.movieId) !== movieId) {
          movieId = String(s.movieId);
          details = await this.getDetails(securityKey, movieId);
        }
      }
      const data = this.extractDataBlock(details);
      const episodes = data.episodes || [];
      let episodeId = null;
      if (mediaType === "tv") {
        const ep = episodes.find((e) => e.number === episode);
        if (ep && ep.id) episodeId = String(ep.id);
      } else if (episodes.length) {
        episodeId = String(episodes[0].id);
      }
      if (!episodeId) throw new Error("Could not find episode ID");
      const epObj = episodes.find((e) => String(e.id) === episodeId);
      const tracks = epObj?.tracks || [];
      const resolution = 2;
      let allStreams = [];
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const langName = track.languageName || track.abbreviate || `Lang${i + 1}`;
        if (track.existIndividualVideo && track.languageId) {
          try {
            const videoData = await this.getVideoV1(
              securityKey,
              movieId,
              episodeId,
              String(track.languageId),
              resolution
            );
            const langStreams = this.processVideoResponse(
              videoData,
              tmdbInfo,
              season,
              episode,
              resolution,
              `[${langName}]`
            );
            allStreams.push(...langStreams);
          } catch (e) {
            console.error(`[Castle] ${langName}: v1 failed - ${e?.message || e}`);
          }
        }
      }
      if (!allStreams.length) {
        const videoData = await this.getVideo2(
          securityKey,
          movieId,
          episodeId,
          resolution
        );
        allStreams = this.processVideoResponse(
          videoData,
          tmdbInfo,
          season,
          episode,
          resolution,
          "[Shared]"
        );
      }
      allStreams.sort(
        (a, b) => this.qualityValue(b.quality) - this.qualityValue(a.quality)
      );
      return allStreams;
    } catch (e) {
      console.error(`[Castle] Error: ${e?.message || e}`);
      return [];
    }
  }
};
var _castle = new CastleScraper();
var castle = {
  id: "castle",
  name: "Steve",
  label: "HLS \xB7 multi-language",
  active: true,
  rank: 5,
  async fetch(ctx) {
    const streams = await _castle.fetchSources(ctx.tmdbId, ctx.season, ctx.episode).catch(() => []);
    if (!streams.length) return null;
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const s of streams) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      out.push({
        file: s.url,
        label: s.quality.replace(/p$/i, ""),
        type: s.url.includes(".m3u8") ? "hls" : s.url.includes(".mpd") ? "dash" : "mp4"
      });
    }
    return { streams: out };
  }
};

// ../../../../tmp/vidsuper-source/lib/scraper/cinesu.ts
var import_crypto3 = __toESM(require("crypto"));
var BASE_URL = "https://cine.su";
var FALLBACK_TOKEN = "4f069b6a3007";
var FALLBACK_SALT = "ac99adcd819fb92558bbc706dc13d74ed73971fc3619056e56a63a08d1496099";
var UA2 = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
var credsCache = null;
var CREDS_TTL = 6 * 60 * 60 * 1e3;
function credsFromJs(js) {
  if (!js.includes("/v1/s/")) return null;
  let token = null;
  const vm = js.match(/\/v1\/s\/\$\{(\w+)\}\/m\//);
  if (vm) {
    const t = js.match(new RegExp(`\\b${vm[1]}\\s*=\\s*["']([0-9a-f]{12})["']`));
    if (t) token = t[1];
  }
  if (!token) {
    const g = js.match(/["']([0-9a-f]{12})["']/);
    if (g) token = g[1];
  }
  const sm = js.match(/([0-9a-f]{64}):\$\{/);
  const salt = sm ? sm[1] : null;
  if (token && salt) return { token, salt };
  return null;
}
async function extractCreds() {
  const headers = { "User-Agent": UA2 };
  const page = await fetch(`${BASE_URL}/en/watch-movie/1339713`, {
    headers,
    cache: "no-store"
  });
  if (!page.ok) return null;
  const html = await page.text();
  const chunks = [
    ...new Set(
      [...html.matchAll(/\/_next\/static\/chunks\/[a-z0-9]+\.js/g)].map(
        (x) => x[0]
      )
    )
  ];
  const bodies = await Promise.all(
    chunks.map(
      (p) => fetch(`${BASE_URL}${p}`, { headers, cache: "no-store" }).then((r) => r.ok ? r.text() : null).catch(() => null)
    )
  );
  for (const js of bodies) {
    const c = js && credsFromJs(js);
    if (c) return c;
  }
  return null;
}
async function getApiCreds(force = false) {
  if (!force && credsCache && Date.now() - credsCache.at < CREDS_TTL) {
    return credsCache.creds;
  }
  const c = await extractCreds().catch(() => null);
  if (c) {
    credsCache = { creds: c, at: Date.now() };
    return c;
  }
  return credsCache?.creds ?? { token: FALLBACK_TOKEN, salt: FALLBACK_SALT };
}
function sha256(buf) {
  return import_crypto3.default.createHash("sha256").update(buf).digest();
}
function hs(text, salt) {
  return sha256(Buffer.concat([Buffer.from(`${salt}:`), Buffer.from(text, "utf-8")]));
}
function hr(text, length, salt) {
  const baseHash = hs(text, salt);
  const out = Buffer.alloc(length);
  let s = 0;
  let a = 0;
  while (s < length) {
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(a >>> 0, 0);
    const h = sha256(Buffer.concat([baseHash, counter]));
    const take = Math.min(h.length, length - s);
    h.copy(out, s, 0, take);
    s += h.length;
    a += 1;
  }
  return out;
}
function hi(data, tStr, salt) {
  const iStream = hr(tStr, data.length, salt);
  const rHash = hs(`mask:${tStr}`, salt);
  const rLen = rHash.length;
  const out = Buffer.alloc(data.length);
  for (let t = 0; t < data.length; t++) {
    const mask = 17 * t + rHash[t % rLen] & 255;
    let val = data[t] - mask & 255;
    val = (val ^ iStream[t]) & 255;
    out[t] = val;
  }
  return out;
}
async function cineSuVariants(tmdbId, season, episode) {
  const isMovie = !season || !episode;
  const mType = isMovie ? "movie" : "tv";
  const sVal = isMovie ? 0 : season;
  const eVal = isMovie ? 0 : episode;
  const payload = { m: mType, t: tmdbId, s: sVal, e: eVal };
  const blob = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const referer = `${BASE_URL}/en/watch-${mType}/${tmdbId}`;
  const tStr = `artifact:${payload.m}:${payload.t}:${payload.s}:${payload.e}`;
  const attempt = (apiToken) => fetch(`${BASE_URL}/v1/s/${apiToken}/m/${blob}`, {
    headers: {
      "User-Agent": UA2,
      accept: "application/octet-stream,*/*",
      "accept-language": "en-GB,en;q=0.5",
      Referer: referer
    },
    cache: "no-store"
  });
  let creds = await getApiCreds();
  let res = await attempt(creds.token);
  if (res.status === 404) {
    const fresh = await getApiCreds(true);
    if (fresh.token !== creds.token) {
      creds = fresh;
      res = await attempt(creds.token);
    }
  }
  if (!res.ok) return [];
  const encData = Buffer.from(await res.arrayBuffer());
  const decrypted = hi(encData, tStr, creds.salt);
  let data;
  try {
    data = JSON.parse(decrypted.toString("utf-8"));
  } catch {
    return [];
  }
  if (data.tag !== creds.token || !Array.isArray(data.variants)) return [];
  return data.variants.map((v) => ({
    label: cleanLabel(v.label),
    base: v.base || "",
    init: v.init || "",
    target: v.target || 6,
    segs: v.segs || []
  }));
}
function cleanLabel(label) {
  const s = String(label || "auto");
  const wxh = s.match(/\d+\s*[x×]\s*(\d+)/i);
  if (wxh) return wxh[1];
  return s.replace(/p$/i, "");
}
var cinesu = {
  id: "cinesu",
  name: "Alex",
  label: "HLS \xB7 reconstructed",
  active: true,
  rank: 3,
  async fetch(ctx) {
    const variants = await cineSuVariants(
      ctx.tmdbId,
      ctx.season,
      ctx.episode
    ).catch(() => []);
    if (!variants.length) return null;
    const qs = (v) => `m=${ctx.season && ctx.episode ? "tv" : "movie"}&t=${ctx.tmdbId}&s=${ctx.season || 0}&e=${ctx.episode || 0}&v=${v}`;
    const streams = variants.map((variant, i) => ({
      file: `${ctx.origin}/api/cinesu?${qs(i)}`,
      label: variant.label,
      type: "hls"
    }));
    streams.sort(
      (a, b) => (parseInt(b.label, 10) || 0) - (parseInt(a.label, 10) || 0)
    );
    return { streams };
  }
};

// ../../../../tmp/vidsuper-source/lib/scraper/vidnest.ts
var BASE_URL2 = "https://vidnest.fun";
var API_BASE2 = "https://new.vidnest.fun";
var HEADERS2 = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: `${BASE_URL2}/`,
  Origin: BASE_URL2
};
var VIDNEST_ALPHABET = "RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/";
var STANDARD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var TRANSLATE = /* @__PURE__ */ new Map();
for (let i = 0; i < VIDNEST_ALPHABET.length; i++) {
  TRANSLATE.set(VIDNEST_ALPHABET[i], STANDARD_ALPHABET[i]);
}
var SERVERS = [
  { path: "moviebox", name: "MovieBox", query: "" },
  { path: "allmovies", name: "AllMovies", query: "" },
  { path: "catflix", name: "CatFlix", query: "" },
  { path: "purstream", name: "PurStream", query: "", audio: "French" },
  { path: "hollymoviehd", name: "HollyMovieHD", query: "" },
  { path: "lamda", name: "Lamda", query: "" },
  { path: "flixhq", name: "FlixHQ", query: "" },
  { path: "vidlink", name: "VidLink", query: "" },
  { path: "onehd", name: "OneHD", query: "?server=upcloud" },
  { path: "klikxxi", name: "KlikXXI", query: "" },
  { path: "delta", name: "Delta", query: "" }
];
function decodePayload(payload) {
  let p = payload;
  const pad = p.length % 4;
  if (pad) p += "=".repeat(4 - pad);
  let std = "";
  for (const ch of p) std += TRANSLATE.get(ch) ?? ch;
  const json = Buffer.from(std, "base64").toString("utf-8");
  return JSON.parse(json);
}
function proxyUrl(url) {
  if (!url) return url;
  const data = encodeURIComponent(
    JSON.stringify({ url, headers: HEADERS2 })
  );
  return `https://omss.fstream.app/v1/proxy?data=${data}`;
}
function inferType(typeStr, url) {
  const t = String(typeStr || "").toLowerCase();
  const u = (url || "").toLowerCase();
  if (t === "hls" || u.includes(".m3u8")) return "hls";
  if (t === "dash" || u.includes(".mpd")) return "dash";
  if (u.includes(".mp4")) return "mp4";
  return "hls";
}
function mapServer(path, data) {
  const sources = [];
  const subtitles = [];
  try {
    if (path === "klikxxi") {
      for (const s of data.sources || [])
        sources.push({ url: s.url, type: inferType(s.type, s.url), quality: s.quality || "Auto", audio: "English" });
    } else if (path === "allmovies" || path === "delta") {
      for (const s of data.streams || [])
        sources.push({ url: s.url, type: inferType(s.type, s.url), quality: "Auto", audio: s.language || "Unknown" });
    } else if (path === "onehd") {
      if (data.url) sources.push({ url: data.url, type: inferType("", data.url), quality: "Auto", audio: "English" });
      for (const sub of data.subtitles || []) subtitles.push({ url: sub.url, lang: sub.lang });
    } else if (path === "hollymoviehd") {
      for (const s of data.sources || [])
        sources.push({ url: s.file, type: inferType(s.type, s.file), quality: s.label || "Auto", audio: "English" });
    } else if (path === "vidlink") {
      const stream = data?.data?.stream || {};
      if (stream.playlist)
        sources.push({ url: stream.playlist, type: inferType(stream.type, stream.playlist), quality: "Auto", audio: "English" });
      for (const cap of stream.captions || []) subtitles.push({ url: cap.url, lang: cap.language });
    } else if (path === "purstream") {
      for (const s of data.sources || [])
        sources.push({ url: s.url, type: inferType(s.format, s.url), quality: s.name || "Auto", audio: "French" });
    } else if (path === "moviebox") {
      for (const u of data.url || [])
        sources.push({ url: u.link, type: inferType(u.type, u.link), quality: "Auto", audio: u.lang || "Unknown" });
    } else if (path === "catflix" || path === "lamda" || path === "flixhq") {
      const list = data.sources || data.streams || [];
      for (const s of list)
        sources.push({
          url: s.url || s.file || s.link,
          type: inferType(s.type || s.format, s.url || s.file || s.link || ""),
          quality: s.quality || s.label || s.name || "Auto",
          audio: s.language || s.lang || "Unknown"
        });
    }
  } catch {
  }
  return { sources: sources.filter((s) => s.url), subtitles: subtitles.filter((s) => s.url) };
}
async function fetchProvider(def, ctx) {
  const isMovie = !ctx.season || !ctx.episode;
  const path = isMovie ? `${API_BASE2}/${def.path}/movie/${ctx.tmdbId}${def.query}` : `${API_BASE2}/${def.path}/tv/${ctx.tmdbId}/${ctx.season}/${ctx.episode}${def.query}`;
  try {
    const res = await fetch(path, {
      headers: HEADERS2,
      cache: "no-store",
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return { sources: [], subtitles: [] };
    const json = await res.json();
    if (!json?.data) return { sources: [], subtitles: [] };
    return mapServer(def.path, decodePayload(json.data));
  } catch {
    return { sources: [], subtitles: [] };
  }
}
function toResult(raw, label, serverName) {
  const streams = raw.sources.map((s, i) => ({
    file: proxyUrl(s.url),
    label: label(s, i),
    type: s.type,
    audio: s.audio || s.language || s.lang || ""
  }));
  const subtitles = raw.subtitles.map((s) => ({
    url: proxyUrl(s.url),
    display: s.lang || "Subtitle",
    language: (s.lang || "").slice(0, 2).toLowerCase(),
    source: serverName
  }));
  return { streams, subtitles };
}
function childLabel(s, i) {
  if (/\d{3,4}/.test(s.quality)) return s.quality.replace(/p$/i, "");
  if (s.audio && s.audio !== "Unknown") return s.audio;
  return s.quality && s.quality !== "Auto" ? s.quality : `Source ${i + 1}`;
}
var children = SERVERS.map((def) => ({
  id: def.path,
  name: def.name,
  async fetch(ctx) {
    const raw = await fetchProvider(def, ctx);
    if (!raw.sources.length) return null;
    return toResult(raw, childLabel, def.name);
  }
}));
var vidnest = {
  id: "vidnest",
  name: "Makena",
  label: "11 providers \xB7 auto-pick",
  active: true,
  rank: 4,
  children,
  // Parent: query every provider concurrently and aggregate. Each stream is
  // labelled by its provider so the quality menu doubles as a source picker.
  async fetch(ctx) {
    const results = await Promise.all(
      SERVERS.map(async (def) => {
        const raw = await fetchProvider(def, ctx);
        return raw.sources.length ? { def, raw } : null;
      })
    );
    const streams = [];
    const subtitles = [];
    for (const r of results) {
      if (!r) continue;
      const mapped = toResult(r.raw, () => r.def.name, r.def.name);
      streams.push(...mapped.streams);
      subtitles.push(...mapped.subtitles);
    }
    if (!streams.length) return null;
    return { streams, subtitles };
  }
};

// ../../../../tmp/vidsuper-source/lib/scraper/vidrock.ts
var import_crypto4 = __toESM(require("crypto"));
var BASE_URL3 = "https://vidrock.net/";
var SUB_BASE = "https://sub.vdrk.site";
var PROXY_PREFIX = "https://proxy.vidrock.store/";
var PASSPHRASE = "x7k9mPqT2rWvY8zA5bC3nF6hJ2lK4mN9";
var HEADERS3 = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: BASE_URL3,
  Origin: BASE_URL3.replace(/\/$/, "")
};
function encryptItemId(itemId) {
  const key = Buffer.from(PASSPHRASE, "utf-8");
  const iv = key.subarray(0, 16);
  const cipher = import_crypto4.default.createCipheriv("aes-256-cbc", key, iv);
  const enc = Buffer.concat([cipher.update(itemId, "utf-8"), cipher.final()]);
  return enc.toString("base64url");
}
function proxyUrl2(url) {
  if (!url) return url;
  const data = encodeURIComponent(JSON.stringify({ url, headers: HEADERS3 }));
  return `https://omss.fstream.app/v1/proxy?data=${data}`;
}
async function resolve(tmdbId, season, episode) {
  const isMovie = !season || !episode;
  const itemId = isMovie ? `${tmdbId}` : `${tmdbId}_${season}_${episode}`;
  const mediaType = isMovie ? "movie" : "tv";
  const apiUrl = `${BASE_URL3}api/${mediaType}/${encryptItemId(itemId)}`;
  const sources = [];
  const subs = await fetchSubs(tmdbId, season, episode);
  let data;
  try {
    const res = await fetch(apiUrl, {
      headers: HEADERS3,
      cache: "no-store",
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return { sources, subs };
    data = await res.json();
  } catch {
    return { sources, subs };
  }
  for (const stream of Object.values(data || {})) {
    if (!stream || typeof stream !== "object") continue;
    const streamUrl = stream.url;
    if (!streamUrl) continue;
    const audio = stream.language === "English" ? "eng" : stream.language || "Unknown";
    if (String(streamUrl).includes("hls2.vdrk.site")) {
      try {
        const cdnRes = await fetch(streamUrl, {
          headers: HEADERS3,
          cache: "no-store",
          signal: AbortSignal.timeout(8e3)
        });
        if (!cdnRes.ok) continue;
        const cdnData = await cdnRes.json();
        for (const obj of cdnData || []) {
          let finalUrl = obj.url || "";
          if (finalUrl.startsWith(PROXY_PREFIX)) {
            finalUrl = decodeURIComponent(
              finalUrl.slice(PROXY_PREFIX.length).replace(/^\/+/, "")
            );
          }
          if (!finalUrl) continue;
          sources.push({
            url: finalUrl,
            type: finalUrl.toLowerCase().includes(".mp4") ? "mp4" : "hls",
            quality: `${obj.resolution || "Unknown"}`,
            audio
          });
        }
      } catch {
        continue;
      }
    } else {
      sources.push({ url: streamUrl, type: "hls", quality: "1080", audio });
    }
  }
  return { sources, subs };
}
async function fetchSubs(tmdbId, season, episode) {
  const isMovie = !season || !episode;
  const url = isMovie ? `${SUB_BASE}/v2/movie/${tmdbId}` : `${SUB_BASE}/v2/tv/${tmdbId}/${season}/${episode}`;
  try {
    const res = await fetch(url, {
      headers: HEADERS3,
      cache: "no-store",
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : []).filter((s) => s.file && s.label).map((s) => ({ file: s.file, label: s.label }));
  } catch {
    return [];
  }
}
function langCode(label) {
  const map = {
    english: "en",
    arabic: "ar",
    bengali: "bn",
    filipino: "tl",
    french: "fr",
    indonesian: "id",
    malay: "ms",
    portuguese: "pt",
    russian: "ru",
    spanish: "es",
    german: "de",
    italian: "it",
    turkish: "tr",
    hindi: "hi",
    korean: "ko",
    japanese: "ja",
    chinese: "zh",
    dutch: "nl",
    polish: "pl",
    thai: "th",
    vietnamese: "vi"
  };
  return map[label.toLowerCase()] || label.slice(0, 2).toLowerCase();
}
var vidrock = {
  id: "vidrock",
  name: "Kai",
  label: "Multi-CDN \xB7 built-in subs",
  active: true,
  rank: 7,
  async fetch(ctx) {
    const { sources, subs } = await resolve(
      ctx.tmdbId,
      ctx.season,
      ctx.episode
    );
    if (!sources.length) return null;
    const streams = sources.map((s) => ({
      file: proxyUrl2(s.url),
      label: /^\d{3,4}$/.test(s.quality) ? s.quality : "auto",
      type: s.type
    }));
    streams.sort(
      (a, b) => (parseInt(b.label, 10) || 0) - (parseInt(a.label, 10) || 0)
    );
    const subtitles = subs.map((s) => ({
      url: ctx.proxySub(s.file),
      display: s.label,
      language: langCode(s.label),
      source: "Kai"
    }));
    return { streams, subtitles };
  }
};

// ../../../../tmp/vidsuper-source/lib/scraper/vixsrc.ts
var BASE_URL4 = "https://vixsrc.to";
var HEADERS4 = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: BASE_URL4,
  Origin: BASE_URL4
};
function isTokenExpired(expires) {
  const expiration = parseInt(expires, 10);
  if (!Number.isFinite(expiration)) return true;
  return expiration * 1e3 - 6e4 < Date.now();
}
function extractTokenData(html) {
  const token = html.match(/token["']\s*:\s*["']([^"']+)/)?.[1];
  const expires = html.match(/expires["']\s*:\s*["']([^"']+)/)?.[1];
  const playlist = html.match(/url\s*:\s*["']([^"']+)/)?.[1];
  if (!token || !expires || !playlist) return null;
  if (isTokenExpired(expires)) return null;
  return { token, expires, playlist };
}
function bestResolution(manifest) {
  let best = null;
  const re = /#EXT-X-STREAM-INF:[^\n]*RESOLUTION=\d+x(\d+)/g;
  let m;
  while (m = re.exec(manifest)) {
    const h = parseInt(m[1], 10);
    if (Number.isFinite(h) && (best === null || h > best)) best = h;
  }
  return best;
}
async function resolveMaster(tmdbId, season, episode) {
  const isMovie = !season || !episode;
  const apiUrl = isMovie ? `${BASE_URL4}/api/movie/${tmdbId}` : `${BASE_URL4}/api/tv/${tmdbId}/${season}/${episode}`;
  const get = (url, headers = HEADERS4) => fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(8e3)
  });
  const apiRes = await get(apiUrl);
  if (!apiRes.ok) return null;
  const apiData = await apiRes.json().catch(() => null);
  const sublink = apiData?.src;
  if (!sublink) return null;
  const embedUrl = BASE_URL4 + sublink;
  const htmlRes = await get(embedUrl);
  if (!htmlRes.ok) return null;
  const tokenData = extractTokenData(await htmlRes.text());
  if (!tokenData) return null;
  const sep = tokenData.playlist.includes("?") ? "&" : "?";
  const masterUrl = `${tokenData.playlist}${sep}token=${tokenData.token}&expires=${tokenData.expires}&h=1`;
  const playlistRes = await get(masterUrl, { ...HEADERS4, Referer: apiUrl });
  if (!playlistRes.ok) return null;
  const height = bestResolution(await playlistRes.text());
  if (height === null) return null;
  return { masterUrl, referer: apiUrl, height };
}
var vixsrc = {
  id: "vixsrc",
  name: "Noor",
  label: "HLS \xB7 proxied",
  active: true,
  rank: 8,
  async fetch(ctx) {
    const resolved = await resolveMaster(
      ctx.tmdbId,
      ctx.season,
      ctx.episode
    ).catch(() => null);
    if (!resolved) return null;
    const stream = {
      file: ctx.proxyStream(resolved.masterUrl, resolved.referer),
      label: resolved.height ? String(resolved.height) : "auto",
      type: "hls"
    };
    return { streams: [stream] };
  }
};

// ../../../../tmp/vidsuper-source/lib/scraper/index.ts
var REGISTERED = [
  oneroom,
  insertunit,
  flixhq,
  castle,
  cinesu,
  vidnest,
  vidrock,
  vixsrc
];
function nameFor(id, fallback) {
  return process.env[`SOURCE_${id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_NAME`] || fallback;
}
var byRank = (a, b) => (a.rank ?? 100) - (b.rank ?? 100);
function activeSources() {
  return REGISTERED.filter((s) => s.active).sort(byRank);
}
function getSource(id) {
  const wanted = id || activeSources()[0]?.id;
  if (!wanted) return void 0;
  const [parentId, childId] = wanted.split(":");
  const parent = REGISTERED.find((s) => s.id === parentId && s.active);
  if (!parent) return void 0;
  if (!childId) {
    return { ...parent, name: nameFor(parent.id, parent.name) };
  }
  const child = parent.children?.find((c) => c.id === childId);
  if (!child) return void 0;
  return {
    id: wanted,
    name: `${nameFor(parent.id, parent.name)} \xB7 ${child.name}`,
    label: parent.label,
    active: true,
    fetch: child.fetch
  };
}
function sourceList() {
  return activeSources().map((s) => ({
    id: s.id,
    name: nameFor(s.id, s.name),
    label: s.label,
    children: s.children?.map((c) => ({ id: c.id, name: c.name }))
  }));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activeSources,
  getSource,
  sourceList
});
