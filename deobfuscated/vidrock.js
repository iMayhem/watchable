"use strict";

/**
 * VidRock stream provider (deobfuscated)
 *
 * Flow:
 *  1. Resolve base URL from nuvio-plugin domains.json (fallback: vidrock.net)
 *  2. GET /api/movie/{tmdbId} or /api/tv/{tmdbId}/{season}/{episode}
 *  3. Each server entry has an AES-128-CTR encrypted URL (base64url)
 *  4. Decrypt → fetch master m3u8 → pick top bandwidth variant for quality label
 *  5. Return formatted stream objects
 */

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const DOMAINS_URL =
  "https://raw.githubusercontent.com/sapariyaneel/nuvio-plugin/refs/heads/main/domains.json";
const FALLBACK_BASE_URL = "https://vidrock.net";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  Referer: "https://vidrock.net/",
  Origin: "https://vidrock.net",
};

/** AES-128 key used for stream URL decryption */
const STREAM_KEY_HEX =
  "7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f";

const GCM_IV_LENGTH = 12; // leading IV
const GCM_TAG_LENGTH = 16; // trailing tag (not verified)

let cachedDomains = null;

/* -------------------------------------------------------------------------- */
/* Domain / base URL                                                          */
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

async function getBaseUrl() {
  const domains = await getDomains();
  return (domains.vidrock || FALLBACK_BASE_URL).replace(/\/+$/, "");
}

/* -------------------------------------------------------------------------- */
/* AES-128 (S-box, key schedule, encrypt block)                               */
/* -------------------------------------------------------------------------- */

const AES_SBOX = new Uint8Array(256);
const AES_RCON = [
  0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab,
  0x4d,
];

(function buildSbox() {
  const p = new Uint8Array(256);
  const inv = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 256; i++) {
    p[i] = x;
    inv[x] = i;
    x = (x ^ ((x << 1) & 0xff) ^ (x & 0x80 ? 0x1b : 0)) & 0xff;
  }
  AES_SBOX[0] = 0x63;
  for (let i = 1; i < 256; i++) {
    let s = p[(0xff - inv[i]) % 0xff];
    let xform = s;
    let c = s;
    for (let j = 0; j < 4; j++) {
      c = ((c << 1) | (c >>> 7)) & 0xff;
      xform ^= c;
    }
    AES_SBOX[i] = (xform ^ 0x63) & 0xff;
  }
})();

function gfMultiply(a, b) {
  let p = 0;
  while (b) {
    if (b & 1) p ^= a;
    a = ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff;
    b >>= 1;
  }
  return p & 0xff;
}

function expandAesKey(keyBytes) {
  const Nk = keyBytes.length / 4;
  const Nr = Nk + 6;
  const schedule = new Uint8Array(16 * (Nr + 1));
  schedule.set(keyBytes);

  for (let i = Nk; i < 4 * (Nr + 1); i++) {
    let t0 = schedule[(i - 1) * 4];
    let t1 = schedule[(i - 1) * 4 + 1];
    let t2 = schedule[(i - 1) * 4 + 2];
    let t3 = schedule[(i - 1) * 4 + 3];

    if (i % Nk === 0) {
      const tmp = t0;
      t0 = AES_SBOX[t1] ^ AES_RCON[i / Nk - 1];
      t1 = AES_SBOX[t2];
      t2 = AES_SBOX[t3];
      t3 = AES_SBOX[tmp];
    } else if (Nk > 6 && i % Nk === 4) {
      t0 = AES_SBOX[t0];
      t1 = AES_SBOX[t1];
      t2 = AES_SBOX[t2];
      t3 = AES_SBOX[t3];
    }

    schedule[i * 4] = schedule[(i - Nk) * 4] ^ t0;
    schedule[i * 4 + 1] = schedule[(i - Nk) * 4 + 1] ^ t1;
    schedule[i * 4 + 2] = schedule[(i - Nk) * 4 + 2] ^ t2;
    schedule[i * 4 + 3] = schedule[(i - Nk) * 4 + 3] ^ t3;
  }
  return { schedule, rounds: Nr };
}

function aesEncryptBlock(state, keySched) {
  const { schedule, rounds } = keySched;

  for (let i = 0; i < 16; i++) state[i] ^= schedule[i];

  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < 16; i++) state[i] = AES_SBOX[state[i]];

    // ShiftRows
    let t = state[1];
    state[1] = state[5];
    state[5] = state[9];
    state[9] = state[13];
    state[13] = t;
    t = state[2];
    state[2] = state[10];
    state[10] = t;
    t = state[6];
    state[6] = state[14];
    state[14] = t;
    t = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = state[3];
    state[3] = t;

    if (round !== rounds) {
      for (let c = 0; c < 4; c++) {
        const i = c * 4;
        const a0 = state[i],
          a1 = state[i + 1],
          a2 = state[i + 2],
          a3 = state[i + 3];
        state[i] = gfMultiply(a0, 2) ^ gfMultiply(a1, 3) ^ a2 ^ a3;
        state[i + 1] = a0 ^ gfMultiply(a1, 2) ^ gfMultiply(a2, 3) ^ a3;
        state[i + 2] = a0 ^ a1 ^ gfMultiply(a2, 2) ^ gfMultiply(a3, 3);
        state[i + 3] = gfMultiply(a0, 3) ^ a1 ^ a2 ^ gfMultiply(a3, 2);
      }
    }

    for (let i = 0; i < 16; i++) state[i] ^= schedule[round * 16 + i];
  }
  return state;
}

/* -------------------------------------------------------------------------- */
/* Encoding helpers                                                           */
/* -------------------------------------------------------------------------- */

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64UrlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((b64.length * 3) / 4));
  let buf = 0,
    bits = 0,
    pos = 0;
  for (let i = 0; i < b64.length; i++) {
    const v = BASE64_CHARS.indexOf(b64.charAt(i));
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[pos++] = (buf >> bits) & 0xff;
    }
  }
  return out.subarray(0, pos);
}

function utf8BytesToString(bytes) {
  let s = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) {
      s += String.fromCharCode(b);
    } else if ((b & 0xe0) === 0xc0) {
      const b2 = bytes[i++];
      s += String.fromCharCode(((b & 0x1f) << 6) | (b2 & 0x3f));
    } else if ((b & 0xf0) === 0xe0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      s += String.fromCharCode(
        ((b & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)
      );
    } else if ((b & 0xf8) === 0xf0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      let cp =
        ((b & 0x07) << 18) |
        ((b2 & 0x3f) << 12) |
        ((b3 & 0x3f) << 6) |
        (b4 & 0x3f);
      cp -= 0x10000;
      s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      s += String.fromCharCode(b);
    }
  }
  return s;
}

/* -------------------------------------------------------------------------- */
/* Stream URL decrypt – AES-128-CTR                                           */
/* Layout: [12-byte IV][ciphertext][16-byte tag]  (tag ignored)              */
/* Counter starts at 2 (GCM-style)                                            */
/* -------------------------------------------------------------------------- */

let cachedKeySchedule = null;

function decryptStreamUrl(encryptedB64Url) {
  const raw = base64UrlToBytes(encryptedB64Url);
  if (raw.length <= GCM_IV_LENGTH + GCM_TAG_LENGTH) {
    throw new Error("ciphertext too short");
  }

  if (!cachedKeySchedule) {
    cachedKeySchedule = expandAesKey(hexToBytes(STREAM_KEY_HEX));
  }

  const ciphertext = raw.subarray(GCM_IV_LENGTH, raw.length - GCM_TAG_LENGTH);
  const plain = new Uint8Array(ciphertext.length);

  const counterBlock = new Uint8Array(16);
  counterBlock.set(raw.subarray(0, GCM_IV_LENGTH), 0);

  let counter = 2;
  for (let offset = 0; offset < ciphertext.length; offset += 16) {
    counterBlock[12] = (counter >>> 24) & 0xff;
    counterBlock[13] = (counter >>> 16) & 0xff;
    counterBlock[14] = (counter >>> 8) & 0xff;
    counterBlock[15] = counter & 0xff;

    const keystream = new Uint8Array(16);
    keystream.set(counterBlock);
    aesEncryptBlock(keystream, cachedKeySchedule);

    const n = Math.min(16, ciphertext.length - offset);
    for (let j = 0; j < n; j++) {
      plain[offset + j] = ciphertext[offset + j] ^ keystream[j];
    }
    counter++;
  }

  return utf8BytesToString(plain);
}

/* -------------------------------------------------------------------------- */
/* Metadata / quality helpers                                                 */
/* -------------------------------------------------------------------------- */

function getProviderEmoji(name) {
  const n = String(name).toLowerCase();
  if (n.includes("astra")) return "🪐";
  if (n.includes("atlas")) return "🌀";
  if (n.includes("orion")) return "🎯";
  return "🌍";
}

function buildDropdownMetadata(
  serverName,
  quality,
  meta,
  season,
  episode,
  streamUrl
) {
  let server = String(serverName)
    .replace(/\s*(1080p\s+)?server\s*2\s*$/gi, "")
    .trim();

  let qLabel = quality.toLowerCase().trim() === "auto" ? "Auto" : quality;
  let qualityLine = "💎 " + qLabel;

  const qLower = qLabel.toLowerCase();
  if (qLower.includes("2160") || qLower.includes("4k")) {
    qualityLine = "🌟 2160p";
  } else if (qLower.includes("1080")) {
    qualityLine = "🚀 1080p";
  } else if (qLower.includes("720")) {
    qualityLine = "🛰️ 720p";
  } else if (qLower === "auto") {
    qualityLine = "🛸 Auto";
  }

  const runtime = meta.runtime || "90 min";
  const format = streamUrl.includes(".m3u8") ? "📡 M3U8" : "🎞️ MP4";
  const emoji = getProviderEmoji(server);
  const yearPart = meta.year ? "(" + meta.year + ")" : "N/A";

  let line1 = "🎬 " + (meta.title || "Unknown") + " - " + yearPart;
  if (season && episode) line1 += " | S" + season + "E" + episode;

  return (
    line1 +
    "\n" +
    qualityLine +
    " | 🌍 Original Audio | 🎧 AAC\n" +
    format +
    " | ⚡ x2.64 | ⏱️ " +
    runtime +
    "\n" +
    emoji +
    " " +
    server +
    " | 🔗 Provider: VidRock"
  );
}

async function fetchTmdbDetails(tmdbId, mediaType, season, episode) {
  try {
    const type = mediaType === "tv" ? "tv" : "movie";
    const url =
      "https://api.themoviedb.org/3/" +
      type +
      "/" +
      tmdbId +
      "?api_key=" +
      TMDB_API_KEY;
    const res = await fetch(url, { skipSizeCheck: true });
    if (!res.ok) {
      return { title: "Unknown", year: "N/A", runtime: "90 min" };
    }
    const data = await res.json();

    let runtime = data.runtime;
    if (mediaType === "tv") {
      try {
        const epUrl =
          "https://api.themoviedb.org/3/tv/" +
          tmdbId +
          "/season/" +
          (season || 1) +
          "/episode/" +
          (episode || 1) +
          "?api_key=" +
          TMDB_API_KEY;
        const epRes = await fetch(epUrl, { skipSizeCheck: true });
        if (epRes.ok) {
          const ep = await epRes.json();
          if (ep.runtime) runtime = ep.runtime;
        }
      } catch {
        /* ignore */
      }
    }

    const runtimeStr = runtime
      ? runtime + " min"
      : mediaType === "tv"
        ? "45 min"
        : "90 min";

    return {
      title: mediaType === "tv" ? data.name : data.title,
      year: (
        (mediaType === "tv" ? data.first_air_date : data.release_date) || ""
      ).substring(0, 4),
      runtime: runtimeStr,
    };
  } catch {
    return { title: "Unknown", year: "N/A", runtime: "90 min" };
  }
}

function qualityLabelFromResolution(width, height) {
  if (width >= 3200 || height >= 2000) return "4K";
  if (width >= 2400 || height >= 1400) return "1440p";
  if (width >= 1800 || height >= 1000) return "1080p";
  if (width >= 1200 || height >= 700) return "720p";
  if (width >= 800 || height >= 480) return "480p";
  if (width >= 600 || height >= 340) return "360p";
  if (width > 0 || height > 0) return "240p";
  return "Unknown";
}

function qualityRank(label) {
  if (label === "4K" || label === "2160p") return 2160;
  const n = parseInt(label, 10);
  return Number.isFinite(n) ? n : 0;
}

function resolveUrl(rel, base) {
  try {
    return new URL(rel, base).toString();
  } catch {
    return rel;
  }
}

/** Highest-bandwidth variant from a master playlist */
function parseMasterTopVariant(playlistText, playlistUrl) {
  const lines = playlistText.split("\n").map((l) => l.trim());
  let best = null;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const next = lines[i + 1];
    if (!next || next.startsWith("#")) continue;

    const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
    const resMatch = lines[i].match(/RESOLUTION=(\d+)x(\d+)/);
    const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
    const width = resMatch ? parseInt(resMatch[1], 10) : 0;
    const height = resMatch ? parseInt(resMatch[2], 10) : 0;

    if (!best || bandwidth > best.bandwidth) {
      best = {
        url: resolveUrl(next, playlistUrl),
        bandwidth,
        width,
        height,
      };
    }
  }
  return best;
}

async function buildStream(serverName, entry, meta, season, episode) {
  try {
    const decrypted = decryptStreamUrl(entry.url);
    if (!/^https?:\/\//i.test(decrypted)) return null;

    const res = await fetch(decrypted, {
      headers: HEADERS,
      skipSizeCheck: true,
    });
    if (!res.ok) return null;

    const top = parseMasterTopVariant(await res.text(), decrypted);
    if (!top) return null;

    const quality = qualityLabelFromResolution(top.width, top.height);
    let cleanServer = String(serverName)
      .replace(/\s*(1080p\s+)?server\s*2\s*$/gi, "")
      .trim();
    const emoji = getProviderEmoji(cleanServer);
    const description = buildDropdownMetadata(
      serverName,
      quality,
      meta,
      season,
      episode,
      decrypted
    );

    return {
      name:
        "🪨 VidRock | " + quality + " | " + emoji + " [" + cleanServer + "]",
      title: description,
      size: description,
      description,
      url: decrypted, // master m3u8
      quality: "",
      language: "",
      headers: HEADERS,
      provider: "vidrock",
      subtitles: [],
      _serverKey: serverName,
      _rawQuality: quality,
    };
  } catch {
    return null;
  }
}

/**
 * @param {string|number} tmdbIdOrImdb  TMDB id or IMDb id (tt…)
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

    const base = await getBaseUrl();
    const path =
      mediaType === "tv"
        ? "tv/" + tmdbId + "/" + (season || 1) + "/" + (episode || 1)
        : "movie/" + tmdbId;

    const res = await fetch(base + "/api/" + path, {
      headers: HEADERS,
      skipSizeCheck: true,
    });
    if (!res.ok) return [];

    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object" || data.error) return [];

    // Response shape: { "Astra": { url: "<encrypted>" }, "Atlas": { url: "..." }, ... }
    const servers = Object.keys(data)
      .map((name) => ({ name, entry: data[name] }))
      .filter(
        (s) => s.entry && typeof s.entry === "object" && s.entry.url
      );

    if (!servers.length) return [];

    const meta = await fetchTmdbDetails(tmdbId, mediaType, season, episode);
    const built = await Promise.all(
      servers.map((s) =>
        buildStream(s.name, s.entry, meta, season, episode)
      )
    );

    const seen = {};
    const out = [];
    for (const stream of built) {
      if (!stream || seen[stream.url]) continue;
      seen[stream.url] = true;
      out.push(stream);
    }

    out.sort((a, b) => {
      const ka = String(a._serverKey || "").toLowerCase();
      const kb = String(b._serverKey || "").toLowerCase();
      if (ka !== kb) return ka.localeCompare(kb);
      return qualityRank(b._rawQuality) - qualityRank(a._rawQuality);
    });

    return out;
  } catch (err) {
    console.error("[Vidrock]", err);
    return [];
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams, name: "VidRock", supportedTypes: ["movie", "tv"] };
} else {
  global.getStreams = getStreams;
}
