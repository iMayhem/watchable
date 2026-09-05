import useAxios from './useAxios';
import { buildAnimeplayAnilistEmbedUrl, buildMegaplayAnilistEmbedUrl } from './useAnimeplay';
import { queryAniListApi } from './useAniList';

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

export type TmdbAnimeShowDetails = {
    id: number;
    name: string;
    original_name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    first_air_date?: string;
    vote_average?: number;
    status?: string;
    number_of_episodes?: number;
    genres?: Array<{ id: number; name: string }>;
    networks?: Array<{ name: string }>;
    seasons?: TmdbSeasonMeta[];
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
    /** TMDB season_number when AniList lists a sequel season separately. */
    preferredTmdbSeason?: number | null;
}

type AnilistMediaFields = {
    title?: {
        english?: string | null;
        romaji?: string | null;
        native?: string | null;
    };
    format?: string | null;
    seasonYear?: number | null;
    startDate?: {
        year?: number | null;
        month?: number | null;
        day?: number | null;
    } | null;
    synonyms?: string[] | null;
    episodes?: number | null;
    status?: string | null;
    nextAiringEpisode?: {
        episode?: number | null;
    } | null;
};

const artworkCache = new Map<number, AnimeTmdbArtwork | null>();
/** TMDB-keyed cache when AniList id mapping is not yet available. */
const tmdbOnlyCache = new Map<number, AnimeTmdbArtwork>();
const tmdbShowDetailsCache = new Map<number, TmdbAnimeShowDetails>();
const animePrefetchInFlight = new Set<number>();
const TMDB_SEARCH_CONFIDENCE = 88;
/** TMDB id → AniList id for video embeds only. */
const tmdbToAnilistPlaybackId = new Map<number, number>();
const ANIMATION_GENRE_ID = 16;

export function parseAnilistSeasonNumber(media: AnilistMediaFields): number | null {
    const parts = [
        media.title?.english,
        media.title?.romaji,
        media.title?.native,
        ...(media.synonyms ?? [])
    ]
        .filter(Boolean)
        .map(String);

    for (const part of parts) {
        const seasonAfter = part.match(/\b(?:season|part|cour)\s*(\d+)\b/i);
        if (seasonAfter) return Number(seasonAfter[1]);

        const seasonBefore = part.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/i);
        if (seasonBefore) return Number(seasonBefore[1]);

        const jpCour = part.match(/第(\d+)期/);
        if (jpCour) return Number(jpCour[1]);
    }
    return null;
}

function cleanAnimeTitle(title: string): string {
    return title
        .replace(/\([^)]*\)/g, '')
        .replace(/\b\d+(?:st|nd|rd|th)?\s*(?:season|part|cour)\b/gi, '')
        .replace(/\b(?:season|part|cour)\s*\d+\b/gi, '')
        .replace(/第\d+期/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function searchTitles(media: AnilistMediaFields): string[] {
    const raw = [
        media.title?.english,
        media.title?.romaji,
        media.title?.native,
        ...(media.synonyms ?? [])
    ].filter(Boolean).map((t) => String(t));

    const out: string[] = [];
    const seen = new Set<string>();
    for (const title of raw) {
        for (const variant of [title, cleanAnimeTitle(title)]) {
            const key = variant.toLowerCase();
            if (!variant || seen.has(key)) continue;
            seen.add(key);
            out.push(variant);
        }
    }
    return out;
}

type TmdbSearchHit = {
    id: number;
    poster_path?: string | null;
    backdrop_path?: string | null;
    genre_ids?: number[];
    first_air_date?: string;
    name?: string;
    original_name?: string;
};

function anilistTargetYear(media: AnilistMediaFields): number | null {
    if (media.seasonYear) return media.seasonYear;
    if (media.startDate?.year) return media.startDate.year;
    return null;
}

function hasRebootTitleHint(media: AnilistMediaFields): boolean {
    const blob = [
        media.title?.english,
        media.title?.romaji,
        media.title?.native,
        ...(media.synonyms ?? [])
    ]
        .filter(Boolean)
        .join(' ');
    return /shin|new|gou|sotsu|reboot|remake|\(新|新アニメ/i.test(blob);
}

function titleSimilarityScore(needle: string, names: string[]): number {
    if (!needle) return 0;
    let best = 0;
    for (const name of names) {
        if (!name) continue;
        if (name === needle) return 30;
        if (name.includes(needle) || needle.includes(name)) {
            best = Math.max(best, 20);
            continue;
        }
        const needleTokens = needle.split(/\s+/).filter((t) => t.length > 2);
        const matched = needleTokens.filter((token) => name.includes(token)).length;
        if (needleTokens.length) {
            best = Math.max(best, Math.round((matched / needleTokens.length) * 16));
        }
    }
    return best;
}

function scoreTmdbCandidate(
    hit: TmdbSearchHit,
    media: AnilistMediaFields,
    searchTitle: string
): number {
    let score = 0;
    if (hit.genre_ids?.includes(ANIMATION_GENRE_ID)) score += 50;

    const targetYear = anilistTargetYear(media);
    const airYear = hit.first_air_date
        ? parseInt(hit.first_air_date.slice(0, 4), 10)
        : null;
    const seasonHint = parseAnilistSeasonNumber(media);

    if (targetYear && airYear) {
        const yearDiff = Math.abs(targetYear - airYear);
        if (seasonHint && seasonHint > 1) {
            // Sequel seasons share one TMDB show; premiere year is often season 1.
            score += Math.max(0, 28 - yearDiff * 4);
        } else {
            score += Math.max(0, 40 - yearDiff * 8);
        }
    } else if (hasRebootTitleHint(media) && airYear && airYear >= 2018) {
        score += 30;
    } else if (airYear && !seasonHint) {
        // Long runners (e.g. One Piece): prefer the earliest animated match.
        score += Math.max(0, 24 - Math.floor((airYear - 1990) / 4));
    }

    const needle = cleanAnimeTitle(searchTitle).toLowerCase();
    const names = [hit.name, hit.original_name]
        .filter(Boolean)
        .map((name) => String(name).toLowerCase());
    score += titleSimilarityScore(needle, names);

    return score;
}

async function searchTmdbTitleVariant(
    title: string,
    searchType: 'movie' | 'tv',
    year: number | undefined,
    isMovie: boolean,
    media: AnilistMediaFields,
    axios: ReturnType<typeof useAxios>
): Promise<{ hit: TmdbSearchHit; score: number } | null> {
    const attempts: Record<string, string | number>[] = [{ query: title }];
    if (year && isMovie) {
        attempts.push({ query: title, year });
    }

    let best: TmdbSearchHit | null = null;
    let bestScore = -1;

    for (const params of attempts) {
        const res = await axios.get(`search/${searchType}`, { params });
        const results = (res?.data?.results || []) as TmdbSearchHit[];
        if (!results.length) continue;

        const animated = results.filter((row) =>
            row.genre_ids?.includes(ANIMATION_GENRE_ID)
        );
        const pool = animated.length ? animated : results;

        for (const hit of pool) {
            const score = scoreTmdbCandidate(hit, media, title);
            if (score > bestScore) {
                bestScore = score;
                best = hit;
            }
        }
    }

    return best?.id ? { hit: best, score: bestScore } : null;
}

async function findAnimatedTmdbShow(
    media: AnilistMediaFields
): Promise<{ id: number; poster_path?: string | null; backdrop_path?: string | null } | null> {
    const isMovie = media.format === 'MOVIE';
    const searchType = isMovie ? 'movie' : 'tv';
    const year = media.seasonYear || media.startDate?.year || undefined;
    const axios = useAxios();
    const titles = searchTitles(media);

    let best: TmdbSearchHit | null = null;
    let bestScore = -1;
    const chunkSize = 3;

    for (let i = 0; i < titles.length; i += chunkSize) {
        const chunk = titles.slice(i, i + chunkSize);
        const rows = await Promise.all(
            chunk.map((title) =>
                searchTmdbTitleVariant(title, searchType, year, isMovie, media, axios)
            )
        );

        for (const row of rows) {
            if (!row) continue;
            if (row.score > bestScore) {
                bestScore = row.score;
                best = row.hit;
            }
        }

        if (bestScore >= TMDB_SEARCH_CONFIDENCE) break;
    }

    return best?.id ? best : null;
}

export function resolvePreferredTmdbSeason(
    artwork: AnimeTmdbArtwork | null | undefined,
    anilistId?: number | null
): number | null {
    const direct = artwork?.preferredTmdbSeason;
    if (direct && direct > 0) return direct;
    if (!anilistId) return null;
    const cached = artworkCache.get(anilistId);
    const hinted = cached?.preferredTmdbSeason;
    return hinted && hinted > 0 ? hinted : null;
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

    if (serverName === 'Sugar' || serverName === 'Rabri') {
        const tab = seasonTabs.find((s) => s.seasonNumber === season);
        const targetAnilistId = tab?.anilistId || anilistId;
        const targetEpisode = (tab && tab.anilistId && tab.anilistId !== anilistId) ? episode : absoluteEpisode;
        return buildMegaplayAnilistEmbedUrl(targetAnilistId, targetEpisode, lang);
    }

    if (serverName === 'AnimePlay' || serverName === 'Shrikhand') {
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
            try {
                const payload = await queryAniListApi(query, { id: item.id });
                media = payload?.data?.Media;
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
        const data = showRes?.data;
        if (data) {
            cacheTmdbShowDetails(data);
            posterPath = data.poster_path ?? posterPath;
            backdropPath = data.backdrop_path ?? backdropPath;
            tmdbSeasons = data.seasons || [];
            tmdbTotalEpisodes = data.number_of_episodes ?? 0;
        }
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
    media: AnilistMediaFields | undefined,
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
        seasonTabs,
        preferredTmdbSeason: media ? parseAnilistSeasonNumber(media) : null
    };
}

type ResolveAnimeTmdbMetaOptions = {
    deferFranchise?: boolean;
};

/** Fast path: poster, backdrop, and episode count only (one TMDB show lookup). */
export async function resolveAnimeTmdbMeta(
    anilistId: number,
    media: AnilistMediaFields,
    options: ResolveAnimeTmdbMetaOptions = {}
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
        if (options.deferFranchise) {
            void populateSeasonTabsAnilistIds(anilistId, media, result);
        } else {
            await populateSeasonTabsAnilistIds(anilistId, media, result);
        }
        artworkCache.set(anilistId, result);
        return result;
    } catch (err) {
        console.warn('Failed to load TMDB anime meta:', err);
        return null;
    }
}

/** Warm TMDB mapping + artwork on browse hover (best-effort). */
export function prefetchAnimeTmdbArtwork(
    anilistId: number,
    media: AnilistMediaFields
): void {
    if (!anilistId || animePrefetchInFlight.has(anilistId)) return;

    const cached = artworkCache.get(anilistId);
    if (cached?.tmdbId && cached.posterPath) return;

    animePrefetchInFlight.add(anilistId);
    void resolveAnimeTmdbMeta(anilistId, media, { deferFranchise: true })
        .catch(() => null)
        .finally(() => {
            animePrefetchInFlight.delete(anilistId);
        });
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
        let show = tmdbShowDetailsCache.get(tmdbId) ?? null;
        if (!show) {
            const showRes = await axios.get(`tv/${tmdbId}`);
            show = showRes?.data ?? null;
            if (show) cacheTmdbShowDetails(show);
        }
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
            try {
                const payload = await queryAniListApi(query, { search: searchTitle });
                    const matchedMedia = payload?.data?.Page?.media?.[0];
                    if (matchedMedia) {
                        registerTmdbAnilistPlaybackId(tmdbId, matchedMedia.id);
                        await populateSeasonTabsAnilistIds(matchedMedia.id, matchedMedia, result);
                        artworkCache.set(matchedMedia.id, result);
                    }
                } catch (err) {
                    console.warn('Failed to search AniList for TMDB show:', searchTitle, err);
                }
        }

        if (result.tmdbId) {
            tmdbOnlyCache.set(result.tmdbId, result);
        }
        return result;
    } catch (err) {
        console.warn('Failed to resolve TMDB anime meta by TMDB ID:', tmdbId, err);
        return null;
    }
}

function cacheTmdbShowDetails(show: TmdbAnimeShowDetails): void {
    if (!show?.id) return;
    tmdbShowDetailsCache.set(show.id, show);
}

export async function fetchTmdbAnimeShowDetails(
    tmdbId: number
): Promise<TmdbAnimeShowDetails | null> {
    const cached = tmdbShowDetailsCache.get(tmdbId);
    if (cached) return cached;

    const axios = useAxios();
    try {
        const res = await axios.get(`tv/${tmdbId}`);
        const data = res?.data ?? null;
        if (data) cacheTmdbShowDetails(data);
        return data;
    } catch (err) {
        console.warn('Failed to fetch TMDB anime show details:', tmdbId, err);
        return null;
    }
}

/** Resolve route id (AniList or TMDB) to canonical TMDB id + AniList id for embed playback. */
export async function resolveAnimeRouteIds(
    routeId: number,
    lookupAnilistMedia: (id: number) => Promise<AnilistMediaFields & { id: number } | null>
): Promise<{ tmdbId: number; anilistId: number | null }> {
    const cachedAnilist = artworkCache.get(routeId);
    if (cachedAnilist?.tmdbId) {
        return { tmdbId: cachedAnilist.tmdbId, anilistId: routeId };
    }

    const anilistMedia = await lookupAnilistMedia(routeId).catch(() => null);
    if (anilistMedia?.id) {
        const meta = await resolveAnimeTmdbMeta(anilistMedia.id, anilistMedia, {
            deferFranchise: true
        });
        const tmdbId = meta?.tmdbId ?? routeId;
        registerTmdbAnilistPlaybackId(tmdbId, anilistMedia.id);
        return {
            tmdbId,
            anilistId: anilistMedia.id
        };
    }

    await resolveAnimeTmdbMetaByTmdbId(routeId);
    const anilistId = getAnilistIdForTmdbId(routeId) ?? null;
    if (anilistId) {
        registerTmdbAnilistPlaybackId(routeId, anilistId);
    }
    return {
        tmdbId: routeId,
        anilistId
    };
}

/** AniList id for video embeds only — never used for detail UI. */
export async function resolveAnilistIdForPlayback(tmdbId: number): Promise<number | null> {
    const existing = getAnilistIdForTmdbId(tmdbId);
    if (existing) return existing;

    await resolveAnimeTmdbMetaByTmdbId(tmdbId);
    const afterMeta = getAnilistIdForTmdbId(tmdbId);
    if (afterMeta) return afterMeta;

    return searchAnilistIdForTmdbShow(tmdbId);
}



export async function resolveAnimeTmdbEpisodesByTmdbId(
    tmdbId: number
): Promise<AnimeTmdbEpisode[]> {
    const axios = useAxios();
    try {
        let show = tmdbShowDetailsCache.get(tmdbId) ?? null;
        if (!show) {
            const showRes = await axios.get(`tv/${tmdbId}`);
            show = showRes?.data ?? null;
            if (show) cacheTmdbShowDetails(show);
        }
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

export function registerTmdbAnilistPlaybackId(tmdbId: number, anilistId: number): void {
    if (!tmdbId || !anilistId) return;
    tmdbToAnilistPlaybackId.set(tmdbId, anilistId);

    const existing = artworkCache.get(anilistId);
    if (existing) {
        artworkCache.set(anilistId, { ...existing, tmdbId });
        return;
    }

    const tmdbCached = tmdbOnlyCache.get(tmdbId);
    if (tmdbCached) {
        artworkCache.set(anilistId, { ...tmdbCached, tmdbId });
    }
}

export function getAnilistIdForTmdbId(tmdbId: number): number | undefined {
    const direct = tmdbToAnilistPlaybackId.get(tmdbId);
    if (direct) return direct;

    for (const [aniId, cached] of artworkCache.entries()) {
        if (cached && cached.tmdbId === tmdbId) {
            return aniId;
        }
    }
    return undefined;
}

async function searchAnilistIdForTmdbShow(tmdbId: number): Promise<number | null> {
    const show = await fetchTmdbAnimeShowDetails(tmdbId);
    if (!show) return null;

    const year = show.first_air_date
        ? parseInt(show.first_air_date.slice(0, 4), 10)
        : undefined;
    const titles = [...new Set(
        [show.name, show.original_name]
            .filter(Boolean)
            .map((title) => cleanAnimeTitle(String(title)))
    )];

    for (const search of titles) {
        const query = `
          query ($search: String, $year: Int) {
            Page(page: 1, perPage: 5) {
              media(
                search: $search,
                type: ANIME,
                format_in: [TV, ONA, SPECIAL, MOVIE],
                seasonYear: $year
              ) {
                id
                seasonYear
                format
              }
            }
          }
        `;
        try {
            const payload = await queryAniListApi(query, { search, year: year || null });
            const candidates = payload?.data?.Page?.media || [];
            if (!candidates.length) continue;

            const hit = (year
                ? candidates.find((row: { seasonYear?: number | null }) => row.seasonYear === year)
                : null) || candidates[0];
            if (hit?.id) {
                registerTmdbAnilistPlaybackId(tmdbId, hit.id);
                return hit.id;
            }
        } catch (err) {
            console.warn('Failed to search AniList for TMDB show:', search, err);
        }
    }

    return null;
}

export function getCachedTmdbArtworkByTmdbId(tmdbId: number): AnimeTmdbArtwork | null {
    const direct = tmdbOnlyCache.get(tmdbId);
    if (direct) return direct;
    for (const cached of artworkCache.values()) {
        if (cached?.tmdbId === tmdbId) return cached;
    }
    return null;
}

