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

/** Recently opened titles (global + Netflix) float up in browse grids. */
function watchHistoryBoost(item: MoovieCatalogItem): number {
    if (typeof window === 'undefined') return 0;

    const idx = viewHistory.value.findIndex(
        (row) => String(row.id) === String(item.id)
    );
    if (idx === -1) return 0;

    return Math.max(6, 32 - idx * 4);
}

/**
 * Editorial browse score — higher-rated, fresher, and recently watched titles first.
 * Used across home rails, category browse, explore, and search grids.
 */
export function catalogBrowseRankScore(
    item: MoovieCatalogItem,
    ctx: CatalogBrowseRankContext = {}
): number {
    const rating = itemRating(item);
    const tmdbId = ctx.tmdbById?.get(String(item.id))?.tmdbId;

    return (
        rating * 12 +
        catalogRecencyBoost(item) +
        catalogRatingTierBoost(item) +
        watchHistoryBoost(item) +
        netflixAvailabilityBoost(tmdbId, getNetflixAvailabilityIndex())
    );
}

export function compareCatalogBrowseRank(
    a: MoovieCatalogItem,
    b: MoovieCatalogItem,
    ctx: CatalogBrowseRankContext = {}
): number {
    const scoreDiff =
        catalogBrowseRankScore(b, ctx) - catalogBrowseRankScore(a, ctx);
    if (scoreDiff !== 0) return scoreDiff;

    const yearDiff = releaseTimestamp(b) - releaseTimestamp(a);
    if (yearDiff !== 0) return yearDiff;

    return itemRating(b) - itemRating(a);
}

export function sortCatalogByBrowseRank(
    pool: MoovieCatalogItem[],
    ctx: CatalogBrowseRankContext = {}
): MoovieCatalogItem[] {
    return [...pool].sort((a, b) => compareCatalogBrowseRank(a, b, ctx));
}