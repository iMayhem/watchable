import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppPaths } from './useAppPaths';

const DETAIL_PREFIXES = [
    '/nf/movie/',
    '/nf/tv/',
    '/nf/anime/',
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

export function useDetailBackNavigation() {
    const router = useRouter();
    const { home } = useAppPaths();

    const backPath = computed(() => readHistoryBackPath());

    const canGoBack = computed(() => {
        const path = backPath.value;
        return path != null && isReturnableListingPath(path);
    });

    function goBackToIssue() {
        if (canGoBack.value) {
            router.back();
            return;
        }
        router.push(home.value);
    }

    return {
        home,
        backPath,
        canGoBack,
        goBackToIssue
    };
}