// Unused catalog enrichment cache stub
import type { CatalogTmdbMeta } from './useTmdbArtwork';

export interface CatalogEnrichmentRow {
    catalog_id: string;
    media_type: 'movie' | 'tv';
    display_title?: string;
    catalog_title?: string;
    language_tags: string[];
    variant_family_key?: string;
    tmdb_id?: number;
    tmdb_genre_ids: number[];
    tmdb_genre_names: string[];
    overview?: string;
    browse_categories: string[];
    category_sources: Record<string, string>;
}

export function enrichmentRowToTmdbMeta(row: CatalogEnrichmentRow): CatalogTmdbMeta {
    return {
        genreIds: row.tmdb_genre_ids,
        overview: row.overview || '',
        tmdbId: row.tmdb_id
    };
}

export function itemHasEnrichmentCategory(
    _catalogId: string | number,
    _category: string,
    _enrichmentById: Map<string, CatalogEnrichmentRow>
): boolean {
    return false;
}

export async function fetchEnrichmentByBrowseCategory(
    _category: string,
    _limit = 60
): Promise<CatalogEnrichmentRow[]> {
    return [];
}

export async function fetchEnrichmentByCatalogIds(
    _ids: Array<string | number>
): Promise<Map<string, CatalogEnrichmentRow>> {
    return new Map<string, CatalogEnrichmentRow>();
}

export function peekCatalogEnrichment(
    _catalogId: string | number
): CatalogEnrichmentRow | undefined {
    return undefined;
}