<template>
    <div
        class="watch-stage"
        :class="{ 'is-embed': isEmbed, 'controls-visible': controlsVisible }"
        @mousemove="showControls"
        @mouseleave="scheduleHide"
        @touchstart.passive="showControls"
        @click="showControls"
    >
        <!--
            Mouse-capture layer: when controls are hidden the iframe swallows
            all pointer events and @mousemove on the stage never fires.
            This transparent div sits above the iframe only while controls are
            hidden, catches the first pointermove, shows controls, then gets
            pointer-events: none again so the iframe is usable.
        -->
        <div
            v-if="!controlsVisible"
            class="watch-stage__capture"
            @pointermove.passive="showControls"
            @touchstart.passive="showControls"
            @click="showControls"
        />

        <!-- Full-screen video layer -->
        <div class="watch-stage__video-layer">
            <MoovieFrame
                :media-id="movieId"
                media-type="movie"
                :title="movie?.title || 'Stream'"
                :backdrop-path="movie?.backdrop_path || ''"
                :poster-path="movie?.poster_path || ''"
            />
        </div>

        <!-- TOP overlay: gradient + back + title + server -->
        <div v-if="!isEmbed" class="watch-stage__top-overlay" :class="{ 'is-hidden': !controlsVisible }" @mouseenter="cancelHide" @mouseleave="onTopMouseLeave">
            <div class="watch-stage__top-bar">
                <div class="watch-stage__top-left">
                    <button type="button" class="watch-stage__back" aria-label="Back to home" title="Back to home" @click="goBack">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5" />
                            <path d="m12 19-7-7 7-7" />
                        </svg>
                    </button>
                    <div class="watch-stage__breadcrumb">
                        <span class="watch-stage__breadcrumb-sep">·</span>
                        <h1 v-if="movie" class="watch-stage__title">{{ movie.title }}</h1>
                    </div>
                </div>
                <div class="watch-stage__top-right">
                    <button
                        v-if="movie"
                        type="button"
                        class="watch-stage__party-btn watch-stage__watchlist-btn"
                        :class="{ 'is-added': inWatchlist }"
                        :aria-label="inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'"
                        :title="inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'"
                        @click="toggleWatchlist"
                    >
                        <svg v-if="!inWatchlist" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="watch-stage__party-icon">
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="watch-stage__party-icon">
                            <path d="m5 13 4 4L19 7"/>
                        </svg>
                    </button>
                    <a
                        :href="`/party?media=${movieId}&title=${encodeURIComponent(movie?.title || '')}&provider=moovie`"
                        class="watch-stage__party-btn"
                        aria-label="Watch Together"
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
                    </a>
                </div>
            </div>
        </div>

        <!-- BOTTOM overlay for comments (scrollable below player) -->
        <div v-if="!isEmbed && movie" class="watch-stage__rack">
            <CommentsSection :media-id="movie.id" media-type="movie" />
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMovies, MovieDetails } from '../composables/useMovies';
import {
    currentStreamData,
    getPreferredStreamData,
    savePreferredServer
} from '../composables/useStream';
import { getResumeTimestamp } from '../composables/useProgress';
import { isInWatchlist, toggleWatchlistItem, type WatchlistItem } from '../composables/useWatchlist';

import { useAppPaths } from '../composables/useAppPaths';

import MoovieFrame from '../components/player/MoovieFrame.vue';
import CommentsSection from '../components/player/CommentsSection.vue';

export default defineComponent({
    name: 'StreamMovie',
    components: { MoovieFrame, CommentsSection },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const paths = useAppPaths();
        const isEmbed = computed(() => Boolean(route.meta.bareLayout));
        const movieId = ref<string>(route.params.id as string);
        const movie = ref<MovieDetails | null>(null);
        const error = ref<string | null>(null);
        const { fetchMovie } = useMovies();

        const resumeTimestamp = ref(0);

        const isNavigatingToParty = ref(false);

        const loadMovie = async () => {
            if (!movieId.value) {
                error.value = 'Invalid movie ID';
                return;
            }
            try {
                resumeTimestamp.value = getResumeTimestamp(movieId.value, 'movie');
                const { data } = await fetchMovie(movieId.value);
                if (!data.value) throw new Error('No movie data received');
                movie.value = data.value;
                document.title = `Stream · ${data.value.title}`;

                if (!getPreferredStreamData(movieId.value, 'movie')) {
                    savePreferredServer(movieId.value, 0, 'movie');
                    getPreferredStreamData(movieId.value, 'movie');
                }

            } catch (err) {
                error.value = err instanceof Error ? err.message : 'Failed to load movie';
                console.error(err);
            }
        };

        const goBack = () => {
            router.push(paths.home.value);
        };

        const handleWatchTogether = (event: MouseEvent) => {
            isNavigatingToParty.value = true;
            const target = event.currentTarget as HTMLAnchorElement;
            const href = target.href;
            setTimeout(() => {
                window.location.href = href;
            }, 50);
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

        watch(
            () => route.params.id,
            (next, prev) => {
                if (next && next !== prev) {
                    movieId.value = next as string;
                    loadMovie();
                }
            }
        );

        onMounted(() => {
            loadMovie();
            showControls();
        });

        const inWatchlist = computed(() => {
            if (!movieId.value) return false;
            return isInWatchlist(movieId.value, 'movie');
        });

        const toggleWatchlist = () => {
            if (!movieId.value || !movie.value) return;
            const item: WatchlistItem = {
                id: movie.value.id,
                title: movie.value.title,
                image: movie.value.poster_path || movie.value.backdrop_path || null,
                rating: movie.value.vote_average || 0,
                categories: (movie.value.genres || []).map(g => g.id),
                adult: movie.value.adult || false,
                type: 'movie'
            };
            toggleWatchlistItem(item);
        };

        return {
            isEmbed,
            movieId,
            movie,
            currentStreamData,
            goBack,
            handleWatchTogether,
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
    background: #000;
    color: #fff;
    overflow-x: hidden;
    cursor: none;

    &.is-embed {
        min-height: 100% !important;
        height: 100% !important;
        overflow: hidden;

        .watch-stage__video-layer {
            position: absolute !important;
            inset: 0;
            height: 100%;
        }
    }

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

    // ── Mouse-capture layer (re-shows controls when iframe has focus) ────────
    &__capture {
        position: fixed;
        inset: 0;
        z-index: 10; // above iframe, below top-overlay (z-index: 50)
        cursor: none;
        background: transparent;
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
            background: #000;
        }
    }

    &.is-embed {
        .watch-stage__video-layer { position: absolute; }
    }

    // ── TOP overlay ─────────────────────────────────────────────────────────
    &__top-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 50;
        background: transparent !important;
        background-color: transparent !important;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s ease;
    }

    &__top-gradient {
        position: absolute;
        inset: 0;
        height: 180px;
        background: transparent !important;
        opacity: 0 !important;
        pointer-events: none;
    }

    &__top-bar {
        position: relative;
        background: transparent !important;
        background-color: transparent !important;
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
        background: transparent !important;
        background-color: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        cursor: pointer;
        color: #fff;
        transition: background 0.15s ease, transform 0.15s ease;

        &:hover {
            background: transparent !important;
            background-color: transparent !important;
            color: #fff;
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
    }

    &__breadcrumb-sep {
        color: rgba(255, 255, 255, 0.4);
        font-size: 1.1rem;
        flex-shrink: 0;

        @media (max-width: 640px) { display: none; }
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
        @media (max-width: 640px) { display: none; }
    }

    &__party-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(0, 0, 0, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.34);
        backdrop-filter: blur(8px);
        border-radius: 999px;
        color: #fff;
        padding: 0;
        width: 36px;
        justify-content: center;
        min-height: 36px;
        font-family: var(--font-ui, system-ui);
        font-size: 0.8125rem;
        font-weight: 600;
        text-decoration: none;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;

        &:hover {
            background: #fff;
            color: #000;
            border-color: #fff;
            transform: translateY(-1px);
        }

    }

    &__party-label {
        display: none;
    }

    &__party-icon {
        width: 17px;
        height: 17px;
        flex-shrink: 0;
    }

    // ── Comments rack below the fixed video ─────────────────────────────────
    &__rack {
        position: relative;
        z-index: 1;
        margin-top: 100dvh;
        max-width: var(--container-max, 1280px);
        width: 100%;
        margin-left: auto;
        margin-right: auto;
        padding: 2.5rem 1.25rem calc(5rem + env(safe-area-inset-bottom, 0px));
        box-sizing: border-box;
        background: #000;

        @media (min-width: 768px) {
            padding: 3rem 2rem calc(5rem + env(safe-area-inset-bottom, 0px));
        }
    }
}
</style>
