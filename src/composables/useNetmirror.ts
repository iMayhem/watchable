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
    const params = new URLSearchParams({
        action: 'browse',
        category,
        page: String(page)
    });
    const resp = await fetch(`/api/netmirror?${params}`);
    const data = await resp.json();
    if (!resp.ok) {
        throw new Error(data.error || `Browse failed (${resp.status})`);
    }
    return data as NetmirrorBrowseResponse;
}

export async function searchNetmirror(query: string, page = 0): Promise<NetmirrorBrowseResponse> {
    const params = new URLSearchParams({
        action: 'search',
        q: query,
        page: String(page)
    });
    const resp = await fetch(`/api/netmirror?${params}`);
    const data = await resp.json();
    if (!resp.ok) {
        throw new Error(data.error || `Search failed (${resp.status})`);
    }
    return { results: data.results || [], pager: data.pager };
}

export async function fetchNetmirrorMeta(type: 'movie' | 'tv', id: string) {
    const params = new URLSearchParams({ action: 'meta', type, id });
    const resp = await fetch(`/api/netmirror?${params}`);
    const data = await resp.json();
    if (!resp.ok) {
        throw new Error(data.error || `Metadata failed (${resp.status})`);
    }
    return data.meta;
}

export const NETFLIX_RAILS = [
    {
        category: 'hindi',
        title: 'Hindi',
        eyebrow: 'हिंदी',
        description: 'Bollywood blockbusters and Hindi-dubbed hits.'
    },
    {
        category: 'english',
        title: 'Hollywood',
        eyebrow: 'English',
        description: 'English-language films and series from around the world.'
    },
    {
        category: 'telugu',
        title: 'Telugu',
        eyebrow: 'తెలుగు',
        description: 'Tollywood favourites and Telugu originals.'
    },
    {
        category: 'tamil',
        title: 'Tamil',
        eyebrow: 'தமிழ்',
        description: 'Kollywood cinema and Tamil series.'
    },
    {
        category: 'malayalam',
        title: 'Malayalam',
        eyebrow: 'മലയാളം',
        description: 'Malayalam films and shows in rotation.'
    },
    {
        category: 'korean',
        title: 'Korean',
        eyebrow: '한국어',
        description: 'K-drama and Korean cinema.'
    },
    {
        category: 'punjabi',
        title: 'Punjabi',
        eyebrow: 'ਪੰਜਾਬੀ',
        description: 'Punjabi films and music-driven stories.'
    },
    {
        category: 'bengali',
        title: 'Bengali',
        eyebrow: 'বাংলা',
        description: 'Bengali cinema and serials.'
    },
    {
        category: 'marathi',
        title: 'Marathi',
        eyebrow: 'मराठी',
        description: 'Marathi theatre and screen favourites.'
    }
] as const;