import type { CuratedItem } from '../components/rails/CuratedRail.vue';
import type { CatalogEnrichmentRow } from './useCatalogEnrichmentCache';
import { peekAnilistIdForMoovieCatalogId } from './useAnimeCatalogCache';
import {
    catalogRating,
    inferCatalogMediaType,
    parseCatalogTitle,
    type MoovieCatalogItem
} from './useMoovieCatalog';
import { resolveLanguageTagsForItem } from './useNetflixCatalogLookup';
import type { CatalogArtworkUrlMaps } from './usePosterCache';
import {
    getCachedArtworkForCatalogItem,
    pickCatalogArtwork,
    resolveArtworkForCatalogItem
} from './useTmdbArtwork';

const EMPTY_ARTWORK = { posterPath: null, backdropPath: null } as const;

function curatedMediaType(
    item: MoovieCatalogItem,
    enrichment?: CatalogEnrichmentRow
): 'movie' | 'tv' {
    if (enrichment?.media_type === 'tv') return 'tv';
    return inferCatalogMediaType(item);
}

export function resolveInstantCatalogArtwork(
    item: MoovieCatalogItem,
    cachedArtwork: { posterPath: string | null; backdropPath: string | null } = EMPTY_ARTWORK,
    artworkUrls?: CatalogArtworkUrlMaps
): { posterPath: string | null; backdropPath: string | null } {
    const id = String(item.id);
    return {
        posterPath:
            cachedArtwork.posterPath ||
            artworkUrls?.posters.get(id) ||
            item.backdrop_path ||
            null,
        backdropPath:
            cachedArtwork.backdropPath ||
            artworkUrls?.backdrops.get(id) ||
            item.backdrop_path ||
            null
    };
}

/** Instant rail cards — catalog CDN / R2 / TMDB session cache; TMDB search upgrades later. */
export function toCuratedItemFast(
    item: MoovieCatalogItem,
    genreIds: number[] = [],
    languageMap?: Map<string, string[]>,
    audioCacheById?: Map<string, string[]>,
    enrichment?: CatalogEnrichmentRow,
    artworkUrls?: CatalogArtworkUrlMaps
): CuratedItem {
    const parsed = parseCatalogTitle(item.title || '');
    const cached = getCachedArtworkForCatalogItem(item);
    const artwork = cached ? pickCatalogArtwork(cached) : EMPTY_ARTWORK;
    const instant = resolveInstantCatalogArtwork(item, artwork, artworkUrls);

    const anilistId = peekAnilistIdForMoovieCatalogId(String(item.id));

    return {
        id: item.id,
        title: parsed.displayTitle || item.title,
        originalTitle: parsed.languages.join(' · '),
        catalogTitle: item.title,
        posterPath: instant.posterPath,
        backdropPath: instant.backdropPath,
        rating: catalogRating(item.vote_average),
        releaseDate: item.release_date || '',
        type: curatedMediaType(item, enrichment),
        languageTags: resolveLanguageTagsForItem(item, languageMap, audioCacheById),
        genreIds: genreIds.length ? genreIds : cached?.genreIds || [],
        anilistId,
        tmdbId: enrichment?.tmdb_id
    };
}

/** Upgrades a fast item with TMDB artwork when available (uses artwork cache). */
export async function toCuratedItemUpgraded(
    item: MoovieCatalogItem,
    genreIds: number[] = [],
    languageMap?: Map<string, string[]>,
    audioCacheById?: Map<string, string[]>,
    enrichment?: CatalogEnrichmentRow
): Promise<CuratedItem> {
    const parsed = parseCatalogTitle(item.title || '');
    const resolved = await resolveArtworkForCatalogItem({
        id: String(item.id),
        title: item.title,
        release_date: item.release_date,
        media_type: item.media_type,
        tmdbId: enrichment?.tmdb_id
    });
    const artwork = pickCatalogArtwork(resolved);
    const instant = resolveInstantCatalogArtwork(item, artwork);

    const anilistId = peekAnilistIdForMoovieCatalogId(String(item.id));

    return {
        id: item.id,
        title: parsed.displayTitle || item.title,
        originalTitle: parsed.languages.join(' · '),
        catalogTitle: item.title,
        posterPath: instant.posterPath,
        backdropPath: instant.backdropPath,
        rating: catalogRating(item.vote_average),
        releaseDate: item.release_date || '',
        type: curatedMediaType(item, enrichment),
        languageTags: resolveLanguageTagsForItem(item, languageMap, audioCacheById),
        genreIds: genreIds.length ? genreIds : resolved.genreIds || [],
        anilistId,
        tmdbId: enrichment?.tmdb_id ?? resolved.tmdbId
    };
}