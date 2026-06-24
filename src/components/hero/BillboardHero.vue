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
                        v-if="partySource !== 'netflix'"
                        variant="ghost"
                        size="lg"
                        :to="detailRoute"
                        aria-label="More info"
                    >
                        More info
                    </LmButton>

                    <LmButton
                        v-if="partySource !== 'netflix'"
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

                    <!-- Quick Reactions -->
                    <div v-if="partySource !== 'netflix'" class="billboard__reactions" ref="reactionsContainer">
                        <button
                            type="button"
                            class="billboard__reaction-btn billboard__reaction-btn--heart"
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
        </template>
    </section>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, PropType, ref, toRef, watch } from 'vue';
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
import { useWatchlist } from '../../composables/useWatchlist';
import { getSupabaseClient } from '../../lib/supabase';

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
                // fire-and-forget — never block the UI
                getSupabaseClient().then(supabase =>
                    supabase.rpc('increment_media_likes', {
                        item_id_val: itemIdStr,
                        item_type_val: itemTypeStr
                    })
                ).catch(e => console.error('Failed to increment global likes:', e));
            } else {
                localStorage.removeItem(`like_${props.type}_${props.id}`);
                removeFromLiked(props.id, props.type);
                globalLikesCount.value = Math.max(0, globalLikesCount.value - 1);
                // fire-and-forget — never block the UI
                getSupabaseClient().then(supabase =>
                    supabase.rpc('decrement_media_likes', {
                        item_id_val: itemIdStr,
                        item_type_val: itemTypeStr
                    })
                ).catch(e => console.error('Failed to decrement global likes:', e));
            }
        };

        const displayLikes = computed(() => globalLikesCount.value);

        onMounted(() => {
            primeGenres();
            if (props.partySource === 'netflix') return;
            // fire-and-forget — don't stall mount
            fetchGlobalLikes();

            if (typeof window !== 'undefined') {
                if (isItemLiked(props.id, props.type)) {
                    isLiked.value = true;
                } else {
                    const savedLike = localStorage.getItem(`like_${props.type}_${props.id}`);
                    const savedVote = localStorage.getItem(`vote_${props.type}_${props.id}`);
                    if (savedLike === 'true' || savedVote === 'up') {
                        isLiked.value = true;
                    }
                }
            }
        });

        // Re-fetch when the hero id changes (home page loads hero asynchronously)
        watch(() => props.id, (newId) => {
            if (props.partySource === 'netflix') return;
            if (!newId || newId === '') return;
            // fire-and-forget — don't block the watcher
            fetchGlobalLikes();
            if (typeof window !== 'undefined') {
                if (isItemLiked(newId, props.type)) {
                    isLiked.value = true;
                } else {
                    const savedLike = localStorage.getItem(`like_${props.type}_${newId}`);
                    const savedVote = localStorage.getItem(`vote_${props.type}_${newId}`);
                    if (savedLike === 'true' || savedVote === 'up') {
                        isLiked.value = true;
                    }
                }
            }
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
            toggleMute,
            isLiked,
            handleLikeClick,
            displayLikes,
            reactionsContainer
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
        min-height: clamp(560px, 78vh, 820px);
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

    &--poster-art &__art-fallback {
        justify-content: flex-end;
        padding-right: 6%;
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
        max-width: min(55vw, 460px);
        max-height: 86%;
        width: auto;
        height: auto;
        object-fit: contain;
        object-position: center;
        border-radius: var(--r-md, 8px);
        box-shadow: 0 12px 60px rgba(0, 0, 0, 0.95);
    }

    @media (max-width: 720px) {
        &__art--contained {
            max-width: min(72vw, 300px);
            max-height: 76%;
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
