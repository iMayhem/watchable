import { ref } from "vue"
import useAxios from "./useAxios"
import { getSettings } from "./useSettings"
import { MovieCredit, MovieImages, MovieVideo } from "./useMovies"
export interface TVShowType {
    adult: boolean,
    backdrop_path: string,
    id: number,
    name: string,
    original_language: string,
    original_title: string,
    overview: string,
    poster_path: string,
    media_type: string,
    genre_ids: number[],
    popularity: number
    release_date: string,
    first_air_date?: string,
    video: boolean,
    vote_average: number,
    vote_count: number
}
export interface TVShowDetails {
    backdrop_path: string,
    created_by: {
        id: number,
        credit_id: string,
        name: string,
        gender: number,
        profile_path: string
    }[],
    episode_run_time: number[],
    first_air_date: string,
    genres: {
        id: number,
        name: string
    }[],
    homepage: string,
    id: number,
    in_production: boolean,
    languages: string[],
    last_air_date: string,
    last_episode_to_air: {
        air_date: string,
        episode_number: number,
        id: number,
        name: string,
        overview: string,
        production_code: string,
        season_number: number,
        still_path: string,
        vote_average: number,
        vote_count: number,
        runtime: number,
        show_id: number,
    },
    name: string,
    next_episode_to_air: null | object,
    networks: {
        name: string,
        id: number,
        logo_path: string,
        origin_country: string
    }[],
    number_of_episodes: number,
    number_of_seasons: number,
    origin_country: string[],
    original_language: string,
    original_name: string,
    overview: string,
    popularity: number,
    poster_path: string,
    production_companies: {
        id: number,
        logo_path: string,
        name: string,
        origin_country: string
    }[],
    production_countries: {
        iso_3166_1: string,
        name: string
    }[],
    seasons: {
        air_date: string,
        episode_count: number,
        id: number,
        name: string,
        overview: string,
        poster_path: string,
        season_number: number
    }[],
    spoken_languages: {
        english_name: string,
        iso_639_1: string,
        name: string
    }[],
    status: string,
    tagline: string,
    type: string,
    vote_average: number,
    vote_count: number
}
interface TVShowResponse {
    page: number,
    results: TVShowType[],
    total_pages: number,
    total_results: number
}
export interface Episode {
    air_date: string,
    crew: {
        id: number,
        credit_id: string,
        name: string,
        department: string,
        job: string,
        profile_path: string
    }[],
    episode_number: number,
    runtime: number,
    guest_stars: {
        id: number,
        name: string,
        credit_id: string,
        character: string,
        order: number,
        profile_path: string
    }[],
    name: string,
    overview: string,
    id: number,
    production_code: string,
    season_number: number,
    still_path: string,
    vote_average: number,
    vote_count: number

}
export interface TVShowSeasonDetails {
    _id: string,
    air_date: string,
    episodes: Episode[],
    name: string,
    overview: string,
    id: number,
    poster_path: string,
    season_number: number
}

export const newShows = ref<TVShowType[]>([])
const discoverShowsCache = new Map<string, Promise<any>>();
const tvShowDetailsCache = new Map<string, Promise<any>>();
const tvShowCreditsCache = new Map<string, Promise<any>>();
const tvShowImagesCache = new Map<string, Promise<any>>();
const similarTvShowsCache = new Map<string, Promise<any>>();
const tvShowSeasonDetailsCache = new Map<string, Promise<any>>();
const tvShowVideosCache = new Map<string, Promise<any>>();

export const useTvShows = () => {
    const fetchNewShows = async () => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<TVShowType[]>([])
        try {
            console.log('[📺 TV Shows] Fetching new shows...')
            loading.value = true
            // Use relative path so the axios interceptor can rewrite for non-global regions.
            const req = useAxios().get('trending/tv/day')
            const res = (await req).data
            // Always assign (even empty) so rails can exit skeleton state.
            newShows.value = res.results ?? []
            data.value = res.results ?? []
            console.log('[📺 TV Shows] Fetched', newShows.value.length, 'shows ✅')
        } catch (err: any) {
            error.value = err.message
            newShows.value = []
            data.value = []
            console.error('[📺 TV Shows] Error:', err)
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchDiscoverShows = async (url: string = "https://api.themoviedb.org/3/discover/tv" ) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<TVShowResponse>()
        const { region } = getSettings();
        const cacheKey = `${region.value}:${url}`;
        try {
            loading.value = true
            if (!discoverShowsCache.has(cacheKey)) {
                discoverShowsCache.set(cacheKey, useAxios().get(url).then(r => r.data));
            }
            const res = await discoverShowsCache.get(cacheKey)!;
            if (res.results) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            discoverShowsCache.delete(cacheKey);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchTvShow = async (id: string) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<TVShowDetails>()
        try {
            loading.value = true
            if (!tvShowDetailsCache.has(id)) {
                tvShowDetailsCache.set(id, useAxios().get(`https://api.themoviedb.org/3/tv/${id}`).then(r => r.data));
            }
            const res = await tvShowDetailsCache.get(id)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            tvShowDetailsCache.delete(id);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchTvShowCredit = async (id: string) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<MovieCredit>()
        try {
            loading.value = true
            if (!tvShowCreditsCache.has(id)) {
                tvShowCreditsCache.set(id, useAxios().get(`https://api.themoviedb.org/3/tv/${id}/credits`).then(r => r.data));
            }
            const res = await tvShowCreditsCache.get(id)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            tvShowCreditsCache.delete(id);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchTvShowImages = async (id:string) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<MovieImages>()
        try {
            loading.value = true
            const url = `https://api.themoviedb.org/3/tv/${id}/images?include_image_language=en`;
            if (!tvShowImagesCache.has(url)) {
                tvShowImagesCache.set(url, useAxios().get(url).then(r => r.data));
            }
            const res = await tvShowImagesCache.get(url)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            const url = `https://api.themoviedb.org/3/tv/${id}/images?include_image_language=en`;
            tvShowImagesCache.delete(url);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchSimilarTvShows = async (id:string) =>{
        let loading = ref(false)
        let error = ref("")
        let data = ref<TVShowResponse>()
        try {
            loading.value = true
            const url = `https://api.themoviedb.org/3/tv/${id}/similar?language=en-US&page=1`;
            if (!similarTvShowsCache.has(url)) {
                similarTvShowsCache.set(url, useAxios().get(url).then(r => r.data));
            }
            const res = await similarTvShowsCache.get(url)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            const url = `https://api.themoviedb.org/3/tv/${id}/similar?language=en-US&page=1`;
            similarTvShowsCache.delete(url);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchTvShowBySeason = async (id:string, season:number) =>{
        let loading = ref(false)
        let error = ref("")
        let data = ref<TVShowSeasonDetails>()
        try {
            loading.value = true
            const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}`;
            if (!tvShowSeasonDetailsCache.has(url)) {
                tvShowSeasonDetailsCache.set(url, useAxios().get(url).then(r => r.data));
            }
            const res = await tvShowSeasonDetailsCache.get(url)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}`;
            tvShowSeasonDetailsCache.delete(url);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    
    }
    const fetchTvShowVideos = async (id:string) =>{
        let loading = ref(false)
        let error = ref("")
        let data = ref<{
            id: string,
            results: MovieVideo[]
        }>()
        try {
            loading.value = true
            const url = `https://api.themoviedb.org/3/tv/${id}/videos?language=en-US`;
            if (!tvShowVideosCache.has(url)) {
                tvShowVideosCache.set(url, useAxios().get(url).then(r => r.data));
            }
            const res = await tvShowVideosCache.get(url)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            const url = `https://api.themoviedb.org/3/tv/${id}/videos?language=en-US`;
            tvShowVideosCache.delete(url);
        } finally {
            loading.value = false
        }

        return {
            loading,
            error,
            data
        }
    
    }
    return{
        fetchNewShows,
        fetchDiscoverShows,
        fetchTvShow,
        fetchTvShowCredit,
        fetchTvShowImages,
        fetchSimilarTvShows,
        fetchTvShowBySeason,
        fetchTvShowVideos
    }
}