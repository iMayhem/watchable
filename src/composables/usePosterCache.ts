export interface CatalogArtworkUrlMaps {
    posters: Map<string, string>;
    backdrops: Map<string, string>;
}

const EMPTY_MAPS: CatalogArtworkUrlMaps = {
    posters: new Map(),
    backdrops: new Map()
};

export async function fetchCatalogArtworkUrlsByIds(
    _ids: Array<string | number>
): Promise<CatalogArtworkUrlMaps> {
    return { posters: new Map(), backdrops: new Map() };
}

/** @deprecated Use fetchCatalogArtworkUrlsByIds */
export async function fetchPosterUrlsByCatalogIds(
    ids: Array<string | number>
): Promise<Map<string, string>> {
    const maps = await fetchCatalogArtworkUrlsByIds(ids);
    return maps.posters;
}

export function peekCachedCatalogArtworkUrls(_id: string | number): CatalogArtworkUrlMaps {
    return EMPTY_MAPS;
}

export { EMPTY_MAPS as emptyCatalogArtworkUrlMaps };
