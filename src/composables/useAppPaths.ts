import { computed } from 'vue';
import { useRoute } from 'vue-router';

export function useIsMobileApp() {
    const route = useRoute();
    return computed(() => route.path === '/m' || route.path.startsWith('/m/'));
}

export function useAppPaths() {
    const isMobile = useIsMobileApp();
    const prefix = computed(() => (isMobile.value ? '/m' : ''));

    const home = computed(() => (isMobile.value ? '/m' : '/'));

    function movie(id: number | string) {
        return `${prefix.value}/movie/${id}`;
    }

    function tvShow(id: number | string) {
        return `${prefix.value}/tv-show/${id}`;
    }

    function anime(id: number | string) {
        return `${prefix.value}/anime/${id}`;
    }

    function actor(id: number | string) {
        return `${prefix.value}/actor/${id}`;
    }

    function streamMovie(id: number | string) {
        return `${prefix.value}/stream/movie/${id}`;
    }

    function streamTvShow(id: number | string, season: number | string, episode: number | string) {
        return `${prefix.value}/stream/tv-show/${id}/season/${season}/episode/${episode}`;
    }

    function streamAnime(
        id: number | string,
        episode?: number | string,
        anilistId?: number | string | null
    ) {
        const base = episode != null
            ? `${prefix.value}/stream/anime/${id}/episode/${episode}`
            : `${prefix.value}/stream/anime/${id}`;
        const ani = Number(anilistId);
        if (Number.isFinite(ani) && ani > 0) {
            return `${base}?ani=${ani}`;
        }
        return base;
    }

    function detailPath(type: 'movie' | 'tv' | 'anime', id: number | string) {
        if (type === 'tv') return tvShow(id);
        if (type === 'anime') return anime(id);
        return movie(id);
    }

    const movies = computed(() => `${prefix.value}/movies`);
    const tvShows = computed(() => `${prefix.value}/tv-shows`);
    const animeList = computed(() => `${prefix.value}/anime`);
    const search = computed(() => `${prefix.value}/search`);
    const watchlist = computed(() => `${prefix.value}/watchlist`);
    const actors = computed(() => `${prefix.value}/actors`);
    const liveTv = computed(() => `${prefix.value}/livetv`);
    const party = computed(() => `${prefix.value}/party`);
    const upcoming = computed(() => `${prefix.value}/upcoming`);
    const discuss = computed(() => `${prefix.value}/discuss`);
    const help = computed(() => `${prefix.value}/help`);
    const more = computed(() => `${prefix.value}/more`);

    const streamMovieRouteName = computed(() => (isMobile.value ? 'm-StreamMovie' : 'StreamMovie'));
    const streamTvRouteName = computed(() => (isMobile.value ? 'm-StreamTVShow' : 'StreamTVShow'));
    const streamAnimeRouteName = computed(() => (isMobile.value ? 'm-StreamAnime' : 'StreamAnime'));
    const streamAnimeEpisodeRouteName = computed(() =>
        isMobile.value ? 'm-StreamAnimeEpisode' : 'StreamAnimeEpisode'
    );

    return {
        isMobile,
        prefix,
        home,
        movies,
        tvShows,
        animeList,
        search,
        watchlist,
        actors,
        liveTv,
        party,
        upcoming,
        discuss,
        help,
        more,
        movie,
        tvShow,
        anime,
        actor,
        streamMovie,
        streamTvShow,
        streamAnime,
        detailPath,
        streamMovieRouteName,
        streamTvRouteName,
        streamAnimeRouteName,
        streamAnimeEpisodeRouteName
    };
}
