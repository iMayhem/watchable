import { ref } from "vue"
import useAxios from "./useAxios"
import { queryAniListApi, type AnimeMedia, type AnimeResponse } from "./useAniList"

export interface SearchMovie {
    id: number;
    title?: string;
    original_title?: string;
    poster_path: string | null;
    vote_average?: number;
    release_date?: string;
    genre_ids?: number[];
    adult?: boolean;
    media_type?: string;
}

export interface SearchShow {
    id: number;
    name?: string;
    original_name?: string;
    poster_path: string | null;
    vote_average?: number;
    first_air_date?: string;
    genre_ids?: number[];
    media_type?: string;
}

export interface SearchPerson {
    id: number;
    name: string;
    profile_path: string | null;
    known_for_department?: string;
    media_type?: string;
}

export const reqMetaData = ref<{
    page: number,
    total_pages: number
}>({
    page: 0,
    total_pages: 0
})
export const discoveredMovies = ref<SearchMovie[]>([])
export const discoveredTv = ref<SearchShow[]>([])
export const discoveredPeople = ref<SearchPerson[]>([])
export const discoveredAnime = ref<AnimeMedia[]>([])
export const discoveredUpcomingMovies = ref<SearchMovie[]>([])
export const discoveredUpcomingAnime = ref<AnimeMedia[]>([])

export const animeMeta = ref({
    page: 0,
    hasNextPage: false,
    lastPage: 1
})

export const upcomingMoviesMeta = ref({
    page: 0,
    total_pages: 0
})

export const upcomingAnimeMeta = ref({
    page: 0,
    hasNextPage: false,
    lastPage: 1
})

const ANIME_SEARCH_FIELDS = `
    id
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
    averageScore
    seasonYear
    format
    status
    startDate {
        year
        month
        day
    }
`

const ANIME_SEARCH_QUERY = `
    query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
            pageInfo {
                currentPage
                lastPage
                hasNextPage
            }
            media(type: ANIME, search: $search, sort: [POPULARITY_DESC]) {
                ${ANIME_SEARCH_FIELDS}
            }
        }
    }
`

const UPCOMING_ANIME_SEARCH_QUERY = `
    query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
            pageInfo {
                currentPage
                lastPage
                hasNextPage
            }
            media(
                type: ANIME,
                search: $search,
                status: NOT_YET_RELEASED,
                sort: [POPULARITY_DESC],
                format_in: [TV, ONA, MOVIE, SPECIAL]
            ) {
                ${ANIME_SEARCH_FIELDS}
            }
        }
    }
`

const isFutureRelease = (dateStr?: string) => {
    if (!dateStr) return false
    return dateStr >= new Date().toISOString().slice(0, 10)
}

const mergeUniqueAnime = (existing: AnimeMedia[], incoming: AnimeMedia[]) => {
    const seen = new Set(existing.map(item => item.id))
    const fresh = incoming.filter(item => !seen.has(item.id))
    return fresh.length ? [...existing, ...fresh] : existing
}

const mergeUniqueMovies = (existing: SearchMovie[], incoming: SearchMovie[]) => {
    const seen = new Set(existing.map(item => item.id))
    const fresh = incoming.filter(item => !seen.has(item.id))
    return fresh.length ? [...existing, ...fresh] : existing
}

/**
 * Re-rank raw TMDB search results so that:
 *  1. Exact title match  → score 2
 *  2. Starts-with match  → score 1
 *  3. Otherwise          → score 0
 * Within same score bucket, sort by TMDB `popularity` descending.
 */
function sortByRelevance<T extends Record<string, any>>(
    items: T[],
    query: string,
    titleKey: keyof T
): T[] {
    const q = query.trim().toLowerCase()
    return [...items].sort((a, b) => {
        const ta = String(a[titleKey] || '').toLowerCase()
        const tb = String(b[titleKey] || '').toLowerCase()
        const sa = ta === q ? 2 : ta.startsWith(q) ? 1 : 0
        const sb = tb === q ? 2 : tb.startsWith(q) ? 1 : 0
        if (sa !== sb) return sb - sa
        return (b.popularity ?? b.vote_count ?? 0) - (a.popularity ?? a.vote_count ?? 0)
    })
}

export const useSearch = () => {
    const fetchSearchResults = async (query: string, pageNumber: number =1) => {
        let loading = ref(false)
        let error = ref("")
        try {
            loading.value = true
            const req = await useAxios().get(`https://api.themoviedb.org/3/search/multi?query=${query}&page=${pageNumber}`)
            const res = req.data.results
            reqMetaData.value = {
                page: req.data.page,
                total_pages: req.data.total_pages
            }
            const rawMovies = res.filter((movie: any) => movie.media_type === "movie")
            const rawTv = res.filter((tv: any) => tv.media_type === "tv")
            const rawPeople = res.filter((people: any) => people.media_type === "person")
            if (pageNumber === 1) {
                // First page: sort by relevance (exact match → starts-with → popularity desc)
                discoveredMovies.value = sortByRelevance(rawMovies, query, 'title')
                discoveredTv.value = sortByRelevance(rawTv, query, 'name')
                discoveredPeople.value = sortByRelevance(rawPeople, query, 'name')
            } else {
                // Subsequent pages: just append without re-sorting
                discoveredMovies.value = mergeUniqueMovies(discoveredMovies.value, rawMovies)
                discoveredTv.value = [...discoveredTv.value, ...rawTv.filter((s: SearchShow) => !discoveredTv.value.find(e => e.id === s.id))]
                discoveredPeople.value = [...discoveredPeople.value, ...rawPeople.filter((p: SearchPerson) => !discoveredPeople.value.find(e => e.id === p.id))]
            }
        } catch (err: any) {
            error.value = err.message
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
        }
    }

    const fetchAnimeSearch = async (query: string, pageNumber = 1, append = false) => {
        const response = (await queryAniListApi(ANIME_SEARCH_QUERY, {
            search: query,
            page: pageNumber,
            perPage: 20
        })) as AnimeResponse
        const media = response.data?.Page?.media ?? []
        const pageInfo = response.data?.Page?.pageInfo

        discoveredAnime.value = append
            ? mergeUniqueAnime(discoveredAnime.value, media)
            : media

        animeMeta.value = {
            page: pageInfo?.currentPage ?? pageNumber,
            hasNextPage: Boolean(pageInfo?.hasNextPage),
            lastPage: pageInfo?.lastPage ?? 1
        }
    }

    const fetchUpcomingSearch = async (query: string, pageNumber = 1, append = false) => {
        const [movieRes, animeRes] = await Promise.all([
            useAxios().get('search/movie', { params: { query, page: pageNumber } }),
            queryAniListApi(UPCOMING_ANIME_SEARCH_QUERY, {
                search: query,
                page: pageNumber,
                perPage: 20
            }) as Promise<AnimeResponse>
        ])

        const upcomingMovies = (movieRes.data.results ?? []).filter(
            (movie: SearchMovie) => isFutureRelease(movie.release_date)
        )

        const animePage = animeRes.data?.Page
        const upcomingAnime = animePage?.media ?? []

        discoveredUpcomingMovies.value = append
            ? mergeUniqueMovies(discoveredUpcomingMovies.value, upcomingMovies)
            : upcomingMovies

        discoveredUpcomingAnime.value = append
            ? mergeUniqueAnime(discoveredUpcomingAnime.value, upcomingAnime)
            : upcomingAnime

        upcomingMoviesMeta.value = {
            page: movieRes.data.page ?? pageNumber,
            total_pages: movieRes.data.total_pages ?? 1
        }

        const animePageInfo = animePage?.pageInfo
        upcomingAnimeMeta.value = {
            page: animePageInfo?.currentPage ?? pageNumber,
            hasNextPage: Boolean(animePageInfo?.hasNextPage),
            lastPage: animePageInfo?.lastPage ?? 1
        }
    }

    const clearSearchResults = () => {
        discoveredMovies.value = []
        discoveredTv.value = []
        discoveredPeople.value = []
        discoveredAnime.value = []
        discoveredUpcomingMovies.value = []
        discoveredUpcomingAnime.value = []
        reqMetaData.value = {
            page: 0,
            total_pages: 0
        }
        animeMeta.value = { page: 0, hasNextPage: false, lastPage: 1 }
        upcomingMoviesMeta.value = { page: 0, total_pages: 0 }
        upcomingAnimeMeta.value = { page: 0, hasNextPage: false, lastPage: 1 }
    }

    return {
        fetchSearchResults,
        fetchAnimeSearch,
        fetchUpcomingSearch,
        clearSearchResults,
    }
}