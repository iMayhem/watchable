// Edge Middleware to dynamically inject SEO metadata before serving the Single Page Application
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (url.hostname === 'www.moovie.fun') {
    url.hostname = 'moovie.fun';
    return Response.redirect(url.toString(), 301);
  }

  // 1. Only intercept GET requests
  if (request.method !== 'GET') {
    return next();
  }

  // Device routing is client-side only (index.html) — edge redirects disagreed with
  // browser viewport/UA checks and caused moovie.fun ↔ m.moovie.fun refresh loops.

  // 2. Skip requests that are not page loads (API, files, sitemaps, static assets)
  if (
    pathname.startsWith('/api/') ||
    pathname.includes('.') ||
    pathname.startsWith('/static/') ||
    pathname.endsWith('sitemap.xml') ||
    pathname.endsWith('sitemap-dynamic.xml')
  ) {
    return next();
  }

  // 3. Detect route type and extract ID
  let type: 'movie' | 'tv' | 'anime' | 'actor' | null = null;
  let id: string | null = null;

  const movieMatch = pathname.match(/^\/movie\/([0-9]+)/);
  const tvMatch = pathname.match(/^\/tv-show\/([0-9]+)/) || pathname.match(/^\/tv\/([0-9]+)/);
  const animeMatch = pathname.match(/^\/anime\/([0-9]+)/);
  const actorMatch = pathname.match(/^\/actor\/([0-9]+)/);

  if (movieMatch) {
    type = 'movie';
    id = movieMatch[1];
  } else if (tvMatch) {
    type = 'tv';
    id = tvMatch[1];
  } else if (animeMatch) {
    type = 'anime';
    id = animeMatch[1];
  } else if (actorMatch) {
    type = 'actor';
    id = actorMatch[1];
  }

  // If we match a dynamic detail route, fetch metadata at the edge
  if (type && id) {
    try {
      let title = 'Moovie — Stream Movies, TV Shows & Anime Free';
      let description = 'Watch movies, TV shows, and anime online in high quality. Host watch parties with friends, search from a vast database of titles, and enjoy uninterrupted streaming on Moovie.';
      let imageUrl = '';
      const TMDB_API_KEY = 'dfa4c2c7c1de1005adee824dc5593672';

      if (type === 'movie') {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}`, {
          cf: { cacheTtl: 86400 } // Cache API request for 1 day at edge
        });
        if (res.ok) {
          const data: any = await res.json();
          title = `${data.title} — Moovie`;
          description = data.overview || description;
          imageUrl = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
        }
      } else if (type === 'tv') {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}`, {
          cf: { cacheTtl: 86400 }
        });
        if (res.ok) {
          const data: any = await res.json();
          title = `${data.name} — Moovie`;
          description = data.overview || description;
          imageUrl = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
        }
      } else if (type === 'anime') {
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query ($id: Int) {
                Media(id: $id, type: ANIME) {
                  title {
                    english
                    romaji
                    native
                  }
                  description
                  coverImage {
                    large
                  }
                }
              }
            `,
            variables: { id: parseInt(id, 10) }
          })
        });
        if (res.ok) {
          const body: any = await res.json();
          const media = body.data?.Media;
          if (media) {
            const animeTitle = media.title.english || media.title.romaji || media.title.native;
            title = `${animeTitle} — Moovie`;
            description = media.description ? media.description.replace(/<[^>]*>/g, '') : description;
            imageUrl = media.coverImage?.large || '';
          }
        }
      } else if (type === 'actor') {
        const res = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_API_KEY}`, {
          cf: { cacheTtl: 86400 }
        });
        if (res.ok) {
          const data: any = await res.json();
          title = `${data.name} — Moovie`;
          description = data.biography || description;
          imageUrl = data.profile_path ? `https://image.tmdb.org/t/p/w500${data.profile_path}` : '';
        }
      }

      if (!imageUrl) {
        const isMobile = url.host.startsWith('m.');
        imageUrl = isMobile ? 'https://m.moovie.fun/og-image.png' : 'https://moovie.fun/og-image.png';
      }

      // 4. Fetch the index.html page response and rewrite tags using HTMLRewriter
      const response = await next();

      return new HTMLRewriter()
        .on('title', {
          element(element) {
            element.text(title);
          }
        })
        .on('meta[name="description"]', {
          element(element) {
            element.setAttribute('content', description);
          }
        })
        .on('meta[property="og:title"]', {
          element(element) {
            element.setAttribute('content', title);
          }
        })
        .on('meta[property="og:description"]', {
          element(element) {
            element.setAttribute('content', description);
          }
        })
        .on('meta[property="og:image"]', {
          element(element) {
            element.setAttribute('content', imageUrl);
          }
        })
        .on('meta[property="og:url"]', {
          element(element) {
            element.setAttribute('content', url.toString());
          }
        })
        .on('meta[property="twitter:title"], meta[name="twitter:title"]', {
          element(element) {
            element.setAttribute('content', title);
          }
        })
        .on('meta[property="twitter:description"], meta[name="twitter:description"]', {
          element(element) {
            element.setAttribute('content', description);
          }
        })
        .on('meta[property="twitter:image"], meta[name="twitter:image"]', {
          element(element) {
            element.setAttribute('content', imageUrl);
          }
        })
        .transform(response);

    } catch (err) {
      // Fallback to serving the page unmodified if fetching/rewriting fails
      return next();
    }
  }

  return next();
}
