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

const CATALOG_API = '/api/moovie-catalog';

export async function browseMoovieCatalog(
    category: string,
    page = 0
): Promise<MoovieCatalogResponse> {
    nfDebug('catalog:browse:start', { category, page });
    const params = new URLSearchParams({
        action: 'browse',
        category,
        page: String(page)
    });
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