// Cloudflare Pages Function for generating a dynamic sitemap
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const host = url.host; // e.g. "moovie.fun", "m.moovie.fun"
  const protocol = url.protocol; // "http:" or "https:"
  const baseUrl = `${protocol}//${host}`;

  const TMDB_API_KEY = 'dfa4c2c7c1de1005adee824dc5593672';

  // Fetch top/trending movies, tv-shows, and anime in parallel
  const moviesPromise = fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}`)
    .then(r => r.json())
    .catch(() => ({ results: [] }));

  const tvShowsPromise = fetch(`https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}`)
    .then(r => r.json())
    .catch(() => ({ results: [] }));

  const animePromise = fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query {
          Page(page: 1, perPage: 40) {
            media(type: ANIME, sort: TRENDING_DESC) {
              id
            }
          }
        }
      `
    })
  })
    .then(r => r.json())
    .catch(() => ({ data: { Page: { media: [] } } }));

  const [moviesData, tvShowsData, animeData] = await Promise.all([
    moviesPromise,
    tvShowsPromise,
    animePromise
  ]);

  const urls: string[] = [];

  // 1. Movie URLs
  if (moviesData.results) {
    moviesData.results.forEach((item: any) => {
      if (item.id) {
        urls.push(`${baseUrl}/movie/${item.id}`);
      }
    });
  }

  // 2. TV Show URLs
  if (tvShowsData.results) {
    tvShowsData.results.forEach((item: any) => {
      if (item.id) {
        urls.push(`${baseUrl}/tv-show/${item.id}`);
      }
    });
  }

  // 3. Anime URLs
  if (animeData.data?.Page?.media) {
    animeData.data.Page.media.forEach((item: any) => {
      if (item.id) {
        urls.push(`${baseUrl}/anime/${item.id}`);
      }
    });
  }

  // Generate XML entries
  const xmlEntries = urls
    .map(
      loc => `  <url>
    <loc>${loc}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('\n');

  // Build complete Sitemap XML string
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>always</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/movies</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/tv-shows</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/anime</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/actors</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/watchlist</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
${xmlEntries}
</urlset>`;

  return new Response(sitemapXml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=604800', // Cache for 7 days
      'Access-Control-Allow-Origin': '*'
    }
  });
}
