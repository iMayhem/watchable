import { fetchAnimeMediaById, type AnimeMedia } from './useAniList';
import {
    cacheRowToMoovieItem,
    catalogIdCollidesWithAnilist,
    fetchAnimeCatalogCacheByIds,
    type AnimeCatalogCacheRow
} from './useAnimeCatalogCache';
import { fetchCatalogAudioCacheByIds } from './useCatalogAudioCache';
import { parseCatalogTitle, type MoovieCatalogItem } from './useMoovieCatalog';
import {
    ANIME_CATALOG_MIN_MATCH_SCORE,
    bestTitleMatchScore,
    explicitLanguageLabels,
    resolveCatalogPlayVariantForTitles,
    sortLanguageTagsForDisplay
} from './useNetflixCatalogLookup';
import type { NetflixLanguageOption } from './useNetflixLanguage';

function searchTitlesForMedia(media: AnimeMedia): string[] {
    return [
        ...new Set(
            [media.title.english, media.title.romaji, media.title.native]
                .filter(Boolean)
                .map((title) => String(title).trim())
        )
    ];
}

export interface AnilistCatalogResolve {
    item: MoovieCatalogItem | null;
    languageTags: string[];
    anilistTitles: string[];
}

export async function resolveMoovieCatalogForAnilist(
    anilistId: number,
    preferredLang?: NetflixLanguageOption
): Promise<AnilistCatalogResolve> {
    const response = await fetchAnimeMediaById(anilistId);
    const media = response?.data?.Media as AnimeMedia | undefined;
    if (!media) {
        return { item: null, languageTags: [], anilistTitles: [] };
    }

    const queries = searchTitlesForMedia(media);

    async function languageTagsFromCacheRow(
        row: AnimeCatalogCacheRow
    ): Promise<string[]> {
        if (row.language_tags.length) {
            return sortLanguageTagsForDisplay(row.language_tags);
        }
        if (row.moovie_catalog_id) {
            const audioMap = await fetchCatalogAudioCacheByIds([row.moovie_catalog_id]);
            const fromAudio = audioMap.get(String(row.moovie_catalog_id));
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

    const cacheMap = await fetchAnimeCatalogCacheByIds([anilistId]);
    const cached = cacheMap.get(anilistId);
    if (cached) {
        const languageTags = await languageTagsFromCacheRow(cached);
        const item = cacheRowToMoovieItem(cached);
        if (
            item &&
            !catalogIdCollidesWithAnilist(anilistId, item.id) &&
            String(item.id) !== String(anilistId)
        ) {
            const parsed = parseCatalogTitle(item.title || '');
            const display = parsed.displayTitle || item.title || '';
            if (
                bestTitleMatchScore(queries, display) >= ANIME_CATALOG_MIN_MATCH_SCORE &&
                languageTags.length
            ) {
                return {
                    item,
                    languageTags,
                    anilistTitles: queries
                };
            }
        } else if (languageTags.length) {
            return {
                item: null,
                languageTags,
                anilistTitles: queries
            };
        }
    }

    const resolved = await resolveCatalogPlayVariantForTitles(queries, {
        preferredLang,
        tvOnly: true,
        searchPages: 3,
        anilistId,
        minScore: ANIME_CATALOG_MIN_MATCH_SCORE
    });

    if (
        !resolved.item ||
        catalogIdCollidesWithAnilist(anilistId, resolved.item.id) ||
        String(resolved.item.id) === String(anilistId)
    ) {
        return { item: null, languageTags: [], anilistTitles: queries };
    }

    const parsed = parseCatalogTitle(resolved.item.title || '');
    const display = parsed.displayTitle || resolved.item.title || '';
    if (bestTitleMatchScore(queries, display) < ANIME_CATALOG_MIN_MATCH_SCORE) {
        return { item: null, languageTags: [], anilistTitles: queries };
    }

    return { ...resolved, anilistTitles: queries };
}