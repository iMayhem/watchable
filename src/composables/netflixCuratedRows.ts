import type { NetflixLanguageOption } from './useNetflixLanguage';
import { resolveTmdbGenreSpec, type TmdbGenreSpec } from './netflixTmdbGenres';
import genreRows from '../data/netflixGenreCodes.json';

export type NetflixRowSection = 'editorial' | 'genre';

export type NetflixRowPickKind =
    | 'top-rated'
    | 'newest'
    | 'all'
    | 'keywords'
    | 'keyword-groups'
    | 'tmdb-genre';

export interface NetflixCuratedRowDef {
    id: string;
    title: string;
    eyebrow: string;
    defaultType: 'movie' | 'tv';
    section: NetflixRowSection;
    priority: number;
    netflixCode?: number;
    catalogues?: string[];
    keywords?: string[];
    keywordGroups?: string[][];
    pick: NetflixRowPickKind;
    minRating?: number;
    homeDedupe?: boolean;
    /** Foreign/regional row — take top titles from the already-filtered catalogue pool. */
    cataloguePoolOnly?: boolean;
    tmdbGenres?: TmdbGenreSpec;
    description?: (catalogueLabel: string, lang: NetflixLanguageOption) => string;
}

const EDITORIAL_ROWS: NetflixCuratedRowDef[] = [
    {
        id: 'top10-movies',
        title: 'Top 10 Movies Today',
        eyebrow: 'Top 10',
        defaultType: 'movie',
        section: 'editorial',
        priority: 3200,
        pick: 'top-rated',
        homeDedupe: true,
        description: (catalogueLabel) => `Today's most popular movies in ${catalogueLabel}.`
    },
    {
        id: 'top10-tv',
        title: 'Top 10 TV Shows Today',
        eyebrow: 'Top 10',
        defaultType: 'tv',
        section: 'editorial',
        priority: 3190,
        pick: 'top-rated',
        homeDedupe: true,
        description: (catalogueLabel) => `Today's most popular series in ${catalogueLabel}.`
    },
    {
        id: 'new-on-netflix',
        title: 'New on Netflix',
        eyebrow: 'New arrivals',
        defaultType: 'movie',
        section: 'editorial',
        priority: 3180,
        pick: 'newest',
        homeDedupe: true,
        description: (catalogueLabel, lang) =>
            `Recently added ${catalogueLabel} titles in ${lang.label}.`
    },
    {
        id: 'blockbuster-movies',
        title: 'Blockbuster Movies',
        eyebrow: 'Hits',
        defaultType: 'movie',
        section: 'editorial',
        priority: 3170,
        pick: 'top-rated',
        minRating: 6.5,
        homeDedupe: true,
        description: (catalogueLabel, lang) =>
            `Big ${catalogueLabel} films with ${lang.label} audio.`
    },
    {
        id: 'critically-acclaimed',
        title: 'Critically Acclaimed Movies',
        eyebrow: 'Award season',
        defaultType: 'movie',
        section: 'editorial',
        priority: 3160,
        pick: 'top-rated',
        minRating: 7.5,
        homeDedupe: true,
        description: (catalogueLabel) => `Standout ${catalogueLabel} movies rated 7.5+.`
    },
    {
        id: 'exciting-tv',
        title: 'Exciting TV Shows',
        eyebrow: 'Series',
        defaultType: 'tv',
        section: 'editorial',
        priority: 3150,
        pick: 'top-rated',
        minRating: 6,
        homeDedupe: true,
        description: (catalogueLabel, lang) =>
            `Binge-worthy ${catalogueLabel} series in ${lang.label}.`
    },
    {
        id: 'only-on-netflix',
        title: 'Only on Netflix',
        eyebrow: 'Exclusive',
        defaultType: 'movie',
        section: 'editorial',
        priority: 2000,
        pick: 'all',
        homeDedupe: true,
        description: (catalogueLabel) => `More ${catalogueLabel} titles you can watch now.`
    }
];

function genreRowDescription(
    title: string,
    eyebrow: string,
    catalogueLabel: string,
    lang: NetflixLanguageOption
) {
    if (eyebrow === 'Browse') {
        return `${title} from ${catalogueLabel} in ${lang.label}.`;
    }
    return `${title} — ${eyebrow} picks in ${catalogueLabel}.`;
}

const IMPORTED_GENRE_ROWS: NetflixCuratedRowDef[] = (genreRows as Array<{
    id: string;
    netflixCode: number;
    title: string;
    eyebrow: string;
    defaultType: 'movie' | 'tv';
    keywords: string[];
    keywordGroups?: string[][];
    catalogues?: string[];
    priority: number;
    section: 'genre';
}>).map((row) => {
    const cataloguePoolOnly =
        row.eyebrow === 'Foreign movies' && Boolean(row.catalogues?.length);
    return {
        id: row.id,
        netflixCode: row.netflixCode,
        title: row.title,
        eyebrow: row.eyebrow,
        defaultType: row.defaultType,
        section: 'genre' as const,
        priority: row.priority,
        catalogues: row.catalogues,
        keywords: row.keywords,
        keywordGroups: row.keywordGroups,
        pick: cataloguePoolOnly ? 'top-rated' : 'tmdb-genre',
        cataloguePoolOnly,
        tmdbGenres: resolveTmdbGenreSpec(row.id, row.eyebrow, row.title),
        homeDedupe: false,
        description: (catalogueLabel, lang) =>
            genreRowDescription(row.title, row.eyebrow, catalogueLabel, lang)
    };
});

export const NETFLIX_CURATED_ROW_DEFS: NetflixCuratedRowDef[] = [
    ...EDITORIAL_ROWS,
    ...IMPORTED_GENRE_ROWS
].sort((a, b) => b.priority - a.priority);

export const NETFLIX_BROWSE_ROW_IDS = [
    'trending',
    ...NETFLIX_CURATED_ROW_DEFS.map((row) => row.id)
] as const;

export type NetflixBrowseRowId = (typeof NETFLIX_BROWSE_ROW_IDS)[number];

const ROW_DEF_BY_ID = new Map(NETFLIX_CURATED_ROW_DEFS.map((row) => [row.id, row]));

const BROWSE_ROW_ID_SET = new Set<string>(NETFLIX_BROWSE_ROW_IDS);

export function isValidNetflixBrowseRow(rowId: string): rowId is NetflixBrowseRowId {
    return BROWSE_ROW_ID_SET.has(rowId);
}

export function getNetflixCuratedRowDef(rowId: string): NetflixCuratedRowDef | undefined {
    return ROW_DEF_BY_ID.get(rowId);
}

export function rowsForCatalogue(catalogueId: string): NetflixCuratedRowDef[] {
    return NETFLIX_CURATED_ROW_DEFS.filter(
        (row) => !row.catalogues?.length || row.catalogues.includes(catalogueId)
    );
}

export function getNetflixRowMeta(
    rowId: NetflixBrowseRowId,
    catalogue: { label: string; eyebrow?: string },
    lang: NetflixLanguageOption
): {
    title: string;
    eyebrow: string;
    description: string;
    defaultType: 'movie' | 'tv';
    netflixCode?: number;
} {
    if (rowId === 'trending') {
        return {
            title: 'Trending now',
            eyebrow: catalogue.eyebrow || catalogue.label,
            description: `Trending ${catalogue.label} titles in ${lang.label}.`,
            defaultType: 'movie'
        };
    }

    const def = ROW_DEF_BY_ID.get(rowId);
    if (!def) {
        return {
            title: catalogue.label,
            eyebrow: '',
            description: '',
            defaultType: 'movie'
        };
    }

    return {
        title: def.title,
        eyebrow: def.eyebrow,
        description: def.description
            ? def.description(catalogue.label, lang)
            : `${def.title} in ${catalogue.label}.`,
        defaultType: def.defaultType,
        netflixCode: def.netflixCode
    };
}