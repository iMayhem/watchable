import type { CuratedItem } from '../components/rails/CuratedRail.vue';
import type { CatalogEnrichmentRow } from './useCatalogEnrichmentCache';
import { peekAnilistIdForMoovieCatalogId } from './useAnimeCatalogCache';
import {
    catalogDisplayTitle,
    catalogRating,
    inferCatalogMediaType,
    type MoovieCatalogItem
} from './useMoovieCatalog';
import { resolveLanguageTagsForItem } from './useNetflixCatalogLookup';
import type { CatalogArtworkUrlMaps } from './usePosterCache';

function curatedMediaType(
    item: MoovieCatalogItem,
    enrichment?: CatalogEnrichmentRow
): 'movie' | 'tv' {
    const inferred = inferCatalogMediaType(item);
    if (inferred === 'movie') return 'movie';
    if (enrichment?.media_type === 'movie') return 'movie';
    return inferred;
}

/** Catalog CDN poster key art + optional R2 medium — no full backdrop assets. */
export function resolveInstantCatalogArtwork(
    item: MoovieCatalogItem,
    artworkUrls?: CatalogArtworkUrlMaps
): { posterPath: string | null; backdropPath: string | null } {
    const id = String(item.id);
    const catalogArt = item.backdrop_path || null;
    const posterPath = artworkUrls?.posters.get(id) || catalogArt;
    return {
        posterPath,
        backdropPath: posterPath
    };
}

/** Instant rail cards — catalog CDN / R2 cache only (NetMirror-style, no TMDB artwork). */
export function toCuratedItemFast(
    item: MoovieCatalogItem,
    genreIds: number[] = [],
    languageMap?: Map<string, string[]>,
    audioCacheById?: Map<string, string[]>,
    enrichment?: CatalogEnrichmentRow,
    artworkUrls?: CatalogArtworkUrlMaps
): CuratedItem {
    const instant = resolveInstantCatalogArtwork(item, artworkUrls);

    const anilistId = peekAnilistIdForMoovieCatalogId(String(item.id));

    return {
        id: item.id,
        title: catalogDisplayTitle(item.title || ''),
        originalTitle: '',
        catalogTitle: item.title,
        posterPath: instant.posterPath,
        backdropPath: instant.backdropPath,
        rating: catalogRating(item.vote_average),
        releaseDate: item.release_date || '',
        type: anilistId ? 'anime' : curatedMediaType(item, enrichment),
        languageTags: resolveLanguageTagsForItem(item, languageMap, audioCacheById),
        genreIds,
        anilistId,
        tmdbId: enrichment?.tmdb_id
    };
}