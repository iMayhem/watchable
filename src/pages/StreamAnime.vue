<template>
    <div class="watch-stage">
        <header class="watch-stage__chrome">
            <div class="watch-stage__chrome-inner">
                <div class="watch-stage__crumb">
                    <button
                        type="button"
                        class="watch-stage__back"
                        aria-label="Back to anime"
                        @click="goBack"
                    >
                        <ArrowLeft />
                    </button>
                    <p class="eyebrow">Now projecting</p>
                </div>

                <div class="watch-stage__title-block">
                    <h1 v-if="tmdbShow" class="watch-stage__title">{{ animeTitle }}</h1>
                    <span v-else class="watch-stage__title-skeleton" aria-hidden="true" />
                    <div class="watch-stage__episode-nav">
                        <button
                            type="button"
                            class="watch-stage__nav-btn"
                            :disabled="currentEpisode <= seasonFirstEpisode"
                            @click="goToPreviousEpisode"
                            aria-label="Previous Episode"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                        <p class="meta watch-stage__code">
                            Episode {{ getEpisodeInSeasonNumber(currentEpisode) }}
                        </p>
                        <button
                            type="button"
                            class="watch-stage__nav-btn"
                            :disabled="isLastEpisode"
                            @click="goToNextEpisode"
                            aria-label="Next Episode"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="watch-stage__actions">
                    <details
                        v-if="seasonsList.length > 1 || availableServers[activeServerIndex]?.name !== 'Videasy'"
                        class="watch-stage__options"
                    >
                        <summary class="watch-stage__options-trigger">
                            <span>Options</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </summary>

                        <div class="watch-stage__options-menu">
                            <div v-if="seasonsList.length > 1" class="watch-stage__option-group">
                                <label class="eyebrow watch-stage__option-label" for="anime-season-select">
                                    Season / Arc
                                </label>
                                <select
                                    id="anime-season-select"
                                    :value="activeSeasonSelectValue"
                                    class="watch-stage__option-select"
                                    @change="goToSeason(Number(($event.target as HTMLSelectElement).value))"
                                >
                                    <option
                                        v-for="s in seasonsList"
                                        :key="s.id"
                                        :value="s.id"
                                    >
                                        {{ s.label }}
                                    </option>
                                </select>
                            </div>

                            <div
                                v-if="availableServers[activeServerIndex]?.name !== 'Videasy'"
                                class="watch-stage__option-group"
                            >
                                <p class="eyebrow watch-stage__option-label">Language Pref</p>
                                <div class="watch-stage__language-tabs">
                                    <button
                                        type="button"
                                        class="watch-stage__language-btn"
                                        :class="{ 'is-active': activeLanguage === 'sub' }"
                                        @click="activeLanguage = 'sub'"
                                    >
                                        Subtitled
                                    </button>
                                    <button
                                        type="button"
                                        class="watch-stage__language-btn"
                                        :class="{ 'is-active': activeLanguage === 'dub' }"
                                        @click="activeLanguage = 'dub'"
                                    >
                                        Dubbed
                                    </button>
                                </div>
                            </div>
                        </div>
                    </details>

                    <!-- Mobile and Tablet direct sub/dub toggle button -->
                    <div
                        v-if="availableServers[activeServerIndex]?.name !== 'Videasy'"
                        class="watch-stage__lang-toggle"
                    >
                        <button
                            type="button"
                            class="watch-stage__lang-btn"
                            :class="{ 'is-active': activeLanguage === 'sub' }"
                            @click="activeLanguage = 'sub'"
                        >
                            SUB
                        </button>
                        <button
                            type="button"
                            class="watch-stage__lang-btn"
                            :class="{ 'is-active': activeLanguage === 'dub' }"
                            @click="activeLanguage = 'dub'"
                        >
                            DUB
                        </button>
                    </div>

                    <ServerAccordion
                        variant="dropdown"
                        :servers="availableServers"
                        :active-server-index="activeServerIndex"
                        @server-change="activeServerIndex = $event"
                    />

                    <a
                        v-if="tmdbShow && partyHref"
                        :href="partyHref"
                        class="watch-stage__party-btn"
                        title="Watch Together with friends!"
                        rel="nofollow"
                        @click.prevent="handleWatchTogether"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="watch-stage__party-icon">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span class="button-text">Watch Together</span>
                    </a>
                </div>
            </div>
        </header>

        <main class="watch-stage__main" id="main">
            <div class="watch-stage__theater">
                <div class="watch-stage__player-container">
                    <StreamFrame
                        :embed-url="currentEmbedUrl"
                        :title="animeTitle || 'Anime Player'"
                        :backdrop-path="tmdbBackdropPath"
                        :poster-path="tmdbPosterPath"
                        :media-id="resolvedAnilistId || animeId"
                        media-type="anime"
                        :embed-provider="isAnimeplayServer ? 'animeplay' : 'default'"
                        :episode="currentEpisode"
                        @switch-to-server="activeServerIndex = $event"
                    />
                </div>

            </div>

            <section v-if="availableSeasons.length" class="watch-stage__rack">
                <EpisodeNavigator
                    :show-id="animeId"
                    media-type="anime"
                    :available-seasons="availableSeasons"
                    :season-episodes="seasonEpisodes"
                    :current-season="navigatorSeason"
                    :current-episode="currentEpisode"
                    :is-loading-episodes="isLoadingEpisodes"
                    @season-change="onSeasonChange"
                    @select="changeEpisode"
                    @previous="goToPreviousEpisode"
                    @next="goToNextEpisode"
                />

                <div v-if="nextAiringInfo" class="episode-navigator__upcoming">
                    <div class="upcoming-badge">
                        <span class="upcoming-badge__pulse" />
                        Next Episode
                    </div>
                    <span class="upcoming-text">
                        <strong>Episode {{ nextAiringInfo.episode }}</strong>
                        <span v-if="nextAiringInfo.name && nextAiringInfo.name !== `Episode ${nextAiringInfo.episode}`">
                            ("{{ nextAiringInfo.name }}")
                        </span>
                        airs on {{ nextAiringInfo.dateString }}.
                    </span>
                </div>
            </section>



            <section v-if="animeId" class="watch-stage__rack">
                <CommentsSection :media-id="animeId" media-type="anime" />
            </section>
        </main>

        <UpNextDrawer
            v-if="tmdbShow && availableSeasons.length"
            :current-season="navigatorSeason"
            :current-episode="currentEpisode"
            :season-episodes="seasonEpisodes"
            :next-season-number="nextSeasonNumber"
            :next-season-episodes="nextSeasonEpisodes"
            :is-loading="isLoadingEpisodes"
            :seasons="seasonsDropdownList"
            :preview-episodes="previewEpisodes"
            :is-preview-loading="isPreviewLoading"
            @select="onUpNextSelect"
            @season-change="onUpNextSeasonChange"
            @preview-season="onPreviewSeason"
        />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAniList } from '../composables/useAniList';
import { saveProgress } from '../composables/useProgress';
import { addViewedItem } from '../composables/useHistory';
import { Server } from '../composables/useStream';
import { Episode } from '../composables/useTvShows';
import StreamFrame from '../components/player/StreamFrame.vue';
import ServerAccordion from '../components/player/ServerAccordion.vue';
import EpisodeNavigator from '../components/player/EpisodeNavigator.vue';
import UpNextDrawer from '../components/player/UpNextDrawer.vue';
import ArrowLeft from '../components/svg/outline/arrow-left-long.vue';
import { useAppPaths } from '../composables/useAppPaths';
import CommentsSection from '../components/player/CommentsSection.vue';
import {
    partitionStreamSeasonEpisodes,
    sortEpisodes,
    type EpisodeLike
} from '../utils/episodeAvailability';
import { resolveAnimeplayStreamEpisode } from '../composables/useAnimeplay';
import {
    buildAnimeEmbedUrl,
    estimateAnimeEpisodeTotal,
    findTmdbSeasonTabForEpisode,
    getCachedAnimeTmdbArtwork,
    getCachedTmdbArtworkByTmdbId,
    resolveAnimeRouteIds,
    resolveAnilistIdForPlayback,
    resolveAnimeTmdbEpisodesByTmdbId,
    resolveAnimeTmdbMetaByTmdbId,
    resolvePreferredTmdbSeason,
    fetchTmdbAnimeShowDetails,
    type AnimeTmdbArtwork,
    type AnimeTmdbEpisode,
    type TmdbAnimeShowDetails
} from '../composables/useAnimeTmdbArtwork';
import { useWebImage } from '../utils/useWebImage';
import { buildStreamPartyHref } from '../utils/partyRoom';

export default defineComponent({
    name: 'StreamAnime',
    components: {
        ArrowLeft,
        ServerAccordion,
        StreamFrame,
        EpisodeNavigator,
        UpNextDrawer,
        CommentsSection
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const paths = useAppPaths();
        const { fetchAnimeById } = useAniList();

        const animeId = ref<number>(Number(route.params.id));
        const tmdbShow = ref<TmdbAnimeShowDetails | null>(null);
        const anilistIdRef = ref<number | null>(null);
        const anilistPlaybackMeta = ref<{
            status?: string | null;
            nextAiringEpisode?: { episode?: number | null } | null;
        } | null>(null);
        const currentEpisode = ref<number>(1);
        const activeServerIndex = ref<number>(0);
        const activeLanguage = ref<'sub' | 'dub'>('sub');
        const suppressRouteReload = ref(false);
        let loadGeneration = 0;

        const tmdbArtwork = ref<AnimeTmdbArtwork | null>(null);
        const isLoadingTmdb = ref(false);
        const isLoadingEpisodes = ref(false);
        const seasonEpisodes = ref<Episode[]>([]);
        const nextSeasonEpisodes = ref<Episode[]>([]);
        const nextAiringEpisode = ref<Episode | null>(null);
        const activeTmdbSeason = ref(1);

        const usesTmdbSeasonTabs = computed(() => tmdbArtwork.value?.usesTmdbSeasonTabs ?? false);

        const tmdbEpisodes = computed(() => tmdbArtwork.value?.episodes ?? []);

        const tmdbPosterPath = computed(() => {
            const path = tmdbArtwork.value?.posterPath;
            return path ? useWebImage(path, 'medium') : '';
        });

        const tmdbBackdropPath = computed(() => {
            const path = tmdbArtwork.value?.backdropPath || tmdbArtwork.value?.posterPath;
            return path ? useWebImage(path, 'large') : '';
        });

        const browsableTmdbEpisodes = computed(() => sortEpisodes(tmdbEpisodes.value));

        const getEpisodeInSeasonNumber = (epNum: number) => {
            const match = tmdbEpisodes.value.find(e => e.episode_number === epNum);
            return match ? match.episode_in_season : epNum;
        };

        const animeTitle = computed(() => tmdbShow.value?.name || '');

        const availableServers: Server[] = [
            { name: 'Shrikhand', urlTemplate: 'https://animeplay.cfd/stream/ani/{id}/{episode}/{lang}' },
            { name: 'Rabri', urlTemplate: 'https://megaplay.buzz/stream/ani/{id}/{episode}/{lang}' },
            { name: 'Barfi', urlTemplate: 'https://player.videasy.net/anime/{id}/{episode}?color=E05A47&autoplayNextEpisode=true&overlay=true' }
        ];

        const isAnimeplayServer = computed(() => {
            const server = availableServers[activeServerIndex.value];
            return server?.name === 'Shrikhand' || server?.name === 'Rabri';
        });

        const globalMaxEpisode = computed(() =>
            estimateAnimeEpisodeTotal(
                tmdbEpisodes.value,
                tmdbArtwork.value?.totalEpisodeCount ?? 0,
                anilistPlaybackMeta.value?.nextAiringEpisode?.episode ?? 0
            )
        );



        const syncSeasonTabForEpisode = (ep: number) => {
            if (!usesTmdbSeasonTabs.value) return;
            const tab = findTmdbSeasonTabForEpisode(ep, tmdbArtwork.value?.seasonTabs ?? []);
            if (tab) activeTmdbSeason.value = tab.seasonNumber;
        };

        const activeTmdbSeasonTab = computed(() => {
            if (!usesTmdbSeasonTabs.value) return null;
            return tmdbArtwork.value?.seasonTabs.find((tab) => tab.seasonNumber === activeTmdbSeason.value) ?? null;
        });

        const seasonEpisodeBounds = computed(() => {
            if (usesTmdbSeasonTabs.value && activeTmdbSeasonTab.value) {
                return {
                    first: activeTmdbSeasonTab.value.firstEpisode,
                    last: activeTmdbSeasonTab.value.lastEpisode
                };
            }
            const total = estimateAnimeEpisodeTotal(
                tmdbEpisodes.value,
                tmdbArtwork.value?.totalEpisodeCount ?? 0
            );
            return { first: 1, last: total };
        });

        const seasonFirstEpisode = computed(() => seasonEpisodeBounds.value.first);
        const seasonLastEpisode = computed(() => seasonEpisodeBounds.value.last);

        const totalEpisodes = computed(() => {
            if (isLoadingTmdb.value && !tmdbArtwork.value?.totalEpisodeCount && !tmdbEpisodes.value.length) {
                return 0;
            }
            return seasonLastEpisode.value - seasonFirstEpisode.value + 1;
        });

        const availableSeasons = computed(() => {
            if (!tmdbShow.value && !tmdbArtwork.value) return [];
            if (usesTmdbSeasonTabs.value && tmdbArtwork.value?.seasonTabs.length) {
                return tmdbArtwork.value.seasonTabs.map((tab) => ({
                    id: tab.seasonNumber,
                    season_number: tab.seasonNumber,
                    episode_count: tab.lastEpisode - tab.firstEpisode + 1,
                    name: tab.label
                }));
            }
            return [{
                id: 1,
                season_number: 1,
                episode_count: globalMaxEpisode.value,
                name: 'Episodes'
            }];
        });

        const nextAiringInfo = computed(() => {
            if (!nextAiringEpisode.value) return null;
            const ep = nextAiringEpisode.value;
            const date = new Date(ep.air_date);
            const dateString = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            return {
                episode: ep.episode_number,
                dateString,
                name: ep.name
            };
        });

        const navigatorSeason = computed(() =>
            usesTmdbSeasonTabs.value ? activeTmdbSeason.value : 1
        );

        const isNavigatingToParty = ref(false);

        const embedEpisode = computed(() => {
            if (!isAnimeplayServer.value) return currentEpisode.value;
            return resolveAnimeplayStreamEpisode(
                currentEpisode.value,
                anilistPlaybackMeta.value,
                globalMaxEpisode.value
            );
        });

        const currentEmbedUrl = computed(() => {
            if (isNavigatingToParty.value || !animeId.value || !anilistIdRef.value) return '';
            const server = availableServers[activeServerIndex.value];
            const isMovie = tmdbArtwork.value?.mediaType === 'movie' || totalEpisodes.value === 1;

            return buildAnimeEmbedUrl(
                server.name,
                animeId.value,
                anilistIdRef.value,
                embedEpisode.value,
                tmdbEpisodes.value,
                {
                    lang: activeLanguage.value,
                    isMovie,
                    seasonTabs: tmdbArtwork.value?.seasonTabs ?? []
                }
            );
        });

        const resolvedAnilistId = computed(() => anilistIdRef.value);

        const partyHref = computed(() => {
            const anilistId = resolvedAnilistId.value;
            if (!anilistId) return '';
            return buildStreamPartyHref({
                id: anilistId,
                partyId: anilistId,
                title: `${animeTitle.value} - Episode ${currentEpisode.value}`,
                type: 'anime',
                episode: currentEpisode.value
            });
        });

        const seasonsList = computed(() => {
            if (!usesTmdbSeasonTabs.value || !tmdbArtwork.value?.seasonTabs.length) return [];
            return tmdbArtwork.value.seasonTabs.map((tab) => ({
                id: tab.seasonNumber,
                label: tab.label
            }));
        });

        const activeSeasonSelectValue = computed(() => activeTmdbSeason.value);

        const seasonsDropdownList = computed(() => {
            return availableSeasons.value.map((s) => ({
                number: s.season_number,
                label: s.name || `Season ${s.season_number}`
            }));
        });

        const goToSeason = (id: number) => {
            activeTmdbSeason.value = id;
            const tab = tmdbArtwork.value?.seasonTabs.find((s) => s.seasonNumber === id);
            if (tab) goToEpisode(tab.firstEpisode);
        };

        const onSeasonChange = async (seasonNum: number) => {
            if (navigatorSeason.value === seasonNum) {
                await loadSeason();
                return;
            }
            activeTmdbSeason.value = seasonNum;
            const tab = tmdbArtwork.value?.seasonTabs.find((s) => s.seasonNumber === seasonNum);
            currentEpisode.value = tab?.firstEpisode ?? 1;
            syncSeasonTabForEpisode(currentEpisode.value);
            await loadSeason();
        };

        const applyTmdbArtwork = (
            cached: AnimeTmdbArtwork | null,
            generation: number,
            anilistHintId?: number | null
        ) => {
            if (generation !== loadGeneration) return;
            if (!cached) return;
            tmdbArtwork.value = cached;

            const preferredSeason = resolvePreferredTmdbSeason(cached, anilistHintId);
            if (preferredSeason) {
                activeTmdbSeason.value = preferredSeason;
            }

            if (cached.usesTmdbSeasonTabs && cached.seasonTabs.length) {
                const tabs = cached.seasonTabs;
                const preferredTab = preferredSeason
                    ? tabs.find((tab) => tab.seasonNumber === preferredSeason)
                    : null;
                if (preferredTab) {
                    activeTmdbSeason.value = preferredTab.seasonNumber;
                } else {
                    syncSeasonTabForEpisode(currentEpisode.value);
                    const activeTab = tabs.find((tab) => tab.seasonNumber === activeTmdbSeason.value);
                    if (!activeTab) {
                        activeTmdbSeason.value = tabs[0].seasonNumber;
                    }
                }
            }
        };

        const loadTmdbArtworkByTmdbId = async (tmdbId: number, generation: number) => {
            isLoadingTmdb.value = true;
            let meta: Awaited<ReturnType<typeof resolveAnimeTmdbMetaByTmdbId>> = null;
            try {
                meta = await resolveAnimeTmdbMetaByTmdbId(tmdbId);
                if (generation !== loadGeneration) return;
                if (meta) {
                    applyTmdbArtwork(meta, generation, anilistIdRef.value);
                }
            } catch (err) {
                console.error('Failed to fetch TMDB meta for anime:', err);
                if (generation === loadGeneration) {
                    tmdbArtwork.value = null;
                }
            } finally {
                if (generation === loadGeneration) {
                    isLoadingTmdb.value = false;
                }
            }

            try {
                let episodes = await resolveAnimeTmdbEpisodesByTmdbId(tmdbId);
                if (generation !== loadGeneration) return;

                if (!episodes.length) {
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    if (generation !== loadGeneration) return;
                    episodes = await resolveAnimeTmdbEpisodesByTmdbId(tmdbId);
                }
                if (generation !== loadGeneration) return;

                applyTmdbArtwork(
                    getCachedTmdbArtworkByTmdbId(tmdbId) || meta,
                    generation,
                    anilistIdRef.value
                );
                if (generation === loadGeneration) {
                    await loadSeason();
                }
            } catch (err) {
                console.error('Failed to fetch TMDB episodes for anime:', err);
                if (generation === loadGeneration) {
                    seasonEpisodes.value = [];
                    isLoadingEpisodes.value = false;
                }
            }
        };

        const loadAnilistPlaybackMeta = async (anilistId: number) => {
            try {
                const response = await fetchAnimeById(anilistId);
                const media = response?.data?.Media;
                if (media) {
                    anilistPlaybackMeta.value = {
                        status: media.status,
                        nextAiringEpisode: media.nextAiringEpisode
                    };
                }
            } catch (err) {
                console.warn('Failed to load AniList playback meta:', err);
            }
        };

        const parseAnilistIdFromRoute = (): number | null => {
            const raw = route.query.ani;
            const value = Array.isArray(raw) ? raw[0] : raw;
            const parsed = Number(value);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        };

        const loadAnime = async (routeId: number) => {
            const generation = ++loadGeneration;
            seasonEpisodes.value = [];
            nextSeasonEpisodes.value = [];
            nextAiringEpisode.value = null;
            try {
                const { tmdbId: resolvedTmdbId, anilistId } = await resolveAnimeRouteIds(routeId, async (id) => {
                    try {
                        const res = await fetchAnimeById(id);
                        return res?.data?.Media ?? null;
                    } catch {
                        return null;
                    }
                });
                if (generation !== loadGeneration) return;

                let tmdbId = resolvedTmdbId;
                animeId.value = tmdbId;
                anilistIdRef.value = anilistId || parseAnilistIdFromRoute();

                if (tmdbId !== routeId) {
                    suppressRouteReload.value = true;
                    await router.replace(
                        paths.streamAnime(tmdbId, currentEpisode.value, anilistIdRef.value)
                    );
                }

                if (!anilistIdRef.value) {
                    anilistIdRef.value = await resolveAnilistIdForPlayback(tmdbId);
                }
                if (generation !== loadGeneration) return;

                await loadTmdbArtworkByTmdbId(tmdbId, generation);
                if (generation !== loadGeneration) return;

                if (!tmdbArtwork.value?.tmdbId && anilistIdRef.value) {
                    const cached = getCachedAnimeTmdbArtwork(anilistIdRef.value);
                    if (cached?.tmdbId && cached.tmdbId !== tmdbId) {
                        tmdbId = cached.tmdbId;
                        animeId.value = tmdbId;
                        if (tmdbId !== routeId) {
                            suppressRouteReload.value = true;
                            await router.replace(
                                paths.streamAnime(tmdbId, currentEpisode.value, anilistIdRef.value)
                            );
                        }
                        await loadTmdbArtworkByTmdbId(tmdbId, generation);
                        if (generation !== loadGeneration) return;
                    }
                }

                const show = await fetchTmdbAnimeShowDetails(tmdbId);
                if (generation !== loadGeneration) return;

                if (show) {
                    tmdbShow.value = show;
                } else if (tmdbArtwork.value) {
                    tmdbShow.value = {
                        id: tmdbId,
                        name: `Anime #${tmdbId}`,
                        poster_path: tmdbArtwork.value.posterPath,
                        backdrop_path: tmdbArtwork.value.backdropPath,
                        number_of_episodes: tmdbArtwork.value.totalEpisodeCount
                    };
                }

                if (anilistIdRef.value) {
                    loadAnilistPlaybackMeta(anilistIdRef.value);
                }

                const posterPath = tmdbArtwork.value?.posterPath || show?.poster_path;
                addViewedItem({
                    id: tmdbId,
                    title: animeTitle.value || `Anime #${tmdbId}`,
                    image: posterPath ? useWebImage(posterPath, 'medium') : '',
                    rating: show?.vote_average ?? 0,
                    categories: [],
                    adult: false,
                    type: 'anime'
                });
            } catch (err) {
                console.error('Failed to load anime for streaming:', err);
            }
        };

        const goBack = () => {
            router.push(paths.anime(animeId.value));
        };

        const handleWatchTogether = (event: MouseEvent) => {
            isNavigatingToParty.value = true;
            const target = event.currentTarget as HTMLAnchorElement;
            const href = target.href;
            setTimeout(() => {
                window.location.href = href;
            }, 50);
        };

        const changeEpisode = (ep: number) => {
            if (ep < 1 || ep === currentEpisode.value) return;
            syncSeasonTabForEpisode(ep);
            currentEpisode.value = ep;
            router.push(paths.streamAnime(animeId.value, ep, anilistIdRef.value));
        };

        const goToEpisode = (ep: number) => changeEpisode(ep);

        const isLastEpisode = computed(() => {
            const now = new Date();
            const releasedCount = seasonEpisodes.value.filter((ep) => {
                if (!ep.air_date) return true;
                return new Date(ep.air_date) <= now;
            }).length;
            const lastInSeason = currentEpisode.value === releasedCount;
            const lastSeason = !nextSeasonNumber.value;
            return lastInSeason && lastSeason;
        });

        const goToPreviousEpisode = async () => {
            const eps = seasonEpisodes.value;
            const idx = eps.findIndex((e) => e.episode_number === currentEpisode.value);
            if (idx > 0) {
                goToEpisode(eps[idx - 1].episode_number);
                return;
            }
            if (usesTmdbSeasonTabs.value && navigatorSeason.value > 1) {
                const prevSeasonNum = navigatorSeason.value - 1;
                activeTmdbSeason.value = prevSeasonNum;
                currentEpisode.value = 1;
                await loadSeason();
                const now = new Date();
                const releasedCount = seasonEpisodes.value.filter((ep) => {
                    if (!ep.air_date) return true;
                    return new Date(ep.air_date) <= now;
                }).length;
                if (releasedCount > 0) {
                    goToEpisode(seasonEpisodes.value[releasedCount - 1].episode_number);
                }
                return;
            }
            if (currentEpisode.value > seasonFirstEpisode.value) {
                goToEpisode(currentEpisode.value - 1);
            }
        };

        const goToNextEpisode = () => {
            if (isLastEpisode.value) return;
            const now = new Date();
            const releasedCount = seasonEpisodes.value.filter((ep) => {
                if (!ep.air_date) return true;
                return new Date(ep.air_date) <= now;
            }).length;
            const idx = seasonEpisodes.value.findIndex((e) => e.episode_number === currentEpisode.value);
            if (idx >= 0 && idx < releasedCount - 1) {
                goToEpisode(seasonEpisodes.value[idx + 1].episode_number);
            } else if (nextSeasonNumber.value) {
                onSeasonChange(nextSeasonNumber.value).then(() => goToEpisode(
                    seasonEpisodes.value[0]?.episode_number ?? 1
                ));
            } else if (currentEpisode.value < releasedCount) {
                goToEpisode(currentEpisode.value + 1);
            }
        };

        const currentSeasonIdx = computed(() => {
            if (!seasonsList.value.length) return -1;
            return seasonsList.value.findIndex((s) => s.id === activeTmdbSeason.value);
        });

        const currentSeasonNumber = computed(() => {
            return currentSeasonIdx.value !== -1 ? currentSeasonIdx.value + 1 : 1;
        });

        const nextSeasonId = computed(() => {
            const idx = currentSeasonIdx.value;
            if (idx === -1 || idx + 1 >= seasonsList.value.length) return null;
            return seasonsList.value[idx + 1].id;
        });

        const nextSeasonNumber = computed(() => nextSeasonId.value ?? 0);

        const nextSeasonCoverImage = ref<string>('');
        const nextSeasonTitle = ref<string>('');

        watch(nextSeasonId, (id) => {
            if (!id) {
                nextSeasonCoverImage.value = '';
                nextSeasonTitle.value = '';
                return;
            }

            const tab = tmdbArtwork.value?.seasonTabs.find((s) => s.seasonNumber === id);
            nextSeasonTitle.value = tab?.label ?? '';
            nextSeasonCoverImage.value = tmdbPosterPath.value;
        }, { immediate: true });

        const mapBrowsableToEpisodes = (
            eps: EpisodeLike[],
            seasonNumber: number,
            fallbackStillPath: string,
            fallbackDesc: string
        ): Episode[] => {
            return eps.map((ep) => {
                const tmdbEp = ep as AnimeTmdbEpisode;
                return {
                    ...ep,
                    id: ep.episode_number,
                    name: ep.name || `Episode ${ep.episode_number}`,
                    overview: tmdbEp.overview || fallbackDesc,
                    still_path: tmdbEp.still_path || fallbackStillPath || '',
                    air_date: ep.air_date || '',
                    episode_number: ep.episode_number,
                    season_number: tmdbEp.season_number ?? seasonNumber,
                    crew: [],
                    guest_stars: [],
                    production_code: '',
                    runtime: 0,
                    vote_average: 0,
                    vote_count: 0
                };
            }) as unknown as Episode[];
        };

        const episodesForTmdbTab = (seasonNumber: number) => {
            const all = browsableTmdbEpisodes.value;
            if (!all.length) return [];

            const tab = tmdbArtwork.value?.seasonTabs.find((s) => s.seasonNumber === seasonNumber);
            if (tab) {
                const byRange = all.filter(
                    (ep) => ep.episode_number >= tab.firstEpisode && ep.episode_number <= tab.lastEpisode
                );
                if (byRange.length) return byRange;
            }

            return all.filter(
                (ep) => (ep as AnimeTmdbEpisode).season_number === seasonNumber
            );
        };

        const resolveRawSeasonEpisodes = (): EpisodeLike[] => {
            const all = browsableTmdbEpisodes.value;
            if (!all.length) return [];

            if (!usesTmdbSeasonTabs.value) return all;

            const forActiveSeason = episodesForTmdbTab(activeTmdbSeason.value);
            if (forActiveSeason.length) return forActiveSeason;

            const tab = findTmdbSeasonTabForEpisode(
                currentEpisode.value,
                tmdbArtwork.value?.seasonTabs ?? []
            );
            if (tab) {
                return all.filter(
                    (ep) => ep.episode_number >= tab.firstEpisode && ep.episode_number <= tab.lastEpisode
                );
            }

            return all;
        };

        const buildSeasonEpisodeList = (
            raw: EpisodeLike[],
            seasonNumber: number,
            fallbackImg: string,
            fallbackDesc: string
        ): { list: Episode[]; nextAiring: Episode | null } => {
            const mapped = mapBrowsableToEpisodes(raw, seasonNumber, fallbackImg, fallbackDesc);
            const { list, nextAiring } = partitionStreamSeasonEpisodes(mapped);
            return { list: list as Episode[], nextAiring: nextAiring as Episode | null };
        };

        const loadSeason = async () => {
            const raw = resolveRawSeasonEpisodes();
            if (!raw.length) {
                seasonEpisodes.value = [];
                nextAiringEpisode.value = null;
                return;
            }

            isLoadingEpisodes.value = true;
            try {
                const fallbackStillPath =
                    tmdbArtwork.value?.posterPath || tmdbArtwork.value?.backdropPath || '';
                const desc = tmdbShow.value?.overview || '';
                const current = buildSeasonEpisodeList(
                    raw,
                    navigatorSeason.value,
                    fallbackStillPath,
                    desc
                );
                seasonEpisodes.value = current.list;
                nextAiringEpisode.value = current.nextAiring;

                if (nextSeasonId.value) {
                    const nextRaw = episodesForTmdbTab(nextSeasonId.value);
                    if (nextRaw.length) {
                        const next = buildSeasonEpisodeList(
                            nextRaw,
                            nextSeasonNumber.value,
                            fallbackStillPath,
                            ''
                        );
                        nextSeasonEpisodes.value = next.list;
                    } else {
                        nextSeasonEpisodes.value = [];
                    }
                } else {
                    nextSeasonEpisodes.value = [];
                }
            } catch (err) {
                console.error('Failed to load anime season:', err);
            } finally {
                isLoadingEpisodes.value = false;
            }
        };

        const onUpNextSelect = async (payload: { season: number; episode: number }) => {
            if (payload.season !== navigatorSeason.value) {
                activeTmdbSeason.value = payload.season;
                currentEpisode.value = payload.episode;
                syncSeasonTabForEpisode(payload.episode);
                await loadSeason();
                router.push(paths.streamAnime(animeId.value, payload.episode, anilistIdRef.value));
            } else {
                changeEpisode(payload.episode);
            }
        };

        const onUpNextSeasonChange = (next: number) => {
            if (next !== navigatorSeason.value) {
                onSeasonChange(next);
            }
        };

        // Keyboard navigation for step increment
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            // Only change episode with Ctrl+Arrow, let plain arrows seek in video
            if (e.key === 'ArrowLeft' && e.ctrlKey) {
                e.preventDefault();
                if (currentEpisode.value > 1) {
                    goToEpisode(currentEpisode.value - 1);
                }
            } else if (e.key === 'ArrowRight' && e.ctrlKey) {
                e.preventDefault();
                if (currentEpisode.value < seasonLastEpisode.value) {
                    goToEpisode(currentEpisode.value + 1);
                }
            }
        };

        // Real-time message listener for auto-next and watch progress saving
        const handlePlayerMessage = (event: MessageEvent) => {
            let data = event.data;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    return;
                }
            }
            if (!data) return;

            // Handle Videasy progress tracking
            if (data.timestamp !== undefined && data.duration !== undefined) {
                saveProgress(animeId.value, 'anime', Number(data.timestamp), Number(data.duration), undefined, currentEpisode.value);
            }

            // Sync current episode from player if it auto-advances
            if (data.episode !== undefined && Number(data.episode) !== currentEpisode.value) {
                goToEpisode(Number(data.episode));
            }

            // Handle watch progress saving
            if (data.event === 'time' && data.time !== undefined && data.duration !== undefined) {
                saveProgress(animeId.value, 'anime', data.time, data.duration, undefined, currentEpisode.value);
            } else if (data.type === 'watching-log' && data.currentTime !== undefined && data.duration !== undefined) {
                saveProgress(animeId.value, 'anime', data.currentTime, data.duration, undefined, currentEpisode.value);
            }

            // Handle auto-next
            if (data.event === 'complete') {
                const nextEp = currentEpisode.value + 1;
                if (nextEp <= seasonLastEpisode.value) {
                    goToEpisode(nextEp);
                }
            }
        };

        const previewEpisodes = ref<Episode[]>([]);
        const isPreviewLoading = ref(false);

        const onPreviewSeason = async (seasonNum: number) => {
            if (seasonNum === navigatorSeason.value) {
                previewEpisodes.value = [];
                return;
            }
            isPreviewLoading.value = true;
            try {
                const raw = episodesForTmdbTab(seasonNum);
                if (raw.length) {
                    const preview = buildSeasonEpisodeList(
                        raw,
                        seasonNum,
                        tmdbPosterPath.value,
                        tmdbShow.value?.overview || ''
                    );
                    previewEpisodes.value = preview.list;
                } else {
                    previewEpisodes.value = [];
                }
            } catch (err) {
                console.error('Failed to load anime season preview:', err);
            } finally {
                isPreviewLoading.value = false;
            }
        };

        onMounted(() => {
            const epParam = route.params.episode;
            if (epParam) {
                currentEpisode.value = parseInt(epParam as string) || 1;
            }
            loadAnime(animeId.value);
            window.addEventListener('message', handlePlayerMessage);
            window.addEventListener('keydown', handleKeyDown);
        });

        onUnmounted(() => {
            window.removeEventListener('message', handlePlayerMessage);
            window.removeEventListener('keydown', handleKeyDown);
        });

        watch(
            () => route.params.id,
            (id) => {
                if (suppressRouteReload.value) {
                    suppressRouteReload.value = false;
                    return;
                }
                const parsed = Number(id);
                if (!parsed || parsed === animeId.value) return;
                animeId.value = parsed;
                loadAnime(parsed);
            }
        );

        watch(
            () => route.params.episode,
            (newEp) => {
                if (!newEp) return;
                const ep = parseInt(newEp as string) || 1;
                const maxEp = globalMaxEpisode.value;
                const resolved = ep > maxEp && maxEp > 0 ? maxEp : ep;
                syncSeasonTabForEpisode(resolved);
                currentEpisode.value = resolved;
                if (resolved !== ep && maxEp > 0) {
                    router.replace(paths.streamAnime(animeId.value, resolved, anilistIdRef.value));
                }
            }
        );

        watch(tmdbArtwork, () => {
            syncSeasonTabForEpisode(currentEpisode.value);
        });

        return {
            animeId,
            resolvedAnilistId,
            tmdbShow,
            animeTitle,
            currentEpisode,
            seasonFirstEpisode,
            seasonLastEpisode,
            activeSeasonSelectValue,
            tmdbPosterPath,
            tmdbBackdropPath,
            activeServerIndex,
            availableServers,
            isAnimeplayServer,
            currentEmbedUrl,
            partyHref,
            seasonsList,
            goToSeason,
            activeLanguage,
            availableSeasons,
            navigatorSeason,
            onSeasonChange,
            goToPreviousEpisode,
            goToNextEpisode,
            currentSeasonNumber,
            seasonEpisodes,
            nextSeasonNumber,
            nextSeasonEpisodes,
            nextAiringInfo,
            isLastEpisode,
            onUpNextSelect,
            onUpNextSeasonChange,
            goBack,
            handleWatchTogether,
            changeEpisode,
            goToEpisode,
            getEpisodeInSeasonNumber,
            isLoadingTmdb,
            isLoadingEpisodes,
            seasonsDropdownList,
            previewEpisodes,
            isPreviewLoading,
            onPreviewSeason
        };
    }
});
</script>

<style lang="scss" scoped>
.watch-stage {
    min-height: 100dvh;
    height: auto;
    // clip — not hidden — so overflow-y stays visible and the page scrolls (not this box)
    overflow-x: clip;
    overflow-y: visible;
    background-color: var(--ink-950);
    color: var(--bone-50);

    &__chrome {
        background: rgba(10, 10, 12, 0.85);
        backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--rule);
        position: sticky;
        top: 0;
        z-index: 10;

        @media (min-width: 1024px) {
            position: fixed;
            left: 0;
            right: 0;
        }
    }

    &__chrome-inner {
        max-width: 1440px;
        margin: 0 auto;
        padding: 0.75rem var(--s-6);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);

        @media (max-width: 1023px) {
            display: grid;
            grid-template-columns: auto 1fr auto;
            grid-template-areas: 'crumb title actions';
            gap: var(--s-3) var(--s-4);
        }

        @media (max-width: 640px) {
            grid-template-columns: auto 1fr;
            grid-template-areas:
                'crumb actions'
                'title title';
            padding: var(--s-2) var(--s-3);
            gap: var(--s-2);
        }
    }

    &__crumb {
        grid-area: crumb;
        display: flex;
        align-items: center;
        gap: var(--s-3);

        @media (max-width: 1023px) {
            .eyebrow {
                display: none !important;
            }
        }
    }

    &__back {
        background: none;
        border: none;
        color: var(--bone-200);
        cursor: pointer;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color var(--dur-fast), transform var(--dur-fast);

        &:hover {
            color: var(--ember);
            transform: translateX(-2px);
        }

        svg {
            width: 20px;
            height: 20px;
        }

        @media (max-width: 640px) {
            display: grid;
            place-items: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: var(--surface-tint);
            color: var(--bone-100);
            padding: 0;

            svg {
                width: 18px;
                height: 18px;
            }
        }
    }

    &__title-block {
        grid-area: title;
        text-align: center;
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 1.15rem;
        margin: 0;
        color: var(--bone-50);

        @media (max-width: 1023px) {
            display: none !important;
        }
    }

    &__title-skeleton {
        @media (max-width: 1023px) {
            display: none !important;
        }
    }

    &__code {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        color: var(--ember);
        margin-top: 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    &__episode-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 4px;
    }

    &__nav-btn {
        background: none;
        border: none;
        color: var(--bone-400);
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--r-sm);
        transition: color var(--dur-fast), background-color var(--dur-fast);

        &:hover:not(:disabled) {
            color: var(--ember);
            background: rgba(255, 255, 255, 0.08);
        }

        &:disabled {
            color: var(--bone-700);
            cursor: not-allowed;
            opacity: 0.35;
        }

        svg {
            width: 14px;
            height: 14px;
        }
    }

    &__actions {
        grid-area: actions;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--s-2);
        min-width: 0;
        flex-wrap: wrap;
    }

    &__options {
        position: relative;

        &[open] .watch-stage__options-trigger svg {
            transform: rotate(180deg);
        }

        @media (max-width: 1023px) {
            display: none !important;
        }
    }

    &__lang-toggle {
        display: none;

        @media (max-width: 1023px) {
            display: inline-flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--rule-strong);
            border-radius: var(--r-pill);
            padding: 3px;
            height: 36px;
            box-sizing: border-box;
            gap: 2px;
        }
    }

    &__lang-btn {
        all: unset;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 0.65rem;
        height: 100%;
        font-family: var(--font-ui);
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--bone-400);
        border-radius: var(--r-pill);
        cursor: pointer;
        transition: all var(--dur-fast);

        &.is-active {
            background: var(--ember);
            color: var(--ink-950);
        }
    }

    &__options-trigger {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        min-height: 38px;
        padding: 0.45rem 0.9rem;
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-pill);
        background: rgba(255, 255, 255, 0.08);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 700;
        list-style: none;
        cursor: pointer;

        &::-webkit-details-marker {
            display: none;
        }

        svg {
            width: 16px;
            height: 16px;
            transition: transform var(--dur-base) var(--ease-out);
        }

        @media (max-width: 640px) {
            width: 36px;
            min-height: 36px;
            padding: 0;
            justify-content: center;

            span {
                display: none;
            }
        }
    }

    &__options-menu {
        position: absolute;
        top: calc(100% + var(--s-2));
        right: 0;
        z-index: calc(var(--z-header) + 1);
        width: min(340px, calc(100vw - var(--s-4)));
        display: grid;
        gap: var(--s-4);
        padding: var(--s-4);
        border: 1px solid var(--rule);
        border-radius: var(--r-lg);
        background: rgba(19, 17, 14, 0.98);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(16px);
    }

    &__option-group {
        display: grid;
        gap: var(--s-2);
    }

    &__option-label {
        margin: 0;
        color: var(--bone-400);
    }

    &__option-select {
        width: 100%;
        min-height: 40px;
        padding: 0 2.4rem 0 0.9rem;
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        background: var(--ink-800);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
    }

    &__language-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s-2);
        padding: 4px;
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        background: rgba(0, 0, 0, 0.2);
    }

    &__language-btn {
        min-height: 34px;
        padding: 0.45rem 0.7rem;
        border-radius: var(--r-sm);
        color: var(--bone-300);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 600;
        transition: color var(--dur-fast), background-color var(--dur-fast);

        &:hover {
            color: var(--bone-50);
        }

        &.is-active {
            background: var(--ember);
            color: var(--ink-900);
        }
    }

    &__party-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 90, 31, 0.08);
        border: 1px solid rgba(255, 90, 31, 0.25);
        border-radius: var(--r-pill);
        color: var(--ember);
        padding: 0.5rem 1.1rem;
        min-height: 38px;
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 600;
        text-decoration: none;
        transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);

        &:hover {
            background: rgba(255, 90, 31, 0.16);
            border-color: rgba(255, 90, 31, 0.45);
            transform: translateY(-1px);
        }

        @media (max-width: 640px) {
            width: 36px;
            min-height: 36px;
            padding: 0;
            display: inline-grid;
            place-items: center;

            .button-text {
                display: none;
            }
        }
    }

    &__party-icon {
        width: 16px;
        height: 16px;
    }

    &__party-icon {
        width: 16px;
        height: 16px;
    }

    &__main {
        display: grid;
        gap: 0;
    }

    &__theater {
        display: grid;
        gap: var(--s-5);
        max-width: 1440px;
        width: 100%;
        margin: 0 auto;
        box-sizing: border-box;

        @media (max-width: 1023px) {
            display: flex;
            flex-direction: column;
            gap: var(--s-4);
            padding: var(--s-3);
            height: auto;
            min-height: 0;
        }

        @media (min-width: 1024px) {
            min-height: 100dvh;
            padding: 72px var(--s-5) var(--s-2) var(--s-5);
            grid-template-columns: 1fr;
            align-items: stretch;
        }
    }

    &__player-container {
        min-width: 0;
        flex-shrink: 0;

        @media (max-width: 1023px) {
            width: 100%;

            :deep(.stream-frame__stage) {
                padding: 0;
            }

            :deep(.stream-frame__player) {
                border-radius: var(--r-md);
            }
        }

        @media (min-width: 1024px) {
            :deep(.stream-frame__player) {
                aspect-ratio: auto;
                height: clamp(300px, 38vw, 520px);
            }
        }
    }

    .player-stage-container {
        width: 100%;
        height: 100%;
    }

    .stream-iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: #000;
    }

    &__aside {
        min-width: 0;
        flex-shrink: 0;

        @media (max-width: 1023px) {
            padding: 0;
            width: 100%;
        }

        @media (min-width: 1024px) {
            position: relative;
            align-self: stretch;
        }

        :deep(.server-accordion) {
            @media (max-width: 1023px) {
                display: none !important;
            }
        }
    }

    &__server-picker {
        display: none;

        @media (max-width: 1023px) {
            position: relative;
            display: inline-flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--rule-strong);
            border-radius: var(--r-pill);
            padding: 0.5rem 2.25rem 0.5rem 1rem;
            min-height: 38px;
            font-family: var(--font-ui);
            font-size: var(--fs-sm);
            font-weight: 600;
            color: var(--bone-50);
            cursor: pointer;
            transition: background-color var(--dur-fast), border-color var(--dur-fast);

            &:hover {
                background: rgba(255, 255, 255, 0.12);
                border-color: var(--bone-400);
            }

            @media (max-width: 640px) {
                min-height: 36px;
                padding: 0.4rem 2rem 0.4rem 0.85rem;
            }
        }
    }

    &__server-select {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        -webkit-appearance: none;
    }

    &__server-select-arrow {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        color: var(--bone-300);

        svg {
            width: 100%;
            height: 100%;
        }

        @media (max-width: 640px) {
            right: 8px;
        }
    }

    &__rack {
        position: relative;
        z-index: 2;
        max-width: 1280px;
        width: 100%;
        margin: 0 auto;
        padding: var(--s-5) var(--s-4) calc(var(--s-7) + env(safe-area-inset-bottom, 0px));
        box-sizing: border-box;
        pointer-events: auto;

        @media (min-width: 768px) {
            padding: var(--s-6) var(--s-5) calc(var(--s-7) + env(safe-area-inset-bottom, 0px));
        }

        &:last-of-type {
            padding-bottom: calc(var(--s-9) + env(safe-area-inset-bottom, 0px));
        }
    }

    &__feature {
        display: grid;
        gap: var(--s-6);
        max-width: 1280px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
        padding: var(--s-6) var(--s-4);

        @media (max-width: 1023px) {
            height: auto;
            min-height: 0;
            align-content: start;
            padding: var(--s-5) var(--s-3) var(--s-4);
            grid-template-columns: 1fr;
        }

        @media (min-width: 1024px) {
            padding: var(--s-6) var(--s-5);
            grid-template-columns: 280px 1fr;
            align-items: center;
        }

        @media (min-width: 768px) and (max-width: 1023px) {
            grid-template-columns: 1fr;
            align-items: start;
        }
    }

    &__poster {
        position: relative;
        aspect-ratio: 2 / 3;
        max-width: 280px;
        border-radius: var(--r-lg);
        overflow: hidden;
        box-shadow: var(--shadow-lg);
        margin: 0 auto;

        @media (max-width: 1023px) {
            display: none !important;
        }

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
    }

    &__feature-body {
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    &__feature-title {
        font-family: var(--font-display);
        font-size: 1.5rem;
        font-weight: 600;
        margin-top: var(--s-1);
        margin-bottom: var(--s-3);
    }

    &__meta {
        list-style: none;
        padding: 0;
        margin: 0 0 var(--s-4) 0;
        display: flex;
        gap: var(--s-5);
        font-size: var(--fs-sm);

        li {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .meta {
            font-size: var(--fs-xs);
            color: var(--bone-450);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
    }

    &__overview {
        color: var(--bone-300);
        line-height: 1.6;
        font-size: var(--fs-sm);
        max-width: 60ch;
    }


}

// Hide scroll car on all watch/stream pages
:global(.scroll-car-container) {
    display: none !important;
}

.language-switcher {
    background: var(--ink-800);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-4);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    min-width: 0;

    &__header {
        margin: 0;
    }

    &__tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s-2);
        background: rgba(0, 0, 0, 0.2);
        padding: 4px;
        border-radius: var(--r-sm);
        border: 1px solid var(--rule);
    }

    &__btn {
        padding: 0.5rem;
        border-radius: var(--r-sm);
        border: none;
        background: transparent;
        color: var(--bone-300);
        font-weight: 500;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all var(--dur-fast);

        &:hover {
            color: var(--bone-50);
        }

        &.is-active {
            background: var(--ember);
            color: #000;
            font-weight: 600;
        }
    }
}

.episode-navigator {
    background: var(--ink-800);
    border-radius: var(--r-lg);
    box-shadow: inset 0 0 0 1px var(--rule);
    padding: var(--s-5) var(--s-5);
    display: grid;
    gap: var(--s-5);

    @media (min-width: 768px) {
        padding: var(--s-6);
    }

    &__head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);
    }

    &__heading {
        display: grid;
        gap: 0.15rem;
    }

    &__title {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-2xl);
        letter-spacing: var(--ls-tight);
        color: var(--bone-50);
    }

    &__count {
        color: var(--bone-400);
    }

    &__actions-row {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        flex-wrap: wrap;
    }

    &__controls {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        background: var(--ink-700);
        padding: var(--s-1);
        border-radius: var(--r-pill);
        box-shadow: inset 0 0 0 1px var(--rule);
    }

    &__nav {
        all: unset;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        color: var(--bone-100);
        transition: background-color var(--dur-fast) var(--ease-out);

        &:hover:not(:disabled) {
            background: var(--ember);
            color: var(--ink-900);
        }

        &:disabled {
            opacity: 0.35;
            cursor: not-allowed;
        }

        svg {
            width: 16px;
            height: 16px;
        }
    }

    &__current {
        font-family: var(--font-mono);
        font-size: var(--fs-sm);
        color: var(--bone-50);
        padding: 0 var(--s-3);
    }
}

.episode-search-bar {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    background: var(--ink-700);
    padding: 0.4rem 0.8rem;
    border-radius: var(--r-md);
    box-shadow: inset 0 0 0 1px var(--rule);
    max-width: 160px;

    .search-hash {
        color: var(--ember);
        font-family: var(--font-mono);
        font-weight: bold;
        font-size: var(--fs-base);
    }

    .episode-search-input {
        background: transparent;
        border: none;
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        width: 100%;
        outline: none;

        &::placeholder {
            color: var(--bone-500);
        }
    }
}

.episode-grid-container {
    margin-top: var(--s-2);
}

.episode-squares-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    gap: var(--s-2);
    height: 280px;
    overflow-y: auto;
    padding-right: 4px;

    @media (max-width: 640px) {
        grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
        gap: 6px;
    }

    &::-webkit-scrollbar {
        width: 6px;
    }
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    &::-webkit-scrollbar-thumb {
        background: var(--rule-strong);
        border-radius: var(--r-pill);
    }
}

.ep-square {
    all: unset;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ink-700);
    border-radius: var(--r-sm);
    box-shadow: inset 0 0 0 1px var(--rule);
    cursor: pointer;
    position: relative;
    box-sizing: border-box;
    transition: all var(--dur-fast) var(--ease-out);

    @media (max-width: 640px) {
        border-radius: var(--r-xs);
    }

    &--skeleton {
        cursor: default;
        background: var(--ink-750);
        animation: anime-ep-skeleton-pulse 1.4s ease-in-out infinite;
    }

    &.is-upcoming {
        opacity: 0.45;
        cursor: not-allowed !important;
        background: rgba(255, 255, 255, 0.03);
        border: 1px dashed rgba(255, 255, 255, 0.15);
        color: var(--bone-500);

        &:hover {
            background: rgba(255, 255, 255, 0.03);
            border-color: rgba(255, 255, 255, 0.15);
            color: var(--bone-500);
            transform: none !important;
        }
    }

    &__number {
        font-family: var(--font-mono);
        font-size: var(--fs-base);
        font-weight: 500;
        color: var(--bone-200);

        @media (max-width: 640px) {
            font-size: var(--fs-xs);
        }
    }

    &:hover:not(.is-active):not(.is-upcoming):not(:disabled) {
        background: var(--ink-600);
        box-shadow: inset 0 0 0 1px var(--rule-strong);
        transform: scale(1.05);

        .ep-square__number {
            color: var(--bone-50);
        }
    }

    &:disabled {
        pointer-events: none;
    }

    &.is-active {
        background: var(--ember);
        box-shadow: 0 0 12px var(--ember-glow);
        transform: scale(1.05);

        .ep-square__number {
            color: var(--ink-950);
            font-weight: 700;
        }
    }

    &__progress-dot {
        position: absolute;
        bottom: 6px;
        right: 6px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ember);
        box-shadow: 0 0 6px var(--ember-glow);
    }
}

.no-results {
    text-align: center;
    padding: var(--s-5);
    color: var(--bone-400);
}

.mobile-season-selector {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    margin-top: var(--s-4);
    margin-bottom: var(--s-3);

    .mobile-season-select-wrapper {
        position: relative;
        width: 100%;
        max-width: 240px;
    }

    .mobile-season-select {
        width: 100%;
        padding: 0.55rem 2.25rem 0.55rem 0.85rem;
        background: var(--ink-700);
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        cursor: pointer;
        appearance: none;
        outline: none;
        transition: border-color var(--dur-fast), box-shadow var(--dur-fast);

        &:hover, &:focus {
            border-color: var(--ember);
        }
    }

    .mobile-season-select-arrow {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        color: var(--bone-400);
        display: flex;
        align-items: center;
        justify-content: center;
    }
}

.season-switcher {
    background: var(--ink-800);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-4);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    min-width: 0;

    &__header {
        margin: 0;
    }

    &__select-wrapper {
        position: relative;
        width: 100%;
    }

    &__select {
        width: 100%;
        padding: 0.6rem 2.5rem 0.6rem 1rem;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--rule);
        border-radius: var(--r-sm);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        appearance: none;
        outline: none;
        transition: border-color var(--dur-fast), box-shadow var(--dur-fast);

        &:hover, &:focus {
            border-color: var(--ember);
        }
    }

    &__chevron {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        color: var(--bone-400);
        display: flex;
        align-items: center;
        justify-content: center;

        svg {
            width: 16px;
            height: 16px;
        }
    }
}

// Side-by-side row for season & language controls
.aside-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-3);

    // If only one child (no season or no language), stretch to full width
    > *:only-child {
        grid-column: span 2;
    }

    @media (max-width: 480px) {
        grid-template-columns: 1fr;

        > *:only-child {
            grid-column: span 1;
        }
    }
}

.episode-navigator__upcoming {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    margin-top: var(--s-4);
    padding: var(--s-3) var(--s-4);
    background: rgba(255, 90, 31, 0.05);
    border: 1px solid rgba(255, 90, 31, 0.25);
    border-radius: var(--r-md);
    font-size: var(--fs-sm);
    color: var(--bone-200);

    .upcoming-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        padding: 0.2rem 0.5rem;
        background: rgba(255, 90, 31, 0.12);
        border: 1px solid rgba(255, 90, 31, 0.3);
        border-radius: var(--r-pill);
        color: var(--ember);
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: var(--ls-micro);
        font-weight: 500;
        flex-shrink: 0;

        &__pulse {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--ember);
            box-shadow: 0 0 8px rgba(255, 90, 31, 0.4);
            animation: upcomingPulse 2s infinite;
        }
    }

    .upcoming-text {
        line-height: var(--lh-base);
        strong {
            color: var(--bone-50);
        }
    }
}

@keyframes upcomingPulse {
    0% { transform: scale(0.95); opacity: 0.5; }
    50% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 12px var(--ember); }
    100% { transform: scale(0.95); opacity: 0.5; }
}

@keyframes anime-ep-skeleton-pulse {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 0.85; }
}
</style>
