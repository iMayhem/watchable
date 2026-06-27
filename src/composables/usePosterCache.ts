export interface CatalogArtworkUrlMaps {
    posters: Map<string, string>;
    backdrops: Map<string, string>;
}

export const EMPTY_MAPS: CatalogArtworkUrlMaps = {
    posters: new Map(),
    backdrops: new Map()
};

const STORAGE_KEY = 'moovie_poster_cache_v1';
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface CacheEntry {
    posters: Record<string, string>;
    backdrops: Record<string, string>;
    cachedAt: number;
}

function readCache(): CacheEntry | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw) as CacheEntry;
        if (Date.now() - entry.cachedAt > CACHE_TTL) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return entry;
    } catch {
        return null;
    }
}

function writeCache(posters: Record<string, string>, backdrops: Record<string, string>) {
    try {
        const entry: CacheEntry = { posters, backdrops, cachedAt: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
    }
}

export async function fetchCatalogArtworkUrlsByIds(
    ids: Array<string | number>
): Promise<CatalogArtworkUrlMaps> {
    if (!ids.length) return EMPTY_MAPS;

    const cached = readCache();
    if (cached) {
        return {
            posters: new Map(Object.entries(cached.posters)),
            backdrops: new Map(Object.entries(cached.backdrops))
        };
    }

    return EMPTY_MAPS;
}

export function cacheCatalogArtworkUrls(
    posters: Record<string, string>,
    backdrops: Record<string, string>
) {
    writeCache(posters, backdrops);
}

export function peekCachedCatalogArtworkUrls(_id: string | number): CatalogArtworkUrlMaps {
    const cached = readCache();
    if (!cached) return EMPTY_MAPS;
    return {
        posters: new Map(Object.entries(cached.posters)),
        backdrops: new Map(Object.entries(cached.backdrops))
    };
}

export function invalidatePosterCache() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
}

export { EMPTY_MAPS as emptyCatalogArtworkUrlMaps };
