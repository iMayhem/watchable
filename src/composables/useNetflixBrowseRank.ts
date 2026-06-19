import type { MoovieCatalogItem } from './useMoovieCatalog';
import { viewHistory } from './useHistory';
import {
    getNetflixAvailabilityIndex,
    netflixAvailabilityBoost
} from './useNetflixProvider';
import type { CatalogTmdbMeta } from './useTmdbArtwork';

const BROWSE_CURRENT_YEAR = new Date().getFullYear();

export interface CatalogBrowseRankContext {
    tmdbById?: Map<string, CatalogTmdbMeta>;
}

function itemRating(item: MoovieCatalogItem): number {
    const raw = item.vote_average;
    const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return Number.isFinite(n) ? n : 0;
}

function releaseTimestamp(item: MoovieCatalogItem): number {
    const raw = String(item.release_date || '');
    const normalized = raw.replace(/,(\d{4})/, ', $1');
    const parsed = Date.parse(normalized);
    if (!Number.isNaN(parsed)) return parsed;
    const year = raw.match(/\b(19|20)\d{2}\b/);
    return year ? Date.UTC(parseInt(year[0], 10), 0, 1) : 0;
}

function releaseYear(item: MoovieCatalogItem): number {
    const ts = releaseTimestamp(item);
    return ts > 0 ? new Date(ts).getUTCFullYear() : 0;
}

/** Boost fresh catalogue drops; gently penalize stale catalogue rows. */
function catalogRecencyBoost(item: MoovieCatalogItem): number {
    const year = releaseYear(item);
    if (!year) return 0;

    const age = Math.max(0, BROWSE_CURRENT_YEAR - year);
    if (age <= 1) return 42;
    if (age <= 2) return 34;
    if (age <= 3) return 26;
    if (age <= 5) return 16;
    if (age <= 8) return 8;
    if (age <= 12) return 2;
    if (age > 18) return -12;
    if (age > 12) return -4;
    return 0;
}

/** Reward well-rated titles; push low-rated filler toward the bottom. */
function catalogRatingTierBoost(item: MoovieCatalogItem): number {
    const rating = itemRating(item);
    if (rating >= 8) return 24;
    if (rating >= 7.5) return 18;
    if (rating >= 7) return 12;
    if (rating >= 6.5) return 6;
    if (rating >= 6) return 0;
    if (rating >= 5) return -10;
    if (rating > 0) return -22;
    return -8;
}

function buildWatchHistoryBoostMap(): Map<string, number> {
    const out = new Map<string, number>();
    if (typeof window === 'undefined') return out;

    viewHistory.value.forEach((row, idx) => {
        out.set(String(row.id), Math.max(6, 32 - idx * 4));
    });
    return out;
}

export function createCatalogBrowseRanker(ctx: CatalogBrowseRankContext = {}) {
    const nfIndex = getNetflixAvailabilityIndex();
    const watchBoostById = buildWatchHistoryBoostMap();
    const scoreCache = new Map<string, number>();

    const score = (item: MoovieCatalogItem): number => {
        const id = String(item.id);
        const cached = scoreCache.get(id);
        if (cached !== undefined) return cached;

        const rating = itemRating(item);
        const tmdbId = ctx.tmdbById?.get(id)?.tmdbId;
        const computed =
            rating * 12 +
            catalogRecencyBoost(item) +
            catalogRatingTierBoost(item) +
            (watchBoostById.get(id) ?? 0) +
            netflixAvailabilityBoost(tmdbId, nfIndex);

        scoreCache.set(id, computed);
        return computed;
    };

    const compare = (a: MoovieCatalogItem, b: MoovieCatalogItem): number => {
        const scoreDiff = score(b) - score(a);
        if (scoreDiff !== 0) return scoreDiff;

        const yearDiff = releaseTimestamp(b) - releaseTimestamp(a);
        if (yearDiff !== 0) return yearDiff;

        return itemRating(b) - itemRating(a);
    };

    return {
        score,
        compare,
        sort(pool: MoovieCatalogItem[]) {
            return [...pool].sort(compare);
        }
    };
}

/**
 * Editorial browse score — higher-rated, fresher, and recently watched titles first.
 * Used across home rails, category browse, explore, and search grids.
 */
export function catalogBrowseRankScore(
    item: MoovieCatalogItem,
    ctx: CatalogBrowseRankContext = {}
): number {
    return createCatalogBrowseRanker(ctx).score(item);
}

export function compareCatalogBrowseRank(
    a: MoovieCatalogItem,
    b: MoovieCatalogItem,
    ctx: CatalogBrowseRankContext = {}
): number {
    return createCatalogBrowseRanker(ctx).compare(a, b);
}

export function sortCatalogByBrowseRank(
    pool: MoovieCatalogItem[],
    ctx: CatalogBrowseRankContext = {}
): MoovieCatalogItem[] {
    if (pool.length < 2) return [...pool];
    return createCatalogBrowseRanker(ctx).sort(pool);
}