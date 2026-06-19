import {
    browseMoovieCatalog,
    type BrowseCatalogOptions,
    type MoovieCatalogItem
} from './useMoovieCatalog';
import {
    browseRowNeedsTmdbForPick,
    enrichCatalogPoolWithTmdb,
    filterCataloguePool,
    pickKoreanCatalogueBrowseItems,
    pickNativeCategoryBrowseItems,
    pickNetflixBrowseItems,
    type CatalogTmdbMeta,
    type NetflixBrowseRowId
} from './useNetflixRails';
import { itemMatchesLanguage, type NetflixLanguageOption } from './useNetflixLanguage';
import { loadNetflixAvailabilityIndex } from './useNetflixProvider';
import {
    getBrowseInitialPageCount,
    getCatalogBrowseFetchPlan,
    type CatalogBrowseSource
} from '../data/netflixCatalogCategories';
import { nfDebug } from './useNetflixDebug';
import {
    enrichmentRowToTmdbMeta,
    fetchEnrichmentByBrowseCategory,
    type CatalogEnrichmentRow
} from './useCatalogEnrichmentCache';

export const BROWSE_GRID_BATCH = 40;
export const BROWSE_INITIAL_PAGES = 16;
export const BROWSE_PAGE_BATCH = 8;
export const BROWSE_MAX_PAGES = 81;
export const BROWSE_PICK_LIMIT = 600;
export const BROWSE_TMDB_CHUNK = 120;
export const BROWSE_TMDB_CONCURRENCY = 14;
export const BROWSE_ENRICH_PASSES = 24;

export interface SlugBrowseCursor {
    source: CatalogBrowseSource;
    pageCursor: number;
    totalPages: number;
    exhausted: boolean;
}

export interface BrowsePoolState {
    browsePool: MoovieCatalogItem[];
    pickedItems: MoovieCatalogItem[];
    tmdbById: Map<string, CatalogTmdbMeta>;
    enrichmentById: Map<string, CatalogEnrichmentRow>;
    enrichmentLoaded: boolean;
    fetchMode: 'native' | 'language';
    slugCursors: SlugBrowseCursor[];
    apiPageCursor: number;
    apiTotalPages: number;
    canFetchMoreApi: boolean;
}

export function createBrowsePoolState(
    rowId: NetflixBrowseRowId,
    catalogueId: string
): BrowsePoolState {
    const plan = getCatalogBrowseFetchPlan(rowId, catalogueId);
    return {
        browsePool: [],
        pickedItems: [],
        tmdbById: new Map(),
        enrichmentById: new Map(),
        enrichmentLoaded: false,
        fetchMode: plan.mode,
        slugCursors:
            plan.mode === 'native'
                ? plan.sources.map((source) => ({
                      source,
                      pageCursor: 0,
                      totalPages: 1,
                      exhausted: false
                  }))
                : [],
        apiPageCursor: 0,
        apiTotalPages: 1,
        canFetchMoreApi: true
    };
}

function browseOptionsForSource(source: CatalogBrowseSource): BrowseCatalogOptions | undefined {
    const options: BrowseCatalogOptions = {};
    if (source.dubbing) options.dubbing = source.dubbing;
    if (source.country) options.country = source.country;
    if (source.type) options.type = source.type;
    if (source.genre) options.genre = source.genre;
    return Object.keys(options).length ? options : undefined;
}

function mergeIntoBrowsePool(
    state: BrowsePoolState,
    items: MoovieCatalogItem[],
    lang: NetflixLanguageOption
) {
    const seen = new Set(state.browsePool.map((item) => item.id));

    for (const item of items) {
        if (!itemMatchesLanguage(item, lang) || seen.has(item.id)) continue;
        seen.add(item.id);
        state.browsePool.push(item);
    }
}

function refreshNativeFetchAvailability(state: BrowsePoolState) {
    state.canFetchMoreApi = state.slugCursors.some((cursor) => !cursor.exhausted);
}

function refreshLanguageFetchAvailability(state: BrowsePoolState) {
    state.canFetchMoreApi =
        state.apiPageCursor < state.apiTotalPages && state.apiPageCursor < BROWSE_MAX_PAGES;
}

async function syncTmdbChunk(state: BrowsePoolState, items: MoovieCatalogItem[]) {
    const pending = items.filter((item) => !state.tmdbById.has(String(item.id)));
    if (!pending.length) return;

    const fresh = await enrichCatalogPoolWithTmdb(
        pending.slice(0, BROWSE_TMDB_CHUNK),
        BROWSE_TMDB_CONCURRENCY
    );
    fresh.forEach((meta, id) => state.tmdbById.set(id, meta));
}

function seedTmdbFromEnrichment(state: BrowsePoolState) {
    state.enrichmentById.forEach((row, catalogId) => {
        if (!state.tmdbById.has(catalogId) && row.tmdb_genre_ids.length) {
            state.tmdbById.set(catalogId, enrichmentRowToTmdbMeta(row));
        }
    });
}

async function loadBrowseEnrichment(state: BrowsePoolState, rowId: NetflixBrowseRowId) {
    if (state.enrichmentLoaded) return;

    const rows = await fetchEnrichmentByBrowseCategory(rowId);
    state.enrichmentLoaded = rows.length > 0;
    state.enrichmentById = new Map(rows.map((row) => [row.catalog_id, row]));
    seedTmdbFromEnrichment(state);

    nfDebug('browse-pool:enrichment', {
        row: rowId,
        loaded: state.enrichmentLoaded,
        count: rows.length
    });
}

export function rebuildBrowsePicks(
    state: BrowsePoolState,
    rowId: NetflixBrowseRowId,
    catalogue: { label: string; id: string },
    lang: NetflixLanguageOption
) {
    const pool = filterCataloguePool(state.browsePool, catalogue.id, lang);

    if (catalogue.id === 'korean' && state.fetchMode === 'language') {
        state.pickedItems = pickKoreanCatalogueBrowseItems(
            pool,
            rowId,
            new Set<string>(),
            BROWSE_PICK_LIMIT,
            state.tmdbById,
            state.enrichmentById
        );
        return;
    }

    if (state.fetchMode === 'native') {
        state.pickedItems = pickNativeCategoryBrowseItems(
            pool,
            rowId,
            state.tmdbById,
            BROWSE_PICK_LIMIT,
            state.enrichmentById
        );
        return;
    }

    state.pickedItems = pickNetflixBrowseItems(
        pool,
        rowId,
        catalogue,
        lang,
        state.tmdbById,
        BROWSE_PICK_LIMIT,
        state.enrichmentById
    );
}

export async function enrichBrowsePoolForPicking(
    state: BrowsePoolState,
    rowId: NetflixBrowseRowId,
    catalogue: { label: string; id: string },
    lang: NetflixLanguageOption,
    targetCount: number
) {
    if (!browseRowNeedsTmdbForPick(rowId, state.enrichmentLoaded)) return;

    for (let pass = 0; pass < BROWSE_ENRICH_PASSES; pass += 1) {
        if (state.pickedItems.length >= targetCount) break;

        const pool = filterCataloguePool(state.browsePool, catalogue.id, lang);
        const pending = pool.filter((item) => !state.tmdbById.has(String(item.id)));
        if (!pending.length) break;

        await syncTmdbChunk(state, pending);
        rebuildBrowsePicks(state, rowId, catalogue, lang);
    }
}

async function fetchNativeCategoryPages(
    state: BrowsePoolState,
    lang: NetflixLanguageOption,
    pageBudget: number
) {
    if (!state.slugCursors.length || pageBudget <= 0) return 0;

    let fetched = 0;

    for (const cursor of state.slugCursors) {
        if (fetched >= pageBudget || cursor.exhausted) continue;

        const page = cursor.pageCursor;
        const options = browseOptionsForSource(cursor.source);
        const response = await browseMoovieCatalog(cursor.source.slug, page, options);

        cursor.totalPages = Math.max(cursor.totalPages, response.pager?.total_pages ?? 1);
        mergeIntoBrowsePool(state, response.results || [], lang);

        cursor.pageCursor += 1;
        fetched += 1;

        if (cursor.pageCursor >= cursor.totalPages) {
            cursor.exhausted = true;
        }
    }

    refreshNativeFetchAvailability(state);
    return fetched;
}

async function fetchLanguageCatalogPages(
    state: BrowsePoolState,
    lang: NetflixLanguageOption,
    count: number
) {
    if (!state.canFetchMoreApi || count <= 0) return 0;

    const capped = Math.min(count, BROWSE_MAX_PAGES - state.apiPageCursor);
    if (capped <= 0) {
        state.canFetchMoreApi = false;
        return 0;
    }

    const pageNums = Array.from({ length: capped }, (_, i) => state.apiPageCursor + i);
    const pages = await Promise.all(
        pageNums.map((page) => browseMoovieCatalog(lang.category, page))
    );

    const seen = new Set(state.browsePool.map((item) => item.id));
    for (const page of pages) {
        state.apiTotalPages = Math.max(state.apiTotalPages, page.pager?.total_pages ?? 1);
        for (const item of page.results || []) {
            if (!itemMatchesLanguage(item, lang) || seen.has(item.id)) continue;
            seen.add(item.id);
            state.browsePool.push(item);
        }
    }

    state.apiPageCursor += pages.length;
    refreshLanguageFetchAvailability(state);

    return pages.length;
}

export async function fetchBrowseCatalogPages(
    state: BrowsePoolState,
    lang: NetflixLanguageOption,
    count: number
) {
    if (state.fetchMode === 'native') {
        return fetchNativeCategoryPages(state, lang, count);
    }
    return fetchLanguageCatalogPages(state, lang, count);
}

/**
 * Populate browse grid — NetMirror-style native category fetch when available,
 * otherwise fall back to paginated language browse + TMDB genre matching.
 */
export async function ensureBrowsePickCount(
    state: BrowsePoolState,
    rowId: NetflixBrowseRowId,
    catalogue: { label: string; id: string },
    lang: NetflixLanguageOption,
    targetCount: number
) {
    void loadNetflixAvailabilityIndex();
    await loadBrowseEnrichment(state, rowId);

    const initialPages =
        state.fetchMode === 'native'
            ? Math.max(state.slugCursors.length, 1)
            : getBrowseInitialPageCount(catalogue.id, state.fetchMode) || BROWSE_INITIAL_PAGES;

    if (!state.browsePool.length) {
        await fetchBrowseCatalogPages(state, lang, initialPages);
        rebuildBrowsePicks(state, rowId, catalogue, lang);
        await enrichBrowsePoolForPicking(state, rowId, catalogue, lang, targetCount);
    }

    let idleRounds = 0;

    while (state.pickedItems.length < targetCount && state.canFetchMoreApi) {
        const before = state.pickedItems.length;
        const batch =
            state.fetchMode === 'native'
                ? Math.max(state.slugCursors.filter((c) => !c.exhausted).length, 1)
                : BROWSE_PAGE_BATCH;

        if (state.fetchMode === 'language' && state.apiPageCursor >= BROWSE_MAX_PAGES) {
            break;
        }

        await fetchBrowseCatalogPages(state, lang, batch);
        await enrichBrowsePoolForPicking(state, rowId, catalogue, lang, targetCount);
        rebuildBrowsePicks(state, rowId, catalogue, lang);

        if (state.pickedItems.length === before) {
            idleRounds += 1;
            if (idleRounds >= 3) break;
        } else {
            idleRounds = 0;
        }
    }

    nfDebug('browse-pool:scan:done', {
        row: rowId,
        mode: state.fetchMode,
        target: targetCount,
        picked: state.pickedItems.length,
        pool: state.browsePool.length,
        pages: state.fetchMode === 'native' ? state.slugCursors : state.apiPageCursor,
        tmdb: state.tmdbById.size
    });
}