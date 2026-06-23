const INDIAN_LANGUAGES = new Set([
    'hi',
    'ta',
    'te',
    'ml',
    'kn',
    'mr',
    'bn',
    'pa',
    'gu',
    'ur'
]);

const INDIAN_SCRIPT_RE =
    /[\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0D00-\u0D7F\u0A80-\u0AFF]/;

export type GlobalContentTier = 'hollywood' | 'neutral' | 'indian';

/** Default TMDB filter for global neutral browse — Hollywood / English first. */
export const GLOBAL_DEFAULT_ORIGINAL_LANGUAGE = 'en';

type BrowseContentItem = {
    original_language?: string;
    title?: string;
    original_title?: string;
    name?: string;
    original_name?: string;
};

export function isGlobalHomeFeedPath(url: string): boolean {
    return (
        url.includes('trending/movie') ||
        url.includes('movie/popular') ||
        url.includes('movie/now_playing') ||
        url.includes('trending/tv') ||
        url.includes('tv/on_the_air')
    );
}

export function isGlobalDiscoverFeedPath(url: string): boolean {
    return url.includes('discover/movie') || url.includes('discover/tv');
}

export function isGlobalBrowseFeedPath(url: string): boolean {
    return isGlobalHomeFeedPath(url) || isGlobalDiscoverFeedPath(url);
}

export function hasExplicitLanguageFilter(url: string, params?: Record<string, unknown>): boolean {
    const paramLang = params?.with_original_language;
    if (typeof paramLang === 'string' && paramLang.length > 0) return true;

    try {
        const parsed = url.startsWith('http')
            ? new URL(url)
            : new URL(url, 'https://api.themoviedb.org/3/');
        const lang = parsed.searchParams.get('with_original_language');
        return Boolean(lang && lang.length > 0);
    } catch {
        return false;
    }
}

function getEffectiveLanguageFilter(
    url: string,
    params?: Record<string, unknown>
): string | null {
    const paramLang = params?.with_original_language;
    if (typeof paramLang === 'string' && paramLang.length > 0) return paramLang;

    try {
        const parsed = url.startsWith('http')
            ? new URL(url)
            : new URL(url, 'https://api.themoviedb.org/3/');
        return parsed.searchParams.get('with_original_language');
    } catch {
        return null;
    }
}

/** True when global neutral should bias toward Hollywood / English. */
export function shouldApplyGlobalHollywoodBias(
    region: string,
    url: string,
    params?: Record<string, unknown>
): boolean {
    if (region !== 'global') return false;
    if (!isGlobalBrowseFeedPath(url)) return false;
    const lang = getEffectiveLanguageFilter(url, params);
    return !lang || lang === GLOBAL_DEFAULT_ORIGINAL_LANGUAGE;
}

export function shouldCurateGlobalBrowse(
    region: string,
    url: string,
    params?: Record<string, unknown>
): boolean {
    return shouldApplyGlobalHollywoodBias(region, url, params);
}

export function getGlobalContentTier(item: BrowseContentItem): GlobalContentTier {
    const lang = (item.original_language || '').toLowerCase();
    if (INDIAN_LANGUAGES.has(lang)) return 'indian';

    const text = [item.title, item.original_title, item.name, item.original_name]
        .filter(Boolean)
        .join(' ');
    if (INDIAN_SCRIPT_RE.test(text)) return 'indian';

    if (lang === 'en') return 'hollywood';
    return 'neutral';
}

const TIER_ORDER: Record<GlobalContentTier, number> = {
    hollywood: 0,
    neutral: 1,
    indian: 2
};

export function curateGlobalBrowseResults<T extends BrowseContentItem>(items: T[]): T[] {
    if (!items?.length) return items ?? [];
    return [...items].sort(
        (a, b) => TIER_ORDER[getGlobalContentTier(a)] - TIER_ORDER[getGlobalContentTier(b)]
    );
}

export function applyGlobalBrowseCuration<T extends BrowseContentItem>(
    items: T[],
    options: { excludeIndian?: boolean } = {}
): T[] {
    const sorted = curateGlobalBrowseResults(items);
    if (!options.excludeIndian) return sorted;
    return sorted.filter((item) => getGlobalContentTier(item) !== 'indian');
}

/** @deprecated Use curateGlobalBrowseResults */
export const curateGlobalHomeResults = curateGlobalBrowseResults;