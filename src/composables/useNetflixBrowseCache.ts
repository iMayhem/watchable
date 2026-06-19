import type { CuratedItem } from '../components/rails/CuratedRail.vue';
import type { MoovieCatalogItem } from './useMoovieCatalog';
import type { BrowsePoolState } from './useNetflixBrowsePool';

export interface CachedGenreRail {
    id: string;
    title: string;
    defaultType: 'movie' | 'tv';
    items: CuratedItem[];
}

export interface NetflixBrowseCacheSnapshot {
    results: CuratedItem[];
    poolState: BrowsePoolState;
    displayedCount: number;
    genreRails: CachedGenreRail[];
    languageMapEntries: Array<[string, string[]]>;
    variantSnapshot: MoovieCatalogItem[];
    loadKey: string;
    savedAt: number;
}

const CACHE_TTL_MS = 8 * 60 * 1000;
/** Bump when browse pick / media-type logic changes — invalidates stale snapshots. */
const BROWSE_CACHE_VERSION = 4;
const MAX_CACHE_ENTRIES = 12;
const browseCache = new Map<string, NetflixBrowseCacheSnapshot>();
const warmInflight = new Set<string>();

export function cloneBrowsePoolState(state: BrowsePoolState): BrowsePoolState {
    return {
        ...state,
        browsePool: [...state.browsePool],
        pickedItems: [...state.pickedItems],
        tmdbById: new Map(state.tmdbById),
        enrichmentById: new Map(state.enrichmentById),
        slugCursors: state.slugCursors.map((cursor) => ({ ...cursor }))
    };
}

export function browseCacheKey(
    catalogueId: string,
    rowId: string,
    languageCategory: string
): string {
    return `v${BROWSE_CACHE_VERSION}:${catalogueId}:${rowId}:${languageCategory}`;
}

export function readNetflixBrowseCache(loadKey: string): NetflixBrowseCacheSnapshot | null {
    const entry = browseCache.get(loadKey);
    if (!entry) return null;
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
        browseCache.delete(loadKey);
        return null;
    }
    return {
        ...entry,
        results: [...entry.results],
        poolState: cloneBrowsePoolState(entry.poolState),
        genreRails: entry.genreRails.map((rail) => ({
            ...rail,
            items: [...rail.items]
        })),
        languageMapEntries: [...entry.languageMapEntries],
        variantSnapshot: [...entry.variantSnapshot]
    };
}

export function writeNetflixBrowseCache(
    loadKey: string,
    snapshot: Omit<NetflixBrowseCacheSnapshot, 'loadKey' | 'savedAt'>
) {
    browseCache.set(loadKey, {
        ...snapshot,
        poolState: cloneBrowsePoolState(snapshot.poolState),
        loadKey,
        savedAt: Date.now()
    });

    if (browseCache.size <= MAX_CACHE_ENTRIES) return;

    const oldest = [...browseCache.entries()].sort((a, b) => a[1].savedAt - b[1].savedAt);
    while (browseCache.size > MAX_CACHE_ENTRIES && oldest.length) {
        const [key] = oldest.shift()!;
        browseCache.delete(key);
    }
}

export function markBrowseWarmInflight(loadKey: string): boolean {
    if (browseCache.has(loadKey) || warmInflight.has(loadKey)) return false;
    warmInflight.add(loadKey);
    return true;
}

export function clearBrowseWarmInflight(loadKey: string) {
    warmInflight.delete(loadKey);
}