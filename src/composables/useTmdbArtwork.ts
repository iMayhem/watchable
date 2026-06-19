import useAxios from './useAxios';
import { inferCatalogMediaType, parseCatalogTitle } from './useMoovieCatalog';
import { nfDebugError } from './useNetflixDebug';

export interface TmdbArtwork {
    posterPath: string | null;
    backdropPath: string | null;
    tmdbId?: number;
    genreIds?: number[];
    overview?: string;
}

export interface CatalogArtworkPaths {
    posterPath: string | null;
    backdropPath: string | null;
}

/** TMDB-first artwork — catalogue CDN only when TMDB has no poster or backdrop. */
export function pickCatalogArtwork(
    art: TmdbArtwork & { fallbackPath?: string | null }
): CatalogArtworkPaths {
    const fallback = art.fallbackPath || null;
    return {
        posterPath: art.posterPath || art.backdropPath || fallback,
        backdropPath: art.backdropPath || art.posterPath || fallback
    };
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

const MIN_TITLE_MATCH_SCORE = 80;

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholePhrase(name: string, phrase: string): boolean {
    if (!phrase) return false;
    const pattern = new RegExp(`\\b${escapeRegExp(phrase).replace(/\s+/g, '\\s+')}\\b`);
    return pattern.test(name);
}

function titleScore(query: string, candidate: TmdbSearchResult): number {
    const q = normalizeTitle(query);
    if (!q) return 0;

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
        if (name === q) {
            best = Math.max(best, 100);
            continue;
        }

        if (name.startsWith(`${q} `) || name.startsWith(`${q}:`)) {
            best = Math.max(best, 92);
            continue;
        }

        if (q.startsWith(name)) {
            best = Math.max(best, 72);
            continue;
        }

        if (hasWholePhrase(name, q)) {
            best = Math.max(best, 78);
            continue;
        }

        // Loose substring only for longer queries — avoids "the boys" → "the athlete boys".
        if (q.length >= 12 && (name.includes(q) || q.includes(name))) {
            best = Math.max(best, 58);
        }
    }

    if (candidate.poster_path) best += 4;
    if (candidate.backdrop_path) best += 2;
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

    return bestScore >= MIN_TITLE_MATCH_SCORE ? best : null;
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
    // Never pass year / first_air_date_year to TMDB search. Catalogue release_date is
    // usually a dub/listing date (e.g. The Boys 2026) and filters out the real title.

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

        // Year is only a tie-breaker in scoring — retry with no year bias if match is weak.
        if (!hasUsableArtwork(match) && year) {
            match = await searchTmdbByType(opts.type, cleanTitle, null);
            if (!hasUsableArtwork(match)) {
                const altType = opts.type === 'movie' ? 'tv' : 'movie';
                const altMatch = await searchTmdbByType(altType, cleanTitle, null);
                if (hasUsableArtwork(altMatch)) match = altMatch;
            }
        }

        let posterPath = match?.poster_path || null;
        let backdropPath = match?.backdrop_path || null;
        let genreIds = match?.genre_ids || [];
        let overview = match?.overview || '';
        const tmdbId = match?.id;

        if (tmdbId) {
            try {
                const detail = await useAxios().get(`${opts.type}/${tmdbId}`);
                const d = detail.data || {};
                posterPath = d.poster_path || posterPath;
                backdropPath = d.backdrop_path || backdropPath;
                genreIds = (d.genres || []).map((g: { id: number }) => g.id);
                overview = d.overview || overview;
            } catch {
                /* search result is enough */
            }
        }

        const artwork: TmdbArtwork = {
            posterPath,
            backdropPath,
            tmdbId,
            genreIds,
            overview
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

function catalogArtworkCacheKey(item: {
    id: string;
    title: string;
    media_type: 'movie' | 'tv';
}) {
    const mediaType = inferCatalogMediaType(item);
    return `nm2-${mediaType}-${item.id}`;
}

export function getCachedArtworkForCatalogItem(item: {
    id: string;
    title: string;
    media_type: 'movie' | 'tv';
    backdrop_path?: string | null;
}): (TmdbArtwork & { fallbackPath: string | null }) | null {
    const cached = artworkCache.get(catalogArtworkCacheKey(item));
    if (!cached) return null;
    return {
        ...cached,
        fallbackPath: item.backdrop_path || null
    };
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
    const mediaType = inferCatalogMediaType(item);
    const tmdb = await resolveTmdbArtwork({
        title: displayTitle,
        type: mediaType,
        cacheKey: catalogArtworkCacheKey(item)
    });

    return {
        ...tmdb,
        fallbackPath: item.backdrop_path || null
    };
}

export interface CatalogTmdbMeta {
    genreIds: number[];
    overview: string;
    tmdbId?: number;
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
                    overview: art.overview || '',
                    tmdbId: art.tmdbId
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