<template>
    <div class="watch-stage" :class="{ 'is-embed': isEmbed }">
        <header v-if="!isEmbed" class="watch-stage__chrome">
            <div class="watch-stage__chrome-inner">
                <div class="watch-stage__crumb">
                    <button
                        type="button"
                        class="watch-stage__back"
                        aria-label="Back to feature"
                        @click="goBack"
                    >
                        <ArrowLeft />
                    </button>
                    <p class="eyebrow">Now projecting</p>
                </div>

                <h1 v-if="movie" class="watch-stage__title">{{ movie.title }}</h1>
                <span v-else class="watch-stage__title-skeleton" aria-hidden="true" />

                <div class="watch-stage__actions">
                    <ServerAccordion
                        variant="dropdown"
                        :servers="availableServers"
                        :active-server-index="activeAccordionIndex"
                        @server-change="changeServer"
                    />

                    <a
                        :href="`/party?media=${movieId}&title=${encodeURIComponent(movie?.title || '')}${isMoovieServer ? '&provider=moovie' : ''}`"
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
            <div class="watch-stage__theater" :class="{ 'is-embed': isEmbed }">
                <div class="watch-stage__player-container" :class="{ 'is-embed': isEmbed }">
                    <StreamFrame
                        v-if="!isMoovieServer"
                        :embed-url="currentEmbedUrl"
                        :title="movie?.title || 'Stream'"
                        :backdrop-path="movie?.backdrop_path || ''"
                        :poster-path="movie?.poster_path || ''"
                        :media-id="movieId"
                        media-type="movie"
                        @switch-to-server="changeServer"
                    />
                    <MoovieFrame
                        v-else
                        :media-id="movieId"
                        media-type="movie"
                        :title="movie?.title || 'Stream'"
                        :backdrop-path="movie?.backdrop_path || ''"
                        :poster-path="movie?.poster_path || ''"
                    />
                </div>
            </div>

            <section v-if="!isEmbed && movie" class="watch-stage__rack">
                <CommentsSection :media-id="movie.id" media-type="movie" />
            </section>
        </main>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMovies, MovieDetails } from '../composables/useMovies';
import {
    currentStreamData,
    getPreferredStreamData,
    savePreferredServer,
    getServers,
    buildStreamUrl
} from '../composables/useStream';
import { getResumeTimestamp } from '../composables/useProgress';

import { useAppPaths } from '../composables/useAppPaths';

import StreamFrame from '../components/player/StreamFrame.vue';
import MoovieFrame from '../components/player/MoovieFrame.vue';
import ServerAccordion from '../components/player/ServerAccordion.vue';
import ArrowLeft from '../components/svg/outline/arrow-left-long.vue';
import CommentsSection from '../components/player/CommentsSection.vue';

export default defineComponent({
    name: 'StreamMovie',
    components: { StreamFrame, MoovieFrame, ServerAccordion, ArrowLeft, CommentsSection },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const paths = useAppPaths();
        const isEmbed = computed(() => Boolean(route.meta.bareLayout));
        const movieId = ref<string>(route.params.id as string);
        const movie = ref<MovieDetails | null>(null);
        const error = ref<string | null>(null);
        const { fetchMovie } = useMovies();

        const availableServers = computed(() => {
            const allServers = getServers('movie');
            if (route.query.mode === '4k') {
                return allServers.filter(s => s.name === 'Kaju Katli');
            }
            return allServers;
        });
        const activeAccordionIndex = computed(() => {
            if (route.query.mode === '4k') {
                return 0;
            }
            return currentStreamData.value.currentServer;
        });
        const isMoovieServer = computed(() => {
            const servers = getServers('movie');
            const idx = currentStreamData.value.currentServer;
            return servers[idx]?.name === 'Moovie';
        });
        const reloadKey = ref(0);
        const resumeTimestamp = ref(0);

        const isNavigatingToParty = ref(false);

        const currentEmbedUrl = computed(() => {
            if (isNavigatingToParty.value) return '';
            if (!movieId.value) return '';

            const ts = (resumeTimestamp.value > 0 && reloadKey.value === 0)
                ? resumeTimestamp.value
                : undefined;
            
            let serverIndex = currentStreamData.value.currentServer;
            if (route.query.mode === '4k') {
                const kajuIndex = getServers('movie').findIndex(s => s.name === 'Kaju Katli');
                if (kajuIndex !== -1) {
                    serverIndex = kajuIndex;
                }
            }

            const base = buildStreamUrl(
                movieId.value,
                'movie',
                serverIndex,
                1,
                1,
                ts
            );
            if (reloadKey.value > 0) {
                return `${base}${base.includes('?') ? '&' : '?'}t=${reloadKey.value}`;
            }
            return base;
        });



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

        const changeServer = (index: number) => {
            if (route.query.mode === '4k') return;
            if (index < 0 || index >= availableServers.value.length) return;
            savePreferredServer(movieId.value, index, 'movie');
            getPreferredStreamData(movieId.value, 'movie');
            reloadKey.value = Date.now();
        };

        const goBack = () => {
            router.push(paths.movie(movieId.value));
        };

        const handleWatchTogether = (event: MouseEvent) => {
            isNavigatingToParty.value = true;
            const target = event.currentTarget as HTMLAnchorElement;
            const href = target.href;
            setTimeout(() => {
                window.location.href = href;
            }, 50);
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
        });

        return {
            isEmbed,
            movieId,
            movie,
            currentStreamData,
            availableServers,
            activeAccordionIndex,
            isMoovieServer,
            currentEmbedUrl,
            changeServer,
            goBack,
            handleWatchTogether
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
    background: var(--ink-900);
    color: var(--bone-50);

    &.is-embed {
        min-height: 100dvh !important;
        height: 100dvh !important;
        overflow: hidden !important;
        padding: 0 !important;
        margin: 0 !important;
        background: #000 !important;

        .watch-stage__main {
            height: 100dvh !important;
            grid-template-rows: 1fr !important;
            gap: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
        }

        .watch-stage__theater {
            max-width: 100% !important;
            width: 100% !important;
            height: 100dvh !important;
            min-height: 100dvh !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
        }

        .watch-stage__player-container {
            width: 100% !important;
            height: 100dvh !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;

            :deep(.stream-frame__player),
            :deep(.moovie-frame__player) {
                width: 100% !important;
                height: 100dvh !important;
                max-width: 100% !important;
                max-height: 100dvh !important;
                aspect-ratio: unset !important;
                border-radius: 0 !important;
                border: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            :deep(.stream-frame__stage),
            :deep(.moovie-frame__stage) {
                padding: 0 !important;
                height: 100dvh !important;
                max-height: 100dvh !important;
            }
        }
    }

    // Hide scroll car on all watch/stream pages
    & ~ :global(.scroll-car-container) {
        display: none !important;
    }

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

        // Overlay the player slide — avoids double gap once scroll-snap is off.
        @media (min-width: 1024px) {
            position: fixed;
            left: 0;
            right: 0;
        }
    }

    &__chrome-inner {
        max-width: var(--container-max);
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

        // ── Mobile: controls row only, title removed ────────────────
        @media (max-width: 640px) {
            grid-template-columns: auto 1fr;
            grid-template-areas: 'crumb actions';
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

        @media (max-width: 1023px) {
            gap: var(--s-2);

            .eyebrow {
                display: none !important;
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

    &__title {
        grid-area: title;
        margin: 0;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-lg);
        letter-spacing: var(--ls-tight);
        color: var(--bone-50);
        text-align: center;
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
        grid-area: title;
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
        max-width: var(--container-max);
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
            min-height: auto;
            max-width: 100% !important;
            padding: 72px 0 0 0;
            grid-template-columns: 1fr;
            align-items: stretch;
        }
    }

    &__player-container {
        min-width: 0;
        flex-shrink: 0;

        @media (max-width: 1023px) {
            width: 100%;

            :deep(.stream-frame__stage),
            :deep(.moovie-frame__stage) {
                padding: 0;
            }

            :deep(.stream-frame__player),
            :deep(.moovie-frame__player) {
                border-radius: var(--r-md);
            }
        }

        @media (min-width: 1024px) {
            :deep(.stream-frame__player),
            :deep(.moovie-frame__player) {
                width: 100%;
                max-width: 100% !important;
                aspect-ratio: 16 / 9;
                height: auto;
                max-height: 82vh;
                margin: 0;
                border-radius: 0 !important;
                border: 0 !important;
            }
            :deep(.stream-frame__stage),
            :deep(.moovie-frame__stage) {
                padding: 0 !important;
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
        max-width: var(--container-max);
        width: 100%;
        margin: 0 auto;
        padding: var(--s-5) var(--s-4) calc(var(--s-9) + env(safe-area-inset-bottom, 0px));
        box-sizing: border-box;

        @media (min-width: 768px) {
            padding: var(--s-6) var(--s-5) calc(var(--s-9) + env(safe-area-inset-bottom, 0px));
        }
    }

    &__feature {
        display: grid;
        gap: var(--s-6);
        max-width: var(--container-max);
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

    &__tagline {
        margin: 0;
        font-family: var(--font-display);
        font-style: italic;
        color: var(--bone-200);
        font-size: var(--fs-lg);
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
</style>
