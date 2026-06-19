<template>
    <div class="watch-stage">
        <header class="watch-stage__chrome">
            <div class="watch-stage__chrome-inner">
                <div class="watch-stage__crumb">
                    <button
                        type="button"
                        class="watch-stage__back"
                        aria-label="Back to title"
                        @click="goBack"
                    >
                        <ArrowLeft />
                    </button>
                    <p class="eyebrow">Now projecting</p>
                </div>

                <h1 v-if="title" class="watch-stage__title">{{ title }}</h1>
                <span v-else class="watch-stage__title-skeleton" aria-hidden="true" />

                <div class="watch-stage__actions">
                    <div v-if="resolved?.streams?.length" class="watch-stage__qualities">
                        <button
                            v-for="(stream, index) in resolved.streams"
                            :key="stream.url"
                            type="button"
                            class="watch-stage__quality"
                            :class="{ 'is-active': selectedStreamIndex === index }"
                            @click="onQuality(index)"
                        >
                            {{ stream.quality }}
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <main class="watch-stage__main" id="main">
            <div class="watch-stage__theater">
                <div class="watch-stage__player-container">
                    <div class="nf-player">
                        <div ref="artContainer" class="nf-player__stage" />
                        <div v-if="!artReady" class="nf-player__placeholder">
                            {{ loading ? 'Resolving stream…' : 'Preparing player…' }}
                        </div>
                    </div>
                </div>
            </div>

            <p v-if="playbackError" class="watch-stage__error" role="alert">{{ playbackError }}</p>

            <p class="watch-stage__disclaimer meta">
                Streams are mirrored from third-party providers. moovie does not host video files.
                <span v-if="extensionActive"> · Extension active</span>
            </p>
        </main>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ArrowLeft from '../components/svg/outline/arrow-left-long.vue';
import { parseNetmirrorTitle } from '../composables/useNetmirror';
import { useNetmirrorPlayer } from '../composables/useNetmirrorPlayer';
import { useSeo } from '../composables/useSeo';

export default defineComponent({
    name: 'StreamNetflix',
    components: { ArrowLeft },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const {
            extensionActive,
            loading,
            playbackError,
            resolved,
            selectedStreamIndex,
            artReady,
            artContainer,
            resolveAndPlay,
            switchQuality
        } = useNetmirrorPlayer();

        const mediaType = computed((): 'movie' | 'tv' => {
            if (route.name === 'StreamNetflixTV') return 'tv';
            return 'movie';
        });

        const title = computed(() => {
            const raw = resolved.value?.meta?.title || '';
            if (!raw) return '';
            return parseNetmirrorTitle(raw).displayTitle || raw;
        });

        const resolveUrl = computed(() => {
            const params = new URLSearchParams({
                action: 'resolve',
                type: mediaType.value,
                id: String(route.params.id || ''),
                se: String(route.params.season || '0'),
                ep: String(route.params.episode || '0'),
                server: '1'
            });
            return `/api/netmirror?${params.toString()}`;
        });

        const goBack = () => {
            const id = route.params.id;
            router.push(`/nf/${mediaType.value}/${id}`);
        };

        const startPlayback = () => {
            resolveAndPlay({
                type: mediaType.value,
                id: String(route.params.id || ''),
                season: parseInt(String(route.params.season || '0'), 10),
                episode: parseInt(String(route.params.episode || '0'), 10)
            });
        };

        const onQuality = (index: number) => {
            switchQuality(index, resolveUrl.value);
        };

        onMounted(() => {
            updateSeo({
                title: 'Watch — Netflix on Moovie',
                canonical: `https://moovie.fun${route.path}`,
                image: 'https://moovie.fun/og-image.png'
            });
            startPlayback();
        });

        watch(
            () => [route.params.id, route.params.season, route.params.episode],
            startPlayback
        );

        return {
            extensionActive,
            loading,
            playbackError,
            resolved,
            selectedStreamIndex,
            artReady,
            artContainer,
            title,
            goBack,
            onQuality
        };
    }
});
</script>

<style lang="scss" scoped>
.watch-stage {
    height: 100vh;
    height: 100dvh;
    overflow-y: scroll;
    scroll-snap-type: y mandatory;
    scroll-behavior: smooth;
    background: var(--ink-900);
    color: var(--bone-50);

    & ~ :global(.scroll-car-container) {
        display: none !important;
    }

    @media (max-width: 1023px) {
        height: auto;
        min-height: 100dvh;
        scroll-snap-type: none;
        overflow-x: hidden;
    }

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

        &:hover {
            background: var(--ember);
            color: var(--ink-900);
            transform: translateX(-2px);
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

        @media (max-width: 640px) {
            text-align: left;
            padding-inline: var(--s-1);
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
    }

    &__actions {
        grid-area: actions;
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        justify-content: flex-end;
    }

    &__qualities {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        justify-content: flex-end;
    }

    &__quality {
        padding: 0.35rem 0.7rem;
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);
        background: rgba(255, 255, 255, 0.06);
        color: var(--bone-200);
        font-family: var(--font-mono);
        font-size: 0.68rem;
        cursor: pointer;

        &.is-active,
        &:hover {
            border-color: var(--ember);
            color: var(--bone-50);
        }
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
        width: 100%;
    }

    &__error {
        max-width: 1440px;
        margin: var(--s-3) auto 0;
        padding: 0 var(--s-5);
        color: #ff8b8b;
        font-size: var(--fs-sm);
    }

    &__disclaimer {
        max-width: 1440px;
        margin: var(--s-4) auto var(--s-6);
        padding: 0 var(--s-5);
        text-align: center;
    }
}

.nf-player {
    position: relative;
    width: 100%;
    background: var(--ink-850);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    overflow: hidden;

    @media (max-width: 1023px) {
        aspect-ratio: 16 / 9;
    }

    @media (min-width: 1024px) {
        height: clamp(300px, 38vw, 520px);
    }

    &__stage {
        width: 100%;
        height: 100%;
        min-height: inherit;
    }

    &__placeholder {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--bone-400);
        font-size: var(--fs-sm);
        pointer-events: none;
    }
}
</style>