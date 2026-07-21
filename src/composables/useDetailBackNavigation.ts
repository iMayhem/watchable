import { computed } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';
import { useAppPaths } from './useAppPaths';

const DETAIL_RETURN_KEY = 'moovie:detail-return';

const DETAIL_ROUTE_NAMES = new Set([
    'AnimeDetail',
    'Movie',
    'TVShow',
    'Actor'
]);

const DETAIL_PREFIXES = [
    '/movie/',
    '/tv-show/',
    '/anime/',
    '/stream/'
];

function isDetailPath(path: string): boolean {
    return DETAIL_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** True when browser history has an in-app listing page to return to. */
function isReturnableListingPath(path: string): boolean {
    if (!path) return false;
    if (isDetailPath(path)) return false;
    if (path.startsWith('/stream/')) return false;
    return true;
}

function readHistoryBackPath(): string | null {
    const back = window.history.state?.back;
    return typeof back === 'string' ? back : null;
}

function readStoredDetailReturnPath(): string | null {
    if (typeof window === 'undefined') return null;
    const stored = sessionStorage.getItem(DETAIL_RETURN_KEY);
    return stored && isReturnableListingPath(stored) ? stored : null;
}

function listingFallbackForDetail(routePath: string, paths: ReturnType<typeof useAppPaths>): string {
    if (/\/anime\/\d+/.test(routePath)) return paths.animeList.value;
    if (/\/movie\/\d+/.test(routePath)) return paths.movies.value;
    if (/\/tv-show\/\d+/.test(routePath) || /^\/m?\/tv\/\d+/.test(routePath)) {
        return paths.tvShows.value;
    }
    if (/\/actor\/\d+/.test(routePath)) return paths.actors.value;
    if (routePath.startsWith('/nf/anime/')) return '/nf/browse/hollywood/anime';
    if (routePath.startsWith('/nf/movie/')) return '/nf/explore/movie';
    if (routePath.startsWith('/nf/tv/')) return '/nf/explore/tv';
    return paths.home.value;
}

/** Call from router beforeEach to remember which listing page opened a detail view. */
export function recordDetailReturnPath(
    from: RouteLocationNormalized,
    to: RouteLocationNormalized
): void {
    if (typeof window === 'undefined') return;
    if (!to.name || !DETAIL_ROUTE_NAMES.has(String(to.name))) return;
    if (!from.name || DETAIL_ROUTE_NAMES.has(String(from.name))) return;
    if (!from.matched.length || !from.path || isDetailPath(from.path)) return;
    sessionStorage.setItem(DETAIL_RETURN_KEY, from.fullPath);
}

export function useDetailBackNavigation() {
    const router = useRouter();
    const route = useRoute();
    const paths = useAppPaths();

    const backPath = computed(() => {
        route.fullPath;
        return readStoredDetailReturnPath() || readHistoryBackPath();
    });

    const canGoBack = computed(() => {
        const path = backPath.value;
        return path != null && isReturnableListingPath(path);
    });

    function goBackToIssue() {
        const stored = readStoredDetailReturnPath();
        if (stored) {
            router.push(stored);
            return;
        }

        const back = readHistoryBackPath();
        if (back && isReturnableListingPath(back)) {
            router.push(back);
            return;
        }

        router.push(listingFallbackForDetail(route.path, paths));
    }

    return {
        home: paths.home,
        backPath,
        canGoBack,
        goBackToIssue
    };
}