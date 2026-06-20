<template>
    <section
        ref="rootRef"
        class="billboard"
        :class="{
            'trailer-playing': trailerLive,
            'is-loading': loading,
            'billboard--poster-art': isPosterKeyArt
        }"
        aria-label="Featured title"
    >
        <!-- Skeleton Loading state -->
        <div v-if="loading" class="billboard__skeleton-wrapper">
            <div class="billboard__stage billboard__skeleton-shimmer" />
            <div class="container-lm billboard__content">
                <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 120px; height: 16px; margin-bottom: 24px; border-radius: 4px" />
                <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 60%; height: 5rem; margin-bottom: 24px; border-radius: 8px" />
                <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 40%; height: 24px; margin-bottom: 16px; border-radius: 4px" />
                <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 50%; height: 60px; margin-bottom: 32px; border-radius: 6px" />
                <div class="billboard__actions">
                    <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                    <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                    <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                </div>
            </div>
        </div>

        <!-- Normal Content -->
        <template v-else>
            <div class="billboard__stage">
                <template v-if="backdropUrl">
                    <div v-if="isPosterKeyArt" class="billboard__art-fallback">
                        <img
                            class="billboard__art--blurred"
                            :src="backdropUrl"
                            alt=""
                            fetchpriority="low"
                            decoding="async"
                            loading="eager"
                        />
                        <img
                            class="billboard__art--contained"
                            :src="backdropUrl"
                            :alt="title"
                            fetchpriority="high"
                            decoding="async"
                            loading="eager"
                        />
                    </div>
                    <img
                        v-else
                        class="billboard__backdrop"
                        :src="backdropUrl"
                        :alt="title"
                        loading="eager"
                        fetchpriority="high"
                        decoding="async"
                    />
                </template>
                <div v-else class="billboard__backdrop billboard__backdrop--placeholder" aria-hidden="true" />

                <TrailerIframe
                    :bind-ref="setIframe"
                    :src="trailerSrc"
                    :visible="trailerVisible"
                    :live="trailerLive"
                    @load="onIframeLoad"
                />

                <div class="billboard__scrim" aria-hidden="true" />
                <div class="billboard__bloom" aria-hidden="true" />
                <div class="billboard__grain grain" aria-hidden="true" />
            </div>

            <TrailerControls
                :visible="trailerLive"
                :paused="userPaused"
                :muted="userMuted"
                @toggle-pause="togglePause"
                @toggle-mute="toggleMute"
            />

            <div class="container-lm billboard__content">
                <span class="eyebrow billboard__eyebrow">{{ eyebrow }}</span>

                <h1 class="billboard__title display">
                    {{ title }}
                </h1>

                <p v-if="tagline" class="billboard__tagline">{{ tagline }}</p>

                <ul class="billboard__meta meta">
                    <li v-if="year">{{ year }}</li>
                    <li v-if="ratingLabel" class="billboard__rating">
                        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                            <path fill="currentColor" d="M12 2l2.9 6.88L22 9.82l-5.34 4.94L18.18 22 12 18.27 5.82 22l1.52-7.24L2 9.82l7.1-.94z"/>
                        </svg>
                        {{ ratingLabel }}
                    </li>
                    <li v-for="g in genreNames" :key="g">{{ g }}</li>
                    <li v-if="adult" class="billboard__cert">18+</li>
                </ul>

                <p v-if="overview" class="billboard__overview">{{ truncatedOverview }}</p>

                <div class="billboard__actions">
                    <LmButton
                        variant="primary"
                        size="lg"
                        :to="playRoute"
                        aria-label="Play"
                    >
                        <template #leading>
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                <path fill="currentColor" d="M8 5v14l11-7z"/>
                            </svg>
                        </template>
                        Play
                    </LmButton>



                    <LmButton
                        variant="ghost"
                        size="lg"
                        :to="detailRoute"
                        aria-label="More info"
                    >
                        More info
                    </LmButton>

                    <LmButton
                        variant="outline"
                        size="lg"
                        :href="partyHref"
                        rel="nofollow"
                        aria-label="Watch Together"
                    >
                        <template #leading>
                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </template>
                        Watch Together
                    </LmButton>
                </div>
            </div>
        </template>
    </section>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, PropType, ref, toRef } from 'vue';
import LmButton from '../primitives/Button.vue';
import {
    catalogDisplayImageSize,
    isCatalogCdnImage
} from '../../utils/useWebImage';
import TrailerControls from './TrailerControls.vue';
import TrailerIframe from './TrailerIframe.vue';
import { genreName, primeGenres } from '../../composables/useGenreLookup';
import { useAmbientColor } from '../../composables/useAmbientColor';
import { useTrailerEmbed } from '../../composables/useTrailerEmbed';
import { useAppPaths } from '../../composables/useAppPaths';
import { useWebImage } from '../../utils/useWebImage';
import { buildPartyHref } from '../../utils/partyRoom';

export default defineComponent({
    name: 'BillboardHero',
    components: { LmButton, TrailerControls, TrailerIframe },
    props: {
        id: { type: [Number, String], default: '' },
        partyId: { type: [Number, String], default: null },
        partySource: { type: String as PropType<'global' | 'netflix'>, default: 'global' },
        type: { type: String as PropType<'movie' | 'tv' | 'anime'>, default: 'movie' },
        title: { type: String, default: '' },
        tagline: { type: String, default: '' },
        overview: { type: String, default: '' },
        backdropPath: { type: String as PropType<string | null>, default: null },
        posterPath: { type: String as PropType<string | null>, default: null },
        rating: { type: Number, default: 0 },
        releaseDate: { type: String, default: '' },
        genreIds: { type: Array as PropType<number[]>, default: () => [] },
        adult: { type: Boolean, default: false },
        eyebrow: { type: String, default: 'This week’s feature' },
        dwellMs: { type: Number, default: 2000 },
        loading: { type: Boolean, default: false },
        strictBackdrop: { type: Boolean, default: false },
        playTo: { type: [String, Object] as PropType<string | Record<string, unknown>>, default: null },
        detailTo: { type: [String, Object] as PropType<string | Record<string, unknown>>, default: null }
    },
    setup(props) {
        const rootRef = ref<HTMLElement | null>(null);
        const artPath = computed(() => {
            if (props.partySource === 'netflix') {
                return props.posterPath || props.backdropPath;
            }
            return props.strictBackdrop
                ? props.backdropPath
                : props.backdropPath || props.posterPath;
        });

        const isPosterKeyArt = computed(() => {
            const path = artPath.value;
            if (!path) return false;
            if (props.partySource === 'netflix') return true;
            if (props.backdropPath && props.backdropPath === props.posterPath) return true;
            return isCatalogCdnImage(path);
        });

        useAmbientColor(artPath, rootRef);

        const backdropUrl = computed(() => {
            const path = artPath.value;
            if (!path) return '';
            const preferHero = Boolean(props.backdropPath) && !isPosterKeyArt.value;
            const size = catalogDisplayImageSize(path, preferHero ? 'hero' : 'large');
            return useWebImage(path, size);
        });

        const year = computed(() =>
            props.releaseDate ? new Date(props.releaseDate).getFullYear() : null
        );

        const ratingLabel = computed(() =>
            props.rating > 0 ? props.rating.toFixed(1) : ''
        );

        const genreNames = computed(() => {
            return (props.genreIds || [])
                .map(id => genreName(id, props.type === 'anime' ? 'tv' : props.type))
                .filter((n): n is string => !!n)
                .slice(0, 3);
        });

        const truncatedOverview = computed(() => {
            if (!props.overview) return '';
            if (props.overview.length <= 240) return props.overview;
            return `${props.overview.slice(0, 237).trim()}…`;
        });

        const paths = useAppPaths();

        const playRoute = computed(() => {
            if (props.playTo) return props.playTo;
            return props.type === 'tv'
                ? paths.streamTvShow(props.id, 1, 1)
                : paths.streamMovie(props.id);
        });

        const detailRoute = computed(() => {
            if (props.detailTo) return props.detailTo;
            return paths.detailPath(props.type === 'tv' ? 'tv' : 'movie', props.id);
        });

        const partyHref = computed(() =>
            buildPartyHref({
                id: props.id,
                partyId: props.partyId ?? undefined,
                title: props.title,
                type: props.type,
                source: props.partySource
            })
        );

        const embedType = computed(() => props.type === 'anime' ? 'tv' as const : props.type);

        const {
            iframeRef,
            trailerVisible,
            trailerLive,
            trailerSrc,
            userPaused,
            userMuted,
            onIframeLoad,
            togglePause,
            toggleMute
        } = useTrailerEmbed({
            id: toRef(props, 'id'),
            type: embedType,
            rootEl: rootRef,
            dwellMs: props.dwellMs
        });

        const setIframe = (el: HTMLIFrameElement | null) => {
            iframeRef.value = el;
        };

        onMounted(() => {
            primeGenres();
        });

        return {
            rootRef,
            setIframe,
            backdropUrl,
            isPosterKeyArt,
            year,
            ratingLabel,
            genreNames,
            truncatedOverview,
            playRoute,
            detailRoute,
            partyHref,
            trailerVisible,
            trailerLive,
            trailerSrc,
            userPaused,
            userMuted,
            onIframeLoad,
            togglePause,
            toggleMute
        };
    }
});
</script>

<style lang="scss" scoped>
.billboard {
    position: relative;
    isolation: isolate;
    min-height: clamp(520px, 78vh, 880px);
    display: flex;
    align-items: flex-end;
    color: var(--bone-50);
    overflow: hidden;

    &__stage {
        position: absolute;
        inset: 0;
        z-index: 0;
    }

    &__backdrop {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 25%;
        transition: opacity var(--dur-slow) var(--ease-out);

        &--placeholder {
            background: radial-gradient(70% 70% at 40% 40%, var(--ink-700), var(--ink-900));
        }
    }

    &.trailer-playing &__backdrop,
    &.trailer-playing &__art-fallback { opacity: 0; }

    &--poster-art {
        min-height: clamp(420px, 62vh, 640px);
    }

    &--poster-art &__scrim {
        background:
            linear-gradient(180deg, rgba(11,10,8,0.6) 0%, rgba(11,10,8,0) 25%, rgba(11,10,8,0) 55%, rgba(11,10,8,0.8) 88%, var(--ink-900) 100%),
            radial-gradient(120% 90% at 0% 100%, rgba(11,10,8,0.7), rgba(11,10,8,0) 55%);
    }

    &__art-fallback {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: var(--ink-950);
        transition: opacity var(--dur-slow) var(--ease-out);
    }

    &__art--blurred {
        position: absolute;
        inset: -40px;
        width: calc(100% + 80px);
        height: calc(100% + 80px);
        object-fit: cover;
        filter: blur(30px) brightness(0.2) saturate(1.2);
        opacity: 0.9;
        z-index: 1;
    }

    &__art--contained {
        position: relative;
        z-index: 2;
        max-width: min(38vw, 280px);
        max-height: 68%;
        width: auto;
        height: auto;
        object-fit: contain;
        object-position: center;
        border-radius: var(--r-md, 8px);
        box-shadow: 0 12px 60px rgba(0, 0, 0, 0.95);
    }

    @media (max-width: 720px) {
        &__art--contained {
            max-width: min(56vw, 220px);
            max-height: 58%;
        }
    }

    &__scrim {
        position: absolute;
        inset: 0;
        background:
            linear-gradient(180deg, rgba(11,10,8,0) 0%, rgba(11,10,8,0) 40%, rgba(11,10,8,0.75) 85%, var(--ink-900) 100%),
            linear-gradient(90deg, rgba(11,10,8,0.85) 0%, rgba(11,10,8,0.45) 45%, rgba(11,10,8,0) 75%);
        pointer-events: none;
    }

    &__bloom {
        position: absolute;
        left: -10%;
        bottom: -30%;
        width: 80%;
        height: 80%;
        background: radial-gradient(closest-side, rgba(var(--ambient, 255 90 31), 0.20), transparent 70%);
        filter: blur(40px);
        pointer-events: none;
    }

    &__grain {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.6;
    }

    &__content {
        position: relative;
        z-index: 1;
        padding-block: clamp(var(--s-6), 8vh, var(--s-10));
        padding-inline: var(--s-6);
        max-width: 860px;
    }

    &__eyebrow {
        color: var(--ember);
        display: inline-block;
        margin-bottom: var(--s-3);
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(3rem, 8vw, 6.5rem);
        line-height: 0.96;
        letter-spacing: -0.02em;
        font-variation-settings: 'opsz' 144, 'SOFT' 30;
        color: var(--bone-50);
        margin: 0;
        text-wrap: balance;
        max-width: 18ch;
    }

    &__tagline {
        font-family: var(--font-display);
        font-style: italic;
        font-size: clamp(1.125rem, 1.6vw, 1.5rem);
        color: var(--bone-200);
        margin-top: var(--s-3);
        max-width: 48ch;
    }

    &__meta {
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-3);
        margin: var(--s-5) 0 0;
        padding: 0;
        color: var(--bone-200);
        font-size: var(--fs-xs);

        li {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            position: relative;
        }

        li + li::before {
            content: '·';
            color: var(--bone-400);
            margin-right: var(--s-3);
            position: absolute;
            left: calc(-1 * var(--s-3) - 0.2rem);
        }
    }

    &__rating {
        color: var(--gold-leaf);
        svg { color: var(--gold-leaf); }
    }

    &__cert {
        padding: 1px 6px;
        border: 1px solid var(--rule);
        border-radius: 2px;
        color: var(--bone-200);
    }

    &__overview {
        font-size: var(--fs-base);
        line-height: 1.55;
        color: var(--bone-200);
        margin: var(--s-5) 0 0;
        max-width: 52ch;

        @media (max-width: 600px) {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
    }

    &__actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-3);
        margin-top: var(--s-6);
    }

    @media (max-width: 720px) {
        min-height: clamp(460px, 70vh, 680px);
        align-items: flex-end;

        &__content { padding-block: var(--s-6); }
        &__overview { margin-top: var(--s-4); }
        &__actions { margin-top: var(--s-5); }
    }
}

@media (prefers-reduced-motion: reduce) {
    .billboard__backdrop { transition: none; }
}

.billboard__skeleton-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.billboard__skeleton-line {
    background: var(--ink-750);
}

.billboard__skeleton-shimmer {
    position: relative;
    overflow: hidden;
    background: var(--ink-750);

    &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.04),
            transparent
        );
        transform: translateX(-100%);
        animation: billboard-skeleton-shimmer-anim 1.6s infinite ease-in-out;
    }
}

@keyframes billboard-skeleton-shimmer-anim {
    100% {
        transform: translateX(100%);
    }
}
</style>
