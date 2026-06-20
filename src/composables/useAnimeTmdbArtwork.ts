import useAxios from './useAxios';
import { buildAnimeplayAnilistEmbedUrl } from './useAnimeplay';

export interface AnimeTmdbEpisode {
    /** User-facing episode index (absolute for long runners, in-season otherwise). */
    episode_number: number;
    season_number: number;
    episode_in_season: number;
    absolute_number: number;
    still_path: string | null;
    name?: string;
    overview?: string;
    air_date?: string;
}

export interface AnimeTmdbSeasonTab {
    seasonNumber: number;
    label: string;
    firstEpisode: number;
    lastEpisode: number;
    anilistId?: number;
}

type TmdbSeasonMeta = {
    season_number: number;
    name?: string;
    episode_count?: number;
};

export interface AnimeTmdbArtwork {
    tmdbId: number | null;
    mediaType: 'movie' | 'tv';
    posterPath: string | null;
    backdropPath: string | null;
    /** From TMDB show metadata — available before per-episode fetch completes. */
    totalEpisodeCount: number;
    episodes: AnimeTmdbEpisode[];
    episodesLoaded: boolean;
    /** Long runners (e.g. One Piece) use TMDB seasons instead of AniList relations. */
    usesTmdbSeasonTabs: boolean;
    seasonTabs: AnimeTmdbSeasonTab[];
}

type AnilistMediaFields = {
    title?: {
        english?: string | null;
        romaji?: string | null;
        native?: string | null;
    };
    format?: string | null;
    seasonYear?: number | null;
    episodes?: number | null;
    status?: string | null;
    nextAiringEpisode?: {
        episode?: number | null;
    } | null;
};

const artworkCache = new Map<number, AnimeTmdbArtwork | null>();
const ANIMATION_GENRE_ID = 16;

function cleanAnimeTitle(title: string): string {
    return title.replace(/\b(Season|Part|Cour)\s*\d+\b/gi, '').replace(/\s+/g, ' ').trim();
}

function searchTitles(media: AnilistMediaFields): string[] {
    return [media.title?.english, media.title?.romaji, media.title?.native]
        .filter(Boolean)
        .map((t) => cleanAnimeTitle(String(t)));
}

async function findAnimatedTmdbShow(
    media: AnilistMediaFields
): Promise<{ id: number; poster_path?: string | null; backdrop_path?: string | null } | null> {
    const isMovie = media.format === 'MOVIE';
    const searchType = isMovie ? 'movie' : 'tv';
    const year = media.seasonYear || undefined;
    const axios = useAxios();

    for (const title of searchTitles(media)) {
        const params: Record<string, string | number> = { query: title };
        if (year && isMovie) {
            params.year = year;
        }

        const res = await axios.get(`search/${searchType}`, { params });
        const results = res?.data?.results || [];
        if (!results.length) continue;

        const animated = results.filter((row: { genre_ids?: number[] }) =>
            row.genre_ids?.includes(ANIMATION_GENRE_ID)
        );
        const pool = animated.length ? animated : results;

        // Prefer the longest-running match (e.g. One Piece 1999 over live-action 2023).
        pool.sort((a: { first_air_date?: string }, b: { first_air_date?: string }) =>
            (a.first_air_date || '9999').localeCompare(b.first_air_date || '9999')
        );

        const hit = pool[0];
        if (hit?.id) return hit;
    }

    return null;
}



async function fetchFlattenedTmdbEpisodes(
    tvId: number,
    seasons: Array<{ season_number: number }>
): Promise<AnimeTmdbEpisode[]> {
    const axios = useAxios();
    const regularSeasons = seasons
        .filter((s) => s.season_number > 0)
        .sort((a, b) => a.season_number - b.season_number);

    const flattened: AnimeTmdbEpisode[] = [];
    let absoluteOffset = 0;
    const chunkSize = 5;

    for (let i = 0; i < regularSeasons.length; i += chunkSize) {
        const chunk = regularSeasons.slice(i, i + chunkSize);
        const responses = await Promise.all(
            chunk.map((season) => axios.get(`tv/${tvId}/season/${season.season_number}`))
        );

        for (let j = 0; j < responses.length; j++) {
            const seasonRes = responses[j];
            const seasonNumber = chunk[j].season_number;
            const eps = seasonRes?.data?.episodes || [];
            for (const ep of eps) {
                const absolute = absoluteOffset + ep.episode_number;
                flattened.push({
                    episode_number: absolute,
                    season_number: seasonNumber,
                    episode_in_season: ep.episode_number,
                    absolute_number: absolute,
                    still_path: ep.still_path ?? null,
                    name: ep.name,
                    overview: ep.overview,
                    air_date: ep.air_date
                });
            }
            absoluteOffset += eps.length;
        }
    }

    return flattened;
}

function formatTmdbSeasonLabel(season: TmdbSeasonMeta): string {
    const name = season.name?.trim();
    if (name && !/^season\s*\d+$/i.test(name)) {
        return `Season ${season.season_number} · ${name}`;
    }
    return `Season ${season.season_number}`;
}

export function buildTmdbSeasonTabs(
    tmdbSeasons: TmdbSeasonMeta[],
    episodes: AnimeTmdbEpisode[] = []
): AnimeTmdbSeasonTab[] {
    const regular = tmdbSeasons
        .filter((s) => s.season_number > 0)
        .sort((a, b) => a.season_number - b.season_number);

    if (episodes.length) {
        const bySeason = new Map<number, number[]>();
        for (const ep of episodes) {
            const abs = ep.absolute_number ?? ep.episode_number;
            const list = bySeason.get(ep.season_number) ?? [];
            list.push(abs);
            bySeason.set(ep.season_number, list);
        }

        return regular
            .map((season) => {
                const abs = bySeason.get(season.season_number) ?? [];
                if (!abs.length) return null;
                return {
                    seasonNumber: season.season_number,
                    label: formatTmdbSeasonLabel(season),
                    firstEpisode: Math.min(...abs),
                    lastEpisode: Math.max(...abs)
                };
            })
            .filter((tab): tab is AnimeTmdbSeasonTab => tab !== null);
    }

    let offset = 0;
    return regular
        .map((season) => {
            const count = season.episode_count ?? 0;
            if (count <= 0) return null;
            const tab: AnimeTmdbSeasonTab = {
                seasonNumber: season.season_number,
                label: formatTmdbSeasonLabel(season),
                firstEpisode: offset + 1,
                lastEpisode: offset + count
            };
            offset += count;
            return tab;
        })
        .filter((tab): tab is AnimeTmdbSeasonTab => tab !== null);
}

export function estimateAnimeEpisodeTotal(
    tmdbEpisodes: AnimeTmdbEpisode[] = [],
    totalEpisodeCount = 0,
    anilistNextEpisode = 0
): number {
    const fromList = tmdbEpisodes.length
        ? Math.max(...tmdbEpisodes.map((ep) => ep.absolute_number ?? ep.episode_number))
        : 0;
    return Math.max(fromList, totalEpisodeCount, anilistNextEpisode, 1);
}

export function findAnimeEpisodeByAbsolute(
    absoluteEp: number,
    episodes: AnimeTmdbEpisode[]
): AnimeTmdbEpisode | undefined {
    return episodes.find(
        (ep) => (ep.absolute_number ?? ep.episode_number) === absoluteEp
    );
}

export function getAnimeTmdbSeasonEpisode(
    absoluteEp: number,
    episodes: AnimeTmdbEpisode[],
    seasonTabs: AnimeTmdbSeasonTab[] = []
): { season: number; episode: number } {
    const mapped = findAnimeEpisodeByAbsolute(absoluteEp, episodes);
    if (mapped) {
        return {
            season: mapped.season_number,
            episode: mapped.episode_in_season
        };
    }

    const tab = seasonTabs.find(
        (s) => absoluteEp >= s.firstEpisode && absoluteEp <= s.lastEpisode
    );
    if (tab) {
        return {
            season: tab.seasonNumber,
            episode: absoluteEp - tab.firstEpisode + 1
        };
    }

    return { season: 1, episode: absoluteEp };
}

export function findTmdbSeasonTabForEpisode(
    absoluteEp: number,
    seasonTabs: AnimeTmdbSeasonTab[] = []
): AnimeTmdbSeasonTab | undefined {
    return seasonTabs.find(
        (s) => absoluteEp >= s.firstEpisode && absoluteEp <= s.lastEpisode
    );
}

const VIDEASY_COLOR = 'E05A47';

/** @deprecated Use buildAnimeplayAnilistEmbedUrl from useAnimeplay */
export const buildAnimeplayEmbedUrl = buildAnimeplayAnilistEmbedUrl;

export function buildAnimeEmbedUrl(
    serverName: string,
    tmdbId: number,
    anilistId: number,
    absoluteEpisode: number,
    episodes: AnimeTmdbEpisode[],
    options: {
        lang?: 'sub' | 'dub';
        isMovie?: boolean;
        seasonTabs?: AnimeTmdbSeasonTab[];
        useAbsoluteAnimeEpisode?: boolean;
    } = {}
): string {
    const {
        lang = 'sub',
        isMovie = false,
        seasonTabs = [],
        useAbsoluteAnimeEpisode = false
    } = options;
    const { season, episode } = getAnimeTmdbSeasonEpisode(
        absoluteEpisode,
        episodes,
        seasonTabs
    );

    if (serverName === 'Barfi' || serverName === 'Videasy') {
        if (!tmdbId) return '';
        if (isMovie) {
            return `https://player.videasy.net/anime/${tmdbId}?color=${VIDEASY_COLOR}&autoplayNextEpisode=true&overlay=true`;
        }
        if (useAbsoluteAnimeEpisode) {
            return `https://player.videasy.net/anime/${tmdbId}/${absoluteEpisode}?color=${VIDEASY_COLOR}&autoplayNextEpisode=true&overlay=true&nextEpisode=true`;
        }
        return `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}?color=${VIDEASY_COLOR}&autoplayNextEpisode=true&overlay=true&nextEpisode=true`;
    }

    if (serverName === 'AnimePlay' || serverName === 'Shrikhand' || serverName === 'Rabri') {
        const tab = seasonTabs.find((s) => s.seasonNumber === season);
        const targetAnilistId = tab?.anilistId || anilistId;
        const targetEpisode = (tab && tab.anilistId && tab.anilistId !== anilistId) ? episode : absoluteEpisode;
        return buildAnimeplayAnilistEmbedUrl(targetAnilistId, targetEpisode, lang);
    }

    return '';
}
async function resolveAnilistFranchise(
    startId: number,
    startMedia?: any
): Promise<Array<{ id: number; title: string; year: number }>> {
    const visited = new Set<number>();
    const franchise: Array<{ id: number; title: string; year: number }> = [];
    const queue: Array<{ id: number; media?: any }> = [{ id: startId, media: startMedia }];

    while (queue.length > 0) {
        const item = queue.shift()!;
        if (visited.has(item.id)) continue;
        visited.add(item.id);

        let media = item.media;
        if (!media) {
            try {
                const query = `
                  query ($id: Int) {
                    Media(id: $id, type: ANIME) {
                      id
                      title {
                        romaji
                        english
                        native
                      }
                      seasonYear
                      format
                      episodes
                      relations {
                        edges {
                          relationType
                          node {
                            id
                            title {
                              romaji
                              english
                              native
                            }
                            type
                            format
                            seasonYear
                            episodes
                          }
                        }
                      }
                    }
                  }
                `;
                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, variables: { id: item.id } })
                });
                const json = await res.json();
                media = json?.data?.Media;
            } catch (err) {
                console.warn('Failed to fetch franchise media:', item.id, err);
            }
        }

        if (!media) continue;

        const titleStr = media.title?.english || media.title?.romaji || media.title?.native || '';
        franchise.push({
            id: media.id,
            title: titleStr,
            year: media.seasonYear || 0
        });

        const edges = media.relations?.edges || [];
        for (const edge of edges) {
            const node = edge.node;
            if (node.type === 'ANIME' && (edge.relationType === 'PREQUEL' || edge.relationType === 'SEQUEL')) {
                if (node.format === 'MOVIE' || node.format === 'MUSIC') continue;
                if (node.episodes != null && node.episodes <= 2) continue;
                if (!visited.has(node.id)) {
                    queue.push({ id: node.id });
                }
            }
        }
    }

    // Sort by year ascending, then by ID ascending
    return franchise.sort((a, b) => (a.year - b.year) || (a.id - b.id));
}

async function populateSeasonTabsAnilistIds(
    anilistId: number,
    media: any,
    artwork: AnimeTmdbArtwork
) {
    if (!artwork.seasonTabs.length) return;
    try {
        const franchise = await resolveAnilistFranchise(anilistId, media);
        const regularSeasons = artwork.seasonTabs;
        const sortedFranchise = [...franchise].sort((a, b) => (a.year - b.year) || (a.id - b.id));

        const len = Math.min(regularSeasons.length, sortedFranchise.length);
        for (let i = 0; i < len; i++) {
            regularSeasons[i].anilistId = sortedFranchise[i].id;
        }
    } catch (err) {
        console.warn('Failed to populate season tabs AniList IDs:', err);
    }
}

async function loadTmdbEpisodes(
    showId: number,
    _media: AnilistMediaFields,
    isMovie: boolean,
    tmdbSeasons: Array<{ season_number: number; episode_count?: number }> = [],
    _tmdbTotalEpisodes = 0
): Promise<AnimeTmdbEpisode[]> {
    if (isMovie) return [];
    return fetchFlattenedTmdbEpisodes(showId, tmdbSeasons);
}

async function resolveTmdbShowDetails(
    show: { id: number; poster_path?: string | null; backdrop_path?: string | null },
    media: AnilistMediaFields
): Promise<{
    posterPath: string | null;
    backdropPath: string | null;
    mediaType: 'movie' | 'tv';
    tmdbSeasons: TmdbSeasonMeta[];
    tmdbTotalEpisodes: number;
}> {
    const isMovie = media.format === 'MOVIE';
    const axios = useAxios();
    let posterPath = show.poster_path ?? null;
    let backdropPath = show.backdrop_path ?? null;
    let tmdbSeasons: Array<{ season_number: number; episode_count?: number }> = [];
    let tmdbTotalEpisodes = 0;

    if (isMovie) {
        const movieRes = await axios.get(`movie/${show.id}`);
        posterPath = movieRes?.data?.poster_path ?? posterPath;
        backdropPath = movieRes?.data?.backdrop_path ?? backdropPath;
    } else {
        const showRes = await axios.get(`tv/${show.id}`);
        posterPath = showRes?.data?.poster_path ?? posterPath;
        backdropPath = showRes?.data?.backdrop_path ?? backdropPath;
        tmdbSeasons = showRes?.data?.seasons || [];
        tmdbTotalEpisodes = showRes?.data?.number_of_episodes ?? 0;
    }

    return {
        posterPath,
        backdropPath,
        mediaType: isMovie ? 'movie' : 'tv',
        tmdbSeasons,
        tmdbTotalEpisodes
    };
}

/** Poster/backdrop only — used by browse grids; does not load or cache episodes. */
export async function resolveAnimeTmdbPosterOnly(
    anilistId: number,
    media: AnilistMediaFields
): Promise<Pick<AnimeTmdbArtwork, 'tmdbId' | 'posterPath' | 'backdropPath' | 'mediaType'> | null> {
    const cached = artworkCache.get(anilistId);
    if (cached?.posterPath) {
        return {
            tmdbId: cached.tmdbId,
            posterPath: cached.posterPath,
            backdropPath: cached.backdropPath,
            mediaType: cached.mediaType
        };
    }

    const show = await findAnimatedTmdbShow(media);
    if (!show?.id) return null;

    try {
        const details = await resolveTmdbShowDetails(show, media);
        const existing = artworkCache.get(anilistId);
        const partial = buildArtworkResult(
            show.id,
            media,
            details,
            existing?.episodes ?? [],
            existing?.episodesLoaded ?? false
        );
        artworkCache.set(anilistId, partial);
        return {
            tmdbId: show.id,
            posterPath: details.posterPath,
            backdropPath: details.backdropPath,
            mediaType: details.mediaType
        };
    } catch {
        return {
            tmdbId: show.id,
            posterPath: show.poster_path ?? null,
            backdropPath: show.backdrop_path ?? null,
            mediaType: media.format === 'MOVIE' ? 'movie' : 'tv'
        };
    }
}

function buildArtworkResult(
    showId: number,
    _media: AnilistMediaFields,
    details: {
        posterPath: string | null;
        backdropPath: string | null;
        mediaType: 'movie' | 'tv';
        tmdbTotalEpisodes: number;
        tmdbSeasons: TmdbSeasonMeta[];
    },
    episodes: AnimeTmdbEpisode[] = [],
    episodesLoaded = false
): AnimeTmdbArtwork {
    const usesTmdbSeasonTabs = details.mediaType === 'tv'
        && details.tmdbSeasons.filter((s) => s.season_number > 0).length > 1;
    const seasonTabs = usesTmdbSeasonTabs
        ? buildTmdbSeasonTabs(details.tmdbSeasons, episodes)
        : [];

    return {
        tmdbId: showId,
        mediaType: details.mediaType,
        posterPath: details.posterPath,
        backdropPath: details.backdropPath,
        totalEpisodeCount: details.tmdbTotalEpisodes,
        episodes,
        episodesLoaded,
        usesTmdbSeasonTabs,
        seasonTabs
    };
}

/** Fast path: poster, backdrop, and episode count only (one TMDB show lookup). */
export async function resolveAnimeTmdbMeta(
    anilistId: number,
    media: AnilistMediaFields
): Promise<AnimeTmdbArtwork | null> {
    const cached = artworkCache.get(anilistId);
    if (cached?.posterPath && (cached.totalEpisodeCount ?? 0) > 0) {
        return cached;
    }

    const show = await findAnimatedTmdbShow(media);
    if (!show?.id) {
        artworkCache.set(anilistId, null);
        return null;
    }

    try {
        const details = await resolveTmdbShowDetails(show, media);
        const result = buildArtworkResult(
            show.id,
            media,
            details,
            cached?.episodes ?? [],
            cached?.episodesLoaded ?? false
        );
        await populateSeasonTabsAnilistIds(anilistId, media, result);
        artworkCache.set(anilistId, result);
        return result;
    } catch (err) {
        console.warn('Failed to load TMDB anime meta:', err);
        return null;
    }
}

/** Loads full per-episode TMDB data; safe to call in the background. */
export async function resolveAnimeTmdbEpisodes(
    anilistId: number,
    media: AnilistMediaFields
): Promise<AnimeTmdbEpisode[]> {
    const cached = artworkCache.get(anilistId);
    if (cached?.episodesLoaded && cached.episodes.length > 0) {
        return cached.episodes;
    }

    const show = await findAnimatedTmdbShow(media);
    if (!show?.id) return [];

    const isMovie = media.format === 'MOVIE';
    if (isMovie) return [];

    try {
        const details = await resolveTmdbShowDetails(show, media);
        const episodes = await loadTmdbEpisodes(
            show.id,
            media,
            false,
            details.tmdbSeasons,
            details.tmdbTotalEpisodes
        );

        const existing = artworkCache.get(anilistId);
        const result = buildArtworkResult(
            show.id,
            media,
            details,
            episodes,
            episodes.length > 0
        );
        await populateSeasonTabsAnilistIds(anilistId, media, result);
        artworkCache.set(anilistId, {
            ...result,
            posterPath: existing?.posterPath ?? result.posterPath,
            backdropPath: existing?.backdropPath ?? result.backdropPath,
            seasonTabs: result.seasonTabs
        });
        return episodes;
    } catch (err) {
        console.warn('Failed to load TMDB anime episodes:', err);
        return cached?.episodes ?? [];
    }
}

export async function resolveAnimeTmdbArtwork(
    anilistId: number,
    media: AnilistMediaFields
): Promise<AnimeTmdbArtwork | null> {
    const meta = await resolveAnimeTmdbMeta(anilistId, media);
    if (!meta) return null;

    if (meta.episodesLoaded && meta.episodes.length > 0) {
        return meta;
    }

    const episodes = await resolveAnimeTmdbEpisodes(anilistId, media);
    const cached = artworkCache.get(anilistId);
    return cached ?? { ...meta, episodes, episodesLoaded: episodes.length > 0 };
}

/** Resolve TMDB poster paths for a browse grid (cached, limited concurrency). */
export async function resolveAnimeTmdbPosterBatch(
    items: Array<{ id: number } & AnilistMediaFields>
): Promise<Record<number, string>> {
    const out: Record<number, string> = {};
    const pending = items.filter((item) => {
        if (!item.id) return false;
        const cached = artworkCache.get(item.id);
        return !cached?.posterPath;
    });
    const chunkSize = 5;

    for (let i = 0; i < pending.length; i += chunkSize) {
        const chunk = pending.slice(i, i + chunkSize);
        const resolved = await Promise.all(
            chunk.map(async (item) => {
                const artwork = await resolveAnimeTmdbPosterOnly(item.id, item);
                return { id: item.id, posterPath: artwork?.posterPath || null };
            })
        );
        for (const row of resolved) {
            if (row.posterPath) out[row.id] = row.posterPath;
        }
    }

    for (const item of items) {
        const cached = artworkCache.get(item.id);
        if (cached?.posterPath && !out[item.id]) {
            out[item.id] = cached.posterPath;
        }
    }

    return out;
}

export function getCachedAnimeTmdbArtwork(anilistId: number): AnimeTmdbArtwork | null {
    return artworkCache.get(anilistId) ?? null;
}

export async function resolveAnimeTmdbMetaByTmdbId(
    tmdbId: number
): Promise<AnimeTmdbArtwork | null> {
    for (const [_, cached] of artworkCache.entries()) {
        if (cached && cached.tmdbId === tmdbId) {
            return cached;
        }
    }

    const axios = useAxios();
    try {
        const showRes = await axios.get(`tv/${tmdbId}`);
        const show = showRes?.data;
        if (!show) return null;

        const details = {
            posterPath: show.poster_path ?? null,
            backdropPath: show.backdrop_path ?? null,
            mediaType: 'tv' as const,
            tmdbTotalEpisodes: show.number_of_episodes ?? 0,
            tmdbSeasons: show.seasons || []
        };

        const mockMedia = {
            title: {
                english: show.name,
                romaji: show.original_name
            },
            format: 'TV'
        };

        const result = buildArtworkResult(
            tmdbId,
            mockMedia,
            details,
            [],
            false
        );

        const searchTitle = show.name || show.original_name;
        if (searchTitle) {
            try {
                const query = `
                  query ($search: String) {
                    Page(page: 1, perPage: 1) {
                      media(search: $search, type: ANIME, format_in: [TV, ONA, SPECIAL]) {
                        id
                        title {
                          romaji
                          english
                          native
                        }
                        seasonYear
                        format
                        episodes
                        relations {
                          edges {
                            relationType
                            node {
                              id
                              title {
                                romaji
                                english
                                native
                              }
                              type
                              format
                              seasonYear
                              episodes
                            }
                          }
                        }
                      }
                    }
                  }
                `;
                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, variables: { search: searchTitle } })
                });
                const json = await res.json();
                const matchedMedia = json?.data?.Page?.media?.[0];
                if (matchedMedia) {
                    await populateSeasonTabsAnilistIds(matchedMedia.id, matchedMedia, result);
                    artworkCache.set(matchedMedia.id, result);
                }
            } catch (err) {
                console.warn('Failed to search AniList for TMDB show:', searchTitle, err);
            }
        }

        return result;
    } catch (err) {
        console.warn('Failed to resolve TMDB anime meta by TMDB ID:', tmdbId, err);
        return null;
    }
}

export async function resolveAnimeTmdbEpisodesByTmdbId(
    tmdbId: number
): Promise<AnimeTmdbEpisode[]> {
    const axios = useAxios();
    try {
        const showRes = await axios.get(`tv/${tmdbId}`);
        const show = showRes?.data;
        if (!show) return [];

        const episodes = await fetchFlattenedTmdbEpisodes(tmdbId, show.seasons || []);
        const meta = await resolveAnimeTmdbMetaByTmdbId(tmdbId);
        if (meta) {
            meta.episodes = episodes;
            meta.episodesLoaded = episodes.length > 0;
            meta.seasonTabs = buildTmdbSeasonTabs(show.seasons || [], episodes);

            let matchedAnilistId = 0;
            for (const [aniId, cached] of artworkCache.entries()) {
                if (cached && cached.tmdbId === tmdbId) {
                    matchedAnilistId = aniId;
                    break;
                }
            }
            if (matchedAnilistId) {
                await populateSeasonTabsAnilistIds(matchedAnilistId, null, meta);
            }
        }

        return episodes;
    } catch (err) {
        console.warn('Failed to resolve TMDB episodes by TMDB ID:', tmdbId, err);
        return [];
    }
}

export function getAnilistIdForTmdbId(tmdbId: number): number | undefined {
    for (const [aniId, cached] of artworkCache.entries()) {
        if (cached && cached.tmdbId === tmdbId) {
            return aniId;
        }
    }
    return undefined;
}