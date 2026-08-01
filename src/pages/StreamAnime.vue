<template>
    <div
        class="watch-stage"
        :class="{ 'is-embed': isEmbed, 'controls-visible': controlsVisible }"
        @mousemove="showControls"
        @mouseleave="scheduleHide"
        @touchstart.passive="showControls"
        @click="showControls"
    >
        <!-- Full-screen video layer -->
        <div class="watch-stage__video-layer">
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

        <!-- TOP overlay: gradient + back + title + episode nav + server -->
        <div v-if="!isEmbed" class="watch-stage__top-overlay">
            <div class="watch-stage__top-gradient" aria-hidden="true" />
            <div class="watch-stage__top-bar">
                <div class="watch-stage__top-left">
                    <button
                        type="button"
                        class="watch-stage__back"
                        aria-label="Back to anime"
                        @click="goBack"
                    >
                        <ArrowLeft />
                    </button>
                    <div class="watch-stage__breadcrumb">
                        <span class="watch-stage__breadcrumb-sep">·</span>
                        <h1 v-if="tmdbShow" class="watch-stage__title">{{ animeTitle }}</h1>
                        <span v-else class="watch-stage__title-skeleton" aria-hidden="true" />
                    </div>
                    <!-- Episode navigation pill -->
                    <div class="watch-stage__ep-nav">
                        <button
                            type="button"
                            class="watch-stage__nav-btn"
                            :disabled="currentEpisode <= seasonFirstEpisode"
                            @click="goToPreviousEpisode"
                            aria-label="Previous Episode"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                                <path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                        <span class="watch-stage__ep-code" @click="openEpisodePicker">
                            Episode {{ getEpisodeInSeasonNumber(currentEpisode) }}
                        </span>
                        <button
                            type="button"
                            class="watch-stage__nav-btn"
                            :disabled="isLastEpisode"
                            @click="goToNextEpisode"
                            aria-label="Next Episode"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                                <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="watch-stage__top-right">
                    <!-- Language toggle (only for non-Videasy servers) -->
                    <div
                        v-if="availableServers[activeServerIndex]?.name !== 'Videasy'"
                        class="watch-stage__lang-pill"
                    >
                        <button
                            type="button"
                            class="watch-stage__lang-pill-btn"
                            :class="{ 'is-active': activeLanguage === 'sub' }"
                            @click="activeLanguage = 'sub'"
                        >
                            SUB
                        </button>
                        <button
                            type="button"
                            class="watch-stage__lang-pill-btn"
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

                    <button
                        v-if="animeTitle || animeId"
                        type="button"
                        class="watch-stage__party-btn watch-stage__watchlist-btn"
                        :class="{ 'is-added': inWatchlist }"
                        :title="inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'"
                        @click="toggleWatchlist"
                    >
                        <svg v-if="!inWatchlist" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="watch-stage__party-icon">
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="watch-stage__party-icon">
                            <path d="m5 13 4 4L19 7"/>
                        </svg>
                        <span class="watch-stage__party-label">{{ inWatchlist ? 'In Watchlist' : 'Watchlist' }}</span>
                    </button>

                    <template v-if="seasonsList.length > 1 || availableServers[activeServerIndex]?.name !== 'Videasy'">
                        <details class="watch-stage__options">
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
                    </template>

                    <button
                        type="button"
                        class="watch-stage__fullscreen-btn"
                        :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
                        @click="toggleFullscreen"
                    >
                        <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="watch-stage__fullscreen-icon">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="watch-stage__fullscreen-icon">
                            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </button>

                    <a
                        v-if="tmdbShow && partyHref"
                        :href="partyHref"
                        class="watch-stage__party-btn"
                        title="Watch Together"
                        rel="nofollow"
                        @click.prevent="handleWatchTogether"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="watch-stage__party-icon">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span class="watch-stage__party-label">Watch Together</span>
                    </a>
                </div>
            </div>
        </div>

        <!-- Up-Next drawer -->
        <UpNextDrawer
            v-if="availableSeasons.length && !isFullscreen"
            ref="upNextDrawerRef"
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

        <!-- Scrollable content below the fixed video -->
        <div v-if="!isEmbed && tmdbShow" class="watch-stage__rack">
            <div class="watch-stage__mobile-episodes">
                <EpisodeNavigator
                    :available-seasons="availableSeasons"
                    :season-episodes="seasonEpisodes"
                    :current-season="navigatorSeason"
                    :current-episode="currentEpisode"
                    :show-id="animeId"
                    :is-loading-episodes="isLoadingEpisodes"
                    :preview-episodes="previewEpisodes"
                    :is-preview-loading="isPreviewLoading"
                    media-type="anime"
                    @season-change="onPreviewSeason"
                    @select="onMobileEpisodeSelect"
                    @previous="goToPreviousEpisode"
                    @next="goToNextEpisode"
                />
            </div>
        </div>
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

import UpNextDrawer from '../components/player/UpNextDrawer.vue';
import ArrowLeft from '../components/svg/outline/arrow-left-long.vue';
import { useAppPaths } from '../composables/useAppPaths';
import { isInWatchlist, toggleWatchlistItem, type WatchlistItem } from '../composables/useWatchlist';
import EpisodeNavigator from '../components/player/EpisodeNavigator.vue';
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
    resolveAnimeTmdbMeta,
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

        UpNextDrawer,
        EpisodeNavigator
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
            { name: 'Barfi', urlTemplate: 'https://player.videasy.net/anime/{id}/{episode}?color=E05A47&autoplayNextEpisode=true&overlay=true' },
            { name: 'Shrikhand', urlTemplate: 'https://animeplay.cfd/stream/ani/{id}/{episode}/{lang}' },
            { name: 'Rabri', urlTemplate: 'https://megaplay.buzz/stream/ani/{id}/{episode}/{lang}' }
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
                episode_count: Math.max(globalMaxEpisode.value, currentEpisode.value),
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

        const isEmbed = computed(() => Boolean(route.meta.bareLayout));

        const controlsVisible = ref(true);
        let hideTimer: ReturnType<typeof setTimeout> | null = null;

        const showControls = () => {
            controlsVisible.value = true;
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                controlsVisible.value = false;
            }, 3000);
        };

        const scheduleHide = () => {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                controlsVisible.value = false;
            }, 800);
        };

        const isFullscreen = ref(false);

        const toggleFullscreen = async () => {
            if (!document.fullscreenElement) {
                try {
                    await document.documentElement.requestFullscreen();
                    isFullscreen.value = true;
                } catch {
                    isFullscreen.value = false;
                }
            } else {
                try {
                    await document.exitFullscreen();
                    isFullscreen.value = false;
                } catch {
                    isFullscreen.value = true;
                }
            }
        };

        const onFullscreenChange = () => {
            isFullscreen.value = !!document.fullscreenElement;
        };

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
                anilistIdRef.value = anilistId;

                if (!anilistIdRef.value) {
                    anilistIdRef.value = await resolveAnilistIdForPlayback(tmdbId);
                }

                if (!anilistIdRef.value) {
                    anilistIdRef.value = parseAnilistIdFromRoute();
                }

                if (tmdbId !== routeId) {
                    suppressRouteReload.value = true;
                    await router.replace(
                        paths.streamAnime(tmdbId, currentEpisode.value, anilistIdRef.value)
                    );
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

                let show = await fetchTmdbAnimeShowDetails(tmdbId);
                if (generation !== loadGeneration) return;

                // If TMDB lookup failed and we have an AniList ID (from ?ani=), resolve TMDB ID from it
                if (!tmdbArtwork.value?.tmdbId && !show && anilistIdRef.value && anilistIdRef.value !== routeId) {
                    const anilistRes = await fetchAnimeById(anilistIdRef.value).catch(() => null);
                    const anilistMedia = anilistRes?.data?.Media;
                    if (anilistMedia) {
                        const meta = await resolveAnimeTmdbMeta(anilistIdRef.value, anilistMedia, { deferFranchise: true });
                        const correctTmdbId = meta?.tmdbId;
                        if (correctTmdbId && correctTmdbId !== tmdbId) {
                            tmdbId = correctTmdbId;
                            animeId.value = tmdbId;
                            suppressRouteReload.value = true;
                            await router.replace(paths.streamAnime(tmdbId, currentEpisode.value, anilistIdRef.value));
                            if (generation !== loadGeneration) return;
                            await loadTmdbArtworkByTmdbId(tmdbId, generation);
                            if (generation !== loadGeneration) return;
                        }
                    }
                    show = await fetchTmdbAnimeShowDetails(tmdbId);
                }

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

        const onMobileEpisodeSelect = async (ep: number, selectedSeasonNum: number) => {
            if (navigatorSeason.value !== selectedSeasonNum) {
                activeTmdbSeason.value = selectedSeasonNum;
                currentEpisode.value = ep;
                syncSeasonTabForEpisode(ep);
                await loadSeason();
                router.replace(paths.streamAnime(animeId.value, ep, anilistIdRef.value));
            } else {
                changeEpisode(ep);
            }
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
            if (!all.length) {
                const count = Math.max(globalMaxEpisode.value, currentEpisode.value);
                const dummyList: EpisodeLike[] = [];
                for (let i = 1; i <= count; i++) {
                    dummyList.push({
                        episode_number: i,
                        name: `Episode ${i}`,
                        air_date: ''
                    });
                }
                return dummyList;
            }

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
            document.addEventListener('fullscreenchange', onFullscreenChange);
            showControls();
        });

        onUnmounted(() => {
            window.removeEventListener('message', handlePlayerMessage);
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
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

        const upNextDrawerRef = ref<any>(null);

        const openEpisodePicker = () => {
            if (upNextDrawerRef.value) {
                upNextDrawerRef.value.open = true;
            }
        };

        const inWatchlist = computed(() => {
            if (!animeId.value) return false;
            return isInWatchlist(animeId.value, 'anime');
        });

        const toggleWatchlist = () => {
            if (!animeId.value || !animeTitle.value) return;
            const item: WatchlistItem = {
                id: animeId.value,
                title: animeTitle.value,
                image: tmdbPosterPath.value || tmdbBackdropPath.value || null,
                rating: 0,
                categories: [],
                adult: false,
                type: 'anime'
            };
            toggleWatchlistItem(item);
        };

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
            onMobileEpisodeSelect,
            goToEpisode,
            getEpisodeInSeasonNumber,
            isLoadingTmdb,
            isLoadingEpisodes,
            seasonsDropdownList,
            previewEpisodes,
            isPreviewLoading,
            onPreviewSeason,
            upNextDrawerRef,
            openEpisodePicker,
            useWebImage,
            isEmbed,
            controlsVisible,
            showControls,
            scheduleHide,
            inWatchlist,
            toggleWatchlist,
            isFullscreen,
            toggleFullscreen
        };
    }
});
</script>

<style lang="scss" scoped>
.watch-stage {
    position: relative;
    width: 100%;
    min-height: 100dvh;
    background: #080A10;
    color: #fff;
    overflow-x: hidden;
    cursor: none;

    &.controls-visible {
        cursor: default;

        .watch-stage__top-overlay {
            opacity: 1;
            pointer-events: auto;
        }
    }

    // ── Video layer
    &__video-layer {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100dvh;
        z-index: 0;

        :deep(.stream-frame) {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
        }

        :deep(.stream-frame__stage) {
            width: 100%;
            height: 100%;
            padding: 0;
            margin: 0;
        }

        :deep(.stream-frame__player) {
            width: 100%;
            height: 100%;
            border-radius: 0;
            box-shadow: none;
            border: 0;
            background: #080A10;
        }
    }

    // ── TOP overlay
    &__top-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 50;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
    }

    &__top-gradient {
        position: absolute;
        inset: 0;
        height: 180px;
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0.85) 0%, transparent 100%);
        pointer-events: none;
    }

    &__top-bar {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.25rem calc(2rem + env(safe-area-inset-left, 0px)) 1rem calc(2rem + env(safe-area-inset-right, 0px));

        @media (max-width: 640px) {
            padding: 0.75rem 1rem;
        }
    }

    &__top-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
        flex: 1;
    }

    &__top-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-shrink: 0;
    }

    &__back {
        all: unset;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(8px);
        cursor: pointer;
        color: #fff;
        transition: background 0.15s ease, transform 0.15s ease;

        &:hover {
            background: rgba(255, 90, 31, 0.85);
            transform: translateX(-2px);
        }

        :deep(svg) { width: 18px; height: 18px; }

        @media (max-width: 640px) { width: 36px; height: 36px; }
    }

    &__breadcrumb {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
        @media (max-width: 640px) { display: none; }
    }

    &__breadcrumb-sep {
        color: rgba(255, 255, 255, 0.4);
        font-size: 1.1rem;
        flex-shrink: 0;
    }

    &__title {
        margin: 0;
        font-family: var(--font-display, system-ui);
        font-weight: 500;
        font-size: 1.05rem;
        letter-spacing: -0.02em;
        color: rgba(255, 255, 255, 0.95);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        @media (min-width: 768px) { font-size: 1.2rem; }
    }

    &__title-skeleton {
        display: inline-block;
        width: 180px;
        height: 1.05rem;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.08);
        animation: title-skeleton-pulse 1.4s ease-in-out infinite;
    }

    // Episode navigation pill
    &__ep-nav {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 999px;
        padding: 0.3rem 0.5rem;
        flex-shrink: 0;
    }

    &__nav-btn {
        all: unset;
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.8);
        transition: color 0.15s ease, background 0.15s ease;

        &:hover:not(:disabled) {
            color: #fff;
            background: rgba(255, 255, 255, 0.15);
        }

        &:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }
    }

    &__ep-code {
        font-family: var(--font-ui, system-ui);
        font-size: 0.8rem;
        font-weight: 600;
        color: #fff;
        letter-spacing: 0.03em;
        padding: 0 0.35rem;
        cursor: pointer;
        user-select: none;

        &:hover { color: rgba(255, 255, 255, 0.7); }
    }

    // Language pill (inline sub/dub toggle)
    &__lang-pill {
        display: flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 999px;
        padding: 2px;
        gap: 2px;

        @media (max-width: 900px) {
            display: none !important;
        }
    }

    &__lang-pill-btn {
        all: unset;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem 0.6rem;
        min-height: 26px;
        border-radius: 999px;
        font-family: var(--font-ui, system-ui);
        font-size: 0.7rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover { color: rgba(255, 255, 255, 0.8); }

        &.is-active {
            background: rgba(255, 90, 31, 0.85);
            color: #fff;
        }
    }

    // Options dropdown
    &__options {
        position: relative;

        &[open] .watch-stage__options-trigger svg {
            transform: rotate(180deg);
        }

        @media (max-width: 900px) {
            display: none !important;
        }
    }

    &__options-trigger {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 36px;
        padding: 0.35rem 0.85rem;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(8px);
        color: rgba(255, 255, 255, 0.9);
        font-family: var(--font-ui, system-ui);
        font-size: 0.8rem;
        font-weight: 600;
        list-style: none;
        cursor: pointer;

        &::-webkit-details-marker { display: none; }

        svg {
            width: 14px;
            height: 14px;
            transition: transform 0.2s ease;
        }

        @media (max-width: 640px) {
            width: 36px;
            min-height: 36px;
            padding: 0;
            justify-content: center;
            span { display: none; }
        }
    }

    &__options-menu {
        position: absolute;
        top: calc(100% + 0.5rem);
        right: 0;
        z-index: 60;
        width: min(340px, calc(100vw - 2rem));
        display: grid;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        background: rgba(16, 16, 20, 0.97);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(16px);
    }

    &__option-group {
        display: grid;
        gap: 0.5rem;
    }

    &__option-label {
        margin: 0;
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    &__option-select {
        width: 100%;
        min-height: 40px;
        padding: 0 2.4rem 0 0.9rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.3);
        color: rgba(255, 255, 255, 0.9);
        font-family: var(--font-ui, system-ui);
        font-size: 0.85rem;
        cursor: pointer;
        appearance: none;
        outline: none;

        &:hover, &:focus {
            border-color: rgba(255, 90, 31, 0.5);
        }
    }

    &__language-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
        padding: 4px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.2);
    }

    &__language-btn {
        min-height: 34px;
        padding: 0.45rem 0.7rem;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.4);
        font-family: var(--font-ui, system-ui);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover { color: rgba(255, 255, 255, 0.8); }

        &.is-active {
            background: rgba(255, 90, 31, 0.85);
            color: #fff;
        }
    }

    // Fullscreen toggle button
    &__fullscreen-btn {
        all: unset;
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(8px);
        cursor: pointer;
        color: rgba(255, 255, 255, 0.8);
        transition: background 0.15s ease, color 0.15s ease;

        &:hover {
            background: rgba(255, 90, 31, 0.85);
            color: #fff;
        }

        @media (max-width: 640px) {
            width: 32px;
            height: 32px;
        }
    }

    &__fullscreen-icon {
        width: 16px;
        height: 16px;
    }

    // Party / Watch Together button
    &__party-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 90, 31, 0.12);
        border: 1px solid rgba(255, 90, 31, 0.3);
        backdrop-filter: blur(8px);
        border-radius: 999px;
        color: #ff7842;
        padding: 0.45rem 1rem;
        min-height: 36px;
        font-family: var(--font-ui, system-ui);
        font-size: 0.8125rem;
        font-weight: 600;
        text-decoration: none;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;

        &:hover {
            background: rgba(255, 90, 31, 0.22);
            border-color: rgba(255, 90, 31, 0.5);
            transform: translateY(-1px);
        }

        @media (max-width: 640px) {
            width: 36px;
            padding: 0;
            justify-content: center;
        }
    }

    &__party-label {
        @media (max-width: 640px) { display: none; }
    }

    &__party-icon {
        width: 15px;
        height: 15px;
        flex-shrink: 0;
    }

    // ── Rack: scrollable section below the fixed 100dvh video
    &__rack {
        position: relative;
        z-index: 1;
        margin-top: 100dvh;
        max-width: var(--container-max, 1280px);
        width: 100%;
        margin-left: auto;
        margin-right: auto;
        padding: 2rem 1.25rem calc(5rem + env(safe-area-inset-bottom, 0px));
        box-sizing: border-box;
        background: #080A10;

        @media (min-width: 768px) {
            padding: 2.5rem 2rem calc(5rem + env(safe-area-inset-bottom, 0px));
        }
    }

    &__mobile-episodes {
        margin-bottom: 1.5rem;
    }
}

@keyframes title-skeleton-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
}

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

.watch-stage__mobile-episodes {
    display: none;

    @media (max-width: 900px) {
        display: block;
        margin: var(--s-4) var(--s-3);
    }
}
</style>
