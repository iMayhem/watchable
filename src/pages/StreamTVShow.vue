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
                v-if="!isMoovieServer"
                :embed-url="currentEmbedUrl"
                :title="show?.name || 'Stream'"
                :backdrop-path="show?.backdrop_path || ''"
                :poster-path="show?.poster_path || ''"
                :media-id="showId"
                media-type="tv"
                :season="currentSeason"
                :episode="currentEpisode"
                @switch-to-server="changeServer"
            />
            <MoovieFrame
                v-else
                :media-id="showId"
                media-type="tv"
                :season="currentSeason"
                :episode="currentEpisode"
                :title="show?.name || 'Stream'"
                :backdrop-path="show?.backdrop_path || ''"
                :poster-path="show?.poster_path || ''"
                @next-episode="goToNextEpisode"
                @prev-episode="goToPreviousEpisode"
            />
        </div>

        <!-- TOP overlay: gradient + back + title + episode nav + server -->
        <div v-if="!isEmbed" class="watch-stage__top-overlay" :class="{ 'is-hidden': !controlsVisible }" @mouseenter="cancelHide" @mouseleave="onTopMouseLeave">
            <div class="watch-stage__top-gradient" aria-hidden="true" />
            <div class="watch-stage__top-bar">
                <div class="watch-stage__top-left">
                    <button
                        type="button"
                        class="watch-stage__back"
                        aria-label="Back to show"
                        @click="goBack"
                    >
                        <ArrowLeft />
                    </button>
                    <div class="watch-stage__breadcrumb">
                        <span class="watch-stage__breadcrumb-sep">·</span>
                        <h1 v-if="show" class="watch-stage__title">{{ show.name }}</h1>
                    </div>
                    <!-- Episode navigation pill -->
                    <div class="watch-stage__ep-nav">
                        <button
                            type="button"
                            class="watch-stage__nav-btn"
                            :disabled="currentEpisode <= 1"
                            @click="goToPreviousEpisode"
                            aria-label="Previous Episode"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                                <path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                        <span class="watch-stage__ep-code" @click="openEpisodePicker">
                            S{{ currentSeason }} · E{{ String(currentEpisode).padStart(2, '0') }}
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
                    <ServerAccordion
                        variant="dropdown"
                        :servers="availableServers"
                        :active-server-index="currentStreamData.currentServer"
                        @server-change="changeServer"
                    />
                    <button
                        v-if="show"
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
                    <a
                        :href="`/party?media=${showId}_s${currentSeason}e${currentEpisode}&title=${encodeURIComponent((show?.name || '') + ' - S' + currentSeason + 'E' + currentEpisode)}${isMoovieServer ? '&provider=moovie' : ''}`"
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

        <!-- Up-Next drawer (stays, it's an overlay itself) -->
        <UpNextDrawer
            v-if="!isEmbed && show && availableSeasons.length"
            ref="upNextDrawerRef"
            :current-season="currentSeason"
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
        <div v-if="!isEmbed && show" class="watch-stage__rack">
            <div class="watch-stage__mobile-episodes">
                <EpisodeNavigator
                    :available-seasons="seasons"
                    :season-episodes="seasonEpisodes"
                    :current-season="currentSeason"
                    :current-episode="currentEpisode"
                    :show-id="showId"
                    :is-loading-episodes="isLoadingEpisodes"
                    :preview-episodes="previewEpisodes"
                    :is-preview-loading="isPreviewLoading"
                    media-type="tv"
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
import { computed, defineComponent, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    useTvShows,
    TVShowDetails,
    Episode,
    TVShowSeasonDetails
} from '../composables/useTvShows';
import {
    currentStreamData,
    getPreferredStreamData,
    savePreferredServer,
    saveLastWatchedMetaData,
    getServers,
    buildStreamUrl
} from '../composables/useStream';
import { getResumeTimestamp } from '../composables/useProgress';
import { isInWatchlist, toggleWatchlistItem, type WatchlistItem } from '../composables/useWatchlist';

import { useAppPaths } from '../composables/useAppPaths';
import { useWebImage } from '../utils/useWebImage';

import StreamFrame from '../components/player/StreamFrame.vue';
import MoovieFrame from '../components/player/MoovieFrame.vue';
import ServerAccordion from '../components/player/ServerAccordion.vue';

import UpNextDrawer from '../components/player/UpNextDrawer.vue';
import ArrowLeft from '../components/svg/outline/arrow-left-long.vue';
import EpisodeNavigator from '../components/player/EpisodeNavigator.vue';

export default defineComponent({
    name: 'StreamTVShow',
    components: {
        StreamFrame,
        MoovieFrame,
        ServerAccordion,

        UpNextDrawer,
        ArrowLeft,
        EpisodeNavigator
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const isEmbed = computed(() => Boolean(route.meta.bareLayout));
        const paths = useAppPaths();
        const { fetchTvShow, fetchTvShowBySeason } = useTvShows();

        const showId = ref<string>(route.params.id as string);
        const externalId = ref<string>('');
        const show = ref<TVShowDetails | null>(null);
        const seasons = ref<TVShowSeasonDetails[]>([]);
        const seasonEpisodes = ref<Episode[]>([]);
        const nextSeasonEpisodes = ref<Episode[]>([]);
        const currentSeason = ref<number>(parseInt(route.params.season as string) || 1);
        const currentEpisode = ref<number>(parseInt(route.params.episode as string) || 1);
        const currentEpisodeDetails = ref<Episode | null>(null);
        const isLoadingEpisodes = ref(false);


        const nextAiringEpisode = ref<any | null>(null);

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

        const availableServers = computed(() => getServers('tv'));
        const isMoovieServer = computed(() => {
            const servers = getServers('tv');
            const idx = currentStreamData.value.currentServer;
            return servers[idx]?.name === 'Moovie';
        });
        const availableSeasons = computed(() =>
            seasons.value.filter((s) => s.season_number > 0)
        );

        const seasonsDropdownList = computed(() => {
            return availableSeasons.value.map(s => ({
                number: s.season_number,
                label: s.name || `Season ${s.season_number}`
            }));
        });

        const nextSeasonNumber = computed(() => {
            const next = availableSeasons.value.find(
                (s) => s.season_number === currentSeason.value + 1
            );
            return next ? next.season_number : 0;
        });

        const isLastEpisode = computed(() => {
            const now = new Date();
            const releasedCount = seasonEpisodes.value.filter(ep => {
                if (!ep.air_date) return true;
                return new Date(ep.air_date) <= now;
            }).length;
            const lastInSeason = currentEpisode.value === releasedCount;
            const lastSeason = !nextSeasonNumber.value;
            return lastInSeason && lastSeason;
        });

        const resumeTimestamp = ref(0);

        const isNavigatingToParty = ref(false);

        const currentEmbedUrl = computed(() => {
            if (isNavigatingToParty.value) return '';
            if (!externalId.value) return '';
            const ts = resumeTimestamp.value > 0 ? resumeTimestamp.value : undefined;
            return buildStreamUrl(
                externalId.value,
                'tv',
                currentStreamData.value.currentServer,
                currentSeason.value,
                currentEpisode.value,
                ts
            );
        });



        const updateDocumentTitle = () => {
            if (show.value?.name) {
                document.title = `Stream · ${show.value.name} · S${currentSeason.value}E${currentEpisode.value}`;
            }
        };

        const loadShow = async () => {
            if (!showId.value) return;
            try {
                resumeTimestamp.value = getResumeTimestamp(showId.value, 'tv', currentSeason.value, currentEpisode.value);
                const { data } = await fetchTvShow(showId.value);
                if (!data.value) throw new Error('No show data received');
                show.value = data.value;
                seasons.value = (data.value.seasons || []).map((s) => ({
                    ...s,
                    _id: String(s.id),
                    episodes: []
                }));
                externalId.value = showId.value;

                const preferred = getPreferredStreamData(showId.value, 'tv');
                if (!preferred) {
                    savePreferredServer(showId.value, 0, 'tv');
                }

                await loadSeason();
                updateDocumentTitle();
                nextTick(() => { resumeTimestamp.value = 0; });
            } catch (err) {
                console.error('Failed to load show:', err);
            }
        };

        const loadSeason = async () => {
            isLoadingEpisodes.value = true;
            try {
                const { data } = await fetchTvShowBySeason(showId.value, currentSeason.value);
                const allEpisodes = data.value?.episodes || [];
                const now = new Date();

                const released = allEpisodes.filter((ep: any) => {
                    if (!ep.air_date) return true;
                    return new Date(ep.air_date) <= now;
                });

                nextAiringEpisode.value = allEpisodes.find((ep: any) => {
                    if (!ep.air_date) return false;
                    return new Date(ep.air_date) > now;
                }) || null;

                if (nextAiringEpisode.value) {
                    seasonEpisodes.value = [...released, nextAiringEpisode.value];
                } else {
                    seasonEpisodes.value = released;
                }

                currentEpisodeDetails.value =
                    seasonEpisodes.value.find((ep) => ep.episode_number === currentEpisode.value) ||
                    seasonEpisodes.value[0] ||
                    null;

                if (currentEpisodeDetails.value) {
                    saveLastWatchedMetaData(showId.value, 'tv', {
                        season: currentSeason.value,
                        episode: currentEpisode.value
                    });
                }

                if (nextSeasonNumber.value) {
                    fetchTvShowBySeason(showId.value, nextSeasonNumber.value)
                        .then(({ data }) => {
                            const allNextEpisodes = data.value?.episodes || [];
                            const nextReleased = allNextEpisodes.filter((ep: any) => {
                                if (!ep.air_date) return true;
                                return new Date(ep.air_date) <= now;
                            });
                            const nextUpcoming = allNextEpisodes.find((ep: any) => {
                                if (!ep.air_date) return false;
                                return new Date(ep.air_date) > now;
                            });
                            if (nextUpcoming) {
                                nextSeasonEpisodes.value = [...nextReleased, nextUpcoming];
                            } else {
                                nextSeasonEpisodes.value = nextReleased;
                            }
                        })
                        .catch(() => {
                            nextSeasonEpisodes.value = [];
                        });
                } else {
                    nextSeasonEpisodes.value = [];
                }
            } catch (err) {
                console.error('Failed to load season:', err);
            } finally {
                isLoadingEpisodes.value = false;
            }
        };

        const updateRoute = async () => {
            try {
                await router.replace({
                    name: 'StreamTVShow',
                    params: {
                        id: showId.value,
                        season: String(currentSeason.value),
                        episode: String(currentEpisode.value)
                    }
                });
                saveLastWatchedMetaData(showId.value, 'tv', {
                    season: currentSeason.value,
                    episode: currentEpisode.value
                });
                updateDocumentTitle();
            } catch (err) {
                console.error('Failed to update route:', err);
            }
        };

        const onSeasonChange = async (next: number) => {
            if (currentSeason.value === next) return;
            currentSeason.value = next;
            currentEpisode.value = 1;
            resumeTimestamp.value = getResumeTimestamp(showId.value, 'tv', next, 1);
            await updateRoute();
            await loadSeason();
            nextTick(() => { resumeTimestamp.value = 0; });
        };

        const changeEpisode = async (next: number) => {
            if (next < 1 || next === currentEpisode.value) return;
            console.log('[EPISODE] changeEpisode called: from', currentEpisode.value, 'to', next, 'season:', currentSeason.value)
            currentEpisode.value = next;
            console.log('[EPISODE] currentEpisode set to', currentEpisode.value)
            resumeTimestamp.value = getResumeTimestamp(showId.value, 'tv', currentSeason.value, next);
            currentEpisodeDetails.value =
                seasonEpisodes.value.find((ep) => ep.episode_number === next) || null;
            console.log('[EPISODE] calling updateRoute...')
            await updateRoute();
            console.log('[EPISODE] updateRoute done')
            nextTick(() => { resumeTimestamp.value = 0; });
        };

        const onMobileEpisodeSelect = async (epNumber: number, selectedSeasonNum: number) => {
            if (currentSeason.value !== selectedSeasonNum) {
                currentSeason.value = selectedSeasonNum;
                currentEpisode.value = epNumber;
                resumeTimestamp.value = getResumeTimestamp(showId.value, 'tv', selectedSeasonNum, epNumber);
                await updateRoute();
                await loadSeason();
                nextTick(() => { resumeTimestamp.value = 0; });
            } else {
                changeEpisode(epNumber);
            }
        };

        const goToPreviousEpisode = async () => {
            if (currentEpisode.value > 1) {
                changeEpisode(currentEpisode.value - 1);
            } else if (currentSeason.value > 1) {
                const prevSeasonNum = currentSeason.value - 1;
                currentSeason.value = prevSeasonNum;
                currentEpisode.value = 1;
                await updateRoute();
                await loadSeason();
                const now = new Date();
                const releasedCount = seasonEpisodes.value.filter(ep => {
                    if (!ep.air_date) return true;
                    return new Date(ep.air_date) <= now;
                }).length;
                if (releasedCount > 0) {
                    changeEpisode(releasedCount);
                }
            }
        };

        const goToNextEpisode = () => {
            if (isLastEpisode.value) return;
            const now = new Date();
            const releasedCount = seasonEpisodes.value.filter(ep => {
                if (!ep.air_date) return true;
                return new Date(ep.air_date) <= now;
            }).length;
            if (currentEpisode.value < releasedCount) {
                changeEpisode(currentEpisode.value + 1);
            } else if (nextSeasonNumber.value) {
                onSeasonChange(nextSeasonNumber.value).then(() => changeEpisode(1));
            }
        };

        const onUpNextSelect = async (payload: { season: number; episode: number }) => {
            if (payload.season !== currentSeason.value) {
                currentSeason.value = payload.season;
                currentEpisode.value = payload.episode;
                await updateRoute();
                await loadSeason();
            } else {
                changeEpisode(payload.episode);
            }
        };

        const onUpNextSeasonChange = (next: number) => {
            if (next !== currentSeason.value) {
                onSeasonChange(next);
            }
        };

        const changeServer = (index: number) => {
            savePreferredServer(showId.value, index, 'tv');
            getPreferredStreamData(showId.value, 'tv');
        };

        const goBack = () => {
            router.push({
                path: paths.tvShow(showId.value),
                query: {
                    season: String(currentSeason.value),
                    episode: String(currentEpisode.value)
                }
            });
        };

        const handleWatchTogether = (event: MouseEvent) => {
            isNavigatingToParty.value = true;
            const target = event.currentTarget as HTMLAnchorElement;
            const href = target.href;
            setTimeout(() => {
                window.location.href = href;
            }, 50);
        };

        const previewEpisodes = ref<Episode[]>([]);
        const isPreviewLoading = ref(false);

        const onPreviewSeason = async (seasonNum: number) => {
            if (seasonNum === currentSeason.value) {
                previewEpisodes.value = [];
                return;
            }
            isPreviewLoading.value = true;
            try {
                const { data } = await fetchTvShowBySeason(showId.value, seasonNum);
                const allEpisodes = data.value?.episodes || [];
                const now = new Date();
                const released = allEpisodes.filter((ep: any) => {
                    if (!ep.air_date) return true;
                    return new Date(ep.air_date) <= now;
                });
                const nextAiring = allEpisodes.find((ep: any) => {
                    if (!ep.air_date) return false;
                    return new Date(ep.air_date) > now;
                }) || null;
                
                previewEpisodes.value = nextAiring ? [...released, nextAiring] : released;
            } catch (err) {
                console.error('Failed to load season preview:', err);
            } finally {
                isPreviewLoading.value = false;
            }
        };

        watch(
            () => route.params,
            async (next) => {
                const nextSeason = parseInt(next.season as string);
                const nextEpisode = parseInt(next.episode as string);
                console.log('[EPISODE] route.params watcher fired: id:', next.id, 'season:', nextSeason, 'episode:', nextEpisode, '| current season:', currentSeason.value, 'current ep:', currentEpisode.value)
                if (next.id !== showId.value) {
                    showId.value = next.id as string;
                    await loadShow();
                } else if (
                    nextSeason !== currentSeason.value ||
                    nextEpisode !== currentEpisode.value
                ) {
                    console.log('[EPISODE] route watcher updating season/episode from route')
                    currentSeason.value = nextSeason || 1;
                    currentEpisode.value = nextEpisode || 1;
                    await loadSeason();
                } else {
                    console.log('[EPISODE] route watcher: no change detected, skipping')
                }
            },
            { deep: true }
        );

        const upNextDrawerRef = ref<any>(null);

        const openEpisodePicker = () => {
            if (upNextDrawerRef.value) {
                upNextDrawerRef.value.open = true;
            }
        };

        // ── smov-style: auto-hide controls after 3s of inactivity ─────────────
        const controlsVisible = ref(true);
        const isHoveringTop = ref(false);
        let hideTimer: ReturnType<typeof setTimeout> | null = null;

        const cancelHide = () => {
            isHoveringTop.value = true;
            controlsVisible.value = true;
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
        };

        const onTopMouseLeave = () => {
            isHoveringTop.value = false;
            showControls();
        };

        const showControls = () => {
            controlsVisible.value = true;
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                if (!isHoveringTop.value) {
                    controlsVisible.value = false;
                }
            }, 3000);
        };

        const scheduleHide = () => {
            if (isHoveringTop.value) return;
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                if (!isHoveringTop.value) {
                    controlsVisible.value = false;
                }
            }, 800);
        };

        onMounted(() => {
            loadShow();
            showControls();
        });

        const inWatchlist = computed(() => {
            if (!showId.value) return false;
            return isInWatchlist(showId.value, 'tv');
        });

        const toggleWatchlist = () => {
            if (!showId.value || !show.value) return;
            const item: WatchlistItem = {
                id: show.value.id,
                title: show.value.name,
                image: show.value.poster_path || show.value.backdrop_path || null,
                rating: show.value.vote_average || 0,
                categories: (show.value.genres || []).map(g => g.id),
                adult: false,
                type: 'tv'
            };
            toggleWatchlistItem(item);
        };

        return {
            showId,
            externalId,
            show,
            currentStreamData,
            availableServers,
            isMoovieServer,
            availableSeasons,
            seasonEpisodes,
            currentSeason,
            currentEpisode,
            currentEpisodeDetails,
            isLoadingEpisodes,
            seasonsDropdownList,
            currentEmbedUrl,
            nextSeasonNumber,
            nextSeasonEpisodes,

            changeServer,
            onSeasonChange,
            changeEpisode,
            onMobileEpisodeSelect,
            goToPreviousEpisode,
            goToNextEpisode,
            onUpNextSelect,
            onUpNextSeasonChange,
            goBack,
            handleWatchTogether,
            nextAiringInfo,
            isLastEpisode,
            previewEpisodes,
            isPreviewLoading,
            onPreviewSeason,
            isEmbed,
            upNextDrawerRef,
            openEpisodePicker,
            useWebImage,
            seasons,
            controlsVisible,
            cancelHide,
            onTopMouseLeave,
            showControls,
            scheduleHide,
            inWatchlist,
            toggleWatchlist,
        };
    }
});
</script>

<style lang="scss" scoped>
// ─── Global: hide scroll-car on stream pages ────────────────────────────────
:global(.scroll-car-container) {
    display: none !important;
}

.watch-stage {
    position: relative;
    width: 100%;
    max-width: 100%;
    min-height: 100dvh;
    background: #080A10;
    color: #fff;
    overflow-x: hidden;
    cursor: none;

    &.controls-visible {
        cursor: default;

        .watch-stage__top-overlay,
        .watch-stage__back,
        .watch-stage__top-right {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }
    }

    // ── Video layer ──────────────────────────────────────────────────────────
    // Keep the player in the document flow so the comments rack can follow it
    // naturally when the page is scrolled. Embed routes still need a viewport-
    // pinned player, handled by the override below.
    &__video-layer {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100dvh;
        z-index: 0;

        :deep(.stream-frame),
        :deep(.moovie-frame) {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
        }

        :deep(.stream-frame__stage),
        :deep(.moovie-frame__stage) {
            width: 100%;
            height: 100%;
            padding: 0;
            margin: 0;
        }

        :deep(.stream-frame__player),
        :deep(.moovie-frame__player) {
            width: 100%;
            height: 100%;
            border-radius: 0;
            box-shadow: none;
            border: 0;
            background: #080A10;
        }
    }

    &.is-embed {
        .watch-stage__video-layer {
            position: fixed;
        }
    }

    // ── TOP overlay ─────────────────────────────────────────────────────────
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

    // ── Rack: scrollable section below the fixed 100dvh video ───────────────
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
</style>
