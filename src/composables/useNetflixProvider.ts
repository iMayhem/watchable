import useAxios from './useAxios';
import { nfDebug, nfDebugError } from './useNetflixDebug';

/** TMDB watch provider id for Netflix */
const NETFLIX_PROVIDER_ID = 8;
const WATCH_REGION = 'IN';
const CACHE_KEY = 'nf_netflix_availability_in_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DISCOVER_PAGES = 8;

let memoryIndex: Set<number> | null = null;
let loadPromise: Promise<Set<number>> | null = null;

function readCache(): Set<number> | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { fetchedAt: number; ids: number[] };
        if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
        return new Set(parsed.ids);
    } catch {
        return null;
    }
}

function writeCache(ids: Set<number>) {
    if (typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ fetchedAt: Date.now(), ids: [...ids] })
        );
    } catch {
        /* quota */
    }
}

async function fetchDiscoverPage(type: 'movie' | 'tv', page: number): Promise<number[]> {
    const res = await useAxios().get(`discover/${type}`, {
        params: {
            with_watch_providers: NETFLIX_PROVIDER_ID,
            watch_region: WATCH_REGION,
            page,
            sort_by: 'popularity.desc',
            include_adult: false
        }
    });
    return (res.data?.results || []).map((row: { id: number }) => row.id);
}

/**
 * TMDB titles currently on Netflix India — used to rank catalogue matches
 * (our playable pool still comes from the Moovie catalogue API).
 */
export async function loadNetflixAvailabilityIndex(): Promise<Set<number>> {
    if (memoryIndex) return memoryIndex;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        const cached = readCache();
        if (cached?.size) {
            memoryIndex = cached;
            nfDebug('netflix-provider:cache-hit', { count: cached.size });
            return cached;
        }

        const ids = new Set<number>();
        try {
            for (const type of ['movie', 'tv'] as const) {
                for (let page = 1; page <= MAX_DISCOVER_PAGES; page += 1) {
                    const pageIds = await fetchDiscoverPage(type, page);
                    pageIds.forEach((id) => ids.add(id));
                    if (pageIds.length < 20) break;
                }
            }
            memoryIndex = ids;
            writeCache(ids);
            nfDebug('netflix-provider:loaded', { count: ids.size, region: WATCH_REGION });
            return ids;
        } catch (err) {
            nfDebugError('netflix-provider:fail', { err });
            memoryIndex = new Set();
            return memoryIndex;
        } finally {
            loadPromise = null;
        }
    })();

    return loadPromise;
}

export function netflixAvailabilityBoost(
    tmdbId: number | undefined,
    index: Set<number> | null | undefined
): number {
    if (!tmdbId || !index?.size) return 0;
    return index.has(tmdbId) ? 20 : 0;
}

export function isOnNetflixIndia(
    tmdbId: number | undefined,
    index: Set<number> | null | undefined
): boolean {
    return Boolean(tmdbId && index?.has(tmdbId));
}

export function getNetflixAvailabilityIndex(): Set<number> | null {
    return memoryIndex;
}