'use strict'

/**
 * RiverStream stream provider
 *
 * Uses Rivestream's internal backendfetch API (secretKey LTQ1YTA1MjAz)
 * to fetch signed streams for movies and TV shows.
 *
 * Services:
 *   flowcast -> direct mp4 (bcdnxw.hakunaymatata.com)
 *   citadel  -> HLS m3u8 (img1.kclov.com)
 *   ophim    -> HLS (kkphimplayer7.com)
 *
 * CORS is closed, so this must run server-side (hub process).
 */

const RIVESTREAM_SECRET = 'LTQ1YTA1MjAz'

const SVCS = ['flowcast', 'citadel', 'ophim']

/**
 * Fetch movie streams from Rivestream backend.
 */
async function fetchMovieStreams (tmdbId) {
  const sources = []
  for (const svc of SVCS) {
    try {
      const url = `https://www.rivestream.app/api/backendfetch?requestID=movieVideoProvider&id=${tmdbId}&service=${svc}&secretKey=${RIVESTREAM_SECRET}`
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const data = await res.json()
      if (!data?.data?.sources) continue
      for (const s of data.data.sources) {
        let type = 'mp4'
        if (svc === 'citadel' || svc === 'ophim') type = 'hls'
        sources.push({
          name: `${svc.toUpperCase()} ${s.quality || ''}p`.trim(),
          title: `RiverStream ${svc} ${s.quality || ''}p`.trim(),
          size: null,
          description: null,
          url: s.url,
          type,
          quality: s.quality || 'unknown',
          language: 'en',
          provider: 'rivestream',
          subtitles: null
        })
      }
    } catch (e) {
      // silently skip
    }
  }
  return sources
}

module.exports = {
  name: 'RiverStream',
  supportedTypes: ['movie', 'tv'],
  getStreams: async function (tmdbIdOrImdb, mediaType, season, episode) {
    if (mediaType === 'movie') {
      return fetchMovieStreams(tmdbIdOrImdb)
    }
    // TV not yet implemented (different secretKey needed)
    return []
  }
}