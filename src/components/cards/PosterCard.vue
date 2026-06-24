<template>
    <article
        class="poster-card"
        :class="[`poster-card--${size}`, { 'is-peeking': peeking }]"
        @mouseenter="handleEnter"
        @mouseleave="handleLeave"
        @focusin="handleEnter"
        @focusout="handleLeaveFocus"
    >
        <div v-if="loading" class="poster-card__skeleton-wrapper">
            <div class="poster-card__poster poster-card__skeleton-shimmer" />
            <div class="poster-card__caption">
                <div class="poster-card__skeleton-line poster-card__skeleton-shimmer" style="width: 85%" />
                <div class="poster-card__skeleton-line poster-card__skeleton-shimmer" style="width: 50%; margin-top: 6px" />
            </div>
        </div>
        <router-link v-else :to="routeTo" class="poster-card__link" :aria-label="title">
            <div class="poster-card__poster">
                <img
                    v-if="imageUrl"
                    ref="imgRef"
                    :src="imageUrl"
                    :alt="title"
                    class="poster-card__img"
                    :loading="priorityLoad ? 'eager' : 'lazy'"
                    decoding="async"
                    :fetchpriority="priorityLoad ? 'high' : 'auto'"
                    @load="onPosterLoad"
                    @error="onPosterError"
                />
                <div v-else class="poster-card__img poster-card__img--empty">
                    <span class="display display--italic">{{ initial }}</span>
                </div>

                <div class="poster-card__badges">
                    <span v-if="rating > 0" class="poster-card__rating" aria-label="Rating">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="m12 2 3 7 7 .6-5.3 4.7 1.6 7L12 17.7 5.7 21.3l1.6-7L2 9.6 9 9z"/>
                        </svg>
                        {{ ratingLabel }}
                    </span>
                    <span v-if="adult" class="poster-card__adult">18+</span>
                </div>

                <div class="poster-card__scrim" aria-hidden="true" />
            </div>

            <div class="poster-card__caption">
                <h4 class="poster-card__title">{{ title }}</h4>
                <p
                    v-if="catalog !== 'netflix' && originalTitle && originalTitle !== title"
                    class="poster-card__original-title"
                >
                    {{ originalTitle }}
                </p>
                <div
                    v-if="catalog === 'netflix' && audioLabels.length"
                    class="poster-card__audio"
                    aria-label="Available audio"
                >
                    <span
                        v-for="tag in audioLabels"
                        :key="tag"
                        class="poster-card__audio-chip"
                        :class="{ 'poster-card__audio-chip--english': tag === 'English' }"
                    >
                        {{ tag }}
                    </span>
                </div>
                <div class="poster-card__meta meta">
                    <span v-if="year">{{ year }}</span>
                    <template v-if="catalog !== 'netflix'">
                        <span v-if="year && genreLabel" class="poster-card__dot">·</span>
                        <span v-if="genreLabel">{{ genreLabel }}</span>
                    </template>
                </div>
            </div>
        </router-link>

        <!-- Peek overlay — actions surface on hover -->
        <div class="poster-card__peek" aria-hidden="true">
            <div class="poster-card__peek-actions">
                <button
                    type="button"
                    class="poster-card__peek-btn poster-card__peek-btn--primary"
                    :aria-label="`Play ${title}`"
                    @click.prevent.stop="goToStream"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
                <button
                    type="button"
                    class="poster-card__peek-btn"
                    :class="{ 'is-added': inWatchlist }"
                    :aria-label="inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'"
                    @click.prevent.stop="toggleWatchlist"
                >
                    <svg v-if="!inWatchlist" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="m5 13 4 4L19 7"/>
                    </svg>
                </button>
            </div>
        </div>
    </article>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onBeforeUnmount, PropType, ref, watch } from 'vue';
import { useWebImage } from '../../utils/useWebImage';
import { genreName } from '../../composables/useGenreLookup';
import { isInWatchlist, toggleWatchlistItem } from '../../composables/useWatchlist';
import { useRouter } from 'vue-router';
import { useAppPaths } from '../../composables/useAppPaths';
import {
    isKnownAnilistCatalogId,
    peekAnilistIdForMoovieCatalogId
} from '../../composables/useAnimeCatalogCache';
import {
    catalogStreamTarget,
    netflixCatalogPlayPath,
    sortLanguageTagsForDisplay
} from '../../composables/useNetflixCatalogLookup';
import {
    prefetchMoovieResolve,
    warmMooviePlayerAssets
} from '../../composables/useMooviePlayer';
import { prefetchAnimeTmdbArtwork } from '../../composables/useAnimeTmdbArtwork';


type MediaType = 'movie' | 'tv' | 'anime';

const loadedPosterUrls = new Set<string>();

export default defineComponent({
    name: 'PosterCard',
    props: {
        id: { type: [Number, String], required: true },
        type: { type: String as PropType<MediaType>, default: 'movie' },
        title: { type: String, required: true },
        originalTitle: { type: String, default: '' },
        posterPath: { type: String as PropType<string | null>, default: null },
        backdropPath: { type: String as PropType<string | null>, default: null },
        priorityLoad: { type: Boolean, default: false },
        rating: { type: Number, default: 0 },
        releaseDate: { type: String, default: '' },
        year: { type: [Number, String], default: '' },
        genreIds: { type: Array as PropType<number[]>, default: () => [] },
        adult: { type: Boolean, default: false },
        size: {
            type: String as PropType<'sm' | 'md' | 'lg'>,
            default: 'md'
        },
        loading: { type: Boolean, default: false },
        query: { type: Object as PropType<Record<string, any>>, default: () => ({}) },
        catalog: { type: String as PropType<'tmdb' | 'netflix'>, default: 'tmdb' },
        languageTags: { type: Array as PropType<string[]>, default: () => [] },
        catalogTitle: { type: String, default: '' },
        anilistId: { type: Number, default: 0 },
        moovieCatalogId: { type: String, default: '' }
    },
    setup(props) {
        const imgRef = ref<HTMLImageElement | null>(null);
        const posterFallback = ref(false);
        const router = useRouter();
        const { detailPath } = useAppPaths();
        const peeking = ref(false);
        let enterTimer: number | null = null;
        let leaveTimer: number | null = null;

        const effectivePosterPath = computed(
            () => props.posterPath || props.backdropPath || null
        );

        const imageUrl = computed(() => {
            const path = effectivePosterPath.value;
            if (!path) return '';
            const isAnilist = /anilist\.co/i.test(path);
            const isAnime = props.type === 'anime' || isAnilist;
            const size =
                props.size === 'lg'
                    ? 'large'
                    : props.size === 'sm'
                      ? 'small'
                      : isAnime
                        ? 'medium'
                        : props.catalog === 'netflix'
                          ? 'large'
                          : 'medium';
            const resolved = useWebImage(path, size);
            if (posterFallback.value) {
                return path.split('?')[0];
            }
            return resolved;
        });

        const markCachedPoster = () => {
            const path = effectivePosterPath.value;
            if (path) {
                loadedPosterUrls.add(path);
            }
        };

        const syncCachedImage = () => {
            const img = imgRef.value;
            if (img?.complete && img.naturalWidth > 0) {
                markCachedPoster();
            }
        };

        watch(imageUrl, () => {
            void nextTick(syncCachedImage);
        });

        watch(effectivePosterPath, () => {
            posterFallback.value = false;
        });

        const onPosterLoad = () => {
            markCachedPoster();
        };

        const onPosterError = () => {
            if (!posterFallback.value) {
                posterFallback.value = true;
            }
        };

        const initial = computed(() => props.title?.[0]?.toUpperCase() ?? '·');

        const ratingLabel = computed(() =>
            props.rating ? props.rating.toFixed(1) : ''
        );

        const yearLabel = computed(() => {
            if (props.year) return String(props.year);
            return props.releaseDate ? String(new Date(props.releaseDate).getFullYear()) : '';
        });

        const audioLabels = computed(() => {
            if (props.catalog !== 'netflix') return [];
            return sortLanguageTagsForDisplay(props.languageTags || []);
        });

        const genreLabel = computed(() => {
            if (props.type === 'anime' || !props.genreIds?.length) return '';
            return genreName(props.genreIds[0], props.type as 'movie' | 'tv') ?? '';
        });

        const netflixCatalogTitle = computed(
            () => props.catalogTitle || props.title
        );

        const routeTo = computed(() => {
            if (props.catalog === 'netflix') {
                return {
                    path: netflixCatalogPlayPath({
                        id: props.id,
                        moovieCatalogId: props.moovieCatalogId || undefined,
                        title: netflixCatalogTitle.value,
                        catalogTitle: netflixCatalogTitle.value,
                        type: props.type,
                        media_type: props.type === 'anime' ? 'tv' : props.type,
                        anilistId: props.anilistId || undefined
                    })
                };
            }
            const kind = props.type === 'anime' ? 'anime' : props.type === 'tv' ? 'tv' : 'movie';
            return {
                path: detailPath(kind as 'movie' | 'tv' | 'anime', props.id),
                query: props.query
            };
        });

        const inWatchlist = computed(() =>
            isInWatchlist(props.id, props.type)
        );

        const toggleWatchlist = () => {
            toggleWatchlistItem({
                id: props.id,
                title: props.title,
                image: props.posterPath,
                rating: props.rating,
                categories: props.genreIds,
                adult: props.adult,
                type: props.type
            });
        };

        const warmAnimeDetailPrefetch = () => {
            if (props.type !== 'anime' || props.catalog !== 'tmdb' || props.loading) return;
            const anilistId = Number(props.id);
            if (!Number.isFinite(anilistId) || anilistId <= 0) return;

            const yearFromRelease = props.releaseDate
                ? parseInt(props.releaseDate.slice(0, 4), 10)
                : null;
            const seasonYear = props.year
                ? Number(props.year)
                : (Number.isFinite(yearFromRelease) ? yearFromRelease : null);

            prefetchAnimeTmdbArtwork(anilistId, {
                title: {
                    english: props.title,
                    romaji: props.originalTitle || props.title
                },
                seasonYear: Number.isFinite(seasonYear) ? seasonYear : null,
                format: 'TV'
            });
        };

        const warmNetflixPlayback = () => {
            if (props.catalog !== 'netflix' || props.anilistId) return;
            const catalogId = props.moovieCatalogId || String(props.id);
            if (
                peekAnilistIdForMoovieCatalogId(catalogId) ||
                isKnownAnilistCatalogId(catalogId)
            ) {
                return;
            }
            const target = catalogStreamTarget({
                id: catalogId,
                title: netflixCatalogTitle.value,
                media_type: props.type === 'tv' ? 'tv' : 'movie'
            });
            void warmMooviePlayerAssets();
            prefetchMoovieResolve({
                type: target.mediaType,
                id: catalogId,
                season: target.season,
                episode: target.episode
            });
        };

        const goToStream = () => {
            const query = props.query && Object.keys(props.query).length ? props.query : undefined;
            if (props.catalog === 'netflix') {
                warmNetflixPlayback();
                router.push({
                    path: netflixCatalogPlayPath({
                        id: props.id,
                        moovieCatalogId: props.moovieCatalogId || undefined,
                        title: netflixCatalogTitle.value,
                        catalogTitle: netflixCatalogTitle.value,
                        type: props.type,
                        media_type: props.type === 'anime' ? 'tv' : props.type,
                        anilistId: props.anilistId || undefined
                    }),
                    query: { play: '1' }
                });
                return;
            }
            if (props.type === 'anime') {
                router.push({
                    path: `/stream/anime/${props.id}`,
                    query: { ...query, ani: String(props.id) }
                });
            } else if (props.type === 'tv') {
                router.push({ path: `/stream/tv-show/${props.id}/season/1/episode/1`, query });
            } else {
                router.push({ path: `/stream/movie/${props.id}`, query });
            }
        };

        const clearTimers = () => {
            if (enterTimer !== null) {
                window.clearTimeout(enterTimer);
                enterTimer = null;
            }
            if (leaveTimer !== null) {
                window.clearTimeout(leaveTimer);
                leaveTimer = null;
            }
        };

        const handleEnter = () => {
            if (leaveTimer !== null) {
                window.clearTimeout(leaveTimer);
                leaveTimer = null;
            }
            if (enterTimer !== null) return;
            enterTimer = window.setTimeout(() => {
                peeking.value = true;
                warmNetflixPlayback();
                warmAnimeDetailPrefetch();
                enterTimer = null;
            }, 240);
        };

        const handleLeave = () => {
            if (enterTimer !== null) {
                window.clearTimeout(enterTimer);
                enterTimer = null;
            }
            leaveTimer = window.setTimeout(() => {
                peeking.value = false;
                leaveTimer = null;
            }, 80);
        };

        const handleLeaveFocus = (e: FocusEvent) => {
            const next = e.relatedTarget as HTMLElement | null;
            const card = (e.currentTarget as HTMLElement) ?? null;
            if (card && next && card.contains(next)) return;
            handleLeave();
        };

        onBeforeUnmount(clearTimers);

        return {
            peeking,
            imageUrl,
            initial,
            ratingLabel,
            year: yearLabel,
            genreLabel,
            audioLabels,
            routeTo,
            inWatchlist,
            toggleWatchlist,
            goToStream,
            handleEnter,
            handleLeave,
            handleLeaveFocus,
            imgRef,
            onPosterLoad,
            onPosterError
        };
    }
});
</script>

<style lang="scss" scoped>
.poster-card {
    position: relative;
    display: flex;
    flex-direction: column;
    --peek-lift: 0;
    contain: layout style;
    transition: transform var(--dur-base) var(--ease-out);

    &.is-peeking {
        z-index: 2;
        --peek-lift: -6px;
        will-change: transform;
    }

    &__link {
        display: block;
        color: inherit;
        text-decoration: none;
    }

    // ── Poster ────────────────────────────────────────────────────────────
    &__poster {
        position: relative;
        aspect-ratio: 2 / 3;
        border-radius: var(--r-md);
        overflow: hidden;
        background: var(--ink-700);
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
        transform: translateY(var(--peek-lift));
        contain: layout paint;
        transition:
            transform var(--dur-base) var(--ease-out),
            box-shadow var(--dur-base) var(--ease-out);

        .is-peeking & {
            box-shadow:
                0 20px 46px rgba(0, 0, 0, 0.55),
                0 0 0 1px rgba(255, 90, 31, 0.25);
        }
    }

    &__img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        transition: transform var(--dur-slow) var(--ease-out);

        .is-peeking & {
            transform: scale(1.04);
        }

        &--empty {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--bone-500);
            background:
                radial-gradient(80% 80% at 50% 30%, var(--ink-600), var(--ink-800));
            font-size: clamp(2rem, 8cqi, 5rem);
            line-height: 1;
            opacity: 1; /* empty icon doesn't need to load */
        }
    }

    &__scrim {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(
            180deg,
            transparent 55%,
            rgba(11, 10, 8, 0.85) 100%
        );
        opacity: 0;
        transition: opacity var(--dur-base) var(--ease-out);

        .is-peeking & { opacity: 1; }
    }

    // ── Badges ────────────────────────────────────────────────────────────
    &__badges {
        position: absolute;
        top: 0.5rem;
        left: 0.5rem;
        right: 0.5rem;
        z-index: 2;
        display: flex;
        justify-content: space-between;
        gap: 0.4rem;
    }

    &__rating {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.2rem 0.5rem;
        /* No backdrop-filter — it's GPU-expensive on every card; plain bg is fine */
        background: rgba(11, 10, 8, 0.82);
        color: var(--gold-leaf);
        font-family: var(--font-mono);
        font-size: 0.6875rem;
        font-weight: 600;
        border-radius: var(--r-sm);

        svg {
            width: 12px;
            height: 12px;
        }
    }

    &__adult {
        margin-left: auto;
        padding: 0.2rem 0.45rem;
        background: rgba(201, 78, 61, 0.92);
        color: var(--bone-50);
        font-family: var(--font-mono);
        font-size: 0.625rem;
        font-weight: 700;
        border-radius: var(--r-sm);
        letter-spacing: 0.03em;
    }

    // ── Caption ───────────────────────────────────────────────────────────
    &__caption {
        padding: var(--s-3) var(--s-1) var(--s-1);
        transform: translateY(calc(var(--peek-lift) * 0.5));
        transition: transform var(--dur-base) var(--ease-out);
    }

    &__title {
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        color: var(--bone-50);
        letter-spacing: var(--ls-snug);
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        transition: color var(--dur-fast) var(--ease-out);

        .is-peeking & {
            color: var(--ember);
        }
    }

    &__original-title {
        font-family: var(--font-ui);
        font-size: 0.65rem;
        color: var(--bone-400);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color var(--dur-fast) var(--ease-out);

        .is-peeking & {
            color: var(--bone-200);
        }
    }

    &__audio {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
        margin-top: 0.35rem;
    }

    &__audio-chip {
        font-family: var(--font-mono);
        font-size: 0.58rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--bone-200);
        background: rgba(255, 90, 31, 0.1);
        border: 1px solid rgba(255, 90, 31, 0.22);
        border-radius: var(--r-pill);
        padding: 0.12rem 0.45rem;
        line-height: 1.35;

        &--english {
            color: var(--bone-50);
            background: rgba(96, 165, 250, 0.14);
            border-color: rgba(96, 165, 250, 0.42);
        }
    }

    &__meta {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0.3rem;
        color: var(--bone-400);
        font-size: 0.6875rem;
    }

    &__dot {
        color: var(--bone-500);
    }

    // ── Peek actions (hover CTAs) ─────────────────────────────────────────
    &__peek {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        aspect-ratio: 2 / 3;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        padding: var(--s-2);
        gap: var(--s-2);
        // Always pass-through on the wrapper — only the action row catches the pointer.
        // Otherwise the empty area of this overlay would steal hover/clicks from the
        // underlying <router-link>, killing the pointer cursor and detail-page nav.
        pointer-events: none;
        opacity: 0;
        transform: translateY(calc(var(--peek-lift) + 8px));
        transition:
            opacity var(--dur-base) var(--ease-out),
            transform var(--dur-base) var(--ease-out);

        .is-peeking & {
            z-index: 3;
            opacity: 1;
            transform: translateY(var(--peek-lift));
        }
    }

    &__peek-actions {
        display: flex;
        gap: var(--s-2);
        pointer-events: none;

        .is-peeking & {
            pointer-events: auto;
        }
    }

    &__peek-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: rgba(11, 10, 8, 0.80);
        /* backdrop-filter only when the peek overlay is visible — saves GPU raster */
        .is-peeking & {
            backdrop-filter: blur(8px);
        }
        border: 1px solid var(--rule-strong);
        border-radius: 50%;
        color: var(--bone-50);
        cursor: pointer;
        transition:
            background-color var(--dur-fast) var(--ease-out),
            color var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out),
            transform var(--dur-fast) var(--ease-out);

        svg { width: 16px; height: 16px; }

        &:hover {
            background: var(--ember);
            color: var(--ink-900);
            border-color: var(--ember);
            transform: scale(1.08);
        }

        &--primary {
            background: var(--ember);
            color: var(--ink-900);
            border-color: var(--ember);
            box-shadow: 0 8px 18px rgba(255, 90, 31, 0.35);

            &:hover {
                background: var(--ember-600);
                border-color: var(--ember-600);
            }
        }

        &.is-added {
            background: var(--gold-leaf);
            color: var(--ink-900);
            border-color: var(--gold-leaf);
        }
    }

    // ── Size variants ─────────────────────────────────────────────────────
    &--sm &__title   { font-size: var(--fs-xs); }
    &--sm &__peek-btn { width: 30px; height: 30px; svg { width: 14px; height: 14px; } }

    &--lg &__title   { font-size: var(--fs-base); }
    &--lg &__peek-btn { width: 42px; height: 42px; svg { width: 18px; height: 18px; } }
}

// Reduced motion — no scale, snap to end-states
@media (prefers-reduced-motion: reduce) {
    .poster-card {
        --peek-lift: 0;
        &__img, &__poster, &__caption, &__peek {
            transition: none;
            transform: none !important;
        }
    }
}

.poster-card__skeleton-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
}

.poster-card__skeleton-line {
    height: 12px;
    border-radius: var(--r-xs);
    background: var(--ink-750);
}

.poster-card__skeleton-shimmer {
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
        animation: poster-skeleton-shimmer 1.6s infinite ease-in-out;
    }
}

@keyframes poster-skeleton-shimmer {
    100% {
        transform: translateX(100%);
    }
}
</style>
