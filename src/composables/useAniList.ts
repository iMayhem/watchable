import { ref } from 'vue';
import { getVpsProxyBaseUrl } from '../utils/useWebImage';

export interface AniListFuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListMediaTrailer {
  id: string;
  site: string;
}

export interface AnimeMedia {
  id: number;
  idMal: number | null;
  title: {
    romaji: string;
    english: string | null;
    native: string;
  };
  coverImage: {
    extraLarge?: string | null;
    large: string;
    medium: string;
  };
  bannerImage: string | null;
  description: string | null;
  averageScore: number | null;
  genres: string[];
  seasonYear: number | null;
  episodes: number | null;
  format: string | null;
  status: string | null;
  startDate?: AniListFuzzyDate | null;
  trailer?: AniListMediaTrailer | null;
  nextAiringEpisode?: {
    airingAt: number;
    episode: number;
  } | null;
}

export interface AnimeResponse {
  data: {
    Page: {
      media: AnimeMedia[];
      pageInfo: {
        total: number;
        currentPage: number;
        lastPage: number;
        hasNextPage: boolean;
        perPage: number;
      };
    };
  };
}

const ANILIST_API = 'https://graphql.anilist.co';

// Client-side in-memory cache (aggressive TTL to reduce API calls)
interface CacheEntry {
    data: unknown;
    ts: number;
}
const anilistCache = new Map<string, CacheEntry>();
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

function cacheKey(query: string, variables: Record<string, unknown>): string {
    const hash = query.replace(/\s+/g, ' ').trim() + JSON.stringify(variables);
    let h = 0;
    for (let i = 0; i < hash.length; i++) {
        h = ((h << 5) - h) + hash.charCodeAt(i);
        h |= 0;
    }
    return String(h);
}

function getCached(key: string): unknown | null {
    const entry = anilistCache.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    anilistCache.delete(key);
    return null;
}

function setCache(key: string, data: unknown) {
    anilistCache.set(key, { data, ts: Date.now() });
    // Evict oldest entries if cache grows too large
    if (anilistCache.size > 500) {
        const oldest = [...anilistCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) anilistCache.delete(oldest[0]);
    }
}

export async function queryAniListApi(query: string, variables: Record<string, unknown> = {}) {
    const ck = cacheKey(query, variables);
    const cached = getCached(ck);
    if (cached) return cached;

    const vpsUrl = getVpsProxyBaseUrl();

    // Try VPS proxy first, fall back to direct Anilist
    let response: Response | null = null;
    if (vpsUrl) {
        try {
            const baseUrl = vpsUrl.replace(/\/+$/, '');
            response = await fetch(`${baseUrl}/api/anilist-proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables }),
            });
            if (!response.ok) {
                console.warn('[AniList] VPS proxy returned', response.status, '— falling back to direct');
                response = null;
            }
        } catch (err) {
            console.warn('[AniList] VPS proxy failed — falling back to direct:', err);
            response = null;
        }
    }

    if (!response) {
        response = await fetch(ANILIST_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables
            })
        });
    }

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
    }

    if (payload?.errors?.length) {
        const message = payload.errors
            .map((entry: { message?: string }) => entry.message)
            .filter(Boolean)
            .join('; ');
        throw new Error(message || 'AniList API returned errors');
    }

    if (!payload?.data) {
        throw new Error('AniList API returned no data');
    }

    setCache(ck, payload);
    return payload;
}

const ANIME_BROWSE_MEDIA_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
  }
  coverImage {
    extraLarge
    large
    medium
  }
  bannerImage
  description
  averageScore
  genres
  seasonYear
  episodes
  format
  status
`;

/** TV anime catalogue pages — series only, no feature films. */
export async function fetchAnimeBrowseMedia(options: {
  page?: number;
  perPage?: number;
  sort?: string;
} = {}): Promise<AnimeResponse> {
  const query = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(
          type: ANIME,
          sort: $sort,
          format_in: [TV, ONA, SPECIAL]
        ) {
          ${ANIME_BROWSE_MEDIA_FIELDS}
        }
      }
    }
  `;

  return queryAniListApi(query, {
    page: options.page || 1,
    perPage: options.perPage || 50,
    sort: [options.sort || 'POPULARITY_DESC']
  }) as Promise<AnimeResponse>;
}

/** Anime that has not premiered yet — sorted by start date. */
export async function fetchUpcomingAnime(options: {
  page?: number;
  perPage?: number;
} = {}): Promise<AnimeResponse> {
  const query = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(
          type: ANIME,
          status: NOT_YET_RELEASED,
          sort: $sort,
          format_in: [TV, ONA, MOVIE, SPECIAL]
        ) {
          ${ANIME_BROWSE_MEDIA_FIELDS}
          startDate {
            year
            month
            day
          }
          trailer {
            id
            site
          }
          nextAiringEpisode {
            airingAt
            episode
          }
        }
      }
    }
  `;

  return queryAniListApi(query, {
    page: options.page || 1,
    perPage: options.perPage || 24,
    sort: ['START_DATE']
  }) as Promise<AnimeResponse>;
}

export async function fetchAnimeMediaById(id: number) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${ANIME_BROWSE_MEDIA_FIELDS}
      }
    }
  `;

  return queryAniListApi(query, { id });
}

function mapKitsuToAnimeMedia(item: any): AnimeMedia {
    const attr = item?.attributes || {};
    const year = attr.startDate ? parseInt(attr.startDate.slice(0, 4), 10) : null;
    return {
        id: parseInt(item.id, 10),
        idMal: null,
        title: {
            romaji: attr.titles?.en_jp || attr.canonicalTitle || '',
            english: attr.titles?.en || attr.canonicalTitle || '',
            native: attr.titles?.ja_jp || ''
        },
        coverImage: {
            extraLarge: attr.posterImage?.original || attr.posterImage?.large || null,
            large: attr.posterImage?.large || attr.posterImage?.original || attr.posterImage?.medium || '',
            medium: attr.posterImage?.medium || attr.posterImage?.small || ''
        },
        bannerImage: attr.coverImage?.original || attr.coverImage?.large || null,
        description: attr.synopsis || '',
        averageScore: attr.averageRating ? Math.round(parseFloat(attr.averageRating)) : null,
        genres: [],
        seasonYear: year,
        episodes: attr.episodeCount || null,
        format: attr.showType ? attr.showType.toUpperCase() : 'TV',
        status: attr.status ? attr.status.toUpperCase() : 'FINISHED'
    };
}

async function fetchKitsuDiscover(options: {
    page?: number;
    perPage?: number;
    genres?: string[];
    yearStart?: number;
    yearEnd?: number;
    sort?: string;
    search?: string;
}): Promise<AnimeResponse> {
    const page = options.page || 1;
    const perPage = options.perPage || 20;
    const offset = (page - 1) * perPage;

    let sortParam = '-userCount';
    if (options.sort === 'SCORE_DESC') sortParam = '-averageRating';
    if (options.sort === 'START_DATE_DESC') sortParam = '-startDate';
    if (options.sort === 'POPULARITY_DESC') sortParam = '-favoritesCount';

    let url = `https://kitsu.io/api/edge/anime?page[limit]=${perPage}&page[offset]=${offset}&sort=${sortParam}`;
    if (options.search) {
        url = `https://kitsu.io/api/edge/anime?page[limit]=${perPage}&page[offset]=${offset}&filter[text]=${encodeURIComponent(options.search)}`;
    } else if (options.genres && options.genres.length > 0) {
        url += `&filter[categories]=${encodeURIComponent(options.genres.join(','))}`;
    }
    if (options.yearStart && options.yearEnd) {
        url += `&filter[seasonYear]=${options.yearStart}..${options.yearEnd}`;
    }

    const res = await fetch(url, {
        headers: {
            'Accept': 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json'
        }
    });
    if (!res.ok) {
        throw new Error(`Kitsu API error: ${res.status}`);
    }
    const json = await res.json();
    const media = (json.data || []).map(mapKitsuToAnimeMedia);
    const count = json.meta?.count || 1000;
    return {
        data: {
            Page: {
                media,
                pageInfo: {
                    total: count,
                    currentPage: page,
                    lastPage: Math.ceil(count / perPage),
                    hasNextPage: offset + perPage < count,
                    perPage
                }
            }
        }
    };
}

async function fetchKitsuAnimeById(id: number) {
    const res = await fetch(`https://kitsu.io/api/edge/anime/${id}`, {
        headers: {
            'Accept': 'application/vnd.api+json'
        }
    });
    if (!res.ok) throw new Error(`Kitsu anime ${id} not found: ${res.status}`);
    const json = await res.json();
    return {
        data: {
            Media: mapKitsuToAnimeMedia(json.data)
        }
    };
}

export function useAniList() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchTrendingAnime = async (page = 1, perPage = 20) => {
    loading.value = true;
    error.value = null;

    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
            perPage
          }
          media(type: ANIME, sort: TRENDING_DESC) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
            }
            bannerImage
            description
            averageScore
            genres
            seasonYear
            episodes
            format
            status
          }
        }
      }
    `;

    try {
      const response = await queryAniListApi(query, { page, perPage });
      loading.value = false;
      return response as AnimeResponse;
    } catch (err: any) {
      try {
        const fallback = await fetchKitsuDiscover({ page, perPage, sort: 'TRENDING_DESC' });
        loading.value = false;
        return fallback;
      } catch {
        error.value = err.message;
        loading.value = false;
        throw err;
      }
    }
  };

  const fetchPopularAnime = async (page = 1, perPage = 20) => {
    loading.value = true;
    error.value = null;

    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
            perPage
          }
          media(type: ANIME, sort: POPULARITY_DESC) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
            }
            bannerImage
            description
            averageScore
            genres
            seasonYear
            episodes
            format
            status
          }
        }
      }
    `;

    try {
      const response = await queryAniListApi(query, { page, perPage });
      loading.value = false;
      return response as AnimeResponse;
    } catch (err: any) {
      try {
        const fallback = await fetchKitsuDiscover({ page, perPage, sort: 'POPULARITY_DESC' });
        loading.value = false;
        return fallback;
      } catch {
        error.value = err.message;
        loading.value = false;
        throw err;
      }
    }
  };

  const searchAnime = async (searchTerm: string, page = 1, perPage = 20) => {
    loading.value = true;
    error.value = null;

    const query = `
      query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
            perPage
          }
          media(type: ANIME, search: $search) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
            }
            bannerImage
            description
            averageScore
            genres
            seasonYear
            episodes
            format
            status
          }
        }
      }
    `;

    try {
      const response = await queryAniListApi(query, { search: searchTerm, page, perPage });
      loading.value = false;
      return response as AnimeResponse;
    } catch (err: any) {
      try {
        const fallback = await fetchKitsuDiscover({ page, perPage, search: searchTerm });
        loading.value = false;
        return fallback;
      } catch {
        error.value = err.message;
        loading.value = false;
        throw err;
      }
    }
  };

  const fetchAnimeById = async (id: number) => {
    loading.value = true;
    error.value = null;

    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            large
            medium
          }
          bannerImage
          description
          averageScore
          genres
          seasonYear
          episodes
          format
          status
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          studios {
            nodes {
              name
            }
          }
          trailer {
            id
            site
          }
          nextAiringEpisode {
            airingAt
            timeUntilAiring
            episode
          }
          relations {
            edges {
              relationType
              node {
                id
                title {
                  romaji
                  english
                  native
                }
                type
                format
                episodes
                seasonYear
                coverImage {
                  large
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await queryAniListApi(query, { id });
      loading.value = false;
      return response;
    } catch (err: any) {
      try {
        const fallback = await fetchKitsuAnimeById(id);
        loading.value = false;
        return fallback;
      } catch {
        error.value = err.message;
        loading.value = false;
        throw err;
      }
    }
  };

  const discoverAnime = async (options: {
    page?: number;
    perPage?: number;
    genres?: string[];
    yearStart?: number;
    yearEnd?: number;
    sort?: string;
  }) => {
    loading.value = true;
    error.value = null;

    const query = `
      query ($page: Int, $perPage: Int, $genres: [String], $startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
            perPage
          }
          media(
            type: ANIME,
            genre_in: $genres,
            startDate_greater: $startDateGreater,
            startDate_lesser: $startDateLesser,
            sort: $sort,
            format_in: [TV, ONA, SPECIAL, MOVIE]
          ) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
            }
            bannerImage
            description
            averageScore
            genres
            seasonYear
            episodes
            format
            status
          }
        }
      }
    `;

    const variables: any = {
      page: options.page || 1,
      perPage: options.perPage || 20,
    };

    if (options.genres && options.genres.length > 0) {
      variables.genres = options.genres;
    }
    
    if (options.yearStart) {
      variables.startDateGreater = (options.yearStart - 1) * 10000 + 1231;
    }
    
    if (options.yearEnd) {
      variables.startDateLesser = options.yearEnd * 10000 + 1231;
    }

    if (options.sort) {
      variables.sort = [options.sort];
    }

    try {
      const response = (await queryAniListApi(query, variables)) as AnimeResponse;
      const media = response.data?.Page?.media ?? [];
      if (media.length > 0) {
        loading.value = false;
        return response;
      }

      const fallback = await fetchKitsuDiscover(options);
      loading.value = false;
      return fallback;
    } catch (err: any) {
      try {
        const fallback = await fetchKitsuDiscover(options);
        loading.value = false;
        return fallback;
      } catch (fallbackErr: any) {
        error.value = err.message || fallbackErr.message;
        loading.value = false;
        throw err;
      }
    }
  };

  return {
    loading,
    error,
    fetchTrendingAnime,
    fetchPopularAnime,
    searchAnime,
    fetchAnimeById,
    discoverAnime
  };
}
