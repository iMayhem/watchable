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
    const origin = url.searchParams.get('origin')
    const ua = url.searchParams.get('ua')
    if (referer) headers.set('Referer', referer)
    if (origin) headers.set('Origin', origin)
    if (ua) headers.set('User-Agent', ua)

    const range = request.headers.get('Range')
    if (range) headers.set('Range', range)

    try {
      const resp = await fetch(target, { headers })
      const respHeaders = new Headers(resp.headers)
      respHeaders.set('Access-Control-Allow-Origin', '*')
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
