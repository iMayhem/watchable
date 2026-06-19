<template>
    <header ref="rootRef" class="masthead" :class="{ 'trailer-playing': trailerLive, 'is-loading': loading }" :aria-label="loading ? 'Loading...' : `${title} — masthead`">
        <!-- Skeleton Loading state -->
        <div v-if="loading" class="masthead__skeleton-wrapper">
            <div class="masthead__stage masthead__skeleton-shimmer" />
            <div class="container-lm masthead__inner">
                <div class="masthead__crumb eyebrow" style="opacity: 0.3">
                    <span aria-hidden="true">←</span> Back to issue
                </div>
                <div class="masthead__content">
                    <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 140px; height: 16px; margin-bottom: 24px; border-radius: 4px" />
                    <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 55%; height: 5.5rem; margin-bottom: 24px; border-radius: 8px" />
                    <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 35%; height: 24px; margin-bottom: 24px; border-radius: 4px" />
                    <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 280px; height: 32px; margin-bottom: 32px; border-radius: 16px" />
                    <div class="masthead__actions">
                        <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                        <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                        <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Normal Masthead Content -->
        <template v-else>
            <div class="masthead__stage">
                <template v-if="backdropUrl">
                    <div v-if="isVerticalBackdrop" class="masthead__art-fallback-container">
                        <img
                            :key="`masthead-blur-${id}-${backdropPath}`"
                            class="masthead__art--blurred"
                            :src="backdropUrl"
                            alt=""
                            fetchpriority="low"
                            decoding="async"
                            loading="eager"
                        />
                        <img
                            :key="`masthead-contain-${id}-${backdropPath}`"
                            class="masthead__art--contained"
                            :src="backdropUrl"
                            :alt="title"
                            fetchpriority="high"
                            decoding="async"
                            loading="eager"
                        />
                    </div>
                    <img
                        v-else
                        :key="`masthead-art-${id}-${backdropPath}`"
                        class="masthead__art"
                        :src="backdropUrl"
                        :alt="title"
                        fetchpriority="high"
                        decoding="async"
                        loading="eager"
                    />
                </template>
                <div v-else class="masthead__art masthead__art--placeholder" aria-hidden="true" />

                <TrailerIframe
                    :bind-ref="setIframe"
                    :src="trailerSrc"
                    :visible="trailerVisible"
                    :live="trailerLive"
                    @load="onIframeLoad"
                />

                <div class="masthead__scrim" aria-hidden="true" />
                <div class="masthead__bloom" aria-hidden="true" />
                <div class="masthead__grain grain" aria-hidden="true" />
            </div>

            <TrailerControls
                :visible="trailerLive"
                :paused="userPaused"
                :muted="userMuted"
                @toggle-pause="togglePause"
                @toggle-mute="toggleMute"
            />

            <div class="container-lm masthead__inner">
                <button
                    type="button"
                    class="masthead__crumb eyebrow"
                    @click="goBackToIssue"
                >
                    <span aria-hidden="true">←</span>
                    Back to issue
                </button>

                <div class="masthead__content">
                    <span class="eyebrow masthead__eyebrow">
                        {{ eyebrow }}
                        <span v-if="year" class="masthead__year">· {{ year }}</span>
                    </span>

                    <h1 class="masthead__title display" data-reveal>{{ title }}</h1>

                    <p v-if="tagline" class="masthead__tagline">
                        <span class="masthead__quote" aria-hidden="true">“</span>{{ tagline }}<span class="masthead__quote" aria-hidden="true">”</span>
                    </p>

                    <ul
                        v-if="audioTags.length || genres.length || ratingLabel"
                        class="masthead__chips"
                    >
                        <li v-if="ratingLabel" class="masthead__rating">
                            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                                <path fill="currentColor" d="M12 2l2.9 6.88L22 9.82l-5.34 4.94L18.18 22 12 18.27 5.82 22l1.52-7.24L2 9.82l7.1-.94z"/>
                            </svg>
                            {{ ratingLabel }}
                        </li>
                        <li
                            v-for="tag in audioTags"
                            :key="`audio-${tag}`"
                            class="masthead__chip masthead__chip--audio"
                            :class="{ 'masthead__chip--english': tag === 'English' }"
                        >
                            {{ tag }}
                        </li>
                        <li v-for="g in genres.slice(0, 4)" :key="g" class="masthead__chip">{{ g }}</li>
                        <li v-if="adult" class="masthead__cert">18+</li>
                    </ul>

                    <div class="masthead__actions">
                        <LmButton 
                            variant="primary" 
                            size="lg" 
                            :to="playRoute" 
                            :aria-label="playLabel"
                            @mouseenter="handlePlayHover"
                            @focus="handlePlayHover"
                        >
                            <template #leading>
                                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                    <path fill="currentColor" d="M8 5v14l11-7z"/>
                                </svg>
                            </template>
                            {{ playLabel }}
                        </LmButton>

                        <LmButton
                            v-if="showTrailer"
                            variant="outline"
                            size="lg"
                            @click="$emit('trailer')"
                        >
                            <template #leading>
                                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="5" width="18" height="14" rx="2"/>
                                    <path d="M10 9l5 3-5 3z" fill="currentColor"/>
                                </svg>
                            </template>
                            Trailer
                        </LmButton>

                        <LmButton
                            variant="outline"
                            size="lg"
                            :href="partyHref"
                            rel="nofollow"
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
            </div>
        </template>
    </header>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref, toRef } from 'vue';
import LmButton from '../primitives/Button.vue';
import TrailerControls from '../hero/TrailerControls.vue';
import TrailerIframe from '../hero/TrailerIframe.vue';
import { useAmbientColor } from '../../composables/useAmbientColor';
import { useTrailerEmbed } from '../../composables/useTrailerEmbed';
import { usePrefetch } from '../../composables/usePrefetch';
import {
    prefetchMoovieResolve,
    warmMooviePlayerAssets
} from '../../composables/useMooviePlayer';
import { useDetailBackNavigation } from '../../composables/useDetailBackNavigation';
import { useWebImage } from '../../utils/useWebImage';
import { buildPartyHref } from '../../utils/partyRoom';

export default defineComponent({
    name: 'TitleMasthead',
    components: { LmButton, TrailerControls, TrailerIframe },
    emits: ['trailer'],
    props: {
        id: { type: [Number, String], default: '' },
        partyId: { type: [Number, String], default: null },
        partySource: { type: String as PropType<'global' | 'netflix'>, default: 'global' },
        type: { type: String as PropType<'movie' | 'tv' | 'anime'>, default: 'movie' },
        title: { type: String, default: '' },
        tagline: { type: String, default: '' },
        eyebrow: { type: String, default: 'Feature' },
        backdropPath: { type: String as PropType<string | null>, default: null },
        posterPath: { type: String as PropType<string | null>, default: null },
        rating: { type: Number, default: 0 },
        releaseDate: { type: String, default: '' },
        genres: { type: Array as PropType<string[]>, default: () => [] },
        audioTags: { type: Array as PropType<string[]>, default: () => [] },
        genreIds: { type: Array as PropType<number[]>, default: () => [] },
        adult: { type: Boolean, default: false },
        playRoute: { type: [String, Object] as PropType<string | Record<string, unknown>>, default: '' },
        playLabel: { type: String, default: 'Play' },
        showTrailer: { type: Boolean, default: true },
        loading: { type: Boolean, default: false },
        strictBackdrop: { type: Boolean, default: false }
    },
    setup(props) {
        const { goBackToIssue } = useDetailBackNavigation();
        const rootRef = ref<HTMLElement | null>(null);
        const ambientPath = computed(() =>
            props.strictBackdrop ? props.backdropPath : props.backdropPath || props.posterPath
        );
        useAmbientColor(ambientPath, rootRef);

        const { prefetchStream } = usePrefetch();

        const isNetflixStreamPlay = computed(() => {
            const route = props.playRoute;
            const path =
                typeof route === 'string'
                    ? route
                    : route && typeof route === 'object' && 'path' in route
                      ? String((route as { path?: string }).path || '')
                      : '';
            return path.includes('/stream/nf/');
        });

        const warmPlayback = () => {
            void warmMooviePlayerAssets();
            const id = String(props.id || '').trim();
            if (!id) return;

            if (isNetflixStreamPlay.value && (props.type === 'movie' || props.type === 'tv')) {
                prefetchMoovieResolve({
                    type: props.type,
                    id,
                    season: props.type === 'tv' ? 1 : 0,
                    episode: props.type === 'tv' ? 1 : 0
                });
                return;
            }

            if (props.type === 'movie' || props.type === 'tv' || props.type === 'anime') {
                prefetchStream(
                    props.id,
                    props.type,
                    props.title,
                    year.value || undefined
                );
            }
        };

        const handlePlayHover = () => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(warmPlayback, { timeout: 400 });
            } else {
                setTimeout(warmPlayback, 0);
            }
        };

        const heroArtPath = computed(() =>
            props.strictBackdrop ? props.backdropPath : props.backdropPath || props.posterPath
        );

        const backdropUrl = computed(() => {
            const path = heroArtPath.value;
            if (!path) return '';
            return useWebImage(path, props.backdropPath ? 'hero' : 'large');
        });

        const isVerticalBackdrop = computed(() => {
            const path = heroArtPath.value;
            if (!path) return false;
            if (props.strictBackdrop && !props.backdropPath) return false;
            if (!props.backdropPath || props.backdropPath === props.posterPath) return true;
            if (path.toLowerCase().includes('cover')) return true;
            return false;
        });

        const year = computed(() => {
            if (!props.releaseDate) return null;
            const parsed = parseInt(props.releaseDate);
            if (!isNaN(parsed) && parsed > 1000 && parsed < 3000) return parsed;
            return new Date(props.releaseDate).getFullYear();
        });

        const ratingLabel = computed(() =>
            props.rating > 0 ? props.rating.toFixed(1) : ''
        );



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
            type: toRef(props, 'type') as any,
            rootEl: rootRef,
            dwellMs: 3000
        });

        const setIframe = (el: HTMLIFrameElement | null) => {
            iframeRef.value = el;
        };

        const partyHref = computed(() =>
            buildPartyHref({
                id: props.id,
                partyId: props.partyId ?? undefined,
                title: props.title,
                type: props.type,
                source: props.partySource
            })
        );

        return {
            goBackToIssue,
            rootRef,
            backdropUrl,
            isVerticalBackdrop,
            year,
            ratingLabel,
            setIframe,
            trailerVisible,
            trailerLive,
            trailerSrc,
            userPaused,
            userMuted,
            onIframeLoad,
            togglePause,
            toggleMute,
            partyHref,
            handlePlayHover
        };
    }
});
</script>

<style lang="scss" scoped>
.masthead {
    position: relative;
    isolation: isolate;
    min-height: clamp(520px, 80vh, 860px);
    color: var(--bone-50);
    display: flex;
    align-items: flex-end;
    overflow: hidden;

    &__stage {
        position: absolute;
        inset: 0;
        z-index: 0;
    }

    &__art {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 22%;
        transition: opacity var(--dur-slow) var(--ease-out);

        &--placeholder {
            background: radial-gradient(70% 70% at 50% 40%, var(--ink-700), var(--ink-900));
        }
    }

    &.trailer-playing &__art,
    &.trailer-playing &__art-fallback-container { opacity: 0; }

    &__art-fallback-container {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
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
        max-width: 90%;
        max-height: 95%;
        width: auto;
        height: 100%;
        object-fit: contain;
        object-position: center;
        border-radius: var(--r-md, 8px);
        box-shadow: 0 12px 60px rgba(0, 0, 0, 0.95);
    }

    &__scrim {
        position: absolute;
        inset: 0;
        background:
            linear-gradient(180deg, rgba(11,10,8,0.6) 0%, rgba(11,10,8,0) 25%, rgba(11,10,8,0) 55%, rgba(11,10,8,0.8) 88%, var(--ink-900) 100%),
            radial-gradient(120% 90% at 0% 100%, rgba(11,10,8,0.7), rgba(11,10,8,0) 55%);
        pointer-events: none;
    }

    &__bloom {
        position: absolute;
        left: -5%;
        bottom: -10%;
        width: 70%;
        height: 70%;
        background: radial-gradient(closest-side, rgba(var(--ambient, 255 90 31), 0.18), transparent 70%);
        filter: blur(40px);
        pointer-events: none;
    }

    &__grain {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.6;
    }

    &__inner {
        position: relative;
        z-index: 1;
        padding-block: clamp(var(--s-6), 6vh, var(--s-10));
        padding-inline: var(--s-6);
    }

    &__crumb {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--bone-200);
        margin-bottom: var(--s-8);
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        cursor: pointer;
        text-decoration: none;
        transition: color var(--dur-fast) var(--ease-out);

        &:hover, &:focus-visible { color: var(--ember); }

        span { transition: transform var(--dur-fast) var(--ease-out); }
        &:hover span { transform: translateX(-3px); }
    }

    &__content {
        max-width: 960px;
    }

    &__eyebrow {
        color: var(--ember);
        display: inline-flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: var(--s-3);
    }

    &__year {
        color: var(--bone-400);
        font-family: var(--font-mono);
        letter-spacing: 0.05em;
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(2.8rem, 8vw, 6.75rem);
        line-height: 0.94;
        letter-spacing: -0.02em;
        font-variation-settings: 'opsz' 144, 'SOFT' 30;
        color: var(--bone-50);
        margin: 0;
        text-wrap: balance;
        max-width: 22ch;
    }

    &__tagline {
        font-family: var(--font-display);
        font-style: italic;
        font-size: clamp(1.125rem, 1.7vw, 1.6rem);
        color: var(--bone-200);
        margin: var(--s-4) 0 0;
        max-width: 54ch;
        line-height: 1.35;
    }

    &__quote {
        color: var(--ember);
        font-size: 1.2em;
        line-height: 0;
        vertical-align: -0.15em;
        padding-inline: 0.1em;
    }

    &__chips {
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-2);
        margin: var(--s-5) 0 0;
        padding: 0;
        font-size: var(--fs-xs);

        li {
            padding: 0.35rem 0.7rem;
            border: 1px solid var(--rule);
            border-radius: var(--r-pill);
            color: var(--bone-200);
            background: rgba(245, 239, 228, 0.04);
            backdrop-filter: blur(6px);
        }
    }

    &__chip {
        font-family: var(--font-mono);
        text-transform: uppercase;
        letter-spacing: 0.1em;

        &--audio {
            text-transform: none;
            letter-spacing: 0.06em;
            background: rgba(255, 90, 31, 0.1);
            border-color: rgba(255, 90, 31, 0.22);
        }

        &--english {
            color: var(--bone-50);
            background: rgba(96, 165, 250, 0.14);
            border-color: rgba(96, 165, 250, 0.42);
        }
    }

    &__rating {
        color: var(--gold-leaf) !important;
        border-color: rgba(201, 167, 106, 0.35) !important;
        display: inline-flex !important;
        align-items: center;
        gap: 0.35rem;

        svg { color: var(--gold-leaf); }
    }

    &__cert {
        font-family: var(--font-mono);
        font-weight: 600;
    }

    &__actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-3);
        margin-top: var(--s-6);
    }

    @media (max-width: 720px) {
        min-height: clamp(440px, 68vh, 620px);

        &__crumb { margin-bottom: var(--s-5); }
        &__actions { margin-top: var(--s-5); }
    }
}

.masthead__skeleton-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.masthead__skeleton-line {
    background: var(--ink-750);
}

.masthead__skeleton-shimmer {
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
        animation: masthead-skeleton-shimmer-anim 1.6s infinite ease-in-out;
    }
}

@keyframes masthead-skeleton-shimmer-anim {
    100% {
        transform: translateX(100%);
    }
}
</style>
