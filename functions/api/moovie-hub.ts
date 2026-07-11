const HUB_BASE = 'https://providers.peestream.in';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const type = url.searchParams.get('type');
  const season = url.searchParams.get('season');
  const episode = url.searchParams.get('episode');

  if (!q || !type) {
    return new Response(JSON.stringify({ error: 'Missing required parameters: q, type' }), {
      status: 400,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      },
    });
  }

  const hubUrl = new URL(`${HUB_BASE}/api/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`);
  if (season) hubUrl.searchParams.set('season', season);
  if (episode) hubUrl.searchParams.set('episode', episode);

  try {
    const hubRes = await fetch(hubUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (!hubRes.ok) {
      return new Response(JSON.stringify({ error: `Hub search failed (${hubRes.status})` }), {
        status: hubRes.status,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
      });
    }

    const body = await hubRes.text();

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=600, s-maxage=600',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Hub proxy failed' }), {
      status: 502,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      },
    });
  }
}
