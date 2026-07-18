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

    const target = url.searchParams.get('url')
    if (!target) return new Response('Missing url', { status: 400 })

    const headers = new Headers()
    const referer = url.searchParams.get('referer')
    const origin  = url.searchParams.get('origin')
    const ua      = url.searchParams.get('ua')
    if (referer) headers.set('Referer', referer)
    if (origin)  headers.set('Origin', origin)
    if (ua)      headers.set('User-Agent', ua)

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
        const rewritten = bodyText
          .split('\n')
          .map(line => {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) return line

            try {
              // Resolve relative URL against the manifest base
              const absolute = new URL(trimmed, baseUrl).href
              return absolute
            } catch {
              return line
            }
          })
          .join('\n')

        respHeaders.set('Content-Type', ct || 'application/vnd.apple.mpegurl')
        respHeaders.delete('Content-Length') // length changed after rewrite
        return new Response(rewritten, {
          status: resp.status,
          statusText: resp.statusText,
          headers: respHeaders,
        })
      }
      // ── Non-HLS: pass through as-is ──────────────────────────────────────────

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders,
      })
    } catch (e) {
      return new Response(e.message, { status: 502 })
    }
  },
}
