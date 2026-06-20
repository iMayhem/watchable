import {
    inferCatalogMediaType,
    parseCatalogTitle,
    type MoovieCatalogItem
} from './useMoovieCatalog';
import {
    getNetflixCuratedRowDef,
    getNetflixRowMeta,
    homeRowsForCatalogue,
    MAX_NETFLIX_HOME_PER_RAIL,
    MAX_NETFLIX_HOME_RAILS,
    type NetflixBrowseRowId,
    type NetflixCuratedRowDef
} from './netflixCuratedRows';
import {
    itemMatchesLanguage,
    type NetflixLanguageOption
} from './useNetflixLanguage';
import type { CuratedItem } from '../components/rails/CuratedRail.vue';
import {
    getNetflixStandardGenre,
    isStandardNetflixGenre,
    type GenreBrowseRailDef
} from '../data/netflixStandardGenres';
import { hasNativeBrowseCategory } from '../data/netflixCatalogCategories';
import {
    genreIdsMatchSpec,
    TMDB_MOVIE,
    TMDB_TV,
    type TmdbGenreSpec
} from './netflixTmdbGenres';
import type { CatalogTmdbMeta } from './useTmdbArtwork';

import type { CatalogEnrichmentRow } from './useCatalogEnrichmentCache';
import {
    catalogBrowseRankScore,
    sortCatalogByBrowseRank,
    type CatalogBrowseRankContext
} from './useNetflixBrowseRank';

export type { CatalogTmdbMeta };
export { sortCatalogByBrowseRank, catalogBrowseRankScore } from './useNetflixBrowseRank';

export {
    NETFLIX_BROWSE_ROW_IDS,
    type NetflixBrowseRowId,
    getNetflixRowMeta,
    isValidNetflixBrowseRow
} from './netflixCuratedRows';

export interface NetflixRailSection {
    id: string;
    rowId: string;
    title: string;
    eyebrow: string;
    description: string;
    defaultType: 'movie' | 'tv';
    items: CuratedItem[];
}

export function netflixBrowsePath(catalogueId: string, rowId: string) {
    return `/nf/browse/${catalogueId}/${rowId}`;
}

interface RailDefinition {
    id: string;
    title: string;
    eyebrow: string;
    description: (lang: NetflixLanguageOption) => string;
    defaultType: 'movie' | 'tv';
    match: (item: MoovieCatalogItem, lang: NetflixLanguageOption) => boolean;
    /** Higher = closer to top (after trending). */
    priority: number;
}

const HOLLYWOOD_COUNTRIES = new Set([
    'united states',
    'united kingdom',
    'canada',
    'australia',
    'new zealand',
    'mexico',
    'france',
    'germany',
    'spain',
    'italy',
    'poland',
    'brazil',
    'netherlands',
    'belgium',
    'sweden',
    'norway',
    'denmark',
    'finland',
    'ireland',
    'south africa',
    'argentina',
    'colombia'
]);

const KOREAN_COUNTRIES = new Set(['south korea', 'korea', 'republic of korea']);
const JAPAN_COUNTRIES = new Set(['japan']);
const CHINESE_COUNTRIES = new Set(['china', 'hong kong', 'taiwan']);
const ARAB_COUNTRIES = new Set([
    'saudi arabia',
    'united arab emirates',
    'uae',
    'egypt',
    'morocco',
    'lebanon',
    'jordan',
    'qatar',
    'kuwait',
    'bahrain',
    'oman',
    'iraq',
    'syria'
]);

function haystack(item: MoovieCatalogItem): string {
    const parsed = parseCatalogTitle(item.title || '');
    return [
        item.title,
        item.channel,
        item.cn,
        parsed.displayTitle,
        ...parsed.languages
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function haystackWithTmdb(
    item: MoovieCatalogItem,
    meta?: CatalogTmdbMeta
): string {
    return [haystack(item), meta?.overview || ''].filter(Boolean).join(' ').toLowerCase();
}

function itemHasKeywordNeedles(
    item: MoovieCatalogItem,
    needles: string[],
    meta?: CatalogTmdbMeta
): boolean {
    const h = haystackWithTmdb(item, meta);
    return needles.some((needle) => h.includes(needle.toLowerCase()));
}

function lgbtqGenreConflict(
    item: MoovieCatalogItem,
    genreIds: number[]
): boolean {
    if (!genreIds.length) return false;
    const isTv = inferCatalogMediaType(item) === 'tv';
    if (isTv) return false;
    if (genreIds.includes(TMDB_MOVIE.HORROR)) return true;
    if (
        genreIds.includes(TMDB_MOVIE.THRILLER) &&
        !genreIds.includes(TMDB_MOVIE.ROMANCE)
    ) {
        return true;
    }
    return false;
}

function countryOf(item: MoovieCatalogItem): string {
    return (item.cn || '').trim().toLowerCase();
}

function channelOf(item: MoovieCatalogItem): string {
    return (item.channel || '').trim().toLowerCase();
}

function isMovie(item: MoovieCatalogItem) {
    return inferCatalogMediaType(item) === 'movie';
}

function isSeries(item: MoovieCatalogItem) {
    return inferCatalogMediaType(item) === 'tv';
}

const ANIME_FEATURE_FILM_PATTERN =
    /\b(film|the movie|movie:|movie -|ova\b|episode of|stampede|strong world|infinity castle|gekijouban)\b/i;

function isAnimeFeatureFilm(item: MoovieCatalogItem): boolean {
    const title = item.title || '';
    if (/\bS\d/i.test(title)) return false;
    if (ANIME_FEATURE_FILM_PATTERN.test(title)) return true;
    return inferCatalogMediaType(item) === 'movie' && hasAnimeCatalogueSignal(item);
}

/** Anime browse is series-only — not one-off films/OVAs. */
function isAnimeSeriesItem(item: MoovieCatalogItem): boolean {
    if (isAnimeFeatureFilm(item)) return false;
    if (!isSeries(item)) return false;
    if (isRegionalIndianAnimation(item)) return false;
    return hasAnimeCatalogueSignal(item) || channelOf(item).includes('anime');
}

function animeSeriesInCatalogue(item: MoovieCatalogItem, lang: NetflixLanguageOption): boolean {
    if (!hasLangBase(item, lang)) return false;
    return isAnimeSeriesItem(item);
}

function hasAny(item: MoovieCatalogItem, needles: string[]) {
    const h = haystack(item);
    return needles.some((n) => h.includes(n.toLowerCase()));
}

function hasKeywordGroups(item: MoovieCatalogItem, groups: string[][]) {
    const h = haystack(item);
    return groups.every((group) =>
        group.some((needle) => h.includes(needle.toLowerCase()))
    );
}

function matchesRowMediaType(item: MoovieCatalogItem, def: NetflixCuratedRowDef) {
    if (def.browseAllMediaTypes) return true;
    const mediaType = inferCatalogMediaType(item);
    if (def.defaultType === 'movie' && mediaType !== 'movie') return false;
    if (def.defaultType === 'tv' && mediaType !== 'tv') return false;
    return true;
}

/** Hard filter so movie browse rows never surface series (and vice versa). */
export function filterItemsForBrowseRow(
    items: MoovieCatalogItem[],
    rowId: NetflixBrowseRowId
): MoovieCatalogItem[] {
    if (rowId === 'trending') return items;
    const def = getNetflixCuratedRowDef(rowId);
    if (!def || def.browseAllMediaTypes) return items;
    return items.filter((item) => matchesRowMediaType(item, def));
}

function tmdbGenresMatchItem(
    item: MoovieCatalogItem,
    genreIds: number[],
    spec?: TmdbGenreSpec
): boolean {
    if (!genreIds.length || !spec) return false;
    const isTv = inferCatalogMediaType(item) === 'tv';
    return genreIdsMatchSpec(genreIds, isTv, spec);
}

const ANIME_CATALOGUE_NEEDLES = [
    'anime',
    'naruto',
    'one piece',
    'dragon ball',
    'demon slayer',
    'gundam',
    'mecha',
    'jujutsu kaisen',
    'attack on titan',
    'bleach',
    'my hero academia',
    'one punch man',
    'death note',
    'spy x family',
    'chainsaw man',
    'hunter x hunter',
    'fullmetal alchemist',
    'cowboy bebop',
    'evangelion',
    'sailor moon',
    'pokemon',
    'digimon',
    'studio ghibli',
    'ghibli',
    'kimetsu',
    'haikyu',
    'tokyo ghoul',
    'vinland saga',
    'sword art online',
    'fairy tail',
    'black clover',
    'boruto',
    'jojo',
    'blue exorcist',
    'shield hero',
    'sakamoto',
    'horimiya',
    'frieren',
    'solo leveling',
    'dandadan',
    'mashle',
    're:zero',
    'overlord',
    'konosuba',
    'mob psycho',
    'fire force',
    'dr. stone',
    'dr stone',
    'baki',
    'kengan',
    'yugioh',
    'beyblade',
    'toradora',
    'clannad',
    'steins;gate',
    'steins gate',
    'code geass',
    'gintama',
    'inuyasha',
    'samurai champloo',
    'trigun',
    'hellsing',
    'parasyte',
    'erased'
];

const INDIAN_CARTOON_NEEDLES = [
    'chhota bheem',
    'little singham',
    'motu patlu',
    'pakdam pakdai',
    'keymon ache',
    'bal ganesh',
    'tenali raman',
    'suppandi',
    'shaktimaan',
    'roll no 21',
    'krishna aur',
    'luv kush',
    'shiva ',
    'pernema',
    'selfie with bajrangi',
    'vir: the robot boy'
];

function isRegionalIndianAnimation(item: MoovieCatalogItem): boolean {
    if (hasAny(item, INDIAN_CARTOON_NEEDLES)) return true;
    if (channelOf(item).includes('anime')) return false;
    if (hasAny(item, ANIME_CATALOGUE_NEEDLES)) return false;
    return isIndia(item);
}

function hasAnimeCatalogueSignal(item: MoovieCatalogItem): boolean {
    if (isRegionalIndianAnimation(item)) return false;
    return (
        channelOf(item).includes('anime') || hasAny(item, ANIME_CATALOGUE_NEEDLES)
    );
}

/** Moovie catalogue rows that belong on /nf/anime, not /nf/tv or /nf/movie. */
export function isAnimeCatalogueItem(item: MoovieCatalogItem): boolean {
    return isAnimeSeriesItem(item) || hasAnimeCatalogueSignal(item);
}

function hasJapaneseAnimeOrigin(item: MoovieCatalogItem): boolean {
    if (isRegionalIndianAnimation(item)) return false;
    return (
        JAPAN_COUNTRIES.has(countryOf(item)) || channelOf(item).includes('anime')
    );
}

function hasAnimationTmdbGenre(
    item: MoovieCatalogItem,
    genreIds: number[]
): boolean {
    return tmdbGenresMatchItem(item, genreIds, {
        movie: [TMDB_MOVIE.ANIMATION],
        tv: [TMDB_TV.ANIMATION]
    });
}

/** Japanese anime series only — not films or Indian cartoons. */
function itemMatchesAnimeRow(
    item: MoovieCatalogItem,
    genreIds: number[]
): boolean {
    if (!isAnimeSeriesItem(item)) return false;

    if (hasAnimeCatalogueSignal(item)) {
        return true;
    }

    if (!hasAnimationTmdbGenre(item, genreIds)) {
        return false;
    }

    return hasJapaneseAnimeOrigin(item);
}



function hasLangTag(item: MoovieCatalogItem, ...needles: string[]) {
    const parsed = parseCatalogTitle(item.title || '');
    return needles.some((needle) => {
        const n = needle.toLowerCase();
        return parsed.languages.some((tag) => tag.toLowerCase().includes(n));
    });
}

function hasLangBase(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    return itemMatchesLanguage(item, lang);
}

function isIndia(item: MoovieCatalogItem) {
    return countryOf(item) === 'india';
}

function isHollywoodCountry(item: MoovieCatalogItem) {
    const c = countryOf(item);
    return Boolean(c) && HOLLYWOOD_COUNTRIES.has(c);
}

function isAsianCinemaCountry(item: MoovieCatalogItem) {
    const c = countryOf(item);
    return (
        KOREAN_COUNTRIES.has(c) ||
        JAPAN_COUNTRIES.has(c) ||
        CHINESE_COUNTRIES.has(c)
    );
}

/** Catalogue items use [Hindi] tags + country (cn), not literal "Hollywood" labels. */
function hollywoodMovie(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isMovie(item) || !hasLangBase(item, lang)) return false;
    if (isIndia(item)) return false;
    if (isAsianCinemaCountry(item)) return false;
    if (isKoreanOrigin(item)) return false;
    const c = countryOf(item);
    if (!c) return false;
    if (ARAB_COUNTRIES.has(c)) return false;
    return isHollywoodCountry(item);
}

function bollywoodMovie(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isMovie(item) || !hasLangBase(item, lang)) return false;
    return isIndia(item);
}

function isKoreanOrigin(item: MoovieCatalogItem) {
    const c = countryOf(item);
    return (
        KOREAN_COUNTRIES.has(c) ||
        c.includes('korea') ||
        hasAny(item, ['korean', 'k-drama', 'kdrama', 'korea', 'hwaesang', 'sageuk', 'k-series', 'kseries'])
    );
}

function koreanMovie(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isMovie(item) || !hasLangBase(item, lang)) return false;
    if (isAnimeSeriesItem(item) || hasAnimeCatalogueSignal(item)) return false;
    return isKoreanOrigin(item) || hasLangTag(item, 'korean', 'korea');
}

function koreanSeries(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isSeries(item) || !hasLangBase(item, lang)) return false;
    if (isAnimeSeriesItem(item)) return false;
    return isKoreanOrigin(item);
}

/** Korean browse rows are K-drama/K-film only — anime has its own catalogue tab. */
function isExcludedFromKoreanBrowse(
    item: MoovieCatalogItem,
    rowId: NetflixBrowseRowId
) {
    if (rowId === 'anime') return false;
    return isAnimeSeriesItem(item) || hasAnimeCatalogueSignal(item);
}

function englishSeries(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isSeries(item) || !hasLangBase(item, lang)) return false;
    if (isIndia(item)) return false;
    if (JAPAN_COUNTRIES.has(countryOf(item)) && channelOf(item).includes('anime')) return false;
    if (KOREAN_COUNTRIES.has(countryOf(item))) return false;
    return isHollywoodCountry(item) || channelOf(item).includes('hindidub');
}

function hindiSeries(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isSeries(item) || !hasLangBase(item, lang)) return false;
    return isIndia(item);
}

function japaneseSeries(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isSeries(item) || !hasLangBase(item, lang)) return false;
    return (
        JAPAN_COUNTRIES.has(countryOf(item)) ||
        channelOf(item).includes('anime') ||
        hasAny(item, ['anime', 'kimetsu', 'naruto', 'one piece'])
    );
}

function regionalMovies(
    item: MoovieCatalogItem,
    lang: NetflixLanguageOption,
    regionNeedles: string[]
) {
    if (!isMovie(item) || !hasLangBase(item, lang)) return false;
    return regionNeedles.some(
        (needle) => hasLangTag(item, needle) || haystack(item).includes(needle.toLowerCase())
    );
}

function arabicMovie(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isMovie(item) || !hasLangBase(item, lang)) return false;
    return ARAB_COUNTRIES.has(countryOf(item)) || hasLangTag(item, 'arabic', 'arab');
}

const RAIL_DEFINITIONS: RailDefinition[] = [
    {
        id: 'bollywood',
        title: 'Bollywood movies',
        eyebrow: 'Indian cinema',
        description: (lang) => `Hindi cinema and Bollywood picks in ${lang.label}.`,
        defaultType: 'movie',
        match: bollywoodMovie,
        priority: 100
    },
    {
        id: 'hollywood',
        title: 'Hollywood movies',
        eyebrow: 'Blockbusters',
        description: (lang) => `Hollywood films dubbed in ${lang.label}.`,
        defaultType: 'movie',
        match: hollywoodMovie,
        priority: 90
    },
    {
        id: 'korean-movies',
        title: 'Korean movies',
        eyebrow: 'K-Cinema',
        description: (lang) => `Korean films with ${lang.label} audio.`,
        defaultType: 'movie',
        match: koreanMovie,
        priority: 80
    },
    {
        id: 'korean-series',
        title: 'Korean series',
        eyebrow: 'K-Drama',
        description: (lang) => `Korean dramas and series in ${lang.label}.`,
        defaultType: 'tv',
        match: koreanSeries,
        priority: 75
    },
    {
        id: 'telugu',
        title: 'Telugu movies',
        eyebrow: 'Tollywood',
        description: (lang) => `Telugu cinema in ${lang.label}.`,
        defaultType: 'movie',
        match: (item, lang) => regionalMovies(item, lang, ['telugu', 'tollywood']),
        priority: 70
    },
    {
        id: 'tamil',
        title: 'Tamil movies',
        eyebrow: 'Kollywood',
        description: (lang) => `Tamil cinema in ${lang.label}.`,
        defaultType: 'movie',
        match: (item, lang) => regionalMovies(item, lang, ['tamil', 'kollywood']),
        priority: 65
    },
    {
        id: 'malayalam',
        title: 'Malayalam movies',
        eyebrow: 'Mollywood',
        description: (lang) => `Malayalam cinema in ${lang.label}.`,
        defaultType: 'movie',
        match: (item, lang) => regionalMovies(item, lang, ['malayalam', 'mollywood']),
        priority: 60
    },
    {
        id: 'bengali',
        title: 'Bengali movies',
        eyebrow: 'Regional',
        description: (lang) => `Bengali cinema in ${lang.label}.`,
        defaultType: 'movie',
        match: (item, lang) => regionalMovies(item, lang, ['bengali', 'bangla']),
        priority: 55
    },
    {
        id: 'kannada',
        title: 'Kannada movies',
        eyebrow: 'Sandalwood',
        description: (lang) => `Kannada cinema in ${lang.label}.`,
        defaultType: 'movie',
        match: (item, lang) => regionalMovies(item, lang, ['kannada', 'sandalwood']),
        priority: 50
    },
    {
        id: 'marathi',
        title: 'Marathi movies',
        eyebrow: 'Regional',
        description: (lang) => `Marathi cinema in ${lang.label}.`,
        defaultType: 'movie',
        match: (item, lang) => regionalMovies(item, lang, ['marathi']),
        priority: 45
    },
    {
        id: 'punjabi',
        title: 'Punjabi movies',
        eyebrow: 'Regional',
        description: (lang) => `Punjabi cinema in ${lang.label}.`,
        defaultType: 'movie',
        match: (item, lang) => regionalMovies(item, lang, ['punjabi', 'pollywood']),
        priority: 40
    },
    {
        id: 'chinese',
        title: 'Chinese movies',
        eyebrow: 'Asian cinema',
        description: (lang) => `Chinese films in ${lang.label}.`,
        defaultType: 'movie',
        match: (item, lang) => regionalMovies(item, lang, ['chinese', 'mandarin', 'cantonese']),
        priority: 35
    },
    {
        id: 'japanese',
        title: 'Japanese anime & series',
        eyebrow: 'Anime',
        description: (lang) => `Japanese anime and shows in ${lang.label}.`,
        defaultType: 'tv',
        match: japaneseSeries,
        priority: 30
    },
    {
        id: 'arabic',
        title: 'Arabic movies',
        eyebrow: 'Middle East',
        description: (lang) => `Arabic cinema in ${lang.label}.`,
        defaultType: 'movie',
        match: arabicMovie,
        priority: 25
    },
    {
        id: 'urdu',
        title: 'Urdu movies',
        eyebrow: 'Regional',
        description: (lang) => `Urdu cinema in ${lang.label}.`,
        defaultType: 'movie',
        match: (item, lang) => regionalMovies(item, lang, ['urdu']),
        priority: 20
    },
    {
        id: 'english-series',
        title: 'English series',
        eyebrow: 'International',
        description: (lang) => `English-language series with ${lang.label} audio.`,
        defaultType: 'tv',
        match: englishSeries,
        priority: 15
    },
    {
        id: 'hindi-series',
        title: 'Hindi series',
        eyebrow: 'Shows',
        description: (lang) => `Hindi-language series and seasons in ${lang.label}.`,
        defaultType: 'tv',
        match: hindiSeries,
        priority: 10
    }
];

type CatalogueMatcher = (
    item: MoovieCatalogItem,
    lang: NetflixLanguageOption
) => boolean;

const HEADER_CATALOGUE_MATCHERS: Record<string, CatalogueMatcher> = {
    hollywood: (item, lang) =>
        hollywoodMovie(item, lang) ||
        englishSeries(item, lang) ||
        animeSeriesInCatalogue(item, lang),
    bollywood: (item, lang) =>
        bollywoodMovie(item, lang) ||
        hindiSeries(item, lang) ||
        animeSeriesInCatalogue(item, lang),
    korean: (item, lang) =>
        koreanMovie(item, lang) || koreanSeries(item, lang),
    japanese: (item, lang) => japaneseSeries(item, lang),
    telugu: (item, lang) => regionalMovies(item, lang, ['telugu', 'tollywood']),
    tamil: (item, lang) => regionalMovies(item, lang, ['tamil', 'kollywood']),
    malayalam: (item, lang) => regionalMovies(item, lang, ['malayalam', 'mollywood']),
    bengali: (item, lang) => regionalMovies(item, lang, ['bengali', 'bangla']),
    kannada: (item, lang) => regionalMovies(item, lang, ['kannada', 'sandalwood']),
    marathi: (item, lang) => regionalMovies(item, lang, ['marathi']),
    punjabi: (item, lang) => regionalMovies(item, lang, ['punjabi', 'pollywood'])
};

/** Rails that should float up when their region matches the active language tab. */
const LANGUAGE_RAIL_BOOST: Record<string, string[]> = {
    hindi: ['bollywood', 'hindi-series'],
    telugu: ['telugu'],
    tamil: ['tamil'],
    malayalam: ['malayalam'],
    bengali: ['bengali'],
    kannada: ['kannada'],
    marathi: ['marathi'],
    punjabi: ['punjabi'],
    arabic: ['arabic'],
    urdu: ['urdu'],
    english: ['hollywood', 'english-series']
};

const MIN_RAIL_ITEMS = 3;
const MAX_PER_RAIL = 14;
const MAX_TRENDING = 12;
const TOP_CHART_SIZE = 10;
/** Floor for editorial/browse picks — keeps ancient low-rated filler out. */
const BROWSE_DEFAULT_MIN_RATING = 5.5;

function itemRating(item: MoovieCatalogItem) {
    const raw = item.vote_average;
    const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return Number.isFinite(n) ? n : 0;
}

function releaseTimestamp(item: MoovieCatalogItem) {
    const raw = String(item.release_date || '');
    const normalized = raw.replace(/,(\d{4})/, ', $1');
    const parsed = Date.parse(normalized);
    if (!Number.isNaN(parsed)) return parsed;
    const year = raw.match(/\b(19|20)\d{2}\b/);
    return year ? Date.UTC(parseInt(year[0], 10), 0, 1) : 0;
}

function sortByBrowseRank(
    pool: MoovieCatalogItem[],
    ctx: CatalogBrowseRankContext = {}
): MoovieCatalogItem[] {
    return sortCatalogByBrowseRank(pool, ctx);
}

function takeUnique(
    pool: MoovieCatalogItem[],
    used: Set<string>,
    limit: number,
    predicate: (item: MoovieCatalogItem) => boolean,
    opts: { tmdbById?: Map<string, CatalogTmdbMeta> } = {}
) {
    return takeRanked(pool, used, limit, predicate, opts);
}

function takeRanked(
    pool: MoovieCatalogItem[],
    used: Set<string>,
    limit: number,
    predicate: (item: MoovieCatalogItem) => boolean,
    opts: { minRating?: number; tmdbById?: Map<string, CatalogTmdbMeta> } = {}
) {
    const minRating = opts.minRating ?? BROWSE_DEFAULT_MIN_RATING;
    const candidates = sortByBrowseRank(
        pool.filter((item) => {
            if (used.has(item.id) || !predicate(item)) return false;
            return itemRating(item) >= minRating;
        }),
        { tmdbById: opts.tmdbById }
    );

    const out: MoovieCatalogItem[] = [];
    for (const item of candidates) {
        if (out.length >= limit) break;
        used.add(item.id);
        out.push(item);
    }
    return out;
}

function takeTopRated(
    pool: MoovieCatalogItem[],
    used: Set<string>,
    limit: number,
    opts: {
        movie?: boolean;
        tv?: boolean;
        minRating?: number;
        tmdbById?: Map<string, CatalogTmdbMeta>;
    } = {}
) {
    const minRating = opts.minRating ?? BROWSE_DEFAULT_MIN_RATING;
    const candidates = sortByBrowseRank(
        pool.filter((item) => {
            if (used.has(item.id)) return false;
            if (opts.movie && !isMovie(item)) return false;
            if (opts.tv && !isSeries(item)) return false;
            return itemRating(item) >= minRating;
        }),
        { tmdbById: opts.tmdbById }
    );

    const out: MoovieCatalogItem[] = [];
    for (const item of candidates) {
        if (out.length >= limit) break;
        used.add(item.id);
        out.push(item);
    }
    return out;
}

function takeNewest(
    pool: MoovieCatalogItem[],
    used: Set<string>,
    limit: number,
    opts: { movie?: boolean; tv?: boolean; minRating?: number } = {}
) {
    const minRating = opts.minRating ?? BROWSE_DEFAULT_MIN_RATING;
    const candidates = pool
        .filter((item) => {
            if (used.has(item.id)) return false;
            if (opts.movie && !isMovie(item)) return false;
            if (opts.tv && !isSeries(item)) return false;
            return releaseTimestamp(item) > 0 && itemRating(item) >= minRating;
        })
        .sort((a, b) => {
            const yearDiff = releaseTimestamp(b) - releaseTimestamp(a);
            if (yearDiff !== 0) return yearDiff;
            return itemRating(b) - itemRating(a);
        });

    const out: MoovieCatalogItem[] = [];
    for (const item of candidates) {
        if (out.length >= limit) break;
        used.add(item.id);
        out.push(item);
    }
    return out;
}

function takeByKeywords(
    pool: MoovieCatalogItem[],
    used: Set<string>,
    limit: number,
    keywords: string[],
    opts: { movie?: boolean; tv?: boolean } = {}
) {
    return takeUnique(pool, used, limit, (item) => {
        if (opts.movie && !isMovie(item)) return false;
        if (opts.tv && !isSeries(item)) return false;
        return hasAny(item, keywords);
    });
}

function browseItemScore(item: MoovieCatalogItem, tmdbById: Map<string, CatalogTmdbMeta>) {
    return catalogBrowseRankScore(item, { tmdbById });
}

function matchesNativeBrowseRow(
    item: MoovieCatalogItem,
    rowId: NetflixBrowseRowId,
    def: NetflixCuratedRowDef | undefined,
    tmdbById: Map<string, CatalogTmdbMeta>,
    enrichmentById: Map<string, CatalogEnrichmentRow> = new Map()
): boolean {
    if (rowId === 'trending') return true;
    if (!def) return true;

    const enrichment = enrichmentById.get(String(item.id));
    if (enrichment) {
        if (!enrichment.browse_categories.includes(rowId)) {
            if (isStandardNetflixGenre(rowId) && enrichmentById.size > 0) {
                return false;
            }
        } else if (def.browseAllMediaTypes || matchesRowMediaType(item, def)) {
            return true;
        } else if (isStandardNetflixGenre(rowId) && enrichmentById.size > 0) {
            return false;
        }
    }

    if (isStandardNetflixGenre(rowId) && enrichmentById.size > 0) {
        return false;
    }

    if (rowId === 'anime') {
        const genreIds = tmdbById.get(String(item.id))?.genreIds ?? [];
        return itemMatchesAnimeRow(item, genreIds);
    }

    if (rowId === 'lgbtq' || def.pick === 'tmdb-genre') {
        return itemMatchesGenreRow(item, def, tmdbById, enrichmentById);
    }

    return matchesRowMediaType(item, def);
}

/** NetMirror-style browse: trust the upstream category index, filter lightly. */
export function pickNativeCategoryBrowseItems(
    pool: MoovieCatalogItem[],
    rowId: NetflixBrowseRowId,
    tmdbById: Map<string, CatalogTmdbMeta>,
    limit = BROWSE_POOL_LIMIT,
    enrichmentById: Map<string, CatalogEnrichmentRow> = new Map()
): MoovieCatalogItem[] {
    const def = getNetflixCuratedRowDef(rowId);

    return sortByBrowseRank(
        pool
            .filter((item) =>
                matchesNativeBrowseRow(item, rowId, def, tmdbById, enrichmentById)
            )
            .filter((item) => itemRating(item) >= BROWSE_DEFAULT_MIN_RATING),
        { tmdbById }
    ).slice(0, limit);
}

function takeGenreMatches(
    pool: MoovieCatalogItem[],
    used: Set<string>,
    limit: number,
    def: NetflixCuratedRowDef,
    tmdbById: Map<string, CatalogTmdbMeta>,
    enrichmentById: Map<string, CatalogEnrichmentRow> = new Map()
) {
    const candidates = pool
        .filter(
            (item) =>
                !used.has(item.id) &&
                itemRating(item) >= BROWSE_DEFAULT_MIN_RATING &&
                itemMatchesGenreRow(item, def, tmdbById, enrichmentById)
        )
        .sort((a, b) => browseItemScore(b, tmdbById) - browseItemScore(a, tmdbById));

    const out: MoovieCatalogItem[] = [];
    for (const item of candidates) {
        if (out.length >= limit) break;
        used.add(item.id);
        out.push(item);
    }
    return out;
}

interface NetflixCuratedPlan {
    id: string;
    title: string;
    eyebrow: string;
    description: string;
    defaultType: 'movie' | 'tv';
    items: MoovieCatalogItem[];
}

export interface NetflixHomePlan {
    top10Movies: MoovieCatalogItem[];
    top10Tv: MoovieCatalogItem[];
    rails: NetflixCuratedPlan[];
}

function itemMatchesGenreRow(
    item: MoovieCatalogItem,
    def: NetflixCuratedRowDef,
    tmdbById: Map<string, CatalogTmdbMeta>,
    enrichmentById: Map<string, CatalogEnrichmentRow> = new Map()
): boolean {
    if (!matchesRowMediaType(item, def)) return false;
    if (def.cataloguePoolOnly) return true;

    const enrichment = enrichmentById.get(String(item.id));
    if (enrichment) {
        if (enrichment.browse_categories.includes(def.id)) {
            return true;
        }
        if (isStandardNetflixGenre(def.id)) {
            return false;
        }
    }

    const meta = tmdbById.get(String(item.id));
    const genreIds = meta?.genreIds ?? enrichment?.tmdb_genre_ids ?? [];

    if (def.id === 'anime' || def.id.startsWith('anime-')) {
        return itemMatchesAnimeRow(item, genreIds);
    }

    if (def.id === 'lgbtq' && lgbtqGenreConflict(item, genreIds)) {
        return false;
    }

    if (def.keywords?.length) {
        if (itemHasKeywordNeedles(item, def.keywords, meta)) {
            return true;
        }
        if (isStandardNetflixGenre(def.id)) {
            return false;
        }
    }

    if (isStandardNetflixGenre(def.id)) {
        return tmdbGenresMatchItem(item, genreIds, def.tmdbGenres);
    }

    if (def.keywordGroups?.length && hasKeywordGroups(item, def.keywordGroups)) {
        return true;
    }

    if (tmdbGenresMatchItem(item, genreIds, def.tmdbGenres)) {
        return true;
    }

    if (def.keywords?.length && hasAny(item, def.keywords)) {
        return true;
    }

    return false;
}

function pickFromRowDef(
    filtered: MoovieCatalogItem[],
    def: NetflixCuratedRowDef,
    used: Set<string>,
    limit: number,
    tmdbById: Map<string, CatalogTmdbMeta> = new Map(),
    enrichmentById: Map<string, CatalogEnrichmentRow> = new Map()
): MoovieCatalogItem[] {
    switch (def.pick) {
        case 'top-rated':
            return takeTopRated(filtered, used, limit, {
                movie: def.defaultType === 'movie',
                tv: def.defaultType === 'tv',
                minRating: def.minRating ?? BROWSE_DEFAULT_MIN_RATING,
                tmdbById
            });
        case 'newest':
            return takeNewest(filtered, used, limit, {
                movie: def.defaultType === 'movie',
                tv: def.defaultType === 'tv',
                minRating: def.minRating ?? BROWSE_DEFAULT_MIN_RATING
            });
        case 'all':
            return takeRanked(filtered, used, limit, (item) => matchesRowMediaType(item, def), {
                minRating: def.minRating ?? BROWSE_DEFAULT_MIN_RATING,
                tmdbById
            });
        case 'keyword-groups':
            return takeUnique(
                filtered,
                used,
                limit,
                (item) =>
                    matchesRowMediaType(item, def) &&
                    hasKeywordGroups(item, def.keywordGroups || []),
                { tmdbById }
            );
        case 'tmdb-genre':
            return takeGenreMatches(filtered, used, limit, def, tmdbById, enrichmentById);
        case 'keywords':
        default:
            return takeByKeywords(filtered, used, limit, def.keywords || [], {
                movie: def.defaultType === 'movie',
                tv: def.defaultType === 'tv'
            });
    }
}

/**
 * Netflix home: one global used-set so titles never repeat across rows.
 * Full genre list lives on /nf/categories — not dumped on the homepage.
 */
function planNetflixHomeRows(
    filtered: MoovieCatalogItem[],
    catalogueId: string,
    catalogueLabel: string,
    lang: NetflixLanguageOption,
    tmdbById: Map<string, CatalogTmdbMeta>
): NetflixHomePlan {
    const used = new Set<string>();
    sortByBrowseRank(filtered)
        .slice(0, MAX_TRENDING)
        .forEach((item) => used.add(item.id));

    const top10Movies = takeTopRated(filtered, used, TOP_CHART_SIZE, {
        movie: true,
        minRating: 6
    });
    const top10Tv = takeTopRated(filtered, used, TOP_CHART_SIZE, {
        tv: true,
        minRating: 6
    });

    const rails: NetflixCuratedPlan[] = [];

    for (const def of homeRowsForCatalogue(catalogueId)) {
        if (rails.length >= MAX_NETFLIX_HOME_RAILS) break;

        const dedupeAcrossHome = def.homeDedupe !== false;
        const rowUsed = dedupeAcrossHome ? used : new Set<string>();
        const items =
            catalogueId === 'korean'
                ? pickKoreanCatalogueBrowseItems(
                      filtered,
                      def.id as NetflixBrowseRowId,
                      rowUsed,
                      MAX_NETFLIX_HOME_PER_RAIL,
                      tmdbById
                  )
                : pickFromRowDef(
                      filtered,
                      def,
                      rowUsed,
                      MAX_NETFLIX_HOME_PER_RAIL,
                      tmdbById
                  );
        if (dedupeAcrossHome) {
            items.forEach((item) => used.add(item.id));
        }
        if (items.length < MIN_RAIL_ITEMS) continue;

        const meta = getNetflixRowMeta(def.id as NetflixBrowseRowId, { label: catalogueLabel }, lang);
        rails.push({
            id: def.id,
            title: meta.title,
            eyebrow: meta.eyebrow,
            description: meta.description,
            defaultType: def.defaultType,
            items
        });
    }

    return { top10Movies, top10Tv, rails };
}

const BROWSE_POOL_LIMIT = 600;

/**
 * Korean titles are filtered by country in the pool already. TMDB genre tags are
 * often missing on first paint — fall back to media-type slices (K-dramas = TV).
 */
export function pickKoreanCatalogueBrowseItems(
    pool: MoovieCatalogItem[],
    rowId: NetflixBrowseRowId,
    used: Set<string>,
    limit: number,
    tmdbById: Map<string, CatalogTmdbMeta>,
    enrichmentById: Map<string, CatalogEnrichmentRow> = new Map()
): MoovieCatalogItem[] {
    const available = pool.filter(
        (item) => !used.has(item.id) && !isExcludedFromKoreanBrowse(item, rowId)
    );
    if (!available.length) return [];

    if (rowId === 'trending') {
        return sortByBrowseRank(available).slice(0, limit);
    }

    const def = getNetflixCuratedRowDef(rowId);
    if (!def) {
        return sortByBrowseRank(available).slice(0, limit);
    }

    const strict = pickFromRowDef(
        available,
        def,
        new Set(used),
        limit,
        tmdbById,
        enrichmentById
    );
    if (strict.length >= MIN_RAIL_ITEMS) {
        return strict;
    }

    switch (rowId) {
        case 'dramas':
        case 'exciting-tv':
        case 'korean-series':
        case 'tv-show':
            return takeTopRated(available, used, limit, {
                tv: true,
                minRating: def.minRating ?? 0
            });
        case 'korean-movies':
        case 'blockbuster-movies':
            return takeTopRated(available, used, limit, {
                movie: true,
                minRating: def.minRating ?? 0
            });
        case 'new-on-netflix':
            return takeNewest(available, used, limit, {
                movie: def.defaultType === 'movie',
                tv: def.defaultType === 'tv'
            });
        case 'romantic-movies':
        case 'thrillers':
        case 'action-adventure':
        case 'sci-fi-fantasy':
        case 'horror-movies':
        case 'comedies':
            if (def.defaultType === 'tv') {
                return takeTopRated(available, used, limit, { tv: true });
            }
            if (def.defaultType === 'movie') {
                return takeTopRated(available, used, limit, { movie: true });
            }
            return takeTopRated(available, used, limit);
        default:
            if (def.browseAllMediaTypes) {
                return takeTopRated(available, used, limit);
            }
            if (def.defaultType === 'tv') {
                return takeTopRated(available, used, limit, { tv: true });
            }
            if (def.defaultType === 'movie') {
                return takeTopRated(available, used, limit, { movie: true });
            }
            return takeTopRated(available, used, limit);
    }
}

function pickRowItems(
    filtered: MoovieCatalogItem[],
    rowId: NetflixBrowseRowId,
    _catalogueLabel: string,
    _lang: NetflixLanguageOption,
    limit: number,
    tmdbById: Map<string, CatalogTmdbMeta>,
    enrichmentById: Map<string, CatalogEnrichmentRow> = new Map()
): MoovieCatalogItem[] {
    if (rowId === 'trending') return sortByBrowseRank(filtered).slice(0, limit);
    const def = getNetflixCuratedRowDef(rowId);
    if (!def) return [];

    return pickFromRowDef(
        filtered,
        def,
        new Set<string>(),
        limit,
        tmdbById,
        enrichmentById
    );
}

export function pickNetflixBrowseItems(
    pool: MoovieCatalogItem[],
    rowId: NetflixBrowseRowId,
    catalogue: { label: string },
    lang: NetflixLanguageOption,
    tmdbById: Map<string, CatalogTmdbMeta>,
    limit = BROWSE_POOL_LIMIT,
    enrichmentById: Map<string, CatalogEnrichmentRow> = new Map()
): MoovieCatalogItem[] {
    return pickRowItems(
        pool,
        rowId,
        catalogue.label,
        lang,
        limit,
        tmdbById,
        enrichmentById
    );
}

export interface GenreBrowseRailPlan {
    id: string;
    title: string;
    defaultType: 'movie' | 'tv';
    items: MoovieCatalogItem[];
}

function sliceGenreBrowseRail(
    pool: MoovieCatalogItem[],
    def: NetflixCuratedRowDef,
    rail: GenreBrowseRailDef,
    used: Set<string>,
    tmdbById: Map<string, CatalogTmdbMeta>,
    nativeCategory = false,
    enrichmentById: Map<string, CatalogEnrichmentRow> = new Map(),
    typeFilter?: 'tv' | 'movie'
): MoovieCatalogItem[] {
    const genrePool = nativeCategory
        ? pool.filter(
              (item) =>
                  enrichmentById.size === 0 ||
                  itemMatchesGenreRow(item, def, tmdbById, enrichmentById)
          )
        : pool.filter((item) =>
              itemMatchesGenreRow(item, def, tmdbById, enrichmentById)
          );

    let filteredPool = genrePool;
    if (typeFilter === 'tv') {
        filteredPool = genrePool.filter(isSeries);
    } else if (typeFilter === 'movie') {
        filteredPool = genrePool.filter(isMovie);
    }

    switch (rail.kind) {
        case 'tv':
            return takeUnique(filteredPool, used, rail.limit, (item) => isSeries(item), {
                tmdbById
            });
        case 'movie':
            return takeUnique(filteredPool, used, rail.limit, (item) => isMovie(item), {
                tmdbById
            });
        case 'top-rated':
            return takeTopRated(filteredPool, used, rail.limit, {
                tv: typeFilter === 'tv' || (typeFilter === undefined && def.defaultType === 'tv'),
                movie: typeFilter === 'movie' || (typeFilter === undefined && def.defaultType === 'movie'),
                tmdbById
            });
        case 'newest':
            return takeNewest(filteredPool, used, rail.limit, {
                tv: typeFilter === 'tv' || (typeFilter === undefined && def.defaultType === 'tv'),
                movie: typeFilter === 'movie' || (typeFilter === undefined && def.defaultType === 'movie')
            });
        default:
            return [];
    }
}

/** Netflix genre pages: horizontal sub-rails below "Your Next Watch" (e.g. Exciting TV Shows). */
export function pickGenreBrowseRails(
    pool: MoovieCatalogItem[],
    rowId: NetflixBrowseRowId,
    tmdbById: Map<string, CatalogTmdbMeta>,
    nativeCategory = hasNativeBrowseCategory(rowId),
    enrichmentById: Map<string, CatalogEnrichmentRow> = new Map(),
    typeFilter?: 'tv' | 'movie'
): GenreBrowseRailPlan[] {
    const genre = getNetflixStandardGenre(rowId);
    const def = getNetflixCuratedRowDef(rowId);
    if (!genre?.browseRails?.length || !def) return [];

    const used = new Set<string>();
    const rails: GenreBrowseRailPlan[] = [];

    for (const rail of genre.browseRails) {
        if (typeFilter === 'tv' && rail.kind === 'movie') continue;
        if (typeFilter === 'movie' && rail.kind === 'tv') continue;

        const items = sliceGenreBrowseRail(
            pool,
            def,
            rail,
            used,
            tmdbById,
            nativeCategory,
            enrichmentById,
            typeFilter
        );
        if (items.length < MIN_RAIL_ITEMS) continue;

        rails.push({
            id: rail.id,
            title: rail.title,
            defaultType:
                rail.kind === 'tv' ? 'tv' : rail.kind === 'movie' ? 'movie' : typeFilter || def.defaultType,
            items
        });
    }

    return rails;
}

export function isNetflixGenreBrowsePage(rowId: string): boolean {
    return isStandardNetflixGenre(rowId);
}

/**
 * Netflix browse never blocks on live TMDB — picks use native slugs,
 * catalog heuristics, and pre-synced enrichment cache only.
 */
export function browseRowNeedsTmdbForPick(
    _rowId: NetflixBrowseRowId,
    _enrichmentLoaded = false
): boolean {
    return false;
}

export function railTitleWithLanguage(base: string, lang: NetflixLanguageOption) {
    return `${base} · ${lang.label}`;
}

export function buildTrendingItems(
    pool: MoovieCatalogItem[],
    byId: Map<string, CuratedItem>
): CuratedItem[] {
    return sortByBrowseRank(pool)
        .slice(0, MAX_TRENDING)
        .map((item) => byId.get(String(item.id)))
        .filter((item): item is CuratedItem => Boolean(item));
}

export function itemMatchesCatalogue(
    item: MoovieCatalogItem,
    catalogueId: string,
    lang: NetflixLanguageOption
) {
    const matcher = HEADER_CATALOGUE_MATCHERS[catalogueId];
    return matcher ? matcher(item, lang) : false;
}

export function filterCataloguePool(
    pool: MoovieCatalogItem[],
    catalogueId: string,
    lang: NetflixLanguageOption
) {
    return pool.filter((item) => itemMatchesCatalogue(item, catalogueId, lang));
}

export function buildNetflixHomeSections(
    pool: MoovieCatalogItem[],
    catalogueId: string,
    catalogueLabel: string,
    lang: NetflixLanguageOption,
    byId: Map<string, CuratedItem>,
    tmdbById: Map<string, CatalogTmdbMeta>
): {
    top10Movies: CuratedItem[];
    top10Tv: CuratedItem[];
    rails: NetflixRailSection[];
} {
    const filtered = filterCataloguePool(pool, catalogueId, lang);
    const plan = planNetflixHomeRows(filtered, catalogueId, catalogueLabel, lang, tmdbById);

    const toCurated = (items: MoovieCatalogItem[]) =>
        items
            .map((item) => byId.get(String(item.id)))
            .filter((item): item is CuratedItem => Boolean(item));

    const rails = plan.rails
        .map((row) => {
            const items = toCurated(row.items);
            if (items.length < MIN_RAIL_ITEMS) return null;
            return {
                id: `${catalogueId}-${row.id}`,
                rowId: row.id,
                title: row.title,
                eyebrow: row.eyebrow,
                description: row.description,
                defaultType: row.defaultType,
                items
            };
        })
        .filter((section): section is NetflixRailSection => Boolean(section));

    return {
        top10Movies: toCurated(plan.top10Movies),
        top10Tv: toCurated(plan.top10Tv),
        rails
    };
}

/** @deprecated Use buildNetflixHomeSections */
export function buildNetflixCuratedSections(
    pool: MoovieCatalogItem[],
    catalogueId: string,
    catalogueLabel: string,
    lang: NetflixLanguageOption,
    byId: Map<string, CuratedItem>,
    tmdbById: Map<string, CatalogTmdbMeta>
): NetflixRailSection[] {
    return buildNetflixHomeSections(
        pool,
        catalogueId,
        catalogueLabel,
        lang,
        byId,
        tmdbById
    ).rails;
}

export function collectArtworkIdsForCurated(
    pool: MoovieCatalogItem[],
    catalogueId: string,
    lang: NetflixLanguageOption,
    catalogueLabel: string,
    tmdbById: Map<string, CatalogTmdbMeta>
): MoovieCatalogItem[] {
    const filtered = filterCataloguePool(pool, catalogueId, lang);
    const seen = new Set<string>();
    const out: MoovieCatalogItem[] = [];

    const push = (item: MoovieCatalogItem) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        out.push(item);
    };

    sortByBrowseRank(filtered)
        .slice(0, MAX_TRENDING)
        .forEach(push);
    const home = planNetflixHomeRows(filtered, catalogueId, catalogueLabel, lang, tmdbById);
    home.top10Movies.forEach(push);
    home.top10Tv.forEach(push);
    for (const plan of home.rails) {
        plan.items.forEach(push);
    }

    return out;
}

export function buildNetflixRailSections(
    pool: MoovieCatalogItem[],
    lang: NetflixLanguageOption,
    byId: Map<string, CuratedItem>
): NetflixRailSection[] {
    const boost = new Set(LANGUAGE_RAIL_BOOST[lang.category] || []);

    const sortedDefs = [...RAIL_DEFINITIONS].sort((a, b) => {
        const aBoost = boost.has(a.id) ? 200 : 0;
        const bBoost = boost.has(b.id) ? 200 : 0;
        return bBoost + b.priority - (aBoost + a.priority);
    });

    const usedIds = new Set<string>();
    const sections: NetflixRailSection[] = [];

    for (const def of sortedDefs) {
        const raw = sortByBrowseRank(
            pool.filter((item) => !usedIds.has(item.id) && def.match(item, lang))
        );
        if (raw.length < MIN_RAIL_ITEMS) continue;

        const items = raw
            .slice(0, MAX_PER_RAIL)
            .map((item) => byId.get(String(item.id)))
            .filter((item): item is CuratedItem => Boolean(item));

        if (items.length < MIN_RAIL_ITEMS) continue;

        raw.slice(0, MAX_PER_RAIL).forEach((item) => usedIds.add(item.id));

        sections.push({
            id: def.id,
            rowId: def.id,
            title: railTitleWithLanguage(def.title, lang),
            eyebrow: def.eyebrow,
            description: def.description(lang),
            defaultType: def.defaultType,
            items
        });
    }

    return sections;
}

export function collectArtworkIds(
    pool: MoovieCatalogItem[],
    lang: NetflixLanguageOption
): MoovieCatalogItem[] {
    const seen = new Set<string>();
    const out: MoovieCatalogItem[] = [];

    const push = (item: MoovieCatalogItem) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        out.push(item);
    };

    sortByBrowseRank(pool)
        .slice(0, MAX_TRENDING)
        .forEach(push);

    for (const def of RAIL_DEFINITIONS) {
        let count = 0;
        for (const item of sortByBrowseRank(pool)) {
            if (count >= MAX_PER_RAIL) break;
            if (seen.has(item.id)) continue;
            if (!def.match(item, lang)) continue;
            push(item);
            count++;
        }
    }

    return out;
}