<template>
    <article class="m-poster-card" :class="`m-poster-card--${size}`">
        <router-link :to="routeTo" class="m-poster-card__link" :aria-label="title">
            <div class="m-poster-card__poster">
                <img
                    v-if="imageUrl"
                    :src="imageUrl"
                    :alt="title"
                    loading="lazy"
                    decoding="async"
                    class="m-poster-card__img"
                />
                <div v-else class="m-poster-card__img m-poster-card__img--empty">
                    <span class="display display--italic">{{ initial }}</span>
                </div>

                <div class="m-poster-card__badges">
                    <span v-if="rating > 0" class="m-poster-card__rating" aria-label="Rating">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="m12 2 3 7 7 .6-5.3 4.7 1.6 7L12 17.7 5.7 21.3l1.6-7L2 9.6 9 9z"/>
                        </svg>
                        {{ ratingLabel }}
                    </span>
                    <span v-if="adult" class="m-poster-card__adult">18+</span>
                </div>
            </div>

            <div class="m-poster-card__caption">
                <h4 class="m-poster-card__title">{{ title }}</h4>
                <div class="m-poster-card__meta meta">
                    <span v-if="year">{{ year }}</span>
                    <span v-if="year && genreLabel" class="m-poster-card__dot">·</span>
                    <span v-if="genreLabel">{{ genreLabel }}</span>
                </div>
            </div>
        </router-link>
    </article>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue';
import { useWebImage } from '@/utils/useWebImage';
import { genreName } from '@/composables/useGenreLookup';
import { useAppPaths } from '@/composables/useAppPaths';

type MediaType = 'movie' | 'tv' | 'anime';

export default defineComponent({
    name: 'MobilePosterCard',
    props: {
        id: { type: [Number, String], required: true },
        type: { type: String as PropType<MediaType>, default: 'movie' },
        title: { type: String, required: true },
        posterPath: { type: String as PropType<string | null>, default: null },
        rating: { type: Number, default: 0 },
        releaseDate: { type: String, default: '' },
        year: { type: [Number, String], default: '' },
        genreIds: { type: Array as PropType<number[]>, default: () => [] },
        adult: { type: Boolean, default: false },
        size: {
            type: String as PropType<'sm' | 'md' | 'lg'>,
            default: 'md'
        }
    },
    setup(props) {
        const { detailPath } = useAppPaths();

        const imageUrl = computed(() => {
            if (!props.posterPath) return '';
            const size = props.size === 'lg' ? 'large' : 'medium';
            return useWebImage(props.posterPath, size);
        });

        const initial = computed(() => props.title?.[0]?.toUpperCase() ?? '·');

        const ratingLabel = computed(() =>
            props.rating ? props.rating.toFixed(1) : ''
        );

        const yearLabel = computed(() => {
            if (props.year) return String(props.year);
            return props.releaseDate ? String(new Date(props.releaseDate).getFullYear()) : '';
        });

        const genreLabel = computed(() => {
            if (props.type === 'anime' || !props.genreIds?.length) return '';
            return genreName(props.genreIds[0], props.type as 'movie' | 'tv') ?? '';
        });

        const routeTo = computed(() => {
            const kind = props.type === 'anime' ? 'anime' : props.type === 'tv' ? 'tv' : 'movie';
            return detailPath(kind as 'movie' | 'tv' | 'anime', props.id);
        });

        return {
            imageUrl,
            initial,
            ratingLabel,
            year: yearLabel,
            genreLabel,
            routeTo
        };
    }
});
</script>

<style lang="scss" scoped>
.m-poster-card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;

    &__link {
        display: block;
        color: inherit;
        text-decoration: none;
        
        // Premium active-tap feedback
        &:active {
            .m-poster-card__poster {
                transform: scale(0.96);
                filter: brightness(0.9);
            }
        }
    }

    // ── Poster ────────────────────────────────────────────────────────────
    &__poster {
        position: relative;
        aspect-ratio: 2 / 3;
        border-radius: var(--r-md);
        overflow: hidden;
        background: var(--ink-800);
        border: 1px solid var(--rule);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        transform: translateZ(0);
        transition: transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.15s ease;
    }

    &__img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;

        &--empty {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--bone-500);
            background: radial-gradient(80% 80% at 50% 30%, var(--ink-700), var(--ink-900));
            font-size: 2.5rem;
            line-height: 1;
        }
    }

    // ── Badges ────────────────────────────────────────────────────────────
    &__badges {
        position: absolute;
        top: 0.35rem;
        left: 0.35rem;
        right: 0.35rem;
        z-index: 2;
        display: flex;
        justify-content: space-between;
        gap: 0.25rem;
        pointer-events: none;
    }

    &__rating {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        padding: 0.15rem 0.4rem;
        background: rgba(11, 10, 8, 0.75);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        color: var(--gold-leaf);
        font-family: var(--font-mono);
        font-size: 0.625rem;
        font-weight: 600;
        border-radius: var(--r-sm);
        border: 1px solid rgba(255, 255, 255, 0.05);

        svg {
            width: 10px;
            height: 10px;
        }
    }

    &__adult {
        margin-left: auto;
        padding: 0.15rem 0.35rem;
        background: rgba(201, 78, 61, 0.92);
        color: var(--bone-50);
        font-family: var(--font-mono);
        font-size: 0.58rem;
        font-weight: 700;
        border-radius: var(--r-sm);
        letter-spacing: 0.02em;
    }

    // ── Caption ───────────────────────────────────────────────────────────
    &__caption {
        padding: var(--s-2) var(--s-1) var(--s-1);
    }

    &__title {
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        font-weight: 500;
        color: var(--bone-100);
        letter-spacing: var(--ls-snug);
        line-height: 1.25;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin: 0;
    }

    &__meta {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        margin-top: 0.2rem;
        color: var(--bone-400);
        font-size: 0.625rem;
    }

    &__dot {
        color: var(--bone-600);
    }

    // Size variants
    &--sm &__title {
        font-size: 0.6875rem;
    }

    &--lg &__title {
        font-size: var(--fs-sm);
    }
}
</style>
