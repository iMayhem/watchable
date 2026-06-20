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
import { prefetchArtworkImages } from '../utils/useWebImage';

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
    tmdbId?: number;
}

const PLACEHOLDER_EPISODE_CAP = 200;
const DEFAULT_EPISODE_HINT = 12;

const seasonEpisodesCache = new Map<string, NetflixCatalogEpisode[]>();
const tvSeasonsCache = new Map<string, NetflixCatalogSeason[]>();
const tvShowArtCache = new Map<
    number,
    { backdrop_path: string | null; poster_path: string | null }
>();
const tmdbTvValidityCache = new Map<number, boolean>();

export function episodeRowsNeedStillsUpgrade(rows: NetflixCatalogEpisode[]): boolean {
    return rows.length > 0 && !rows.some((row) => Boolean(row.still_path));
}

function placeholderEpisodes(count: number): NetflixCatalogEpisode[] {
    const safe = Math.max(1, Math.min(count, PLACEHOLDER_EPISODE_CAP));
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

function seasonRowNumber(row: Record<string, unknown>): number | null {
    const raw = row.season_number ?? row.season ?? row.se;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function seasonRowEpisodeCount(row: Record<string, unknown>): number | null {
    const raw = row.episode_count ?? row.episodes ?? row.count ?? row.ep;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
}

export function seasonsFromCatalogData(season: unknown): NetflixCatalogSeason[] {
    if (!Array.isArray(season)) return [];

    const rows: NetflixCatalogSeason[] = [];
    for (const entry of season) {
        if (!entry || typeof entry !== 'object') continue;
        const row = entry as Record<string, unknown>;
        const seasonNum = seasonRowNumber(row);
        if (seasonNum == null || seasonNum < 1) continue;
        const episodeCount = seasonRowEpisodeCount(row) ?? undefined;
        rows.push({
            season_number: seasonNum,
            name: `Season ${seasonNum}`,
            episode_count: episodeCount
        });
    }

    return rows.sort((a, b) => a.season_number - b.season_number);
}

export function inferEpisodeCountFromCatalog(
    season: unknown,
    seasonNum: number,
    fallback = DEFAULT_EPISODE_HINT
): number {
    if (Array.isArray(season)) {
        for (const entry of season) {
            if (!entry || typeof entry !== 'object') continue;
            const row = entry as Record<string, unknown>;
            const rowSeason = seasonRowNumber(row);
            if (rowSeason != null && rowSeason !== seasonNum) continue;
            const count = seasonRowEpisodeCount(row);
            if (count && count > 1) return count;
        }
        if (season.length > 1) return fallback;
    }

    if (season && typeof season === 'object') {
        const count = seasonRowEpisodeCount(season as Record<string, unknown>);
        if (count && count > 1) return count;
    }

    if (typeof season === 'string') {
        const match = season.match(/(\d+)\s*ep(?:isode)?s?/i);
        if (match) {
            const count = parseInt(match[1], 10);
            if (Number.isFinite(count) && count > 1) return count;
        }
    }

    return fallback;
}

function showStillFallback(tmdbId: number): string | null {
    const art = tvShowArtCache.get(tmdbId);
    return art?.backdrop_path || art?.poster_path || null;
}

function mapTmdbEpisode(
    ep: {
        episode_number: number;
        name?: string;
        overview?: string;
        still_path?: string | null;
        runtime?: number;
        air_date?: string;
    },
    fallbackStill?: string | null
): NetflixCatalogEpisode {
    return {
        episode_number: ep.episode_number,
        name: ep.name || `Episode ${ep.episode_number}`,
        overview: ep.overview || undefined,
        still_path: ep.still_path || fallbackStill || null,
        runtime: ep.runtime || undefined,
        air_date: ep.air_date || undefined
    };
}

function prefetchEpisodeStills(rows: NetflixCatalogEpisode[]) {
    prefetchArtworkImages(
        rows.map((row) => row.still_path),
        'medium',
        64
    );
}

async function tmdbTvShowHasSeasons(tmdbId: number): Promise<boolean> {
    const cached = tmdbTvValidityCache.get(tmdbId);
    if (cached !== undefined) return cached;

    try {
        const { data } = await useAxios().get(`tv/${tmdbId}`);
        const ok = Boolean(
            data?.id &&
                Array.isArray(data.seasons) &&
                data.seasons.some(
                    (season: { season_number?: number }) =>
                        Number(season?.season_number) > 0
                )
        );
        tmdbTvValidityCache.set(tmdbId, ok);
        return ok;
    } catch {
        tmdbTvValidityCache.set(tmdbId, false);
        return false;
    }
}

async function acceptTmdbTvId(
    tmdbId: number | undefined,
    forceTv: boolean,
    enrichedMovie: boolean
): Promise<number | null> {
    if (!tmdbId || !Number.isFinite(tmdbId)) return null;
    if (forceTv && enrichedMovie) return null;
    return (await tmdbTvShowHasSeasons(tmdbId)) ? tmdbId : null;
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
    },
    routeType?: 'movie' | 'tv',
    hintedTmdbId?: number
): Promise<number | null> {
    const forceTv = routeType === 'tv';

    if (!forceTv && !catalogHasEpisodeGuide(item)) {
        return null;
    }

    const enrichment = await fetchEnrichmentByCatalogIds([item.id]);
    const row = enrichment.get(String(item.id));
    const enrichedId =
        row?.tmdb_id && Number.isFinite(row.tmdb_id) ? row.tmdb_id : undefined;
    const enrichedIsMovie = row?.media_type === 'movie';

    const hinted = await acceptTmdbTvId(
        hintedTmdbId,
        forceTv,
        enrichedIsMovie && hintedTmdbId === enrichedId
    );
    if (hinted) return hinted;

    const enriched = await acceptTmdbTvId(
        enrichedId,
        forceTv,
        enrichedIsMovie
    );
    if (enriched) return enriched;

    if (!forceTv && enrichedIsMovie) {
        return null;
    }

    const parsed = parseCatalogTitle(item.title || '');
    const displayTitle = parsed.displayTitle || item.title || '';
    if (!displayTitle) return null;

    const art = await resolveTmdbArtwork({
        title: displayTitle,
        year: parseCatalogYear(item.release_date),
        type: 'tv',
        cacheKey: `nf-episodes:${item.id}`,
        tmdbId: enrichedIsMovie ? undefined : enrichedId
    });

    if (art.tmdbId && Number.isFinite(art.tmdbId)) {
        const resolved = await acceptTmdbTvId(art.tmdbId, forceTv, false);
        if (resolved) return resolved;
    }

    return null;
}

async function ensureTmdbShowArt(tmdbId: number) {
    if (tvShowArtCache.has(tmdbId)) return;

    const axios = useAxios();
    const { data } = await axios.get(`tv/${tmdbId}`);
    tvShowArtCache.set(tmdbId, {
        backdrop_path: data?.backdrop_path || null,
        poster_path: data?.poster_path || null
    });
}

async function fetchTmdbTvSeasons(tmdbId: number): Promise<NetflixCatalogSeason[]> {
    const cacheKey = String(tmdbId);
    const cached = tvSeasonsCache.get(cacheKey);
    if (cached) {
        await ensureTmdbShowArt(tmdbId);
        return cached;
    }

    const axios = useAxios();
    const { data } = await axios.get(`tv/${tmdbId}`);
    tvShowArtCache.set(tmdbId, {
        backdrop_path: data?.backdrop_path || null,
        poster_path: data?.poster_path || null
    });
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
    const seasonStill =
        data?.poster_path ||
        showStillFallback(tmdbId);
    const episodes = (data?.episodes || []).map((ep: {
        episode_number: number;
        name?: string;
        overview?: string;
        still_path?: string | null;
        runtime?: number;
        air_date?: string;
    }) => mapTmdbEpisode(ep, seasonStill));
    seasonEpisodesCache.set(cacheKey, episodes);
    prefetchEpisodeStills(episodes);
    return episodes;
}

export function useNetflixCatalogEpisodes() {
    const seasons = ref<NetflixCatalogSeason[]>([]);
    const episodes = ref<NetflixCatalogEpisode[]>([]);
    const loading = ref(false);
    const supportsEpisodes = ref(false);
    const currentSeason = ref(1);
    const activeTmdbId = ref<number | null>(null);
    let inflightCatalogId: string | null = null;
    let inflightLoad: Promise<void> | null = null;

    function applyEpisodeCountHint(
        count: number,
        defaultSeason: number,
        catalogSeason?: unknown
    ) {
        const safe = Math.max(2, Math.min(count, PLACEHOLDER_EPISODE_CAP));
        const catalogSeasons = seasonsFromCatalogData(catalogSeason);
        if (catalogSeasons.length) {
            seasons.value = catalogSeasons;
        } else {
            seasons.value = [
                {
                    season_number: defaultSeason,
                    name: `Season ${defaultSeason}`,
                    episode_count: safe
                }
            ];
        }
        const seasonCount = inferEpisodeCountFromCatalog(
            catalogSeason,
            defaultSeason,
            safe
        );
        episodes.value = placeholderEpisodes(seasonCount);
        updateSupportsEpisodes(supportsEpisodes, episodes.value);
    }

    function applyPlaceholderForSeason(seasonNum: number, count: number) {
        const safe = Math.max(2, Math.min(count, PLACEHOLDER_EPISODE_CAP));
        if (!seasons.value.some((row) => row.season_number === seasonNum)) {
            seasons.value = [
                ...seasons.value,
                {
                    season_number: seasonNum,
                    name: `Season ${seasonNum}`,
                    episode_count: safe
                }
            ].sort((a, b) => a.season_number - b.season_number);
        }
        episodes.value = placeholderEpisodes(safe);
        updateSupportsEpisodes(supportsEpisodes, episodes.value);
    }

    function episodeCountForSeason(seasonNum: number, fallback: number) {
        const seasonRow = seasons.value.find((row) => row.season_number === seasonNum);
        return seasonRow?.episode_count || fallback;
    }

    function applyShowStillToEpisodes(tmdbId: number) {
        const fallback = showStillFallback(tmdbId);
        if (!fallback || !episodes.value.length) return;
        episodes.value = episodes.value.map((ep) => ({
            ...ep,
            still_path: ep.still_path || fallback
        }));
        prefetchEpisodeStills(episodes.value);
    }

    async function loadTmdbSeason(tmdbId: number, seasonNum: number) {
        const rows = await fetchTmdbSeasonEpisodes(tmdbId, seasonNum);
        if (rows.length) {
            episodes.value = rows;
            updateSupportsEpisodes(supportsEpisodes, episodes.value);
            prefetchEpisodeStills(rows);
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
        const catalogId = String(item.id);
        if (inflightCatalogId === catalogId && inflightLoad) {
            return inflightLoad;
        }

        const run = async () => {
            reset();
            loading.value = true;

            const parsed = parseCatalogTitle(item.title || '');
            const defaultSeason = opts.season ?? parsed.season ?? 1;
            currentSeason.value = defaultSeason;

            const hasGuideSignal = catalogHasEpisodeGuide(item);
            // Treat as TV if explicit tv route OR has episode signals (unless caller explicitly says 'movie')
            const isTvPlayback = opts.routeType === 'tv' || (hasGuideSignal && opts.routeType !== 'movie');
            const hasGuide = catalogHasEpisodeGuide(item, opts.routeType);
            const fallbackCount = Math.max(
                opts.episodeCountHint || 0,
                inferEpisodeCountFromCatalog(
                    item.season,
                    defaultSeason,
                    DEFAULT_EPISODE_HINT
                )
            );

            const seedPlaceholders = () => {
                applyEpisodeCountHint(fallbackCount, defaultSeason, item.season);
            };

            try {
                if (
                    opts.episodeCountHint &&
                    opts.episodeCountHint > 1 &&
                    !isTvPlayback
                ) {
                    applyEpisodeCountHint(opts.episodeCountHint, defaultSeason);
                    return;
                }

                if (!isTvPlayback && !hasGuide) {
                    return;
                }

                if (isTvPlayback || hasGuide) {
                    seedPlaceholders();
                    // Keep the picker populated while TMDB metadata upgrades in the background.
                    loading.value = false;
                }

                const tmdbId = await resolveTmdbTvId(
                    item,
                    isTvPlayback ? 'tv' : opts.routeType,
                    opts.tmdbId
                );
                if (!tmdbId) {
                    seedPlaceholders();
                    return;
                }

                activeTmdbId.value = tmdbId;
                await ensureTmdbShowArt(tmdbId);
                applyShowStillToEpisodes(tmdbId);

                const seasonList = await fetchTmdbTvSeasons(tmdbId);
                if (!seasonList.length) {
                    nfDebug('nf-episodes:tmdb:no-seasons', {
                        id: item.id,
                        tmdbId
                    });
                    seedPlaceholders();
                    return;
                }

                seasons.value = seasonList;

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
                        count: episodes.value.length,
                        stills: episodes.value.filter((row) => row.still_path).length
                    });
                    return;
                }

                applyPlaceholderForSeason(
                    targetSeason,
                    episodeCountForSeason(targetSeason, fallbackCount)
                );
            } catch (err) {
                nfDebugError('nf-episodes:load:fail', { id: item.id, err });
                if (opts.episodeCountHint && opts.episodeCountHint > 1) {
                    applyEpisodeCountHint(opts.episodeCountHint, defaultSeason);
                } else if (isTvPlayback || hasGuide) {
                    seedPlaceholders();
                }
            } finally {
                loading.value = false;
            }
        };

        inflightCatalogId = catalogId;
        inflightLoad = run().finally(() => {
            if (inflightCatalogId === catalogId) {
                inflightCatalogId = null;
                inflightLoad = null;
            }
        });
        return inflightLoad;
    }

    async function setSeason(seasonNum: number) {
        currentSeason.value = seasonNum;

        if (!activeTmdbId.value) {
            applyPlaceholderForSeason(
                seasonNum,
                episodeCountForSeason(seasonNum, DEFAULT_EPISODE_HINT)
            );
            return;
        }

        loading.value = true;
        try {
            const loaded = await loadTmdbSeason(activeTmdbId.value, seasonNum);
            if (!loaded) {
                applyPlaceholderForSeason(
                    seasonNum,
                    episodeCountForSeason(seasonNum, DEFAULT_EPISODE_HINT)
                );
            }
        } catch (err) {
            nfDebugError('nf-episodes:season:fail', {
                tmdbId: activeTmdbId.value,
                season: seasonNum,
                err
            });
            applyPlaceholderForSeason(
                seasonNum,
                episodeCountForSeason(seasonNum, DEFAULT_EPISODE_HINT)
            );
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