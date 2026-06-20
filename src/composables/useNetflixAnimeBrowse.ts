import type { CuratedItem } from '../components/rails/CuratedRail.vue';
import {
    fetchAnimeBrowseMedia,
    type AnimeMedia
} from './useAniList';
import {
    explicitLanguageLabels,
    netflixCatalogPlayPath,
    resolveCatalogPlayVariantForTitles,
    sortLanguageTagsForDisplay
} from './useNetflixCatalogLookup';
import { fetchCatalogAudioCacheByIds } from './useCatalogAudioCache';
import type { MoovieCatalogItem } from './useMoovieCatalog';
import type { NetflixLanguageOption } from './useNetflixLanguage';
import { mapWithConcurrency } from './useTmdbArtwork';
import { nfDebug } from './useNetflixDebug';
import {
    type AnimeCatalogCacheRow,
    cacheRowToMoovieItem,
    catalogIdCollidesWithAnilist,
    fetchAnimeCatalogCacheByIds
} from './useAnimeCatalogCache';

export const ANIME_BROWSE_PAGE_SIZE = 40;
const MOOVIE_LINK_CONCURRENCY = 6;

export interface NetflixAnimeBrowseItem extends CuratedItem {
    anilistId: number;
    moovieCatalogId?: string;
    catalogTitle?: string;
}

function searchTitlesForMedia(media: AnimeMedia): string[] {
    const titles = [media.title.english, media.title.romaji, media.title.native]
        .filter(Boolean)
        .map((title) => String(title).trim());
    return [...new Set(titles)];
}

async function linkMoovieCatalogItem(
    media: AnimeMedia,
    preferredLang: NetflixLanguageOption,
    candidatePool: MoovieCatalogItem[] = []
): Promise<{ playItem: MoovieCatalogItem | null; languageTags: string[] }> {
    const resolved = await resolveCatalogPlayVariantForTitles(searchTitlesForMedia(media), {
        preferredLang,
        tvOnly: true,
        searchPages: 3,
        anilistId: media.id,
        minScore: 92,
        candidatePool
    });
    return {
        playItem: resolved.item,
        languageTags: sortLanguageTagsForDisplay(resolved.languageTags)
    };
}

export function animeMediaToCuratedItem(
    media: AnimeMedia,
    moovie?: MoovieCatalogItem | null,
    languageTags: string[] = []
): NetflixAnimeBrowseItem {
    const displayTitle = media.title.english || media.title.romaji;
    const moovieId =
        moovie?.id &&
        !catalogIdCollidesWithAnilist(media.id, moovie.id) &&
        String(moovie.id) !== String(media.id)
            ? String(moovie.id)
            : undefined;
    const tags = sortLanguageTagsForDisplay(languageTags);

    return {
        id: media.id,
        anilistId: media.id,
        moovieCatalogId: moovieId,
        title: displayTitle,
        originalTitle: media.title.native || media.title.romaji,
        catalogTitle: moovie?.title || '',
        posterPath:
            media.coverImage.extraLarge ||
            media.coverImage.large ||
            media.coverImage.medium ||
            null,
        backdropPath:
            media.bannerImage ||
            media.coverImage.extraLarge ||
            media.coverImage.large ||
            null,
        rating: media.averageScore ? media.averageScore / 10 : 0,
        releaseDate: media.seasonYear ? String(media.seasonYear) : '',
        type: 'anime',
        genreIds: [],
        languageTags: tags
    };
}

export interface AnimeBrowsePageInfo {
    currentPage: number;
    lastPage: number;
    hasNextPage: boolean;
    total: number;
}

async function fetchAnimeBrowseMediaPage(page: number) {
    const response = await fetchAnimeBrowseMedia({
        page,
        perPage: ANIME_BROWSE_PAGE_SIZE,
        sort: 'POPULARITY_DESC'
    });
    return {
        media: response.data.Page.media || [],
        pageInfo: response.data.Page.pageInfo as AnimeBrowsePageInfo
    };
}

/** AniList posters only — no Moovie round-trips (instant grid paint). */
export async function fetchAnimeBrowseBatchFast(page: number): Promise<{
    items: NetflixAnimeBrowseItem[];
    media: AnimeMedia[];
    pageInfo: AnimeBrowsePageInfo;
}> {
    const { media, pageInfo } = await fetchAnimeBrowseMediaPage(page);
    return {
        items: media.map((entry) => animeMediaToCuratedItem(entry)),
        media,
        pageInfo: {
            currentPage: pageInfo.currentPage,
            lastPage: pageInfo.lastPage,
            hasNextPage: pageInfo.hasNextPage,
            total: pageInfo.total
        }
    };
}

function resolveAnimeCacheLanguageTags(
    row: AnimeCatalogCacheRow,
    audioById: Map<string, string[]>
): string[] {
    if (row.language_tags.length) {
        return sortLanguageTagsForDisplay(row.language_tags);
    }

    const catalogId = row.moovie_catalog_id;
    if (catalogId) {
        const fromAudio = audioById.get(String(catalogId));
        if (fromAudio?.length) {
            return sortLanguageTagsForDisplay(fromAudio);
        }
    }

    const playItem = cacheRowToMoovieItem(row);
    if (playItem) {
        const explicit = explicitLanguageLabels(playItem);
        if (explicit.length) {
            return sortLanguageTagsForDisplay(explicit);
        }
    }

    return [];
}

function linkFromCacheRow(
    media: AnimeMedia,
    row: AnimeCatalogCacheRow,
    audioById: Map<string, string[]>
): { playItem: MoovieCatalogItem | null; languageTags: string[] } {
    const playItem = cacheRowToMoovieItem(row);
    const languageTags = resolveAnimeCacheLanguageTags(row, audioById);
    if (
        playItem &&
        (catalogIdCollidesWithAnilist(media.id, playItem.id) ||
            String(playItem.id) === String(media.id))
    ) {
        return { playItem: null, languageTags };
    }
    return { playItem, languageTags };
}

/** Instant audio chips from Supabase (one query per grid page). */
export async function applyAnimeCatalogCacheBatch(media: AnimeMedia[]): Promise<{
    items: NetflixAnimeBrowseItem[];
    misses: AnimeMedia[];
    tagMisses: AnimeMedia[];
}> {
    const cacheById = await fetchAnimeCatalogCacheByIds(media.map((entry) => entry.id));
    const audioIds = [
        ...new Set(
            [...cacheById.values()]
                .filter((row) => row.moovie_catalog_id && !row.language_tags.length)
                .map((row) => String(row.moovie_catalog_id))
        )
    ];
    const audioById = audioIds.length
        ? await fetchCatalogAudioCacheByIds(audioIds)
        : new Map<string, string[]>();

    const misses: AnimeMedia[] = [];
    const tagMisses: AnimeMedia[] = [];
    const items = media.map((entry) => {
        const cached = cacheById.get(entry.id);
        if (cached) {
            const { playItem, languageTags } = linkFromCacheRow(
                entry,
                cached,
                audioById
            );
            if (!languageTags.length) {
                tagMisses.push(entry);
            }
            return animeMediaToCuratedItem(entry, playItem, languageTags);
        }
        misses.push(entry);
        return animeMediaToCuratedItem(entry);
    });

    nfDebug('anime-browse:cache:apply', {
        anilist: media.length,
        cacheHits: media.length - misses.length,
        misses: misses.length,
        tagMisses: tagMisses.length,
        audioFallback: audioIds.length,
        withTags: items.filter((item) => item.languageTags?.length).length
    });

    return { items, misses, tagMisses };
}

/** Live Moovie resolve for rows missing from Supabase cache. */
export async function resolveAnimeCatalogMisses(
    media: AnimeMedia[],
    preferredLang: NetflixLanguageOption,
    candidatePool: MoovieCatalogItem[] = []
): Promise<NetflixAnimeBrowseItem[]> {
    if (!media.length) return [];

    const linked = await mapWithConcurrency(
        media,
        (entry) => linkMoovieCatalogItem(entry, preferredLang, candidatePool),
        MOOVIE_LINK_CONCURRENCY
    );

    return media.map((entry, index) => {
        const { playItem, languageTags } = linked[index];
        return animeMediaToCuratedItem(entry, playItem, languageTags);
    });
}

/** Supabase cache first; live catalogue resolve only for cache misses. */
export function animeMediaNeedingLiveResolve(batch: {
    misses: AnimeMedia[];
    tagMisses: AnimeMedia[];
}): AnimeMedia[] {
    return uniqueAnimeMedia([...batch.misses, ...batch.tagMisses]);
}

function uniqueAnimeMedia(entries: AnimeMedia[]): AnimeMedia[] {
    const seen = new Set<number>();
    const out: AnimeMedia[] = [];
    for (const entry of entries) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        out.push(entry);
    }
    return out;
}

export async function enrichAnimeBrowseBatch(
    media: AnimeMedia[],
    preferredLang: NetflixLanguageOption,
    candidatePool: MoovieCatalogItem[] = []
): Promise<NetflixAnimeBrowseItem[]> {
    const { items, misses, tagMisses } = await applyAnimeCatalogCacheBatch(media);
    const toResolve = uniqueAnimeMedia([...misses, ...tagMisses]);
    if (!toResolve.length) {
        return items;
    }

    const resolved = await resolveAnimeCatalogMisses(
        toResolve,
        preferredLang,
        candidatePool
    );
    const resolvedById = new Map(resolved.map((item) => [item.anilistId, item]));

    const merged = items.map((item) => resolvedById.get(item.anilistId) || item);

    nfDebug('anime-browse:enrich', {
        anilist: media.length,
        cacheHits: media.length - misses.length,
        liveResolved: toResolve.length,
        tagMisses: tagMisses.length,
        linked: merged.filter((item) => item.moovieCatalogId).length,
        withTags: merged.filter((item) => item.languageTags?.length).length,
        withEnglish: merged.filter((item) => item.languageTags?.includes('English')).length
    });

    return merged;
}

export async function fetchAnimeBrowseBatch(
    page: number,
    preferredLang: NetflixLanguageOption,
    linkMoovie = true
): Promise<{
    items: NetflixAnimeBrowseItem[];
    pageInfo: AnimeBrowsePageInfo;
}> {
    const fast = await fetchAnimeBrowseBatchFast(page);
    if (!linkMoovie) {
        return { items: fast.items, pageInfo: fast.pageInfo };
    }

    const items = await enrichAnimeBrowseBatch(fast.media, preferredLang);
    return { items, pageInfo: fast.pageInfo };
}

export function streamPathForAnimeBrowseItem(item: NetflixAnimeBrowseItem): string {
    return netflixCatalogPlayPath({
        id: item.id,
        moovieCatalogId: item.moovieCatalogId,
        title: item.title,
        catalogTitle: item.catalogTitle || item.title,
        type: 'anime',
        anilistId: item.anilistId
    });
}

export interface AnimeGenreRailDisplay {
    id: string;
    title: string;
    defaultType: 'tv';
    items: NetflixAnimeBrowseItem[];
}

export function buildAnimeGenreRails(items: NetflixAnimeBrowseItem[]): AnimeGenreRailDisplay[] {
    const scoreSorted = [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const yearSorted = [...items].sort(
        (a, b) => Number(b.releaseDate || 0) - Number(a.releaseDate || 0)
    );

    const rails: AnimeGenreRailDisplay[] = [];

    if (items.length >= 3) {
        rails.push({
            id: 'tv',
            title: 'Exciting TV Shows',
            defaultType: 'tv',
            items: items.slice(0, 20)
        });
    }
    if (scoreSorted.length >= 3) {
        rails.push({
            id: 'top',
            title: 'Anime for Beginners',
            defaultType: 'tv',
            items: scoreSorted.slice(0, 20)
        });
    }
    if (yearSorted.length >= 3) {
        rails.push({
            id: 'new',
            title: 'New on Netflix',
            defaultType: 'tv',
            items: yearSorted.slice(0, 20)
        });
    }

    return rails;
}