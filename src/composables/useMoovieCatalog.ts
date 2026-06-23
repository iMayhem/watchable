import { nfDebug, nfDebugError } from './useNetflixDebug';

export interface MoovieCatalogItem {
    id: string;
    title: string;
    backdrop_path: string | null;
    release_date: string;
    media_type: 'movie' | 'tv';
    vote_average: string | number;
    channel?: string;
    cn?: string;
    duration?: string | number | null;
    subjectid?: string | null;
    embed?: string | null;
    embed_en?: string | null;
    season?: unknown;
}

export interface MoovieCatalogResponse {
    results: MoovieCatalogItem[];
    pager?: {
        current_page: number;
        items_per_page: number;
        total_pages: number;
        total_results: number;
    };
}

export interface ParsedCatalogTitle {
    displayTitle: string;
    languages: string[];
    season: number | null;
    mediaTypeHint: 'movie' | 'tv' | null;
}

const LANGUAGE_PATTERN = /\[([^\]]+)\]/g;
const SEASON_PATTERN = /\bS(\d+)(?:-S\d+)?\b/i;

export function parseCatalogTitle(raw: string): ParsedCatalogTitle {
    const languages: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = LANGUAGE_PATTERN.exec(raw)) !== null) {
        const tag = match[1].trim();
        if (tag && !languages.includes(tag)) {
            languages.push(tag);
        }
    }

    const seasonMatch = raw.match(SEASON_PATTERN);
    const season = seasonMatch ? parseInt(seasonMatch[1], 10) : null;
    const mediaTypeHint = season != null || /\bS\d+/i.test(raw) ? 'tv' : null;

    const displayTitle = raw
        .replace(LANGUAGE_PATTERN, '')
        .replace(/\bS\d+(?:-S\d+)?\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return { displayTitle, languages, season, mediaTypeHint };
}

/** UI label — clean title only (no `[Hindi]` tags, no `S1` season markers). */
export function catalogDisplayTitle(raw: string): string {
    const cleaned = String(raw || '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    if (!cleaned) return '';
    return parseCatalogTitle(cleaned).displayTitle || cleaned;
}

/** Normalized title for search, SEO, and variant matching. */
export function catalogSearchTitle(raw: string): string {
    return catalogDisplayTitle(raw);
}

export function catalogRating(value: string | number | undefined): number {
    const n = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(n) ? n : 0;
}

const CATALOG_FEATURE_FILM_PATTERN =
    /\b(film|the movie|movie:|movie -|ova\b|episode of|stampede|strong world|gekijouban|geki jouban)\b/i;

const CATALOG_SERIES_PATTERN =
    /\b(series|web series|miniseries|limited series)\b/i;

function parseCatalogDurationMinutes(duration: unknown): number {
    const n = parseInt(String(duration ?? ''), 10);
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (n > 500) return Math.round(n / 60);
    return n;
}

function looksLikeFeatureFilm(item: { title?: string; duration?: unknown }): boolean {
    const raw = item.title || '';
    const parsed = parseCatalogTitle(raw);
    if (parsed.season != null || /\bS\d{1,2}(?:-S\d+)?\b/i.test(raw)) {
        return false;
    }

    const minutes = parseCatalogDurationMinutes(item.duration);
    return minutes >= 75 && minutes <= 200;
}

/** Netmirror embed-only rows are almost always standalone film rips, not series. */
export function isEmbedOnlyCatalogFilm(item: {
    embed?: string | null;
    subjectid?: string | null;
    embed_en?: string | null;
}): boolean {
    const hasSubject = Boolean(String(item.subjectid || '').trim());
    if (hasSubject) return false;

    const hasEmbed = Boolean(String(item.embed || '').trim());
    if (hasEmbed) return true;

    return String(item.embed_en || '').trim() === '1';
}

export function hasCatalogSeasonData(season: unknown): boolean {
    if (Array.isArray(season) && season.length > 0) return true;
    if (season && typeof season === 'object') return true;
    if (typeof season === 'string' && season.trim()) return true;
    return false;
}

export type CatalogMediaSignals = {
    title?: string;
    media_type?: string;
    duration?: unknown;
    embed?: string | null;
    subjectid?: string | null;
    embed_en?: string | null;
    season?: unknown;
};

/**
 * Resolve movie vs TV for catalogue browse rows.
 * Season markers win; then explicit API tags; films mis-tagged as tv are demoted.
 */
export function inferCatalogMediaType(item: CatalogMediaSignals & { type?: string }): 'movie' | 'tv' {
    const raw = item.title || '';
    const parsed = parseCatalogTitle(raw);

    if (parsed.season != null || /\bS\d{1,2}(?:-S\d+)?\b/i.test(raw)) {
        return 'tv';
    }

    const mt = String(item.media_type || item.type || '').toLowerCase();
    if (mt === 'movie') return 'movie';

    if (CATALOG_SERIES_PATTERN.test(raw)) {
        return 'tv';
    }

    if (mt === 'tv') {
        if (isEmbedOnlyCatalogFilm(item)) return 'movie';
        if (CATALOG_FEATURE_FILM_PATTERN.test(raw)) return 'movie';
        if (hasCatalogSeasonData(item.season)) return 'tv';
        if (/\bS\d{1,2}(?:-S\d+)?\b/i.test(raw) || CATALOG_SERIES_PATTERN.test(raw)) {
            return 'tv';
        }
        // subjectid powers watchbox for standalone films mis-tagged as tv.
        if (Boolean(String(item.subjectid || '').trim())) return 'movie';
        if (looksLikeFeatureFilm(item)) return 'movie';
        return 'tv';
    }

    if (hasCatalogSeasonData(item.season)) {
        return 'tv';
    }

    return 'movie';
}

/**
 * Stricter gate for season/episode UI — never trust a bare media_type tag alone.
 */
export function catalogHasEpisodeGuide(
    item: CatalogMediaSignals,
    routeType?: 'movie' | 'tv' | string
): boolean {
    const raw = item.title || '';
    const parsed = parseCatalogTitle(raw);

    if (parsed.season != null || /\bS\d{1,2}(?:-S\d+)?\b/i.test(raw)) {
        return true;
    }

    if (CATALOG_FEATURE_FILM_PATTERN.test(raw)) {
        return false;
    }

    if (inferCatalogMediaType(item) === 'movie') {
        return false;
    }

    const mt = String(item.media_type || '').toLowerCase();
    if (mt === 'movie') return false;

    if (routeType === 'movie') {
        return false;
    }

    if (hasCatalogSeasonData(item.season)) {
        return true;
    }

    if (CATALOG_SERIES_PATTERN.test(raw)) {
        return true;
    }

    // subjectid alone also covers single-title watchbox films — need season rows for episode UI.
    return false;
}

/** Netflix catalogue browse/search/meta — proxied for browser CORS (resolve stays on same worker). */
const CATALOG_API = '/api/moovie-catalog';

export interface BrowseCatalogOptions {
    dubbing?: string;
    country?: string;
    type?: string;
    genre?: string;
    genre_ids?: string[];
    sort_by?: string;
    countryNot?: string;
    countryNot2?: string;
    title_not?: string[];
}

const catalogCache = new Map<string, Promise<MoovieCatalogResponse>>();

export async function browseMoovieCatalog(
    category: string,
    page = 0,
    options?: BrowseCatalogOptions
): Promise<MoovieCatalogResponse> {
    const action = category === 'filter' ? 'filter' : 'browse';
    const params = new URLSearchParams({
        action,
        page: String(page)
    });
    if (action === 'browse') {
        params.set('category', category);
    }
    if (options?.dubbing) params.set('dubbing', options.dubbing);
    if (options?.country) params.set('country', options.country);
    if (options?.type) params.set('type', options.type);
    if (options?.genre) params.set('genre', options.genre);
    if (options?.genre_ids?.length) {
        for (const value of options.genre_ids) {
            params.append('genre_ids[]', value);
        }
    }
    if (options?.sort_by) params.set('sort_by', options.sort_by);
    if (options?.countryNot) params.set('countryNot', options.countryNot);
    if (options?.countryNot2) params.set('countryNot2', options.countryNot2);
    if (options?.title_not?.length) {
        for (const value of options.title_not) {
            params.append('title_not[]', value);
        }
    }

    const cacheKey = params.toString();
    if (catalogCache.has(cacheKey)) {
        nfDebug('catalog:browse:cache-hit', { category, page });
        return catalogCache.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
        nfDebug('catalog:browse:start', { category, page, options });
        try {
            const resp = await fetch(`${CATALOG_API}?${params}`);
            const data = await resp.json();
            if (!resp.ok) {
                throw new Error(data.error || `Browse failed (${resp.status})`);
            }
            nfDebug('catalog:browse:ok', {
                category,
                page,
                count: data.results?.length ?? 0,
                totalPages: data.pager?.total_pages
            });
            return data as MoovieCatalogResponse;
        } catch (err) {
            nfDebugError('catalog:browse:fail', { category, page, err });
            catalogCache.delete(cacheKey);
            throw err;
        }
    })();

    catalogCache.set(cacheKey, fetchPromise);
    return fetchPromise;
}

const searchCache = new Map<string, Promise<MoovieCatalogResponse>>();

export async function searchMoovieCatalog(
    query: string,
    page = 0
): Promise<MoovieCatalogResponse> {
    const params = new URLSearchParams({
        action: 'search',
        q: query,
        page: String(page)
    });
    const cacheKey = params.toString();
    if (searchCache.has(cacheKey)) {
        nfDebug('catalog:search:cache-hit', { query, page });
        return searchCache.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
        nfDebug('catalog:search:start', { query, page });
        try {
            const resp = await fetch(`${CATALOG_API}?${params}`);
            const data = await resp.json();
            if (!resp.ok) {
                throw new Error(data.error || `Search failed (${resp.status})`);
            }
            nfDebug('catalog:search:ok', { query, page, count: data.results?.length ?? 0 });
            return { results: data.results || [], pager: data.pager };
        } catch (err) {
            nfDebugError('catalog:search:fail', { query, page, err });
            searchCache.delete(cacheKey);
            throw err;
        }
    })();

    searchCache.set(cacheKey, fetchPromise);
    return fetchPromise;
}

export async function fetchMoovieCatalogMeta(type: 'movie' | 'tv', id: string) {
    nfDebug('catalog:meta:start', { type, id });
    const params = new URLSearchParams({ action: 'meta', type, id });
    try {
        const resp = await fetch(`${CATALOG_API}?${params}`);
        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || `Metadata failed (${resp.status})`);
        }
        nfDebug('catalog:meta:ok', { type, id, title: data.meta?.title });
        return data.meta;
    } catch (err) {
        nfDebugError('catalog:meta:fail', { type, id, err });
        throw err;
    }
}

/** Try requested media type, then flip movie/tv when catalogue tags disagree. */
export async function fetchMoovieCatalogMetaResolved(
    type: 'movie' | 'tv',
    id: string
) {
    try {
        return await fetchMoovieCatalogMeta(type, id);
    } catch (primaryErr) {
        const alt: 'movie' | 'tv' = type === 'movie' ? 'tv' : 'movie';
        try {
            const meta = await fetchMoovieCatalogMeta(alt, id);
            nfDebug('catalog:meta:resolved-alt-type', { id, from: type, to: alt });
            return meta;
        } catch {
            throw primaryErr;
        }
    }
}