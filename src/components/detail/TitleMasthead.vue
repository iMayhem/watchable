<template>
    <header ref="rootRef" class="masthead" :class="{ 'trailer-playing': trailerLive, 'is-loading': loading }" :aria-label="loading ? 'Loading...' : `${title} — masthead`">
        <button
            type="button"
            class="masthead__crumb eyebrow"
            :class="{ 'is-dimmed': loading }"
            @click="goBackToIssue"
        >
            <span aria-hidden="true">←</span>
            Back to issue
        </button>

        <!-- Skeleton Loading state -->
        <div v-if="loading" class="masthead__skeleton-wrapper">
            <div class="masthead__stage masthead__skeleton-shimmer" />
            <div class="container-lm masthead__inner">
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
                            v-if="partySource !== 'netflix'"
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

                        <!-- Quick Reactions -->
                        <div v-if="!hideLikes && partySource !== 'netflix'" class="masthead__reactions" ref="reactionsContainer">
                            <button
                                type="button"
                                class="masthead__reaction-btn masthead__reaction-btn--heart"
                                :class="{ 'is-active': isLiked }"
                                @click="handleLikeClick"
                                aria-label="Like"
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" class="reaction-icon">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                </svg>
                                <span class="reaction-count">{{ displayLikes }}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </header>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref, toRef, onMounted } from 'vue';
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
import { catalogDisplayImageSize, useWebImage } from '../../utils/useWebImage';
import { buildPartyHref } from '../../utils/partyRoom';
import { useWatchlist } from '../../composables/useWatchlist';
import { getSupabaseClient } from '../../lib/supabase';

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
        strictBackdrop: { type: Boolean, default: false },
        hideLikes: { type: Boolean, default: false }
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

            if (props.type === 'movie' || props.type === 'tv') {
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
            const size = catalogDisplayImageSize(
                path,
                props.backdropPath ? 'hero' : 'large'
            );
            return useWebImage(path, size);
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

        const partyHref = computed(() => {
            if (props.partySource === 'netflix') return '';
            // Global anime parties must use AniList ids — route/detail ids are TMDB.
            if (props.type === 'anime' && props.partyId == null) return '';
            return buildPartyHref({
                id: props.id,
                partyId: props.partyId ?? undefined,
                title: props.title,
                type: props.type,
                source: props.partySource
            });
        });



        const { isItemLiked, addToLiked, removeFromLiked } = useWatchlist();
        const globalLikesCount = ref(0);
        const isLiked = ref(false);
        const reactionsContainer = ref<HTMLElement | null>(null);

        const fetchGlobalLikes = async () => {
            if (props.partySource === 'netflix') return;
            try {
                const supabase = await getSupabaseClient();
                const { data, error } = await supabase
                    .from('media_likes')
                    .select('likes_count')
                    .eq('item_id', String(props.id))
                    .eq('item_type', props.type)
                    .maybeSingle();
                
                console.log('[Likes] fetch result', { id: String(props.id), type: props.type, data, error });
                
                if (error) {
                    console.error('[Likes] Supabase error:', error);
                    return;
                }
                if (data) {
                    globalLikesCount.value = data.likes_count ?? 0;
                }
            } catch (e) {
                console.error('[Likes] Failed to fetch global likes count:', e);
            }
        };

        onMounted(async () => {
            if (props.partySource === 'netflix') return;
            await fetchGlobalLikes();

            if (typeof window !== 'undefined') {
                if (isItemLiked(props.id, props.type)) {
                    isLiked.value = true;
                } else {
                    const savedLike = localStorage.getItem(`like_${props.type}_${props.id}`);
                    const savedVote = localStorage.getItem(`vote_${props.type}_${props.id}`);
                    if (savedLike === 'true' || savedVote === 'up') {
                        isLiked.value = true;
                        localStorage.setItem(`like_${props.type}_${props.id}`, 'true');
                        addToLiked({
                            id: props.id,
                            title: props.title,
                            image: props.posterPath || props.backdropPath,
                            rating: props.rating,
                            categories: props.genreIds || [],
                            adult: props.adult,
                            type: props.type
                        });
                        
                        try {
                            const supabase = await getSupabaseClient();
                            await supabase.rpc('increment_media_likes', { 
                                item_id_val: String(props.id), 
                                item_type_val: props.type 
                            });
                        } catch (e) {
                            console.error('Failed to increment global likes on migration:', e);
                        }
                    }
                }
            }
        });

        const spawnHearts = () => {
            if (!reactionsContainer.value) return;
            const count = 4 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const heart = document.createElement('div');
                heart.className = 'floating-heart';
                
                const emojis = ['❤️', '💖', '💝', '💕', '💗', '💓'];
                heart.innerText = emojis[Math.floor(Math.random() * emojis.length)];
                
                const size = 16 + Math.random() * 16;
                const leftOffset = -15 + Math.random() * 30;
                const duration = 1.5 + Math.random() * 1.0;
                const delay = Math.random() * 0.2;
                
                const sway1 = -20 + Math.random() * 40;
                const sway2 = -40 + Math.random() * 80;
                const sway3 = -60 + Math.random() * 120;
                
                heart.style.fontSize = `${size}px`;
                heart.style.left = `calc(50% + ${leftOffset}px)`;
                heart.style.bottom = `10px`;
                heart.style.animationDuration = `${duration}s`;
                heart.style.animationDelay = `${delay}s`;
                
                heart.style.setProperty('--sway-1', `${sway1}px`);
                heart.style.setProperty('--sway-2', `${sway2}px`);
                heart.style.setProperty('--sway-3', `${sway3}px`);
                
                reactionsContainer.value.appendChild(heart);
                
                setTimeout(() => {
                    heart.remove();
                }, (duration + delay) * 1000 + 100);
            }
        };

        const handleLikeClick = async () => {
            if (props.partySource === 'netflix') return;
            isLiked.value = !isLiked.value;
            const item = {
                id: props.id,
                title: props.title,
                image: props.posterPath || props.backdropPath,
                rating: props.rating,
                categories: props.genreIds || [],
                adult: props.adult,
                type: props.type
            };

            const itemIdStr = String(props.id);
            const itemTypeStr = props.type;

            if (isLiked.value) {
                localStorage.setItem(`like_${props.type}_${props.id}`, 'true');
                addToLiked(item);
                spawnHearts();
                globalLikesCount.value++;
                try {
                    const supabase = await getSupabaseClient();
                    await supabase.rpc('increment_media_likes', { 
                        item_id_val: itemIdStr, 
                        item_type_val: itemTypeStr 
                    });
                } catch (e) {
                    console.error('Failed to increment global likes in Supabase:', e);
                }
            } else {
                localStorage.removeItem(`like_${props.type}_${props.id}`);
                removeFromLiked(props.id, props.type);
                globalLikesCount.value = Math.max(0, globalLikesCount.value - 1);
                try {
                    const supabase = await getSupabaseClient();
                    await supabase.rpc('decrement_media_likes', { 
                        item_id_val: itemIdStr, 
                        item_type_val: itemTypeStr 
                    });
                } catch (e) {
                    console.error('Failed to decrement global likes in Supabase:', e);
                }
            }
        };

        const displayLikes = computed(() => globalLikesCount.value);

        return {
            isLiked,
            handleLikeClick,
            displayLikes,
            reactionsContainer,
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
        position: fixed;
        top: calc(var(--site-header-height) + var(--s-3));
        left: max(var(--container-gutter), calc((100vw - var(--container-max)) / 2 + var(--container-gutter)));
        z-index: calc(var(--z-header) - 1);
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--bone-200);
        margin: 0;
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        cursor: pointer;
        text-decoration: none;
        transition: color var(--dur-fast) var(--ease-out);
        text-shadow: 0 1px 12px rgba(11, 10, 8, 0.85);

        &.is-dimmed { opacity: 0.45; }

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

    &__reactions {
        position: relative;
        display: flex;
        align-items: center;
        margin-inline-start: 0.5rem;
        
        @media (max-width: 480px) {
            margin-inline-start: 0;
            width: fit-content;
            justify-content: flex-start;
        }
    }

    &__reaction-btn {
        position: relative;
        z-index: 2;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: rgba(245, 239, 228, 0.6);
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.6rem 1.0rem;
        border-radius: 9999px;
        font-family: var(--font-ui, system-ui);
        font-size: 0.825rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        min-height: 40px;

        .reaction-icon {
            fill: none;
            stroke: currentColor;
            stroke-width: 2px;
            stroke-linecap: round;
            stroke-linejoin: round;
            opacity: 0.5;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        &:hover {
            color: var(--bone-50, #f5efe4);
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.25);

            .reaction-icon {
                transform: scale(1.1);
                opacity: 0.85;
            }
        }

        &:active .reaction-icon {
            transform: scale(0.85);
        }

        &--heart {
            &.is-active {
                color: #ff4757;
                background: rgba(255, 71, 87, 0.15);
                border-color: rgba(255, 71, 87, 0.35);
                
                .reaction-icon {
                    fill: #ff4757;
                    stroke: #ff4757;
                    opacity: 1;
                    filter: drop-shadow(0 0 6px rgba(255, 71, 87, 0.5));
                }
            }
        }
    }

    :deep(.floating-heart) {
        position: absolute;
        pointer-events: none;
        z-index: 1;
        user-select: none;
        will-change: transform, opacity;
        animation-name: floatUp;
        animation-timing-function: cubic-bezier(0.08, 0.77, 0.45, 0.94);
        animation-fill-mode: forwards;
    }

    @media (max-width: 720px) {
        min-height: clamp(440px, 68vh, 620px);

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

@keyframes floatUp {
    0% {
        transform: translateY(0) translateX(0) scale(0.4);
        opacity: 0;
    }
    10% {
        opacity: 0.9;
        transform: translateY(-15px) translateX(var(--sway-1)) scale(1.1);
    }
    45% {
        opacity: 0.9;
        transform: translateY(-70px) translateX(var(--sway-2)) scale(1);
    }
    90% {
        opacity: 0.4;
    }
    100% {
        transform: translateY(-160px) translateX(var(--sway-3)) scale(0.6);
        opacity: 0;
    }
}

</style>
