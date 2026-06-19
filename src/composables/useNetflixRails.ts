import { parseCatalogTitle, type MoovieCatalogItem } from './useMoovieCatalog';
import {
    itemMatchesLanguage,
    type NetflixLanguageOption
} from './useNetflixLanguage';
import type { CuratedItem } from '../components/rails/CuratedRail.vue';

export interface NetflixRailSection {
    id: string;
    title: string;
    eyebrow: string;
    description: string;
    defaultType: 'movie' | 'tv';
    items: CuratedItem[];
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