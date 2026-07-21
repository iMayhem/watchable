import { getSupabaseClient } from '../lib/supabase';
import type { MoovieCatalogItem } from './useMoovieCatalog';

export interface AnimeCatalogCacheRow {
    anilist_id: number;
    moovie_catalog_id: string | null;
    catalog_title: string | null;
    language_tags: string[];
    catalog_season: number;
}

const TABLE = 'anime_catalog_cache';
const memoryByAnilistId = new Map<number, AnimeCatalogCacheRow>();
const memoryByMoovieId = new Map<string, number>();

function normalizeRow(raw: Record<string, unknown>): AnimeCatalogCacheRow {
    const tags = raw.language_tags;
    return {
        anilist_id: Number(raw.anilist_id),
        moovie_catalog_id: raw.moovie_catalog_id ? String(raw.moovie_catalog_id) : null,
        catalog_title: raw.catalog_title ? String(raw.catalog_title) : null,
        language_tags: Array.isArray(tags) ? tags.map(String) : [],
        catalog_season: Number(raw.catalog_season) || 1
    };
}

function indexCacheRow(row: AnimeCatalogCacheRow) {
    memoryByAnilistId.set(row.anilist_id, row);
    const moovieId = row.moovie_catalog_id;
    if (
        moovieId &&
        moovieId !== String(row.anilist_id)
    ) {
        memoryByMoovieId.set(moovieId, row.anilist_id);
    }
}

/** AniList and Moovie catalogue ids can share the same number — never treat as the same title. */
export function catalogIdCollidesWithAnilist(
    anilistId: number,
    moovieCatalogId: string | number | null | undefined
): boolean {
    if (moovieCatalogId == null || moovieCatalogId === '') return false;
    return String(moovieCatalogId) === String(anilistId);
}

export function isKnownAnilistCatalogId(id: string | number): boolean {
    const numeric = Number(id);
    return Number.isFinite(numeric) && memoryByAnilistId.has(numeric);
}

export function peekAnilistIdForMoovieCatalogId(
    moovieCatalogId: string | number
): number | undefined {
    return memoryByMoovieId.get(String(moovieCatalogId));
}



export function cacheRowToMoovieItem(row: AnimeCatalogCacheRow): MoovieCatalogItem | null {
    if (
        !row.moovie_catalog_id ||
        catalogIdCollidesWithAnilist(row.anilist_id, row.moovie_catalog_id)
    ) {
        return null;
    }
    const season =
        row.catalog_season > 0 ? ` S${row.catalog_season}` : '';
    const title = row.catalog_title || '';
    const withSeason =
        season && !/\bS\d/i.test(title) ? `${title}${season}` : title;

    return {
        id: row.moovie_catalog_id,
        title: withSeason,
        backdrop_path: null,
        release_date: '',
        media_type: 'tv',
        vote_average: 0
    };
}

async function fetchRows(
    column: 'anilist_id' | 'moovie_catalog_id',
    values: Array<string | number>
): Promise<AnimeCatalogCacheRow[]> {
    if (!values.length) return [];

    try {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from(TABLE)
            .select(
                'anilist_id, moovie_catalog_id, catalog_title, language_tags, catalog_season'
            )
            .in(column, values);

        if (error) {
            console.error('anime-cache:fetch:fail', {
                column,
                error: error.message,
                count: values.length
            });
            return [];
        }

        const rows = (data || []).map((raw: Record<string, unknown>) =>
            normalizeRow(raw)
        );
        for (const row of rows) {
            indexCacheRow(row);
        }
        console.log('anime-cache:fetch:ok', {
            column,
            requested: values.length,
            found: rows.length
        });
        return rows;
    } catch (err) {
        console.error('anime-cache:fetch:fail', { column, err });
        return [];
    }
}

/** One Supabase round-trip for many AniList ids (session memory cache). */
export async function fetchAnimeCatalogCacheByIds(
    ids: number[]
): Promise<Map<number, AnimeCatalogCacheRow>> {
    const out = new Map<number, AnimeCatalogCacheRow>();
    const unique = [...new Set(ids.filter((id) => Number.isFinite(id)))];
    const missing = unique.filter((id) => !memoryByAnilistId.has(id));

    if (missing.length) {
        await fetchRows('anilist_id', missing);
    }

    for (const id of unique) {
        const row = memoryByAnilistId.get(id);
        if (row) out.set(id, row);
    }

    return out;
}

/** Reverse lookup: Moovie catalogue id → AniList row. */
export async function fetchAnimeCatalogCacheByMoovieIds(
    ids: Array<string | number>
): Promise<Map<string, AnimeCatalogCacheRow>> {
    const out = new Map<string, AnimeCatalogCacheRow>();
    const unique = [...new Set(ids.map((id) => String(id)).filter(Boolean))];
    const missing = unique.filter((id) => !memoryByMoovieId.has(id));

    if (missing.length) {
        await fetchRows('moovie_catalog_id', missing);
    }

    for (const id of unique) {
        const anilistId = memoryByMoovieId.get(id);
        if (!anilistId) continue;
        const row = memoryByAnilistId.get(anilistId);
        if (row) out.set(id, row);
    }

    return out;
}

export function peekAnimeCatalogCache(anilistId: number): AnimeCatalogCacheRow | undefined {
    return memoryByAnilistId.get(anilistId);
}