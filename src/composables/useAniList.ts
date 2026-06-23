import { ref } from 'vue';

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

export async function queryAniListApi(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(ANILIST_API, {
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

  return payload;
}

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
      error.value = err.message;
      loading.value = false;
      throw err;
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
      error.value = err.message;
      loading.value = false;
      throw err;
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
      error.value = err.message;
      loading.value = false;
      throw err;
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
      error.value = err.message;
      loading.value = false;
      throw err;
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
      // YYYY0000 to get anything starting in or after that year
      variables.startDateGreater = (options.yearStart - 1) * 10000 + 1231;
    }
    
    if (options.yearEnd) {
      // YYYY1231 to get anything starting in or before that year
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

      const isDefaultBrowse =
        (options.page || 1) === 1 &&
        (!options.genres || options.genres.length === 0) &&
        (options.sort || 'TRENDING_DESC') === 'TRENDING_DESC';

      if (isDefaultBrowse) {
        const fallback = await fetchTrendingAnime(options.page || 1, options.perPage || 20);
        loading.value = false;
        return fallback;
      }

      loading.value = false;
      return response;
    } catch (err: any) {
      const isDefaultBrowse =
        (options.page || 1) === 1 &&
        (!options.genres || options.genres.length === 0);

      if (isDefaultBrowse) {
        try {
          const fallback = await fetchTrendingAnime(options.page || 1, options.perPage || 20);
          loading.value = false;
          return fallback;
        } catch {
          // Fall through to the original error.
        }
      }

      error.value = err.message;
      loading.value = false;
      throw err;
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
