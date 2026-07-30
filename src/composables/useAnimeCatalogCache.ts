import type { MoovieCatalogItem } from './useMoovieCatalog';

export interface AnimeCatalogCacheRow {
    anilist_id: number;
    moovie_catalog_id: string | null;
    catalog_title: string | null;
    language_tags: string[];
    catalog_season: number;
}

export function catalogIdCollidesWithAnilist(
    _anilistId: number,
    _moovieCatalogId: string | number | null | undefined
): boolean {
    return false;
}

export function isKnownAnilistCatalogId(_id: string | number): boolean {
    return false;
}

export function peekAnilistIdForMoovieCatalogId(
    _moovieCatalogId: string | number
): number | undefined {
    return undefined;
}

export function cacheRowToMoovieItem(_row: AnimeCatalogCacheRow): MoovieCatalogItem | null {
    return null;
}

export async function fetchAnimeCatalogCacheByIds(
    _ids: number[]
): Promise<Map<number, AnimeCatalogCacheRow>> {
    return new Map<number, AnimeCatalogCacheRow>();
}

export async function fetchAnimeCatalogCacheByMoovieIds(
    _ids: Array<string | number>
): Promise<Map<string, AnimeCatalogCacheRow>> {
    return new Map<string, AnimeCatalogCacheRow>();
}

export function peekAnimeCatalogCache(_anilistId: number): AnimeCatalogCacheRow | undefined {
    return undefined;
}