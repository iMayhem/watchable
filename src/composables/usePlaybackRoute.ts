import { ref } from 'vue';

export type PlaybackRoute = 'auto' | 'direct' | 'proxy';

const STORAGE_KEY = 'movora_playback_route';

const ROUTE_EVENT = 'movora_playback_route_change';

function readSaved(): PlaybackRoute {
    if (typeof localStorage === 'undefined') return 'auto';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'direct' || saved === 'proxy' || saved === 'auto') return saved;
    return 'auto';
}

// Applied route — persisted to localStorage so it survives page reloads and restarts.
const savedRoute = ref<PlaybackRoute>(readSaved());

// Draft route — what the user has selected in the UI but has NOT saved yet.
// Playback keeps using `savedRoute` until the user explicitly hits Save.
const draftRoute = ref<PlaybackRoute>(savedRoute.value);

export function usePlaybackRoute() {
    function setDraft(route: PlaybackRoute) {
        draftRoute.value = route;
    }

    function resetDraft() {
        draftRoute.value = savedRoute.value;
    }

    function saveRoute() {
        savedRoute.value = draftRoute.value;
        localStorage.setItem(STORAGE_KEY, savedRoute.value);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(ROUTE_EVENT, { detail: { route: savedRoute.value } }));
        }
        return savedRoute.value;
    }

    function getSavedRoute(): PlaybackRoute {
        return savedRoute.value;
    }

    // Resolve the admin-level proxy toggle against the user's saved route.
    //   auto   → follow the site-wide (admin) setting
    //   direct → never proxy
    //   proxy  → always proxy through the VPS
    function routeProxyEnabled(adminEnabled: boolean): boolean {
        if (savedRoute.value === 'direct') return false;
        if (savedRoute.value === 'proxy') return true;
        return adminEnabled;
    }

    return { savedRoute, draftRoute, setDraft, resetDraft, saveRoute, getSavedRoute, routeProxyEnabled, ROUTE_EVENT };
}
