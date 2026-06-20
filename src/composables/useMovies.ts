import { ref } from "vue"
import { Movie } from "./useHighlights"
import {Actor} from "./useActor"
import useAxios from "./useAxios"
import { useRouter } from "vue-router"

export interface MovieResponse {
    page: number,
    results: Movie[],
    total_pages: number,
    total_results: number
}
export interface MovieDetails{
    adult: boolean,
    backdrop_path: string,
    belongs_to_collection: null | object,
    budget: number,
    genres: {
        id: number,
        name: string
    }[],
    homepage: string,
    id: number,
    imdb_id: string,
    original_language: string,
    original_title: string,
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
    release_date: string,
    revenue: number,
    runtime: number,
    spoken_languages: {
        english_name: string,
        iso_639_1: string,
        name: string
    }[],
    status: string,
    tagline: string,
    title: string,
    video: boolean,
    vote_average: number,
    vote_count: number
}

export interface Cast  extends Actor{
    character: string,
    credit_id: string,
    order: number
}
export interface Crew  extends Actor{
    character: string,
    credit_id: string,
    job: string
}
export interface MovieCredit {
    id: number,
    cast: Cast[],
    crew: Crew[]
}
export interface Image {
    aspect_ratio: number,
    height: number,
    iso_639_1: null | string,
    file_path: string,
    vote_average: number,
    vote_count: number,
    width: number
}
export interface MovieImages {
    backdrops:Image[],
    id: number,
    logos: Image[],
    posters: Image[]
}
export interface MovieVideo {
    id: string,
    iso_639_1: string,
    iso_3166_1: string,
    key: string,
    name: string,
    site: string,
    size: number,
    type: string
}
const router = useRouter()
export const handleMovieClick = (id: number) => {
    router.push({name: "Movie", params: {id: id.toString()}})
}
const discoverMoviesCache = new Map<string, Promise<any>>();
const movieDetailsCache = new Map<string, Promise<any>>();
const movieCreditsCache = new Map<string, Promise<any>>();
const movieImagesCache = new Map<string, Promise<any>>();
const similarMoviesCache = new Map<string, Promise<any>>();
const movieVideosCache = new Map<string, Promise<any>>();

export const useMovies = () => {
    const fetchDiscoverMovies = async (url: string = "https://api.themoviedb.org/3/discover/movie" ) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<MovieResponse>()
        try {
            loading.value = true
            if (!discoverMoviesCache.has(url)) {
                discoverMoviesCache.set(url, useAxios().get(url).then(r => r.data));
            }
            const res = await discoverMoviesCache.get(url)!;
            if (res.results) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            discoverMoviesCache.delete(url);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchMovie = async (id: string) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<MovieDetails>()
        try {
            loading.value = true
            if (!movieDetailsCache.has(id)) {
                movieDetailsCache.set(id, useAxios().get(`https://api.themoviedb.org/3/movie/${id}`).then(r => r.data));
            }
            const res = await movieDetailsCache.get(id)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            movieDetailsCache.delete(id);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchMovieCredits = async (id: string) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<MovieCredit>()
        try {
            loading.value = true
            if (!movieCreditsCache.has(id)) {
                movieCreditsCache.set(id, useAxios().get(`https://api.themoviedb.org/3/movie/${id}/credits`).then(r => r.data));
            }
            const res = await movieCreditsCache.get(id)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            movieCreditsCache.delete(id);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchMovieImages = async (id:string) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<MovieImages>()
        try {
            loading.value = true
            const url = `https://api.themoviedb.org/3/movie/${id}/images?include_image_language=en`;
            if (!movieImagesCache.has(url)) {
                movieImagesCache.set(url, useAxios().get(url).then(r => r.data));
            }
            const res = await movieImagesCache.get(url)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            const url = `https://api.themoviedb.org/3/movie/${id}/images?include_image_language=en`;
            movieImagesCache.delete(url);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchSimilarMovies = async (id:string) =>{
        let loading = ref(false)
        let error = ref("")
        let data = ref<MovieResponse>()
        try {
            loading.value = true
            const url = `https://api.themoviedb.org/3/movie/${id}/similar?language=en-US&page=1`;
            if (!similarMoviesCache.has(url)) {
                similarMoviesCache.set(url, useAxios().get(url).then(r => r.data));
            }
            const res = await similarMoviesCache.get(url)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            const url = `https://api.themoviedb.org/3/movie/${id}/similar?language=en-US&page=1`;
            similarMoviesCache.delete(url);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchMovieVideos = async (id:string) =>{
        let loading = ref(false)
        let error = ref("")
        let data = ref<{
            id: string,
            results: MovieVideo[]
        }>()
        try {
            loading.value = true
            const url = `https://api.themoviedb.org/3/movie/${id}/videos?language=en-US`;
            if (!movieVideosCache.has(url)) {
                movieVideosCache.set(url, useAxios().get(url).then(r => r.data));
            }
            const res = await movieVideosCache.get(url)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            const url = `https://api.themoviedb.org/3/movie/${id}/videos?language=en-US`;
            movieVideosCache.delete(url);
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
        fetchDiscoverMovies,
        fetchMovie,
        fetchMovieCredits,
        fetchMovieImages,
        fetchSimilarMovies,
        fetchMovieVideos
    }
}