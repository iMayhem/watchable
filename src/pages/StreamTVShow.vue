<template>
    <div class="watch-stage">
        <header class="watch-stage__chrome">
            <div class="watch-stage__chrome-inner">
                <div class="watch-stage__crumb">
                    <button
                        type="button"
                        class="watch-stage__back"
                        aria-label="Back to show"
                        @click="goBack"
                    >
                        <ArrowLeft />
                    </button>
                    <p class="eyebrow">Now projecting</p>
                </div>

                <div class="watch-stage__title-block">
                    <h1 v-if="show" class="watch-stage__title">{{ show.name }}</h1>
                    <span v-else class="watch-stage__title-skeleton" aria-hidden="true" />
                    <div class="watch-stage__episode-nav">
                        <button
                            type="button"
                            class="watch-stage__nav-btn"
                            :disabled="currentEpisode <= 1"
                            @click="goToPreviousEpisode"
                            aria-label="Previous Episode"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                        <p class="meta watch-stage__code">
                            S{{ currentSeason }} · E{{ String(currentEpisode).padStart(2, '0') }}
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
                    <ServerAccordion
                        variant="dropdown"
                        :servers="availableServers"
                        :active-server-index="currentStreamData.currentServer"
                        @server-change="changeServer"
                    />

                    <a
                        :href="`/party/?room=${showId}_s${currentSeason}e${currentEpisode}&title=${encodeURIComponent((show?.name || '') + ' - S' + currentSeason + 'E' + currentEpisode)}`"
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
                        :title="show?.name || 'Stream'"
                        :backdrop-path="show?.backdrop_path || ''"
                        :poster-path="show?.poster_path || ''"
                        :media-id="showId"
                        media-type="tv"
                        :season="currentSeason"
                        :episode="currentEpisode"
                        @switch-to-server="changeServer"
                    />
                    
                    <!-- Keyboard Shortcuts Info -->
                    <div class="keyboard-shortcuts-info">
                        <button 
                            type="button" 
                            class="shortcuts-toggle"
                            @click="showShortcuts = !showShortcuts"
                            title="Keyboard Shortcuts"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
                            </svg>
                        </button>
                        
                        <transition name="shortcuts-fade">
                            <div v-if="showShortcuts" class="shortcuts-panel">
                                <h3 class="shortcuts-title">Keyboard Shortcuts</h3>
                                <div class="shortcuts-list">
                                    <div class="shortcut-item">
                                        <kbd>Space</kbd>
                                        <span>Play / Pause</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <kbd>←</kbd>
                                        <span>Seek backward 10s</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <kbd>→</kbd>
                                        <span>Seek forward 10s</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <kbd>Ctrl</kbd> + <kbd>←</kbd>
                                        <span>Previous episode</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <kbd>Ctrl</kbd> + <kbd>→</kbd>
                                        <span>Next episode</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <kbd>F</kbd>
                                        <span>Fullscreen</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <kbd>M</kbd>
                                        <span>Mute / Unmute</span>
                                    </div>
                                </div>
                            </div>
                        </transition>
                    </div>
                </div>
            </div>

            <section v-if="availableSeasons.length" class="watch-stage__rack">
                <EpisodeNavigator
                    :show-id="showId"
                    :available-seasons="availableSeasons"
                    :season-episodes="seasonEpisodes"
                    :current-season="currentSeason"
                    :current-episode="currentEpisode"
                    :is-loading-episodes="isLoadingEpisodes"
                    @season-change="onSeasonChange"
                    @select="changeEpisode"
                    @previous="goToPreviousEpisode"
                    @next="goToNextEpisode"
                />

                <!-- Next Airing Date notice -->
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



            <section v-if="show" class="watch-stage__rack">
                <CommentsSection :media-id="show.id" media-type="tv" />
            </section>

            <p class="watch-stage__disclaimer meta">
                Streams are mirrored from third-party providers. moovie does not host video files.
            </p>
        </main>

        <UpNextDrawer
            v-if="show && availableSeasons.length"
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

import { useAppPaths } from '../composables/useAppPaths';

import StreamFrame from '../components/player/StreamFrame.vue';
import ServerAccordion from '../components/player/ServerAccordion.vue';
import EpisodeNavigator from '../components/player/EpisodeNavigator.vue';
import UpNextDrawer from '../components/player/UpNextDrawer.vue';
import ArrowLeft from '../components/svg/outline/arrow-left-long.vue';
import CommentsSection from '../components/player/CommentsSection.vue';

export default defineComponent({
    name: 'StreamTVShow',
    components: {
        StreamFrame,
        ServerAccordion,
        EpisodeNavigator,
        UpNextDrawer,
        ArrowLeft,
        CommentsSection
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
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
        const showShortcuts = ref(false);

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
            currentEpisode.value = next;
            resumeTimestamp.value = getResumeTimestamp(showId.value, 'tv', currentSeason.value, next);
            currentEpisodeDetails.value =
                seasonEpisodes.value.find((ep) => ep.episode_number === next) || null;
            await updateRoute();
            nextTick(() => { resumeTimestamp.value = 0; });
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
                if (next.id !== showId.value) {
                    showId.value = next.id as string;
                    await loadShow();
                } else if (
                    nextSeason !== currentSeason.value ||
                    nextEpisode !== currentEpisode.value
                ) {
                    currentSeason.value = nextSeason || 1;
                    currentEpisode.value = nextEpisode || 1;
                    await loadSeason();
                }
            },
            { deep: true }
        );

        onMounted(() => {
            loadShow();
        });

        return {
            showId,
            externalId,
            show,
            currentStreamData,
            availableServers,
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
            showShortcuts,
            changeServer,
            onSeasonChange,
            changeEpisode,
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
            onPreviewSeason
        };
    }
});
</script>

<style lang="scss" scoped>
.watch-stage {
    height: 100vh;
    height: 100dvh;
    overflow-y: scroll;
    scroll-snap-type: y proximity;

    // Hide scroll car on all watch/stream pages
    & ~ :global(.scroll-car-container) {
        display: none !important;
    }

    @media (max-width: 1023px) {
        height: auto;
        min-height: 100dvh;
        scroll-snap-type: none;
        overflow-x: hidden;
    }
    scroll-behavior: smooth;
    background: var(--ink-900);
    color: var(--bone-50);

    // Hide scrollbar visually but keep it functional
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }

    &__chrome {
        position: sticky;
        top: 0;
        z-index: var(--z-header);
        background: linear-gradient(
            180deg,
            rgba(11, 10, 8, 0.95),
            rgba(11, 10, 8, 0.6) 70%,
            rgba(11, 10, 8, 0)
        );
        backdrop-filter: blur(14px);
    }

    &__chrome-inner {
        max-width: 1280px;
        margin: 0 auto;
        padding: var(--s-3) var(--s-4);
        display: grid;
        grid-template-columns: auto 1fr auto;
        grid-template-areas: 'crumb title actions';
        align-items: center;
        gap: var(--s-3) var(--s-4);

        @media (min-width: 768px) {
            padding: var(--s-4) var(--s-5);
        }

        // ── Mobile: stack title beneath the controls row ────────────────
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
        display: inline-flex;
        align-items: center;
        gap: var(--s-3);
        min-width: 0;

        @media (max-width: 640px) {
            gap: var(--s-2);

            .eyebrow {
                display: none;
            }
        }
    }

    &__back {
        all: unset;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 50%;
        background: var(--surface-tint);
        cursor: pointer;
        color: var(--bone-100);

        @media (max-width: 640px) {
            width: 36px;
            height: 36px;
        }
        transition:
            background-color var(--dur-fast) var(--ease-out),
            transform var(--dur-fast) var(--ease-out);

        &:hover {
            background: var(--ember);
            color: var(--ink-900);
            transform: translateX(-2px);
        }

        &:focus-visible {
            outline: 2px solid var(--ember);
            outline-offset: 2px;
        }

        :deep(svg) { width: 18px; height: 18px; }
    }

    &__title-block {
        grid-area: title;
        display: grid;
        gap: 0.15rem;
        text-align: center;
        min-width: 0;
    }

    &__title {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-lg);
        letter-spacing: var(--ls-tight);
        color: var(--bone-50);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        @media (min-width: 768px) {
            font-size: var(--fs-xl);
        }

        @media (max-width: 1023px) {
            display: none !important;
        }
    }

    &__title-skeleton {
        display: block;
        height: 18px;
        max-width: 280px;
        margin: 0 auto;
        background: var(--surface-tint);
        border-radius: var(--r-pill);

        @media (max-width: 1023px) {
            display: none !important;
        }
    }

    &__code {
        color: var(--bone-400);
        font-family: var(--font-mono);
    }

    &__episode-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 4px;

        @media (max-width: 640px) {
            justify-content: flex-start;
        }
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
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        justify-content: flex-end;
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
            scroll-snap-align: start;
            scroll-snap-stop: always;
            height: 100dvh;
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

    &__aside {
        min-width: 0;
        flex-shrink: 0;

        @media (max-width: 1023px) {
            display: none !important;
        }

        @media (min-width: 1024px) {
            position: relative;
            align-self: stretch;
        }

        :deep(.server-accordion) {
            background: var(--ink-850);
            box-shadow: inset 0 0 0 1px var(--rule);

            @media (min-width: 1024px) {
                position: absolute;
                inset: 0;
                display: flex;
                flex-direction: column;
                box-sizing: border-box;
            }
        }

        :deep(.server-accordion__body) {
            @media (min-width: 1024px) {
                flex: 1;
                min-height: 0;
                display: flex;
                flex-direction: column;
                box-sizing: border-box;
                overflow: hidden;
                padding-bottom: var(--s-4);
            }
        }

        :deep(.server-accordion__grid) {
            @media (min-width: 1024px) {
                flex: 1;
                overflow-y: auto;
                margin-top: var(--s-3);
                padding-right: var(--s-2);

                &::-webkit-scrollbar {
                    width: 6px;
                }
                &::-webkit-scrollbar-track {
                    background: transparent;
                }
                &::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: var(--r-pill);
                }
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
        max-width: 1280px;
        width: 100%;
        margin: 0 auto;
        padding: 0 var(--s-4);
        box-sizing: border-box;

        @media (max-width: 1023px) {
            padding: var(--s-5) var(--s-3) var(--s-4);
            scroll-snap-align: none;
            height: auto;
        }

        @media (min-width: 1024px) {
            scroll-snap-align: start;
            scroll-snap-stop: always;
            height: 100dvh;
            align-content: center;
            padding: 72px var(--s-5) var(--s-4) var(--s-5);
        }

        @media (min-width: 768px) {
            padding: 0 var(--s-5);
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
            scroll-snap-align: none;
            align-content: start;
            padding: var(--s-5) var(--s-3) var(--s-4);
            grid-template-columns: 1fr;
        }

        @media (min-width: 1024px) {
            scroll-snap-align: start;
            scroll-snap-stop: normal;
            height: 100dvh;
            align-content: center;
            padding: 72px var(--s-5) var(--s-4) var(--s-5);
        }

        @media (min-width: 768px) and (max-width: 1023px) {
            grid-template-columns: 1fr;
            align-items: start;
        }

        @media (min-width: 1024px) {
            grid-template-columns: 280px 1fr;
            align-items: center;
        }
    }

    &__poster {
        position: relative;
        aspect-ratio: 16 / 9;
        max-width: 280px;
        border-radius: var(--r-lg);
        overflow: hidden;
        box-shadow: var(--shadow-lg);
        margin: 0 auto;

        @media (max-width: 1023px) {
            display: none !important;
        }

        @media (min-width: 768px) {
            aspect-ratio: 2 / 3;
        }

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
    }

    &__rating {
        position: absolute;
        top: var(--s-3);
        left: var(--s-3);
        display: inline-flex;
        align-items: baseline;
        gap: 0.35rem;
        background: rgba(11, 10, 8, 0.7);
        backdrop-filter: blur(8px);
        padding: 0.5rem 0.85rem;
        border-radius: var(--r-pill);
        box-shadow: inset 0 0 0 1px var(--rule-strong);

        > .meta { color: var(--bone-300); }
    }

    &__rating-num {
        font-family: var(--font-display);
        font-weight: 600;
        color: var(--gold-leaf);
        font-size: var(--fs-lg);
    }

    &__feature-body {
        display: grid;
        gap: var(--s-3);
        align-content: start;
    }

    &__feature-title {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-3xl);
        line-height: var(--lh-tight);
        letter-spacing: var(--ls-tight);
        color: var(--bone-50);

        @media (min-width: 768px) {
            font-size: var(--fs-4xl);
        }
    }

    &__meta {
        list-style: none;
        margin: 0;
        padding: var(--s-3) 0;
        display: grid;
        gap: var(--s-3);
        border-top: 1px solid var(--rule);
        border-bottom: 1px solid var(--rule);
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));

        li {
            display: grid;
            gap: 0.2rem;

            > .meta {
                color: var(--bone-400);
                text-transform: uppercase;
                letter-spacing: var(--ls-micro);
                font-size: var(--fs-xs);
            }

            > span:not(.meta) {
                color: var(--bone-50);
                font-family: var(--font-ui);
                font-size: var(--fs-base);
            }
        }
    }

    &__overview {
        margin: 0;
        color: var(--bone-200);
        line-height: var(--lh-base);
        max-width: 60ch;
    }

    &__disclaimer {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 var(--s-4);
        text-align: center;
        color: var(--bone-500);

        @media (max-width: 1023px) {
            padding: 0 var(--s-3) calc(var(--s-8) + env(safe-area-inset-bottom, 0px));
        }

        @media (min-width: 768px) {
            padding: 0 var(--s-5);
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
}

// Hide scroll car on all watch/stream pages
:global(.scroll-car-container) {
    display: none !important;
}


// Keyboard Shortcuts Info Panel
.keyboard-shortcuts-info {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 50;
}

.shortcuts-toggle {
    background: rgba(10, 10, 12, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--r-sm);
    padding: 0.5rem;
    cursor: pointer;
    color: var(--bone-200);
    transition: all var(--dur-fast) var(--ease-out);
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
        width: 20px;
        height: 20px;
    }

    &:hover {
        background: rgba(10, 10, 12, 0.95);
        border-color: rgba(255, 255, 255, 0.2);
        color: var(--bone-50);
        transform: translateY(-1px);
    }
}

.shortcuts-panel {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: rgba(10, 10, 12, 0.96);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: var(--r-md);
    padding: 1rem;
    min-width: 280px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.shortcuts-title {
    font-family: var(--font-display);
    font-size: var(--fs-base);
    font-weight: 600;
    color: var(--bone-50);
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.shortcut-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: var(--fs-sm);
    color: var(--bone-300);

    kbd {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        padding: 0.2rem 0.5rem;
        font-family: var(--font-mono);
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--bone-50);
        min-width: 28px;
        text-align: center;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    span {
        flex: 1;
    }
}

.shortcuts-fade-enter-active,
.shortcuts-fade-leave-active {
    transition: opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out);
}

.shortcuts-fade-enter-from,
.shortcuts-fade-leave-to {
    opacity: 0;
    transform: translateY(-8px);
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
</style>
