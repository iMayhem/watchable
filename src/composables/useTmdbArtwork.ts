import useAxios from './useAxios';
import { parseCatalogTitle } from './useMoovieCatalog';
import { nfDebugError } from './useNetflixDebug';

export interface TmdbArtwork {
    posterPath: string | null;
    backdropPath: string | null;
    tmdbId?: number;
    genreIds?: number[];
    overview?: string;
}

interface TmdbSearchResult {
    id: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    genre_ids?: number[];
    overview?: string;
}

const artworkCache = new Map<string, TmdbArtwork>();

function parseYear(value?: string | number | null): number | null {
    if (value == null) return null;
    const match = String(value).match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0], 10) : null;
}

function normalizeTitle(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function titleScore(query: string, candidate: TmdbSearchResult): number {
    const q = normalizeTitle(query);
    const names = [
        candidate.title,
        candidate.name,
        candidate.original_title,
        candidate.original_name
    ]
        .filter(Boolean)
        .map((n) => normalizeTitle(String(n)));

    let best = 0;
    for (const name of names) {
        if (name === q) best = Math.max(best, 100);
        else if (name.startsWith(q) || q.startsWith(name)) best = Math.max(best, 80);
        else if (name.includes(q) || q.includes(name)) best = Math.max(best, 55);
    }
    if (candidate.poster_path) best += 8;
    if (candidate.backdrop_path) best += 4;
    return best;
}

function pickBestMatch(
    results: TmdbSearchResult[],
    query: string,
    year: number | null
): TmdbSearchResult | null {
    if (!results.length) return null;

    let best: TmdbSearchResult | null = null;
    let bestScore = -1;

    for (const row of results) {
        let score = titleScore(query, row);
        const rowYear = parseYear(row.release_date || row.first_air_date);
        if (year && rowYear) {
            if (rowYear === year) score += 20;
            else if (Math.abs(rowYear - year) === 1) score += 8;
            else score -= 10;
        }
        if (score > bestScore) {
            bestScore = score;
            best = row;
        }
    }

    return bestScore >= 45 ? best : results[0] || null;
}

function hasUsableArtwork(match: TmdbSearchResult | null): boolean {
    return Boolean(match?.backdrop_path || match?.poster_path);
}

async function searchTmdbByType(
    type: 'movie' | 'tv',
    cleanTitle: string,
    year: number | null
): Promise<TmdbSearchResult | null> {
    const params: Record<string, string | number> = {
        query: cleanTitle,
        include_adult: 'false'
    };
    if (type === 'movie' && year) params.year = year;
    if (type === 'tv' && year) params.first_air_date_year = year;

    const res = await useAxios().get(`search/${type}`, { params });
    const results = (res.data?.results || []) as TmdbSearchResult[];
    return pickBestMatch(results, cleanTitle, year);
}

export async function resolveTmdbArtwork(opts: {
    title: string;
    year?: string | number | null;
    type: 'movie' | 'tv';
    cacheKey?: string;
}): Promise<TmdbArtwork> {
    const cleanTitle = opts.title.trim();
    if (!cleanTitle) {
        return { posterPath: null, backdropPath: null };
    }

    const cacheId =
        opts.cacheKey ||
        `${opts.type}:${normalizeTitle(cleanTitle)}:${parseYear(opts.year) ?? 'na'}`;
    const cached = artworkCache.get(cacheId);
    if (cached) return cached;

    const year = parseYear(opts.year);

    try {
        let match = await searchTmdbByType(opts.type, cleanTitle, year);

        if (!hasUsableArtwork(match)) {
            const altType = opts.type === 'movie' ? 'tv' : 'movie';
            const altMatch = await searchTmdbByType(altType, cleanTitle, year);
            if (hasUsableArtwork(altMatch)) {
                match = altMatch;
            }
        }

        const artwork: TmdbArtwork = {
            posterPath: match?.poster_path || null,
            backdropPath: match?.backdrop_path || null,
            tmdbId: match?.id,
            genreIds: match?.genre_ids || [],
            overview: match?.overview || ''
        };
        artworkCache.set(cacheId, artwork);
        return artwork;
    } catch (err) {
        nfDebugError('tmdb:artwork:fail', { title: cleanTitle, err });
        const empty = { posterPath: null, backdropPath: null };
        artworkCache.set(cacheId, empty);
        return empty;
    }
}

export async function resolveArtworkForCatalogItem(item: {
    id: string;
    title: string;
    release_date?: string;
    media_type: 'movie' | 'tv';
    backdrop_path?: string | null;
}): Promise<TmdbArtwork & { fallbackPath: string | null }> {
    const parsed = parseCatalogTitle(item.title || '');
    const displayTitle = parsed.displayTitle || item.title;
    const tmdb = await resolveTmdbArtwork({
        title: displayTitle,
        year: item.release_date,
        type: item.media_type === 'tv' ? 'tv' : 'movie',
        cacheKey: `nm-${item.media_type}-${item.id}`
    });

    return {
        ...tmdb,
        fallbackPath: item.backdrop_path || null
    };
}

export interface CatalogTmdbMeta {
    genreIds: number[];
    overview: string;
}

export async function enrichCatalogPoolWithTmdb(
    items: Array<{
        id: string;
        title: string;
        release_date?: string;
        media_type: 'movie' | 'tv';
        backdrop_path?: string | null;
    }>,
    concurrency = 8
): Promise<Map<string, CatalogTmdbMeta>> {
    const pairs = await mapWithConcurrency(
        items,
        async (item) => {
            const art = await resolveArtworkForCatalogItem(item);
            return [
                String(item.id),
                {
                    genreIds: art.genreIds || [],
                    overview: art.overview || ''
                }
            ] as const;
        },
        concurrency
    );
    return new Map(pairs);
}

export async function mapWithConcurrency<T, R>(
    items: T[],
    mapper: (item: T) => Promise<R>,
    concurrency = 5
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let index = 0;

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (index < items.length) {
            const current = index++;
            results[current] = await mapper(items[current]);
        }
    });

    await Promise.all(workers);
    return results;
}