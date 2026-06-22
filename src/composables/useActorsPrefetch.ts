import { useActor } from './useActor';

const POPULAR_ACTORS_URL = 'https://api.themoviedb.org/3/person/popular?page=1';

let actorsRoutePrefetch: Promise<unknown> | null = null;

/** Prime the Actors page chunk (hover / focus on nav). */
export function prefetchActorsRoute() {
    if (!actorsRoutePrefetch) {
        actorsRoutePrefetch = import('../pages/Actors.vue');
    }
    return actorsRoutePrefetch;
}

/** Warm the popular roster API so the grid can paint right after navigation. */
export function prefetchPopularActors() {
    prefetchActorsRoute();
    const { fetchTopActors } = useActor();
    void fetchTopActors(POPULAR_ACTORS_URL);
}

/** Prime actor dossier APIs before navigating from the roster grid. */
export function prefetchActorProfile(id: number | string) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return;
    const { fetchActorDetails, fetchActorImages, fetchCombinedCredits } = useActor();
    void fetchActorDetails(numericId);
    void fetchActorImages(numericId);
    void fetchCombinedCredits(numericId);
}