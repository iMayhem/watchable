import { getSupabaseClient } from '../lib/supabase';
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

const TABLE = 'catalog_enrichment_cache';
const CHUNK_SIZE = 200;
const CATEGORY_FETCH_LIMIT = 1500;

const memoryByCatalogId = new Map<string, CatalogEnrichmentRow>();
const memoryByCategory = new Map<string, CatalogEnrichmentRow[]>();

function normalizeGenreIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((value) => Number(value)).filter((value) => Number.isFinite(value));
}

function normalizeCategories(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map(String).filter(Boolean))];
}

function normalizeSources(raw: unknown): Record<string, string> {
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (key && value != null) out[key] = String(value);
    }
    return out;
}

function normalizeRow(raw: Record<string, unknown>): CatalogEnrichmentRow {
    const tags = raw.language_tags;
    return {
        catalog_id: String(raw.catalog_id),
        media_type: raw.media_type === 'tv' ? 'tv' : 'movie',
        display_title: raw.display_title ? String(raw.display_title) : undefined,
        catalog_title: raw.catalog_title ? String(raw.catalog_title) : undefined,
        language_tags: Array.isArray(tags) ? tags.map(String) : [],
        variant_family_key: raw.variant_family_key
            ? String(raw.variant_family_key)
            : undefined,
        tmdb_id: raw.tmdb_id != null ? Number(raw.tmdb_id) : undefined,
        tmdb_genre_ids: normalizeGenreIds(raw.tmdb_genre_ids),
        tmdb_genre_names: Array.isArray(raw.tmdb_genre_names)
            ? raw.tmdb_genre_names.map(String)
            : [],
        overview: raw.overview ? String(raw.overview) : undefined,
        browse_categories: normalizeCategories(raw.browse_categories),
        category_sources: normalizeSources(raw.category_sources)
    };
}

export function enrichmentRowToTmdbMeta(row: CatalogEnrichmentRow): CatalogTmdbMeta {
    return {
        genreIds: row.tmdb_genre_ids,
        overview: row.overview || '',
        tmdbId: row.tmdb_id
    };
}

export function itemHasEnrichmentCategory(
    catalogId: string | number,
    category: string,
    enrichmentById: Map<string, CatalogEnrichmentRow>
): boolean {
    const row = enrichmentById.get(String(catalogId));
    return Boolean(row?.browse_categories?.includes(category));
}

/** Pre-categorized catalogue rows for a Netflix browse slug (e.g. lgbtq, horror-movies). */
export async function fetchEnrichmentByBrowseCategory(
    category: string,
    limit = CATEGORY_FETCH_LIMIT
): Promise<CatalogEnrichmentRow[]> {
    const slug = category.trim();
    if (!slug) return [];

    const cached = memoryByCategory.get(slug);
    if (cached) return cached.slice(0, limit);

    try {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from(TABLE)
            .select(
                'catalog_id, media_type, display_title, catalog_title, language_tags, variant_family_key, tmdb_id, tmdb_genre_ids, tmdb_genre_names, overview, browse_categories, category_sources'
            )
            .contains('browse_categories', [slug])
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('catalog-enrichment:category:fail', {
                category: slug,
                error: error.message
            });
            return [];
        }

        const rows = (data || []).map((raw: Record<string, unknown>) =>
            normalizeRow(raw)
        );
        for (const row of rows) {
            memoryByCatalogId.set(row.catalog_id, row);
        }
        memoryByCategory.set(slug, rows);

        console.log('catalog-enrichment:category:ok', {
            category: slug,
            count: rows.length
        });
        return rows;
    } catch (err) {
        console.error('catalog-enrichment:category:fail', { category: slug, err });
        return [];
    }
}

/** Batch-fetch enrichment rows for Moovie catalogue ids. */
export async function fetchEnrichmentByCatalogIds(
    ids: Array<string | number>
): Promise<Map<string, CatalogEnrichmentRow>> {
    const out = new Map<string, CatalogEnrichmentRow>();
    const unique = [...new Set(ids.map((id) => String(id)).filter(Boolean))];
    const missing = unique.filter((id) => !memoryByCatalogId.has(id));

    if (missing.length) {
        try {
            const supabase = await getSupabaseClient();

            for (let start = 0; start < missing.length; start += CHUNK_SIZE) {
                const chunk = missing.slice(start, start + CHUNK_SIZE);
                const { data, error } = await supabase
                    .from(TABLE)
                    .select(
                        'catalog_id, media_type, display_title, catalog_title, language_tags, variant_family_key, tmdb_id, tmdb_genre_ids, tmdb_genre_names, overview, browse_categories, category_sources'
                    )
                    .in('catalog_id', chunk);

                if (error) {
                    console.error('catalog-enrichment:fetch:fail', {
                        error: error.message,
                        chunk: chunk.length
                    });
                    continue;
                }

                for (const raw of data || []) {
                    const row = normalizeRow(raw as Record<string, unknown>);
                    memoryByCatalogId.set(row.catalog_id, row);
                }
            }

            console.log('catalog-enrichment:fetch:ok', {
                requested: missing.length,
                found: missing.filter((id) => memoryByCatalogId.has(id)).length
            });
        } catch (err) {
            console.error('catalog-enrichment:fetch:fail', { err });
        }
    }

    for (const id of unique) {
        const row = memoryByCatalogId.get(id);
        if (row) out.set(id, row);
    }

    return out;
}

export function peekCatalogEnrichment(
    catalogId: string | number
): CatalogEnrichmentRow | undefined {
    return memoryByCatalogId.get(String(catalogId));
}