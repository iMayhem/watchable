"use strict";

/**
 * VidNest MovieBox stream provider
 *
 * Flow:
 *  1. GET https://new.vidnest.fun/moviebox/movie/{tmdbId}
 *     or   https://new.vidnest.fun/moviebox/tv/{tmdbId}/{season}/{episode}
 *  2. Response: { data: "<custom-base64>" } — the alphabet is shuffled
 *     (VIDNEST_ALPHABET), so it must be translated back to the standard
 *     base64 alphabet before decoding.
 *  3. Decoded payload: { provider, url: [{ link, type, lang }, ...] }
 *  4. Return direct CDN links (signed .mp4) as stream objects.
 */

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const API_BASE = "https://new.vidnest.fun";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: API_BASE + "/",
  Origin: API_BASE,
};

const VIDNEST_ALPHABET =
  "RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/";
const STANDARD_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const TRANSLATE = new Map();
for (let i = 0; i < VIDNEST_ALPHABET.length; i++) {
  TRANSLATE.set(VIDNEST_ALPHABET[i], STANDARD_ALPHABET[i]);
}

function decodePayload(payload) {
  let p = payload;
  const pad = p.length % 4;
  if (pad) p += "=".repeat(4 - pad);
  let std = "";
  for (const ch of p) std += TRANSLATE.get(ch) ?? ch;
  return JSON.parse(Buffer.from(std, "base64").toString("utf-8"));
}

function inferType(url) {
  const u = String(url || "").toLowerCase();
  if (u.includes(".m3u8")) return "m3u8";
  if (u.includes(".mpd")) return "mpd";
  return "mp4";
}

async function getStreams(tmdbIdOrImdb, mediaType, season, episode) {
  try {
    let tmdbId = tmdbIdOrImdb;

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

    const path =
      mediaType === "tv"
        ? "tv/" + tmdbId + "/" + (season || 1) + "/" + (episode || 1)
        : "movie/" + tmdbId;

    let res = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetch(API_BASE + "/moviebox/" + path, {
          headers: HEADERS,
          skipSizeCheck: true,
          cache: "no-store",
        });
        if (res.ok) break;
      } catch {
        res = null;
      }
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
    if (!res || !res.ok) return [];

    const json = await res.json().catch(() => null);
    if (!json || !json.data) return [];

    let data;
    try {
      data = decodePayload(json.data);
    } catch {
      return [];
    }

    const entries = Array.isArray(data.url) ? data.url : [];
    const seen = {};
    const out = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const link = entry && typeof entry.link === "string" ? entry.link : "";
      if (!link || !/^https?:\/\//i.test(link) || seen[link]) continue;
      seen[link] = true;
      const lang = entry.lang || "Unknown";
      const quality = /1080|720|2160/i.test(link)
        ? (link.match(/1080|720|2160/i)[0] + "p")
        : "Auto";
      out.push({
        name:
          "📦 MovieBox | " +
          quality +
          " | [" +
          (lang === "Unknown" ? "S" + (i + 1) : lang) +
          "]",
        title: lang === "Unknown" ? "MovieBox source " + (i + 1) : "MovieBox · " + lang,
        size: "MovieBox",
        description: "MovieBox · " + lang,
        url: link,
        type: inferType(link),
        quality: "",
        language: lang === "Unknown" ? "" : lang,
        headers: HEADERS,
        provider: "vidnest-moviebox",
        subtitles: [],
      });
    }

    return out;
  } catch (err) {
    console.error("[VidNest-MovieBox]", err);
    return [];
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getStreams,
    name: "VidNest MovieBox",
    supportedTypes: ["movie", "tv"],
  };
} else {
  global.getStreams = getStreams;
}