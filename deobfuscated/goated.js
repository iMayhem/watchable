"use strict";

/**
 * Goated / ReallyFast stream provider (deobfuscated)
 *
 * Flow:
 *  1. Resolve API host from nuvio domains.json (reallyfast / api.reallyfast.xyz)
 *  2. Solve SHA-256 proof-of-work: GET /api/challenge → find nonce
 *  3. POST /api/resolve with { mediaType, id, challenge, nonce [, season, episode] }
 *  4. Fetch returned master m3u8, pick highest variant, estimate size from bitrate × runtime
 *  5. Optionally POST /api/subtitles (same PoW) for subtitle tracks
 */

const name = "Goated (ReallyFast)";
const supportedTypes = ["movie", "tv"];

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const DOMAINS_URL =
  "https://raw.githubusercontent.com/sapariyaneel/nuvio-plugin/refs/heads/main/domains.json";
const FALLBACK_API_HOST = "https://api.reallyfast.xyz";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://goated.cx/",
  Origin: "https://goated.cx",
};

let cachedDomains = null;

/* -------------------------------------------------------------------------- */
/* Domain resolution                                                          */
/* -------------------------------------------------------------------------- */

async function getDomains() {
  if (cachedDomains) return cachedDomains;
  try {
    const res = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    cachedDomains = await res.json();
  } catch {
    cachedDomains = {};
  }
  return cachedDomains;
}

async function getApiHost() {
  const domains = await getDomains();
  return (
    domains.reallyfast ||
    domains["api.reallyfast.xyz"] ||
    FALLBACK_API_HOST
  ).replace(/\/+$/, "");
}

/* -------------------------------------------------------------------------- */
/* Sort / quality helpers                                                     */
/* -------------------------------------------------------------------------- */

function getInvertedSortTag(value, max = 999999) {
  const v = Math.max(0, parseInt(value, 10) || 0);
  const inverted = Math.max(0, max - v);
  return inverted
    .toString(2)
    .padStart(20, "0")
    .split("")
    .map((bit) => (bit === "1" ? "\ufeff" : "\u200b"))
    .join("");
}

function getQualityRank(quality) {
  const q = String(quality || "").toLowerCase();
  if (q.includes("2160") || q.includes("4k") || q.includes("uhd")) return 4;
  if (q.includes("1080") || q.includes("fhd") || q.includes("fullhd")) return 3;
  if (q.includes("720") || q.includes("hd")) return 2;
  if (q.includes("480") || q.includes("sd") || q.includes("360")) return 1;
  return 0;
}

function parseSizeToMB(sizeStr) {
  if (!sizeStr || sizeStr === "N/A" || sizeStr === "Unknown") return 0;
  const m = String(sizeStr).match(/([\d.]+)\s*(GB|MB)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === "GB") return Math.floor(n * 1024);
  if (unit === "MB") return Math.floor(n);
  return 0;
}

function getResolutionEmoji(quality) {
  const q = String(quality || "").toLowerCase();
  if (q.includes("2160") || q.includes("4k") || q.includes("uhd")) return "🌟 4K";
  if (q.includes("1080") || q.includes("fhd")) return "🔥 1080p";
  if (q.includes("720") || q.includes("hd")) return "💎 720p";
  if (q.includes("480") || q.includes("sd")) return "📱 480p";
  return "📺 " + (quality || "1080p");
}

function qualityLabelFromHeight(height) {
  if (height >= 2000) return "4K";
  if (height <= 0) return "Unknown";
  return height + "p";
}

function formatBytes(bytes) {
  if (!bytes) return "Unknown";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function resolveUrl(rel, base) {
  try {
    return new URL(rel, base).toString();
  } catch {
    return rel;
  }
}

/* -------------------------------------------------------------------------- */
/* SHA-256 (for proof-of-work)                                                */
/* -------------------------------------------------------------------------- */

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const c2 = str.charCodeAt(i + 1);
      if (c2 >= 0xdc00 && c2 <= 0xdfff) {
        const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
        i++;
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

function sha256Hex(message) {
  const bytes = utf8Bytes(message);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  bytes.push(
    (hi >>> 24) & 0xff,
    (hi >>> 16) & 0xff,
    (hi >>> 8) & 0xff,
    hi & 0xff
  );
  bytes.push(
    (bitLen >>> 24) & 0xff,
    (bitLen >>> 16) & 0xff,
    (bitLen >>> 8) & 0xff,
    bitLen & 0xff
  );

  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a;
  let h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  const w = new Array(64);
  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      const j = i + t * 4;
      w[t] =
        ((bytes[j] << 24) |
          (bytes[j + 1] << 16) |
          (bytes[j + 2] << 8) |
          bytes[j + 3]) >>>
        0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 =
        ((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^
        ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^
        (w[t - 15] >>> 3);
      const s1 =
        ((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^
        ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^
        (w[t - 2] >>> 10);
      w[t] =
        (((w[t - 16] + s0) >>> 0) + ((w[t - 7] + s1) >>> 0)) >>> 0;
    }

    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 =
        ((((h + S1) >>> 0) + ch) >>> 0) +
        ((SHA256_K[t] + w[t]) >>> 0);
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const words = [h0, h1, h2, h3, h4, h5, h6, h7];
  let hex = "";
  for (const w of words) {
    hex += ("00000000" + w.toString(16)).slice(-8);
  }
  return hex;
}

/** Brute-force nonce until sha256(challenge + nonce) starts with difficulty zeros */
async function solveProofOfWork(apiHost) {
  const res = await fetch(apiHost + "/api/challenge", { skipSizeCheck: true });
  if (!res.ok) throw new Error("failed to fetch PoW challenge");

  const { challenge, difficulty } = await res.json();
  const prefix = "0".repeat(difficulty);

  // max ~5M attempts
  for (let nonce = 0; nonce < 5000000; nonce++) {
    const hash = sha256Hex(challenge + nonce);
    if (hash.startsWith(prefix)) {
      return { challenge, nonce: String(nonce) };
    }
  }
  throw new Error("PoW solve timed out");
}

/* -------------------------------------------------------------------------- */
/* TMDB helpers                                                               */
/* -------------------------------------------------------------------------- */

async function getTmdbRuntimeSeconds(tmdbId, mediaType, season, episode) {
  try {
    const url =
      mediaType === "tv"
        ? "https://api.themoviedb.org/3/tv/" +
          tmdbId +
          "/season/" +
          (season || 1) +
          "/episode/" +
          (episode || 1) +
          "?api_key=" +
          TMDB_API_KEY
        : "https://api.themoviedb.org/3/movie/" +
          tmdbId +
          "?api_key=" +
          TMDB_API_KEY;

    const res = await fetch(url, { skipSizeCheck: true });
    if (!res.ok) return null;
    const data = await res.json();
    const mins =
      data.runtime ||
      (data.episode_run_time != null ? data.episode_run_time[0] : null);
    return mins ? mins * 60 : null;
  } catch {
    return null;
  }
}

async function getTmdbMetadata(tmdbId, mediaType) {
  try {
    const type = mediaType === "tv" ? "tv" : "movie";
    const res = await fetch(
      "https://api.themoviedb.org/3/" +
        type +
        "/" +
        tmdbId +
        "?api_key=" +
        TMDB_API_KEY,
      { skipSizeCheck: true }
    );
    const data = await res.json();
    const title = type === "tv" ? data.name : data.title;
    const dateStr =
      type === "tv" ? data.first_air_date : data.release_date;
    const year = dateStr ? dateStr.split("-")[0] : "";
    return { title, year };
  } catch {
    return { title: "", year: "" };
  }
}

/* -------------------------------------------------------------------------- */
/* HLS master playlist parsing                                                */
/* -------------------------------------------------------------------------- */

function parseMasterPlaylist(text, baseUrl) {
  const lines = text.split("\n").map((l) => l.trim());
  const variants = [];
  let defaultAudioUrl = null;

  for (let i = 0; i < lines.length; i++) {
    // Default audio track
    if (
      lines[i].startsWith("#EXT-X-MEDIA") &&
      lines[i].includes("TYPE=AUDIO") &&
      !defaultAudioUrl
    ) {
      const uriMatch = lines[i].match(/URI="([^"]+)"/);
      const isDefault = /DEFAULT=YES/.test(lines[i]);
      if (uriMatch && (isDefault || !defaultAudioUrl)) {
        defaultAudioUrl = resolveUrl(uriMatch[1], baseUrl);
      }
      continue;
    }

    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const info = lines[i];
    const uri = lines[i + 1];
    if (!uri || uri.startsWith("#")) continue;

    const bwMatch = info.match(/BANDWIDTH=(\d+)/);
    const resMatch = info.match(/RESOLUTION=(\d+)x(\d+)/);
    const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
    const height = resMatch ? parseInt(resMatch[2], 10) : 0;

    variants.push({
      url: resolveUrl(uri, baseUrl),
      bandwidth,
      height,
    });
  }

  return { variants, defaultAudioUrl };
}

async function getAudioBitrateBps(audioPlaylistUrl) {
  if (!audioPlaylistUrl) return 0;
  try {
    const text = await (await fetch(audioPlaylistUrl, { skipSizeCheck: true })).text();
    const m = text.match(/#EXT-X-BITRATE:(\d+)/);
    // tag is in kbps → convert to bps
    return m ? parseInt(m[1], 10) * 1000 : 0;
  } catch {
    return 0;
  }
}

/* -------------------------------------------------------------------------- */
/* Stream object builder                                                      */
/* -------------------------------------------------------------------------- */

function makeStream(
  masterUrl,
  quality,
  sizeLabel,
  title,
  year,
  mediaType,
  season,
  episode,
  subtitles
) {
  const qRank = getQualityRank(quality);
  const sizeMB = parseSizeToMB(sizeLabel);
  const sortTag = getInvertedSortTag(qRank * 100000 + sizeMB, 999999);
  const resEmoji = getResolutionEmoji(quality);

  const safeTitle = (title || "").replace(/[^a-zA-Z0-9]/g, ".");
  const isTv = mediaType === "tv";
  const s = season || 1;
  const e = episode || 1;

  const filename = isTv
    ? safeTitle +
      ".S" +
      String(s).padStart(2, "0") +
      "E" +
      String(e).padStart(2, "0") +
      "." +
      quality +
      ".WEB-DL.Multi-Audio.HEVC.AAC.MKV.MSubs"
    : safeTitle +
      "." +
      (year || "2026") +
      "." +
      quality +
      ".WEB-DL.Multi-Audio.HEVC.AAC.MKV.MSubs";

  const titleLine = isTv
    ? "🎬 " + title + (year ? " (" + year + ")" : "") + " | S" + s + "E" + e
    : "🎬 " + title + (year ? " (" + year + ")" : "");

  const qualityLine =
    resEmoji + " | 🗣️ Multi-Audio | 💾 " + sizeLabel;
  const formatLine = "🎞️ MKV | ✨ HEVC | 🎧 AAC";
  const providerLine = "🌐 Goated | 📥 WEB-DL";

  const name = sortTag + "Goated • " + quality + " • Multi-Audio";
  const description = [titleLine, qualityLine, formatLine, providerLine, filename].join(
    "\n"
  );

  return {
    qualityRank: qRank,
    sizeInMB: sizeMB,
    data: {
      name,
      title: description,
      size: description,
      description,
      url: masterUrl,
      headers: HEADERS,
      subtitles,
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: { request: HEADERS },
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * @param {string|number} tmdbIdOrImdb
 * @param {"movie"|"tv"} mediaType
 * @param {number|null} season
 * @param {number|null} episode
 */
async function getStreams(tmdbIdOrImdb, mediaType, season, episode) {
  try {
    let tmdbId = tmdbIdOrImdb;

    // IMDb → TMDB
    if (
      typeof tmdbIdOrImdb === "string" &&
      tmdbIdOrImdb.trim().toLowerCase().startsWith("tt")
    ) {
      const findUrl =
        "https://api.themoviedb.org/3/find/" +
        tmdbIdOrImdb +
        "?api_key=" +
        TMDB_API_KEY +
        "&external_source=imdb_id";
      const findData = await (
        await fetch(findUrl, { skipSizeCheck: true })
      ).json();
      const results =
        mediaType === "tv" ? findData.tv_results : findData.movie_results;
      tmdbId = results && results.length ? results[0].id : null;
      if (!tmdbId) return [];
    }

    tmdbId = parseInt(tmdbId, 10);
    if (!tmdbId) return [];

    const { title, year } = await getTmdbMetadata(tmdbId, mediaType);
    const apiHost = await getApiHost();
    const isTv = mediaType === "tv";

    // --- Resolve stream ---
    const pow = await solveProofOfWork(apiHost);
    const body = {
      mediaType: isTv ? "tv" : "movie",
      id: String(tmdbId),
      challenge: pow.challenge,
      nonce: pow.nonce,
    };
    if (isTv) {
      body.season = season || 1;
      body.episode = episode || 1;
    }

    const resolveRes = await fetch(apiHost + "/api/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      skipSizeCheck: true,
    });
    if (!resolveRes.ok) return [];

    const resolved = await resolveRes.json().catch(() => null);
    if (!resolved || !resolved.url) return [];

    // --- Parse master playlist ---
    const playlistRes = await fetch(resolved.url, { skipSizeCheck: true });
    if (!playlistRes.ok) return [];

    const playlistText = await playlistRes.text();
    const { variants, defaultAudioUrl } = parseMasterPlaylist(
      playlistText,
      resolved.url
    );
    if (!variants.length) return [];

    // Highest resolution variant
    const top = variants.slice().sort((a, b) => b.height - a.height)[0];

    const [runtimeSec, audioBps] = await Promise.all([
      getTmdbRuntimeSeconds(tmdbId, mediaType, season, episode),
      getAudioBitrateBps(defaultAudioUrl),
    ]);

    // --- Subtitles (optional, separate PoW) ---
    let subtitles = [];
    try {
      const pow2 = await solveProofOfWork(apiHost);
      const subBody = {
        mediaType: isTv ? "tv" : "movie",
        id: String(tmdbId),
        challenge: pow2.challenge,
        nonce: pow2.nonce,
      };
      if (isTv) {
        subBody.season = season || 1;
        subBody.episode = episode || 1;
      }

      const subRes = await fetch(apiHost + "/api/subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subBody),
        skipSizeCheck: true,
      });
      if (subRes.ok) {
        const subData = await subRes.json().catch(() => null);
        subtitles = (subData && subData.subtitles || [])
          .filter((s) => s && s.url)
          .map((s) => ({
            url: s.url,
            lang: s.label || s.language || "Unknown",
          }));
      }
    } catch {
      /* ignore subtitle errors */
    }

    const totalBitrate = top.bandwidth + audioBps;
    const quality = qualityLabelFromHeight(top.height);
    // size ≈ bitrate (bps) × runtime (s) / 8
    const sizeLabel = runtimeSec
      ? formatBytes((totalBitrate * runtimeSec) / 8)
      : "Unknown";

    const stream = makeStream(
      resolved.url,
      quality,
      sizeLabel,
      title || "Unknown Title",
      year || "2026",
      mediaType,
      season,
      episode,
      subtitles
    );

    return [stream.data];
  } catch (err) {
    console.error("[Goated]", err);
    return [];
  }
}

module.exports = { name, supportedTypes, getStreams };
