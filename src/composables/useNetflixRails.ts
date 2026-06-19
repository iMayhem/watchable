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

function hasLangBase(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    return itemMatchesLanguage(item, lang);
}

function hollywoodMovie(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isMovie(item) || !hasLangBase(item, lang)) return false;
    if (hasAny(item, ['bollywood', 'tollywood', 'kollywood', 'sandalwood'])) return false;
    return hasAny(item, [
        'hollywood',
        'english',
        'eng dub',
        'engdub',
        'hindidub',
        'hindi dub',
        'dual audio',
        'multi audio'
    ]);
}

function bollywoodMovie(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isMovie(item) || !hasLangBase(item, lang)) return false;
    return hasAny(item, ['bollywood', 'hindi movie', 'hindi film']);
}

function koreanMovie(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isMovie(item) || !hasLangBase(item, lang)) return false;
    return hasAny(item, ['korean', 'k-drama', 'korea', 'k movie']);
}

function koreanSeries(item: MoovieCatalogItem, lang: NetflixLanguageOption) {
    if (!isSeries(item) || !hasLangBase(item, lang)) return false;
    return hasAny(item, ['korean', 'k-drama', 'korea', 'k series']);
}

function regionalMovies(
    item: MoovieCatalogItem,
    lang: NetflixLanguageOption,
    regionNeedles: string[]
) {
    if (!isMovie(item) || !hasLangBase(item, lang)) return false;
    return hasAny(item, regionNeedles);
}

function regionalSeries(
    item: MoovieCatalogItem,
    lang: NetflixLanguageOption,
    regionNeedles: string[]
) {
    if (!isSeries(item) || !hasLangBase(item, lang)) return false;
    return hasAny(item, regionNeedles);
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
        match: (item, lang) =>
            regionalSeries(item, lang, ['japanese', 'anime', 'japan']),
        priority: 30
    },
    {
        id: 'arabic',
        title: 'Arabic movies',
        eyebrow: 'Middle East',
        description: (lang) => `Arabic cinema in ${lang.label}.`,
        defaultType: 'movie',
        match: (item, lang) => regionalMovies(item, lang, ['arabic', 'arab']),
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
        match: (item, lang) =>
            regionalSeries(item, lang, ['english', 'hollywood', 'web series']),
        priority: 15
    },
    {
        id: 'hindi-series',
        title: 'Hindi series',
        eyebrow: 'Shows',
        description: (lang) => `Hindi-language series and seasons in ${lang.label}.`,
        defaultType: 'tv',
        match: (item, lang) =>
            regionalSeries(item, lang, ['hindi', 'hindidub', 'hindi dub']),
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

const MIN_RAIL_ITEMS = 4;
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