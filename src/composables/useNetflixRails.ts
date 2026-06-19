import { parseCatalogTitle, type MoovieCatalogItem } from './useMoovieCatalog';
import {
    itemMatchesLanguage,
    type NetflixLanguageOption
} from './useNetflixLanguage';
import type { CuratedItem } from '../components/rails/CuratedRail.vue';

export interface NetflixRailSection {
    id: string;
    rowId: string;
    title: string;
    eyebrow: string;
    description: string;
    defaultType: 'movie' | 'tv';
    items: CuratedItem[];
}

export const NETFLIX_BROWSE_ROW_IDS = [
    'trending',
    'top10-movies',
    'top10-tv',
    'new-on-netflix',
    'blockbuster-movies',
    'critically-acclaimed',
    'exciting-tv',
    'action-adventure',
    'comedies',
    'thrillers',
    'romantic-movies',
    'tv-dramas',
    'only-on-netflix'
] as const;

export type NetflixBrowseRowId = (typeof NETFLIX_BROWSE_ROW_IDS)[number];

const BROWSE_ROW_ID_SET = new Set<string>(NETFLIX_BROWSE_ROW_IDS);

export function isValidNetflixBrowseRow(rowId: string): rowId is NetflixBrowseRowId {
    return BROWSE_ROW_ID_SET.has(rowId);
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

function countryOf(item: MoovieCatalogItem): string {
    return (item.cn || '').trim().toLowerCase();
}

function channelOf(item: MoovieCatalogItem): string {
    return (item.channel || '').trim().toLowerCase();
}

function isMovie(item: MoovieCatalogItem) {
    return item.media_type !== 'tv';
}

function isSeries(item: MoovieCatalogItem) {
    return item.media_type === 'tv';
}

function hasAny(item: MoovieCatalogItem, needles: string[]) {
    const h = haystack(item);
    return needles.some((n) => h.includes(n.toLowerCase()));
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
    const c = countryOf(item);
    if (!c) return false;
    if (ARAB_COUNTRIES.has(c)) return false;
    return isHollywoodCountry(item) || !isIndia(item);
}

function bollywoodMovie(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isMovie(item) || !hasLangBase(item, lang)) return false;
    return isIndia(item);
}

function koreanMovie(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isMovie(item) || !hasLangBase(item, lang)) return false;
    return KOREAN_COUNTRIES.has(countryOf(item)) || hasLangTag(item, 'korean', 'korea');
}

function koreanSeries(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isSeries(item) || !hasLangBase(item, lang)) return false;
    return KOREAN_COUNTRIES.has(countryOf(item)) || hasAny(item, ['korean', 'k-drama', 'korea']);
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
    hollywood: (item, lang) => hollywoodMovie(item, lang) || englishSeries(item, lang),
    bollywood: (item, lang) => bollywoodMovie(item, lang) || hindiSeries(item, lang),
    korean: (item, lang) => koreanMovie(item, lang) || koreanSeries(item, lang),
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

function takeUnique(
    pool: MoovieCatalogItem[],
    used: Set<string>,
    limit: number,
    predicate: (item: MoovieCatalogItem) => boolean
) {
    const out: MoovieCatalogItem[] = [];
    for (const item of pool) {
        if (out.length >= limit) break;
        if (used.has(item.id) || !predicate(item)) continue;
        used.add(item.id);
        out.push(item);
    }
    return out;
}

function takeTopRated(
    pool: MoovieCatalogItem[],
    used: Set<string>,
    limit: number,
    opts: { movie?: boolean; tv?: boolean; minRating?: number } = {}
) {
    const minRating = opts.minRating ?? 0;
    const candidates = pool
        .filter((item) => {
            if (used.has(item.id)) return false;
            if (opts.movie && !isMovie(item)) return false;
            if (opts.tv && !isSeries(item)) return false;
            return itemRating(item) >= minRating;
        })
        .sort((a, b) => itemRating(b) - itemRating(a));

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
    opts: { movie?: boolean; tv?: boolean } = {}
) {
    const candidates = pool
        .filter((item) => {
            if (used.has(item.id)) return false;
            if (opts.movie && !isMovie(item)) return false;
            if (opts.tv && !isSeries(item)) return false;
            return releaseTimestamp(item) > 0;
        })
        .sort((a, b) => releaseTimestamp(b) - releaseTimestamp(a));

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

interface NetflixCuratedPlan {
    id: string;
    title: string;
    eyebrow: string;
    description: string;
    defaultType: 'movie' | 'tv';
    items: MoovieCatalogItem[];
}

/** Netflix homepage row titles + ordering (after Trending Now). */
function planNetflixCuratedRows(
    filtered: MoovieCatalogItem[],
    catalogueLabel: string,
    lang: NetflixLanguageOption
): NetflixCuratedPlan[] {
    const used = new Set<string>();
    const rows: NetflixCuratedPlan[] = [];

    const push = (
        id: string,
        title: string,
        eyebrow: string,
        description: string,
        defaultType: 'movie' | 'tv',
        items: MoovieCatalogItem[]
    ) => {
        if (items.length < MIN_RAIL_ITEMS) return;
        rows.push({ id, title, eyebrow, description, defaultType, items });
    };

    push(
        'top10-movies',
        'Top 10 Movies Today',
        'Top 10',
        `Today's most popular movies in ${catalogueLabel}.`,
        'movie',
        takeTopRated(filtered, used, TOP_CHART_SIZE, { movie: true })
    );

    push(
        'top10-tv',
        'Top 10 TV Shows Today',
        'Top 10',
        `Today's most popular series in ${catalogueLabel}.`,
        'tv',
        takeTopRated(filtered, used, TOP_CHART_SIZE, { tv: true })
    );

    push(
        'new-on-netflix',
        'New on Netflix',
        'New arrivals',
        `Recently added ${catalogueLabel} titles in ${lang.label}.`,
        'movie',
        takeNewest(filtered, used, MAX_PER_RAIL)
    );

    push(
        'blockbuster-movies',
        'Blockbuster Movies',
        'Hits',
        `Big ${catalogueLabel} films with ${lang.label} audio.`,
        'movie',
        takeTopRated(filtered, used, MAX_PER_RAIL, { movie: true, minRating: 6.5 })
    );

    push(
        'critically-acclaimed',
        'Critically Acclaimed Movies',
        'Award season',
        `Standout ${catalogueLabel} movies rated 7.5+.`,
        'movie',
        takeTopRated(filtered, used, MAX_PER_RAIL, { movie: true, minRating: 7.5 })
    );

    push(
        'exciting-tv',
        'Exciting TV Shows',
        'Series',
        `Binge-worthy ${catalogueLabel} series in ${lang.label}.`,
        'tv',
        takeTopRated(filtered, used, MAX_PER_RAIL, { tv: true, minRating: 6 })
    );

    push(
        'action-adventure',
        'Action & Adventure',
        'Adrenaline',
        `High-energy ${catalogueLabel} action in ${lang.label}.`,
        'movie',
        takeByKeywords(
            filtered,
            used,
            MAX_PER_RAIL,
            ['action', 'adventure', 'mission', 'war', 'marvel', 'fast', 'gun', 'fighter'],
            { movie: true }
        )
    );

    push(
        'comedies',
        'Comedies',
        'Laughs',
        `Funny ${catalogueLabel} picks in ${lang.label}.`,
        'movie',
        takeByKeywords(
            filtered,
            used,
            MAX_PER_RAIL,
            ['comedy', 'comedic', 'funny', 'laugh', 'humor', 'humour'],
            { movie: true }
        )
    );

    push(
        'thrillers',
        'Thriller Movies',
        'Edge of your seat',
        `Suspenseful ${catalogueLabel} thrillers in ${lang.label}.`,
        'movie',
        takeByKeywords(
            filtered,
            used,
            MAX_PER_RAIL,
            ['thriller', 'mystery', 'crime', 'murder', 'suspense', 'horror', 'dark'],
            { movie: true }
        )
    );

    push(
        'romantic-movies',
        'Romantic Movies',
        'Love stories',
        `Romance and drama in ${catalogueLabel}.`,
        'movie',
        takeByKeywords(
            filtered,
            used,
            MAX_PER_RAIL,
            ['romance', 'romantic', 'love', 'wedding', 'heart'],
            { movie: true }
        )
    );

    push(
        'tv-dramas',
        'TV Dramas',
        'Drama',
        `Dramatic ${catalogueLabel} series in ${lang.label}.`,
        'tv',
        takeByKeywords(
            filtered,
            used,
            MAX_PER_RAIL,
            ['drama', 'season', 'story', 'family', 'life'],
            { tv: true }
        )
    );

    push(
        'only-on-netflix',
        'Only on Netflix',
        'Exclusive',
        `More ${catalogueLabel} titles you can watch now.`,
        'movie',
        takeUnique(filtered, used, MAX_PER_RAIL, () => true)
    );

    return rows;
}

const BROWSE_POOL_LIMIT = 240;

function pickRowItems(
    filtered: MoovieCatalogItem[],
    rowId: NetflixBrowseRowId,
    _catalogueLabel: string,
    _lang: NetflixLanguageOption,
    limit: number
): MoovieCatalogItem[] {
    const used = new Set<string>();

    switch (rowId) {
        case 'trending':
            return filtered.slice(0, limit);
        case 'top10-movies':
            return takeTopRated(filtered, used, limit, { movie: true });
        case 'top10-tv':
            return takeTopRated(filtered, used, limit, { tv: true });
        case 'new-on-netflix':
            return takeNewest(filtered, used, limit);
        case 'blockbuster-movies':
            return takeTopRated(filtered, used, limit, { movie: true, minRating: 6.5 });
        case 'critically-acclaimed':
            return takeTopRated(filtered, used, limit, { movie: true, minRating: 7.5 });
        case 'exciting-tv':
            return takeTopRated(filtered, used, limit, { tv: true, minRating: 6 });
        case 'action-adventure':
            return takeByKeywords(
                filtered,
                used,
                limit,
                ['action', 'adventure', 'mission', 'war', 'marvel', 'fast', 'gun', 'fighter'],
                { movie: true }
            );
        case 'comedies':
            return takeByKeywords(
                filtered,
                used,
                limit,
                ['comedy', 'comedic', 'funny', 'laugh', 'humor', 'humour'],
                { movie: true }
            );
        case 'thrillers':
            return takeByKeywords(
                filtered,
                used,
                limit,
                ['thriller', 'mystery', 'crime', 'murder', 'suspense', 'horror', 'dark'],
                { movie: true }
            );
        case 'romantic-movies':
            return takeByKeywords(
                filtered,
                used,
                limit,
                ['romance', 'romantic', 'love', 'wedding', 'heart'],
                { movie: true }
            );
        case 'tv-dramas':
            return takeByKeywords(
                filtered,
                used,
                limit,
                ['drama', 'season', 'story', 'family', 'life'],
                { tv: true }
            );
        case 'only-on-netflix':
            return takeUnique(filtered, used, limit, () => true);
        default:
            return [];
    }
}

const NETFLIX_ROW_META: Record<
    NetflixBrowseRowId,
    {
        title: string;
        eyebrow: string;
        description: (catalogueLabel: string, lang: NetflixLanguageOption) => string;
        defaultType: 'movie' | 'tv';
    }
> = {
    trending: {
        title: 'Trending now',
        eyebrow: '',
        description: (catalogueLabel, lang) =>
            `Trending ${catalogueLabel} titles in ${lang.label}.`,
        defaultType: 'movie'
    },
    'top10-movies': {
        title: 'Top 10 Movies Today',
        eyebrow: 'Top 10',
        description: (catalogueLabel) => `Today's most popular movies in ${catalogueLabel}.`,
        defaultType: 'movie'
    },
    'top10-tv': {
        title: 'Top 10 TV Shows Today',
        eyebrow: 'Top 10',
        description: (catalogueLabel) => `Today's most popular series in ${catalogueLabel}.`,
        defaultType: 'tv'
    },
    'new-on-netflix': {
        title: 'New on Netflix',
        eyebrow: 'New arrivals',
        description: (catalogueLabel, lang) =>
            `Recently added ${catalogueLabel} titles in ${lang.label}.`,
        defaultType: 'movie'
    },
    'blockbuster-movies': {
        title: 'Blockbuster Movies',
        eyebrow: 'Hits',
        description: (catalogueLabel, lang) =>
            `Big ${catalogueLabel} films with ${lang.label} audio.`,
        defaultType: 'movie'
    },
    'critically-acclaimed': {
        title: 'Critically Acclaimed Movies',
        eyebrow: 'Award season',
        description: (catalogueLabel) => `Standout ${catalogueLabel} movies rated 7.5+.`,
        defaultType: 'movie'
    },
    'exciting-tv': {
        title: 'Exciting TV Shows',
        eyebrow: 'Series',
        description: (catalogueLabel, lang) =>
            `Binge-worthy ${catalogueLabel} series in ${lang.label}.`,
        defaultType: 'tv'
    },
    'action-adventure': {
        title: 'Action & Adventure',
        eyebrow: 'Adrenaline',
        description: (catalogueLabel, lang) =>
            `High-energy ${catalogueLabel} action in ${lang.label}.`,
        defaultType: 'movie'
    },
    comedies: {
        title: 'Comedies',
        eyebrow: 'Laughs',
        description: (catalogueLabel, lang) => `Funny ${catalogueLabel} picks in ${lang.label}.`,
        defaultType: 'movie'
    },
    thrillers: {
        title: 'Thriller Movies',
        eyebrow: 'Edge of your seat',
        description: (catalogueLabel, lang) =>
            `Suspenseful ${catalogueLabel} thrillers in ${lang.label}.`,
        defaultType: 'movie'
    },
    'romantic-movies': {
        title: 'Romantic Movies',
        eyebrow: 'Love stories',
        description: (catalogueLabel) => `Romance and drama in ${catalogueLabel}.`,
        defaultType: 'movie'
    },
    'tv-dramas': {
        title: 'TV Dramas',
        eyebrow: 'Drama',
        description: (catalogueLabel, lang) =>
            `Dramatic ${catalogueLabel} series in ${lang.label}.`,
        defaultType: 'tv'
    },
    'only-on-netflix': {
        title: 'Only on Netflix',
        eyebrow: 'Exclusive',
        description: (catalogueLabel) => `More ${catalogueLabel} titles you can watch now.`,
        defaultType: 'movie'
    }
};

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
    const meta = NETFLIX_ROW_META[rowId];
    const eyebrow =
        rowId === 'trending' ? catalogue.eyebrow || catalogue.label : meta.eyebrow;
    return {
        title: meta.title,
        eyebrow,
        description: meta.description(catalogue.label, lang),
        defaultType: meta.defaultType
    };
}

export function pickNetflixBrowseItems(
    pool: MoovieCatalogItem[],
    rowId: NetflixBrowseRowId,
    catalogue: { label: string },
    lang: NetflixLanguageOption,
    limit = BROWSE_POOL_LIMIT
): MoovieCatalogItem[] {
    return pickRowItems(pool, rowId, catalogue.label, lang, limit);
}

export function railTitleWithLanguage(base: string, lang: NetflixLanguageOption) {
    return `${base} · ${lang.label}`;
}

export function buildTrendingItems(
    pool: MoovieCatalogItem[],
    byId: Map<string, CuratedItem>
): CuratedItem[] {
    return pool
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

export function buildNetflixCuratedSections(
    pool: MoovieCatalogItem[],
    catalogueId: string,
    catalogueLabel: string,
    lang: NetflixLanguageOption,
    byId: Map<string, CuratedItem>
): NetflixRailSection[] {
    const filtered = filterCataloguePool(pool, catalogueId, lang);
    const plans = planNetflixCuratedRows(filtered, catalogueLabel, lang);

    return plans
        .map((plan) => {
            const items = plan.items
                .map((item) => byId.get(String(item.id)))
                .filter((item): item is CuratedItem => Boolean(item));
            if (items.length < MIN_RAIL_ITEMS) return null;
            return {
                id: `${catalogueId}-${plan.id}`,
                rowId: plan.id,
                title: plan.title,
                eyebrow: plan.eyebrow,
                description: plan.description,
                defaultType: plan.defaultType,
                items
            };
        })
        .filter((section): section is NetflixRailSection => Boolean(section));
}

export function collectArtworkIdsForCurated(
    pool: MoovieCatalogItem[],
    catalogueId: string,
    lang: NetflixLanguageOption,
    catalogueLabel: string
): MoovieCatalogItem[] {
    const filtered = filterCataloguePool(pool, catalogueId, lang);
    const seen = new Set<string>();
    const out: MoovieCatalogItem[] = [];

    const push = (item: MoovieCatalogItem) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        out.push(item);
    };

    filtered.slice(0, MAX_TRENDING).forEach(push);
    for (const plan of planNetflixCuratedRows(filtered, catalogueLabel, lang)) {
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
        const raw = pool.filter(
            (item) => !usedIds.has(item.id) && def.match(item, lang)
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

    pool.slice(0, MAX_TRENDING).forEach(push);

    for (const def of RAIL_DEFINITIONS) {
        let count = 0;
        for (const item of pool) {
            if (count >= MAX_PER_RAIL) break;
            if (seen.has(item.id)) continue;
            if (!def.match(item, lang)) continue;
            push(item);
            count++;
        }
    }

    return out;
}