import { ref } from 'vue';
import useAxios from './useAxios';
import {
    inferCatalogMediaType,
    parseCatalogTitle,
    type MoovieCatalogItem
} from './useMoovieCatalog';
import { fetchEnrichmentByCatalogIds } from './useCatalogEnrichmentCache';
import { resolveTmdbArtwork } from './useTmdbArtwork';
import { nfDebugError } from './useNetflixDebug';

export interface NetflixCatalogEpisode {
    episode_number: number;
    name: string;
    overview?: string;
    still_path?: string | null;
    runtime?: number;
    air_date?: string;
}

export interface NetflixCatalogSeason {
    season_number: number;
    name: string;
    episode_count?: number;
}

function placeholderEpisodes(count: number): NetflixCatalogEpisode[] {
    const safe = Math.max(1, Math.min(count, 32));
    return Array.from({ length: safe }, (_, index) => ({
        episode_number: index + 1,
        name: `Episode ${index + 1}`
    }));
}

function updateSupportsEpisodes(
    target: { value: boolean },
    episodeRows: NetflixCatalogEpisode[]
) {
    target.value = episodeRows.length > 1;
}

async function resolveTvShowIdForEpisodes(
    item: Pick<MoovieCatalogItem, 'id' | 'title'> & { release_date?: string },
    knownTmdbId?: number | null
): Promise<number | null> {
    if (knownTmdbId && Number.isFinite(knownTmdbId)) {
        return knownTmdbId;
    }
    const parsed = parseCatalogTitle(item.title || '');
    const displayTitle = parsed.displayTitle || item.title || '';
    if (!displayTitle.trim()) return null;

    const tvArt = await resolveTmdbArtwork({
        title: displayTitle,
        type: 'tv',
        year: item.release_date,
        cacheKey: `nf-ep-tv-${item.id}`
    });

    if (!tvArt.tmdbId) return null;

    try {
        const showRes = await useAxios().get(`tv/${tvArt.tmdbId}`);
        const seasons = (showRes.data?.seasons || []).filter(
            (row: { season_number: number }) => row.season_number > 0
        );
        if (!seasons.length) return null;

        const totalEpisodes = seasons.reduce(
            (sum: number, row: { episode_count?: number }) =>
                sum + (row.episode_count || 0),
            0
        );
        if (totalEpisodes > 1) return tvArt.tmdbId;

        const seasonNum = seasons[0]?.season_number || 1;
        const seasonRes = await useAxios().get(
            `tv/${tvArt.tmdbId}/season/${seasonNum}`
        );
        const rows = seasonRes.data?.episodes || [];
        if (rows.length > 1) return tvArt.tmdbId;
    } catch (err) {
        nfDebugError('nf-episodes:tv-probe:fail', { id: item.id, err });
    }

    return null;
}

export function useNetflixCatalogEpisodes() {
    const seasons = ref<NetflixCatalogSeason[]>([]);
    const episodes = ref<NetflixCatalogEpisode[]>([]);
    const loading = ref(false);
    const supportsEpisodes = ref(false);
    const tmdbShowId = ref<number | null>(null);
    const currentSeason = ref(1);

    async function loadSeasonEpisodes(showId: number, seasonNum: number) {
        currentSeason.value = seasonNum;
        try {
            const res = await useAxios().get(`tv/${showId}/season/${seasonNum}`);
            const rows = res.data?.episodes || [];
            episodes.value = rows.map((ep: NetflixCatalogEpisode) => ({
                episode_number: ep.episode_number,
                name: ep.name || `Episode ${ep.episode_number}`,
                overview: ep.overview,
                still_path: ep.still_path,
                runtime: ep.runtime,
                air_date: ep.air_date
            }));
        } catch (err) {
            nfDebugError('nf-episodes:season:fail', { showId, seasonNum, err });
            episodes.value = [];
        }
    }

    function applyEpisodeCountHint(count: number, defaultSeason: number) {
        const safe = Math.max(2, Math.min(count, 32));
        seasons.value = [
            {
                season_number: defaultSeason,
                name: `Season ${defaultSeason}`,
                episode_count: safe
            }
        ];
        episodes.value = placeholderEpisodes(safe);
        updateSupportsEpisodes(supportsEpisodes, episodes.value);
    }

    async function load(
        item: Pick<MoovieCatalogItem, 'id' | 'title' | 'media_type'> & {
            release_date?: string;
        },
        opts: { season?: number; episodeCountHint?: number } = {}
    ) {
        loading.value = true;
        seasons.value = [];
        episodes.value = [];
        tmdbShowId.value = null;
        supportsEpisodes.value = false;

        const parsed = parseCatalogTitle(item.title || '');
        const defaultSeason = opts.season ?? parsed.season ?? 1;
        currentSeason.value = defaultSeason;
        const inferredTv = inferCatalogMediaType(item) === 'tv';

        try {
            const enrichmentMap = await fetchEnrichmentByCatalogIds([item.id]);
            const enrichment = enrichmentMap.get(String(item.id));
            const enrichmentTmdbId =
                enrichment?.media_type === 'tv' && enrichment.tmdb_id
                    ? enrichment.tmdb_id
                    : null;

            const showId = await resolveTvShowIdForEpisodes(item, enrichmentTmdbId);

            if (!showId) {
                if (
                    opts.episodeCountHint &&
                    opts.episodeCountHint > 1
                ) {
                    applyEpisodeCountHint(opts.episodeCountHint, defaultSeason);
                    return;
                }

                if (inferredTv) {
                    seasons.value = [
                        {
                            season_number: defaultSeason,
                            name: `Season ${defaultSeason}`
                        }
                    ];
                    episodes.value = placeholderEpisodes(12);
                    updateSupportsEpisodes(supportsEpisodes, episodes.value);
                }
                return;
            }

            tmdbShowId.value = showId;
            const showRes = await useAxios().get(`tv/${showId}`);
            const showSeasons = (showRes.data?.seasons || []).filter(
                (row: { season_number: number }) => row.season_number > 0
            );

            if (showSeasons.length) {
                seasons.value = showSeasons.map(
                    (row: {
                        season_number: number;
                        name?: string;
                        episode_count?: number;
                    }) => ({
                        season_number: row.season_number,
                        name: row.name || `Season ${row.season_number}`,
                        episode_count: row.episode_count
                    })
                );
            } else {
                seasons.value = [
                    {
                        season_number: defaultSeason,
                        name: `Season ${defaultSeason}`
                    }
                ];
            }

            const seasonToLoad = seasons.value.some(
                (row) => row.season_number === defaultSeason
            )
                ? defaultSeason
                : seasons.value[0]?.season_number || 1;

            await loadSeasonEpisodes(showId, seasonToLoad);

            if (!episodes.value.length && opts.episodeCountHint && opts.episodeCountHint > 1) {
                applyEpisodeCountHint(opts.episodeCountHint, seasonToLoad);
                return;
            }

            updateSupportsEpisodes(supportsEpisodes, episodes.value);
        } catch (err) {
            nfDebugError('nf-episodes:load:fail', { id: item.id, err });
            if (opts.episodeCountHint && opts.episodeCountHint > 1) {
                applyEpisodeCountHint(opts.episodeCountHint, defaultSeason);
                return;
            }
            if (inferredTv) {
                seasons.value = [
                    {
                        season_number: defaultSeason,
                        name: `Season ${defaultSeason}`
                    }
                ];
                episodes.value = placeholderEpisodes(12);
                updateSupportsEpisodes(supportsEpisodes, episodes.value);
            }
        } finally {
            loading.value = false;
        }
    }

    async function setSeason(seasonNum: number) {
        if (!tmdbShowId.value) {
            currentSeason.value = seasonNum;
            if (episodes.value.length > 1) {
                episodes.value = placeholderEpisodes(episodes.value.length);
            }
            return;
        }
        loading.value = true;
        try {
            await loadSeasonEpisodes(tmdbShowId.value, seasonNum);
            updateSupportsEpisodes(supportsEpisodes, episodes.value);
        } finally {
            loading.value = false;
        }
    }

    return {
        seasons,
        episodes,
        loading,
        supportsEpisodes,
        tmdbShowId,
        currentSeason,
        load,
        setSeason
    };
}