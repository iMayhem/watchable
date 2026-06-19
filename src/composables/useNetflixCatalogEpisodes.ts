import { ref } from 'vue';
import useAxios from './useAxios';
import {
    catalogHasEpisodeGuide,
    parseCatalogTitle,
    type MoovieCatalogItem
} from './useMoovieCatalog';
import { fetchEnrichmentByCatalogIds } from './useCatalogEnrichmentCache';
import { resolveTmdbArtwork } from './useTmdbArtwork';
import { nfDebug, nfDebugError } from './useNetflixDebug';

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

export interface LoadCatalogEpisodesOptions {
    season?: number;
    episodeCountHint?: number;
    routeType?: 'movie' | 'tv';
}

const seasonEpisodesCache = new Map<string, NetflixCatalogEpisode[]>();
const tvSeasonsCache = new Map<string, NetflixCatalogSeason[]>();

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

function parseCatalogYear(releaseDate?: string): number | null {
    if (!releaseDate) return null;
    const match = releaseDate.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0], 10) : null;
}

function mapTmdbEpisode(ep: {
    episode_number: number;
    name?: string;
    overview?: string;
    still_path?: string | null;
    runtime?: number;
    air_date?: string;
}): NetflixCatalogEpisode {
    return {
        episode_number: ep.episode_number,
        name: ep.name || `Episode ${ep.episode_number}`,
        overview: ep.overview || undefined,
        still_path: ep.still_path || null,
        runtime: ep.runtime || undefined,
        air_date: ep.air_date || undefined
    };
}

async function resolveTmdbTvId(
    item: Pick<
        MoovieCatalogItem,
        | 'id'
        | 'title'
        | 'media_type'
        | 'duration'
        | 'embed'
        | 'subjectid'
        | 'embed_en'
        | 'season'
    > & {
        release_date?: string;
    }
): Promise<number | null> {
    if (!catalogHasEpisodeGuide(item)) {
        return null;
    }

    const enrichment = await fetchEnrichmentByCatalogIds([item.id]);
    const row = enrichment.get(String(item.id));

    if (row?.media_type === 'movie') {
        return null;
    }

    const trustedId =
        row?.tmdb_id && Number.isFinite(row.tmdb_id) ? row.tmdb_id : undefined;

    if (trustedId && row?.media_type === 'tv') {
        return trustedId;
    }

    const parsed = parseCatalogTitle(item.title || '');
    const displayTitle = parsed.displayTitle || item.title || '';
    if (!displayTitle) return null;

    const art = await resolveTmdbArtwork({
        title: displayTitle,
        year: parseCatalogYear(item.release_date),
        type: 'tv',
        cacheKey: `nf-episodes:${item.id}`,
        tmdbId: trustedId
    });

    return art.tmdbId && Number.isFinite(art.tmdbId) ? art.tmdbId : null;
}

async function fetchTmdbTvSeasons(tmdbId: number): Promise<NetflixCatalogSeason[]> {
    const cacheKey = String(tmdbId);
    const cached = tvSeasonsCache.get(cacheKey);
    if (cached) return cached;

    const axios = useAxios();
    const { data } = await axios.get(`tv/${tmdbId}`);
    const seasons = (data?.seasons || [])
        .filter((season: { season_number: number }) => season.season_number > 0)
        .map(
            (season: {
                season_number: number;
                name?: string;
                episode_count?: number;
            }) => ({
                season_number: season.season_number,
                name: season.name || `Season ${season.season_number}`,
                episode_count: season.episode_count
            })
        );

    tvSeasonsCache.set(cacheKey, seasons);
    return seasons;
}

async function fetchTmdbSeasonEpisodes(
    tmdbId: number,
    seasonNum: number
): Promise<NetflixCatalogEpisode[]> {
    const cacheKey = `${tmdbId}:${seasonNum}`;
    const cached = seasonEpisodesCache.get(cacheKey);
    if (cached) return cached;

    const axios = useAxios();
    const { data } = await axios.get(`tv/${tmdbId}/season/${seasonNum}`);
    const episodes = (data?.episodes || []).map(mapTmdbEpisode);
    seasonEpisodesCache.set(cacheKey, episodes);
    return episodes;
}

export function useNetflixCatalogEpisodes() {
    const seasons = ref<NetflixCatalogSeason[]>([]);
    const episodes = ref<NetflixCatalogEpisode[]>([]);
    const loading = ref(false);
    const supportsEpisodes = ref(false);
    const currentSeason = ref(1);
    const activeTmdbId = ref<number | null>(null);

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

    async function loadTmdbSeason(tmdbId: number, seasonNum: number) {
        const rows = await fetchTmdbSeasonEpisodes(tmdbId, seasonNum);
        if (rows.length) {
            episodes.value = rows;
            updateSupportsEpisodes(supportsEpisodes, episodes.value);
            return true;
        }
        return false;
    }

    function reset() {
        seasons.value = [];
        episodes.value = [];
        supportsEpisodes.value = false;
        activeTmdbId.value = null;
        loading.value = false;
    }

    async function load(
        item: Pick<
            MoovieCatalogItem,
            | 'id'
            | 'title'
            | 'media_type'
            | 'duration'
            | 'embed'
            | 'subjectid'
            | 'embed_en'
            | 'season'
        > & {
            release_date?: string;
        },
        opts: LoadCatalogEpisodesOptions = {}
    ) {
        reset();
        loading.value = true;

        const parsed = parseCatalogTitle(item.title || '');
        const defaultSeason = opts.season ?? parsed.season ?? 1;
        currentSeason.value = defaultSeason;

        try {
            if (opts.episodeCountHint && opts.episodeCountHint > 1) {
                applyEpisodeCountHint(opts.episodeCountHint, defaultSeason);
                return;
            }

            if (!catalogHasEpisodeGuide(item, opts.routeType)) {
                return;
            }

            const tmdbId = await resolveTmdbTvId(item);
            if (!tmdbId) {
                return;
            }

            activeTmdbId.value = tmdbId;
            const seasonList = await fetchTmdbTvSeasons(tmdbId);
            if (seasonList.length) {
                seasons.value = seasonList;
            } else {
                return;
            }

            const targetSeason = seasons.value.some(
                (row) => row.season_number === defaultSeason
            )
                ? defaultSeason
                : seasons.value[0]?.season_number ?? defaultSeason;
            currentSeason.value = targetSeason;

            const loaded = await loadTmdbSeason(tmdbId, targetSeason);
            if (loaded) {
                nfDebug('nf-episodes:tmdb:ok', {
                    id: item.id,
                    tmdbId,
                    season: targetSeason,
                    count: episodes.value.length
                });
            }
        } catch (err) {
            nfDebugError('nf-episodes:load:fail', { id: item.id, err });
            if (opts.episodeCountHint && opts.episodeCountHint > 1) {
                applyEpisodeCountHint(opts.episodeCountHint, defaultSeason);
            }
        } finally {
            loading.value = false;
        }
    }

    async function setSeason(seasonNum: number) {
        currentSeason.value = seasonNum;

        if (!activeTmdbId.value) {
            return;
        }

        loading.value = true;
        try {
            await loadTmdbSeason(activeTmdbId.value, seasonNum);
        } catch (err) {
            nfDebugError('nf-episodes:season:fail', {
                tmdbId: activeTmdbId.value,
                season: seasonNum,
                err
            });
        } finally {
            loading.value = false;
        }
    }

    return {
        seasons,
        episodes,
        loading,
        supportsEpisodes,
        currentSeason,
        load,
        setSeason,
        reset
    };
}