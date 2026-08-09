function rewriteHlsPlaylist(playlist, baseUrl, workerUrl) {
  let lines = playlist.split('\n');

  // 1. Reorder master playlist variants by bandwidth descending so highest quality plays first
  if (playlist.includes('#EXT-X-STREAM-INF:')) {
    const variants = [];
    const otherLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const urlLine = i + 1 < lines.length ? lines[i + 1] : '';
        const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
        variants.push({
          bandwidth: bwMatch ? parseInt(bwMatch[1]) : 0,
          header: line,
          url: urlLine
        });
        i++; // skip the URL line
      } else {
        otherLines.push(line);
      }
    }
    if (variants.length > 1) {
      variants.sort((a, b) => b.bandwidth - a.bandwidth);
      const reordered = [...otherLines];
      // Append sorted variants to the end of the other header tags
      for (const v of variants) {
        reordered.push(v.header);
        reordered.push(v.url);
      }
      lines = reordered;
    }
  }

  // 2. Make all segment/sub-playlist URLs absolute and rewrite URI tags
  return lines
    .map(line => {
      let rewrittenLine = line;

      // Rewrite URI attributes (e.g. inside EXT-X-MEDIA or EXT-X-KEY tags) to go through the worker
      const uriAttrRe = /URI="([^"]+)"/gi;
      rewrittenLine = rewrittenLine.replace(uriAttrRe, (match, urlVal) => {
        try {
          const absoluteUrl = new URL(urlVal, baseUrl).href;
          const params = new URLSearchParams(new URL(workerUrl).search);
          params.set('url', absoluteUrl);
          return `URI="${new URL(workerUrl).origin}/?${params.toString()}"`;
        } catch {
          return match;
        }
      });

      const trimmed = rewrittenLine.trim();
      if (!trimmed || trimmed.startsWith('#')) return rewrittenLine;
      try {
        return new URL(trimmed, baseUrl).href;
      } catch {
        return rewrittenLine;
      }
    })
    .join('\n');
}

export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    const headers = new Headers()
    const referer = url.searchParams.get('referer')
    const origin  = url.searchParams.get('origin')
    const ua      = url.searchParams.get('ua')
    if (referer) headers.set('Referer', referer)
    if (origin)  headers.set('Origin', origin)
    if (ua)      headers.set('User-Agent', ua)

    // Opaque token mode: ?id=<streamId> — resolve the real URL from the hub
    // so the origin URL is never exposed in query params.
    const id = url.searchParams.get('id')
    let target = url.searchParams.get('url')
    if (!target && id) {
      try {
        const hub = new URL('/api/stream', 'https://proxy.moovie.fun')
        hub.searchParams.set('id', id)
        const resp = await fetch(hub)
        if (resp.ok) {
          const data = await resp.json()
          target = data.url
          if (data.headers) {
            for (const [k, v] of Object.entries(data.headers)) {
              if (v && (k === 'Referer' || k === 'Origin' || k === 'User-Agent')) headers.set(k, v)
            }
          }
        }
      } catch {}
    }
    if (!target) return new Response('Missing url', { status: 400 })

    const range = request.headers.get('Range')
    if (range) headers.set('Range', range)

    try {
      const resp = await fetch(target, { headers })
      const ct   = resp.headers.get('content-type') || ''
      const respHeaders = new Headers(resp.headers)
      respHeaders.set('Access-Control-Allow-Origin', '*')
      respHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')

      // ── HLS manifest rewriting ────────────────────────────────────────────────
      // If the response is an HLS playlist, rewrite every segment / sub-playlist
      // URL so that it is fetched DIRECTLY by the browser (no worker hop).
      // This removes the worker from the hot path for every .ts segment, which
      // was causing rate-limit 429s on Cloudflare's free plan.
      //
      // Only the initial manifest fetch goes through the worker; all segment
      // fetches and sub-playlist fetches go directly to the origin server.
      // The origin (e.g. profitableaffiliatehub.site) checks Referer/Origin on
      // the manifest request; individual segments typically don't require them.
      const bodyText = await resp.text()
      const isHls =
        bodyText.trimStart().startsWith('#EXTM3U') ||
        ct.includes('mpegurl') ||
        ct.includes('x-mpegurl')

      if (isHls) {
        const baseUrl = new URL(target)
        const rewritten = rewriteHlsPlaylist(bodyText, baseUrl, request.url)

        respHeaders.set('Content-Type', ct || 'application/vnd.apple.mpegurl')
        respHeaders.delete('Content-Length') // length changed after rewrite
        return new Response(rewritten, {
          status: resp.status,
          statusText: resp.statusText,
          headers: respHeaders,
        })
      }
      // ── Non-HLS: pass through as-is ──────────────────────────────────────────

      return new Response(bodyText, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders,
      })
    } catch (e) {
      return new Response(e.message, { status: 502 })
    }
  },
}
