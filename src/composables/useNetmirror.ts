import { nfDebug, nfDebugError } from './useNetflixDebug';

export interface NetmirrorBrowseItem {
    id: string;
    title: string;
    backdrop_path: string | null;
    release_date: string;
    media_type: 'movie' | 'tv';
    vote_average: string | number;
    channel?: string;
    cn?: string;
}

export interface NetmirrorBrowseResponse {
    results: NetmirrorBrowseItem[];
    pager?: {
        current_page: number;
        items_per_page: number;
        total_pages: number;
        total_results: number;
    };
}

export interface ParsedNetmirrorTitle {
    displayTitle: string;
    languages: string[];
    season: number | null;
    mediaTypeHint: 'movie' | 'tv' | null;
}

const LANGUAGE_PATTERN = /\[([^\]]+)\]/g;
const SEASON_PATTERN = /\bS(\d+)(?:-S\d+)?\b/i;

export function parseNetmirrorTitle(raw: string): ParsedNetmirrorTitle {
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

export function netmirrorRating(value: string | number | undefined): number {
    const n = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(n) ? n : 0;
}

export async function browseNetmirror(
    category: string,
    page = 0
): Promise<NetmirrorBrowseResponse> {
    nfDebug('netmirror:browse:start', { category, page });
    const params = new URLSearchParams({
        action: 'browse',
        category,
        page: String(page)
    });
    try {
        const resp = await fetch(`/api/netmirror?${params}`);
        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || `Browse failed (${resp.status})`);
        }
        nfDebug('netmirror:browse:ok', {
            category,
            page,
            count: data.results?.length ?? 0,
            totalPages: data.pager?.total_pages
        });
        return data as NetmirrorBrowseResponse;
    } catch (err) {
        nfDebugError('netmirror:browse:fail', { category, page, err });
        throw err;
    }
}

export async function searchNetmirror(query: string, page = 0): Promise<NetmirrorBrowseResponse> {
    nfDebug('netmirror:search:start', { query, page });
    const params = new URLSearchParams({
        action: 'search',
        q: query,
        page: String(page)
    });
    try {
        const resp = await fetch(`/api/netmirror?${params}`);
        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || `Search failed (${resp.status})`);
        }
        nfDebug('netmirror:search:ok', { query, page, count: data.results?.length ?? 0 });
        return { results: data.results || [], pager: data.pager };
    } catch (err) {
        nfDebugError('netmirror:search:fail', { query, page, err });
        throw err;
    }
}

export async function fetchNetmirrorMeta(type: 'movie' | 'tv', id: string) {
    nfDebug('netmirror:meta:start', { type, id });
    const params = new URLSearchParams({ action: 'meta', type, id });
    try {
        const resp = await fetch(`/api/netmirror?${params}`);
        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || `Metadata failed (${resp.status})`);
        }
        nfDebug('netmirror:meta:ok', { type, id, title: data.meta?.title });
        return data.meta;
    } catch (err) {
        nfDebugError('netmirror:meta:fail', { type, id, err });
        throw err;
    }
}

// Language catalogue config lives in useNetflixLanguage.ts