import { ref } from "vue"
import { Movie } from "./useHighlights"
import useAxios from "./useAxios"
import { TVShowType } from "./useTvShows"
export interface Actor {
    adult: boolean,
    gender: number,
    id: number,
    known_for: Movie[],
    known_for_department: string,
    name: string,
    popularity: number,
    profile_path: string
}
export interface ActorDetails extends Actor {
    also_known_as: string[],
    biography: string,
    birthday: string,
    deathday: string,
    homepage: string,
    imdb_id: string,
    place_of_birth: string
}
export interface ActorImages {
    profiles: {
        aspect_ratio: number,
        file_path: string,
        height: number,
        iso_639_1: string,
        vote_average: number,
        vote_count: number,
        width: number
    }[],
    id: number
}
interface ActorResponse {
    page: number,
    results: Actor[],
    total_pages: number,
    total_results: number
}
export interface ActorCombinedCredits {
    cast : Movie[] | TVShowType[],
    crew : TVShowType[] | Movie[]
}
const topActorsCache = new Map<string, Promise<any>>();
const detailsCache = new Map<number, Promise<any>>();
const imagesCache = new Map<number, Promise<any>>();
const creditsCache = new Map<number, Promise<any>>();

export const useActor = () => {
    const fetchTopActors = async (url: string = "trending/person/day" ) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<ActorResponse>()
        try {
            loading.value = true
            if (!topActorsCache.has(url)) {
                topActorsCache.set(url, useAxios().get(url).then(r => r.data));
            }
            const res = await topActorsCache.get(url)!;
            if (res.results) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            topActorsCache.delete(url);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchActorDetails = async (id: number) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<ActorDetails>()
        try {
            loading.value = true
            if (!detailsCache.has(id)) {
                detailsCache.set(id, useAxios().get(`person/${id}`).then(r => r.data));
            }
            const res = await detailsCache.get(id)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            detailsCache.delete(id);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchActorImages = async (id: number) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<ActorImages>()
        try {
            loading.value = true
            if (!imagesCache.has(id)) {
                imagesCache.set(id, useAxios().get(`person/${id}/images`).then(r => r.data));
            }
            const res = await imagesCache.get(id)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            imagesCache.delete(id);
        } finally {
            loading.value = false
        }
        return {
            loading,
            error,
            data
        }
    }
    const fetchCombinedCredits = async (id: number) => {
        let loading = ref(false)
        let error = ref("")
        let data = ref<ActorCombinedCredits>()
        try {
            loading.value = true
            if (!creditsCache.has(id)) {
                creditsCache.set(id, useAxios().get(`person/${id}/combined_credits`).then(r => r.data));
            }
            const res = await creditsCache.get(id)!;
            if (res) {
                data.value = res
            }
        } catch (err: any) {
            error.value = err.message
            creditsCache.delete(id);
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
        fetchTopActors,
        fetchActorDetails,
        fetchActorImages,
        fetchCombinedCredits
    }
}