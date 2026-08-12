"use strict";

/**
 * Vidlove stream provider (deobfuscated)
 *
 * Aggregates multiple sources via a single backend:
 *   https://ballerinacappuccinalovestungtungtungsahur.com/{movie|tv}?id=&mode=json&sources=&hevc=1[&season=&episode=]
 *
 * Filters streams below 1080p (MIN_QUALITY = 1080).
 */

const BASE_URL = "https://ballerinacappuccinalovestungtungtungsahur.com";
const REFERER = "https://player.vidlove.cc/";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = "307b7b8ef035c6aa336900aef4e203bd";

const MIN_QUALITY = 1080; // 0x438
const DEFAULT_QUALITY = "1080p";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const PROVIDERS = [
  "moviebox",
  "ipcloud",
  "tcloud",
  "vidapi",
  "vixsrc",
  "1embed",
  "xpass",
  "vidrift",
  "lookmovie",
  "vidnest",
];

const DEFAULT_HEADERS = {
  accept: "application/json",
  "accept-language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua":
    '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
  Referer: REFERER,
  "User-Agent": USER_AGENT,
};

/* -------------------------------------------------------------------------- */
/* Sort tag – invisible zero-width chars so higher quality sorts first        */
/* -------------------------------------------------------------------------- */

function getInvertedSortTag(value, max = 999999) {
  const v = Math.max(0, parseInt(value, 10) || 0);
  const inverted = Math.max(0, max - v);
  // 20-bit binary padded → BOM (U+FEFF) for '1', ZWSP (U+200B) for '0'
  return inverted
    .toString(2)
    .padStart(20, "0")
    .split("")
    .map((bit) => (bit === "1" ? "\ufeff" : "\u200b"))
    .join("");
}

/* -------------------------------------------------------------------------- */
/* Quality helpers                                                            */
/* -------------------------------------------------------------------------- */

function getResolutionEmoji(quality) {
  const q = String(quality || "").toLowerCase();
  if (q.includes("2160") || q.includes("4k") || q.includes("uhd")) return "🌟 4K";
  if (q.includes("1080") || q.includes("fhd")) return "🔥 1080p";
  if (q.includes("720") || q.includes("hd")) return "💎 720p";
  if (q.includes("480") || q.includes("sd")) return "📱 480p";
  return "📺 " + (quality || "1080p");
}

function qualityRank(quality) {
  if (/2160p|4k/i.test(quality)) return 4;
  if (/1080p/i.test(quality)) return 3;
  if (/720p/i.test(quality)) return 2;
  if (/480p/i.test(quality)) return 1;
  return 0;
}

function parseQuality(q) {
  const m = String(q || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function normalizeQuality(q) {
  const s = String(q || "").trim();
  return s ? s : DEFAULT_QUALITY;
}

function isQualityAcceptable(q) {
  return parseQuality(normalizeQuality(q)) >= MIN_QUALITY;
}

/* -------------------------------------------------------------------------- */
/* TMDB metadata                                                              */
/* -------------------------------------------------------------------------- */

async function fetchTmdbMeta(tmdbId, mediaType, season = null, episode = null) {
  try {
    const type = mediaType === "tv" ? "tv" : "movie";
    const res = await fetch(
      TMDB_BASE +
        "/" +
        type +
        "/" +
        encodeURIComponent(tmdbId) +
        "?api_key=" +
        TMDB_KEY,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      }
    );
    if (!res.ok) {
      return { title: "Unknown", year: null, episodeTitle: "" };
    }

    const data = await res.json();
    const title =
      data.title ||
      data.name ||
      data.original_title ||
      data.original_name ||
      "Unknown";
    const dateStr = data.release_date || data.first_air_date || "";
    const year = dateStr ? parseInt(dateStr.slice(0, 4)) : null;

    let episodeTitle = "";
    if (mediaType === "tv" && season && episode) {
      try {
        const seasonRes = await fetch(
          TMDB_BASE +
            "/tv/" +
            encodeURIComponent(tmdbId) +
            "/season/" +
            season +
            "?api_key=" +
            TMDB_KEY,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": USER_AGENT,
            },
          }
        );
        if (seasonRes.ok) {
          const seasonData = await seasonRes.json();
          if (seasonData && Array.isArray(seasonData.episodes)) {
            const epNum = parseInt(episode);
            const ep = seasonData.episodes.find(
              (e) => e.episode_number === epNum
            );
            if (ep && ep.name) episodeTitle = ep.name;
          }
        }
      } catch {
        /* ignore */
      }
    }

    return { title, year, episodeTitle };
  } catch {
    return { title: "Unknown", year: null, episodeTitle: "" };
  }
}

/* -------------------------------------------------------------------------- */
/* Backend endpoint                                                           */
/* -------------------------------------------------------------------------- */

function buildEndpointUrl(mediaType, tmdbId, provider, season, episode) {
  const params = new URLSearchParams({
    id: tmdbId,
    mode: "json",
    sources: provider,
    hevc: "1",
  });
  if (season != null) params.set("season", season);
  if (episode != null) params.set("episode", episode);
  return BASE_URL + "/" + mediaType + "?" + params;
}

/* -------------------------------------------------------------------------- */
/* Stream mapping                                                             */
/* -------------------------------------------------------------------------- */

function mapQualityToStream(item, providerLabel, index, meta) {
  const quality = normalizeQuality(item.quality);
  const resEmoji = getResolutionEmoji(quality);
  const rank = qualityRank(quality);

  // Invisible sort prefix: higher quality → sorts first alphabetically
  const sortTag = getInvertedSortTag(rank * 100000 + (100 - index), 999999);
  const name = sortTag + "Vidlove • " + quality + " • " + providerLabel;

  const titleLine =
    "🎬 " + meta.title + (meta.year ? " (" + meta.year + ")" : "");

  let seasonLine = null;
  if (meta.mediaType === "tv" && meta.season && meta.episode) {
    seasonLine =
      "📋 S" +
      meta.season +
      " E" +
      meta.episode +
      (meta.episodeTitle ? " - " + meta.episodeTitle : "");
  }

  const qualityLine = resEmoji + " | 🗣️ Multi-Audio";
  const formatLine = "🎞️ MKV | ⚡ HEVC | 🎧 AAC";
  const providerLine =
    "🔗 Vidlove | 🌐 " + providerLabel + " | 📥 WEB-DL";

  const description = [titleLine, seasonLine, qualityLine, formatLine, providerLine]
    .filter(Boolean)
    .join("\n");

  const headers = {
    Referer: REFERER,
    Origin: "https://player.vidlove.cc",
    "User-Agent": USER_AGENT,
  };

  const url = item.url;
  const type = url && (url.includes(".m3u8") || url.includes("m3u8")) ? "hls" : "mp4";

  return {
    name,
    title: description,
    size: description,
    description,
    url,
    type,
    quality,
    headers,
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: { request: headers },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Per-provider fetch                                                         */
/* -------------------------------------------------------------------------- */

async function fetchProviderStreams(
  provider,
  tmdbId,
  mediaType,
  season,
  episode,
  meta
) {
  try {
    const res = await fetch(
      buildEndpointUrl(mediaType, tmdbId, provider, season, episode),
      { method: "GET", headers: DEFAULT_HEADERS }
    );
    if (!res.ok) return [];

    const { source } = await res.json();
    if (!source) return [];

    const qualities = Array.isArray(source.qualities) ? source.qualities : [];
    const label = source.label != null ? source.label : provider;

    // Multi-quality list
    if (qualities.length > 0) {
      return qualities
        .filter((q) => q?.url && isQualityAcceptable(q.quality))
        .map((q, i) => mapQualityToStream(q, label, i, meta));
    }

    // Single stream on source object
    if (source.url && isQualityAcceptable(source.quality)) {
      return [
        mapQualityToStream(
          { url: source.url, quality: source.quality },
          label,
          0,
          meta
        ),
      ];
    }

    return [];
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Main entry                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * @param {string|number} tmdbId
 * @param {string} mediaType  "movie" | "tv" | "series" | "show" | "tvshow"
 * @param {number|null} season
 * @param {number|null} episode
 */
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const raw = String(mediaType || "").toLowerCase().trim();
    const type =
      raw === "series" || raw === "show" || raw === "tvshow" || raw === "tv"
        ? "tv"
        : "movie";

    if (type === "tv" && (season == null || episode == null)) return [];

    const meta = await fetchTmdbMeta(tmdbId, type, season, episode);
    meta.mediaType = type;
    meta.season = season;
    meta.episode = episode;

    const results = await Promise.all(
      PROVIDERS.map((p) =>
        fetchProviderStreams(p, tmdbId, type, season, episode, meta)
      )
    );

    // Dedupe by URL
    const seen = new Set();
    return results
      .flat()
      .filter(
        (s) => s.url && !seen.has(s.url) && seen.add(s.url)
      );
  } catch {
    return [];
  }
}

module.exports = { getStreams, name: "Vidlove", supportedTypes: ["movie", "tv"] };
