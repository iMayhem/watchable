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

export function catalogRating(value: string | number | undefined): number {
    const n = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(n) ? n : 0;
}

const CATALOG_FEATURE_FILM_PATTERN =
    /\b(film|the movie|movie:|movie -|ova\b|episode of|stampede|strong world|gekijouban|geki jouban)\b/i;

const CATALOG_SERIES_PATTERN =
    /\b(series|web series|miniseries|limited series)\b/i;

/**
 * Resolve movie vs TV for catalogue browse rows.
 * Season markers win; then explicit API tags; films mis-tagged as tv are demoted.
 */
export function inferCatalogMediaType(item: {
    title?: string;
    media_type?: string;
}): 'movie' | 'tv' {
    const raw = item.title || '';
    const parsed = parseCatalogTitle(raw);

    if (parsed.season != null || /\bS\d{1,2}(?:-S\d+)?\b/i.test(raw)) {
        return 'tv';
    }

    const mt = String(item.media_type || '').toLowerCase();
    if (mt === 'movie') return 'movie';

    if (CATALOG_SERIES_PATTERN.test(raw)) {
        return 'tv';
    }

    if (mt === 'tv') {
        if (CATALOG_FEATURE_FILM_PATTERN.test(raw)) return 'movie';
        return 'tv';
    }

    return 'movie';
}

const CATALOG_API = '/api/moovie-catalog';

export interface BrowseCatalogOptions {
    dubbing?: string;
    country?: string;
    type?: string;
    genre?: string;
}

export async function browseMoovieCatalog(
    category: string,
    page = 0,
    options?: BrowseCatalogOptions
): Promise<MoovieCatalogResponse> {
    nfDebug('catalog:browse:start', { category, page, options });
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
        throw err;
    }
}

export async function searchMoovieCatalog(
    query: string,
    page = 0
): Promise<MoovieCatalogResponse> {
    nfDebug('catalog:search:start', { query, page });
    const params = new URLSearchParams({
        action: 'search',
        q: query,
        page: String(page)
    });
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
        throw err;
    }
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