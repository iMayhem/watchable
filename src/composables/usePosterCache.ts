import { getSupabaseClient } from '../lib/supabase';

const TABLE = 'poster_cache';
const CHUNK_SIZE = 200;

const memoryPosters = new Map<string, string>();
const memoryBackdrops = new Map<string, string>();

export interface CatalogArtworkUrlMaps {
    posters: Map<string, string>;
    backdrops: Map<string, string>;
}

const EMPTY_MAPS: CatalogArtworkUrlMaps = {
    posters: new Map(),
    backdrops: new Map()
};

export async function fetchCatalogArtworkUrlsByIds(
    ids: Array<string | number>
): Promise<CatalogArtworkUrlMaps> {
    const posters = new Map<string, string>();
    const backdrops = new Map<string, string>();
    const unique = [...new Set(ids.map(String).filter(Boolean))];
    const missing: string[] = [];

    for (const id of unique) {
        const poster = memoryPosters.get(id);
        const backdrop = memoryBackdrops.get(id);
        if (poster) posters.set(id, poster);
        if (backdrop) backdrops.set(id, backdrop);
        if (poster && backdrop) continue;
        missing.push(id);
    }

    if (!missing.length) return { posters, backdrops };

    try {
        const supabase = await getSupabaseClient();
        for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
            const chunk = missing.slice(i, i + CHUNK_SIZE);
            const { data, error } = await supabase
                .from(TABLE)
                .select('entity_id, size, public_url')
                .eq('entity_type', 'catalog')
                .in('size', ['medium', 'backdrop'])
                .in('entity_id', chunk);

            if (error) break;

            for (const row of data || []) {
                const id = String(row.entity_id);
                const url = String(row.public_url || '');
                if (!url) continue;
                if (row.size === 'backdrop') {
                    memoryBackdrops.set(id, url);
                    backdrops.set(id, url);
                } else {
                    memoryPosters.set(id, url);
                    posters.set(id, url);
                }
            }
        }
    } catch {
        // poster_cache table may not exist yet — safe to ignore
    }

    return { posters, backdrops };
}

/** @deprecated Use fetchCatalogArtworkUrlsByIds */
export async function fetchPosterUrlsByCatalogIds(
    ids: Array<string | number>
): Promise<Map<string, string>> {
    const maps = await fetchCatalogArtworkUrlsByIds(ids);
    return maps.posters;
}

export function peekCachedCatalogArtworkUrls(id: string | number): CatalogArtworkUrlMaps {
    const key = String(id);
    const posters = new Map<string, string>();
    const backdrops = new Map<string, string>();
    const poster = memoryPosters.get(key);
    const backdrop = memoryBackdrops.get(key);
    if (poster) posters.set(key, poster);
    if (backdrop) backdrops.set(key, backdrop);
    return { posters, backdrops };
}

export { EMPTY_MAPS as emptyCatalogArtworkUrlMaps };