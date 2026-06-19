import type { NetflixBrowseRowId } from '../composables/netflixCuratedRows';

export interface CatalogBrowseSource {
    slug: string;
    dubbing?: string;
    country?: string;
    type?: string;
    genre?: string;
}

export interface CatalogBrowseFetchPlan {
    mode: 'native' | 'language';
    sources: CatalogBrowseSource[];
}

/** imdb4 search2 category slugs (same upstream NetMirror uses). */
const GENRE_CATEGORY_SLUGS: Partial<Record<NetflixBrowseRowId, string[]>> = {
    'action-adventure': ['action'],
    anime: ['anime', 'japan', 'animated', 'animation'],
    'children-family-movies': ['family', 'kids'],
    comedies: ['comedy'],
    documentaries: ['documentary'],
    dramas: ['drama'],
    'horror-movies': ['horror'],
    lgbtq: ['lgbtq', 'queer', 'lesbian'],
    'romantic-movies': ['romance'],
    'sci-fi-fantasy': ['fantasy'],
    'tv-show': ['series']
};

const CATALOGUE_CATEGORY_SLUGS: Record<string, string> = {
    hollywood: 'hollywood',
    bollywood: 'bollywood',
    korean: 'korean'
};

/** Movie nav rows — paginate catalogue slug, never the series index. */
const MOVIE_EDITORIAL_ROW_IDS = new Set<NetflixBrowseRowId>([
    'blockbuster-movies',
    'top10-movies',
    'critically-acclaimed',
    'new-on-netflix',
    'korean-movies'
]);

/**
 * TV nav rows — paginate the active language dub feed (hindi/english/…).
 * The upstream `series` slug is mostly unrelated regional web series, not the
 * Hindi/English-dubbed Netflix catalogue users expect.
 */
const TV_EDITORIAL_ROW_IDS = new Set<NetflixBrowseRowId>([
    'exciting-tv',
    'top10-tv',
    'korean-series'
]);

function sourcesFromSlugs(slugs: string[]): CatalogBrowseSource[] {
    return slugs.map((slug) => ({ slug }));
}

export function hasNativeBrowseCategory(rowId: NetflixBrowseRowId): boolean {
    return Boolean(
        GENRE_CATEGORY_SLUGS[rowId]?.length || CATALOGUE_CATEGORY_SLUGS[rowId as string]
    );
}

/**
 * Korean titles live in the Hindi/English dub feeds (cn=Korea), not the tiny
 * upstream `korean` genre index alone — paginate the active language catalogue.
 */
function koreanCatalogueFetchPlan(rowId: NetflixBrowseRowId): CatalogBrowseFetchPlan {
    const source: CatalogBrowseSource = {
        slug: 'filter',
        country: 'Korea'
    };

    if (rowId === 'korean-series' || rowId === 'exciting-tv' || TV_EDITORIAL_ROW_IDS.has(rowId) || rowId === 'dramas' || rowId === 'tv-show') {
        source.type = '2'; // TV series
    } else {
        source.type = '1'; // Movie
    }

    return {
        mode: 'native',
        sources: [source]
    };
}

/** Home pool sources — Korean needs deeper language scans plus native K-slugs. */
export function getCatalogueHomeFetchSources(
    catalogueId: string,
    langCategory: string
): Array<{ slug: string; pages: number }> {
    if (catalogueId === 'korean') {
        return [
            { slug: langCategory, pages: 48 },
            { slug: 'korean', pages: 12 },
            { slug: 'drama', pages: 6 }
        ];
    }
    return [{ slug: langCategory, pages: 16 }];
}

export function getBrowseInitialPageCount(
    catalogueId: string,
    fetchMode: CatalogBrowseFetchPlan['mode'],
    rowId?: NetflixBrowseRowId
): number {
    if (rowId && TV_EDITORIAL_ROW_IDS.has(rowId) && fetchMode === 'language') {
        return catalogueId === 'korean' ? 48 : 12;
    }
    if (catalogueId === 'korean' && fetchMode === 'language') {
        return 40;
    }
    return fetchMode === 'native' ? 1 : 8;
}

export function isTvEditorialBrowseRow(rowId: NetflixBrowseRowId): boolean {
    return TV_EDITORIAL_ROW_IDS.has(rowId);
}

/** Resolve how to populate a browse page — mirrors NetMirror /explore/{slug} fetches. */
export function isKoreanLanguageCatalogueBrowse(
    catalogueId: string,
    fetchMode: CatalogBrowseFetchPlan['mode']
): boolean {
    return catalogueId === 'korean' && fetchMode === 'language';
}

export function getCatalogBrowseFetchPlan(
    rowId: NetflixBrowseRowId,
    catalogueId: string
): CatalogBrowseFetchPlan {
    if (catalogueId === 'korean') {
        return koreanCatalogueFetchPlan(rowId);
    }

    if (TV_EDITORIAL_ROW_IDS.has(rowId)) {
        return { mode: 'language', sources: [] };
    }

    // Movie nav rows use the active language feed (hindi/english/…) — not the
    // meta hollywood/bollywood slug index, which is mostly unrelated documentaries.
    if (MOVIE_EDITORIAL_ROW_IDS.has(rowId)) {
        return { mode: 'language', sources: [] };
    }

    const genreSlugs = GENRE_CATEGORY_SLUGS[rowId];
    if (genreSlugs?.length) {
        return { mode: 'native', sources: sourcesFromSlugs(genreSlugs) };
    }

    if (rowId === 'trending') {
        const catalogueSlug = CATALOGUE_CATEGORY_SLUGS[catalogueId];
        if (catalogueSlug) {
            return { mode: 'native', sources: [{ slug: catalogueSlug }] };
        }
    }

    return { mode: 'language', sources: [] };
}

export function isEditorialMediaBrowseRow(rowId: NetflixBrowseRowId): boolean {
    return MOVIE_EDITORIAL_ROW_IDS.has(rowId) || TV_EDITORIAL_ROW_IDS.has(rowId);
}