import type { NetflixLanguageOption } from './useNetflixLanguage';
import { type TmdbGenreSpec } from './netflixTmdbGenres';
import {
    NETFLIX_STANDARD_GENRES,
    standardGenresForCatalogue
} from '../data/netflixStandardGenres';

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
    catalogues?: string[];
    keywords?: string[];
    keywordGroups?: string[][];
    pick: NetflixRowPickKind;
    minRating?: number;
    homeDedupe?: boolean;
    cataloguePoolOnly?: boolean;
    tmdbGenres?: TmdbGenreSpec;
    browseAllMediaTypes?: boolean;
    description?: (catalogueLabel: string, lang: NetflixLanguageOption) => string;
}

/** Netflix home shows curated rows — full genre list lives on /nf/categories. */
export const MAX_NETFLIX_HOME_RAILS = 12;
export const MAX_NETFLIX_HOME_PER_RAIL = 20;

const NETFLIX_HOME_EDITORIAL_IDS = [
    'new-on-netflix'
] as const;

const NETFLIX_HOME_GENRE_IDS: Record<string, string[]> = {
    hollywood: [
        'action-adventure',
        'comedies',
        'dramas',
        'thrillers',
        'horror-movies',
        'sci-fi-fantasy',
        'romantic-movies',
        'anime'
    ],
    bollywood: ['dramas', 'comedies', 'romantic-movies', 'action-adventure', 'thrillers'],
    korean: ['dramas', 'thrillers', 'romantic-movies', 'action-adventure']
};

const NETFLIX_HOME_TAIL_IDS = ['only-on-netflix'] as const;

export function homeRowIdsForCatalogue(catalogueId: string): string[] {
    const genres = NETFLIX_HOME_GENRE_IDS[catalogueId] || NETFLIX_HOME_GENRE_IDS.hollywood;
    const editorial =
        catalogueId === 'korean'
            ? [
                  'new-on-netflix',
                  'korean-movies',
                  'korean-series'
              ]
            : [...NETFLIX_HOME_EDITORIAL_IDS];
    return [...editorial, ...genres, ...NETFLIX_HOME_TAIL_IDS];
}

export interface NetflixCategoryTile {
    id: string;
    title: string;
}

export interface NetflixCategorySection {
    id: string;
    title: string;
    genres: NetflixCategoryTile[];
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
        minRating: 6,
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
        minRating: 6,
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
        catalogues: ['hollywood', 'bollywood'],
        pick: 'top-rated',
        minRating: 6.5,
        homeDedupe: true,
        description: (catalogueLabel, lang) =>
            `Big ${catalogueLabel} films with ${lang.label} audio.`
    },
    {
        id: 'korean-movies',
        title: 'Korean Movies',
        eyebrow: 'K-Cinema',
        defaultType: 'movie',
        section: 'editorial',
        priority: 3175,
        catalogues: ['korean'],
        pick: 'top-rated',
        minRating: 6.5,
        homeDedupe: true,
        description: (_catalogueLabel, lang) =>
            `Big Korean films with ${lang.label} audio.`
    },
    {
        id: 'korean-series',
        title: 'Korean Series',
        eyebrow: 'K-Drama',
        defaultType: 'tv',
        section: 'editorial',
        priority: 3174,
        catalogues: ['korean'],
        pick: 'top-rated',
        minRating: 6,
        homeDedupe: true,
        description: (_catalogueLabel, lang) =>
            `Korean dramas and series in ${lang.label}.`
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
        minRating: 0,
        browseAllMediaTypes: true,
        description: (catalogueLabel) => `More ${catalogueLabel} titles you can watch now.`
    }
];

const STANDARD_GENRE_ROWS: NetflixCuratedRowDef[] = NETFLIX_STANDARD_GENRES.map((row) => ({
    id: row.id,
    title: row.title,
    eyebrow: row.id === 'tv-show' || row.id === 'anime' ? 'TV' : 'Browse',
    defaultType: row.id === 'tv-show' || row.id === 'anime' ? 'tv' : 'movie',
    section: 'genre' as const,
    priority: row.priority,
    catalogues: row.catalogues,
    pick: 'tmdb-genre' as const,
    cataloguePoolOnly: false,
    tmdbGenres: row.tmdbGenres,
    keywords: row.keywords,
    browseAllMediaTypes: row.browseAllMediaTypes ?? (row.id !== 'tv-show' && row.id !== 'anime'),
    homeDedupe: false,
    description: (_catalogueLabel, _lang) => row.tagline
}));

export const NETFLIX_CURATED_ROW_DEFS: NetflixCuratedRowDef[] = [
    ...EDITORIAL_ROWS,
    ...STANDARD_GENRE_ROWS
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

export function homeRowsForCatalogue(catalogueId: string): NetflixCuratedRowDef[] {
    return homeRowIdsForCatalogue(catalogueId)
        .map((id) => ROW_DEF_BY_ID.get(id))
        .filter((row): row is NetflixCuratedRowDef => {
            if (!row) return false;
            if (!row.catalogues?.length) return true;
            return row.catalogues.includes(catalogueId);
        });
}

export function getNetflixCategorySections(catalogueId: string): NetflixCategorySection[] {
    const genres = standardGenresForCatalogue(catalogueId);
    if (!genres.length) return [];

    return [
        {
            id: 'browse',
            title: 'Browse by genre',
            genres: genres.map((row) => ({ id: row.id, title: row.title }))
        }
    ];
}

/** @deprecated Use getNetflixCategorySections */
export function getNetflixCategoryGroups(catalogueId: string) {
    return getNetflixCategorySections(catalogueId);
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
        defaultType: def.defaultType
    };
}