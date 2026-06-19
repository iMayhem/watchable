<template>
    <LmRail
        :title="title"
        :eyebrow="eyebrow"
        :description="description"
        :more-to="moreTo"
        density="free"
        :peek-room="false"
        :columns="{ base: 1.4, sm: 2.2, md: 3.2, lg: 4.2, xl: 5.2 }"
    >
        <article
            v-for="(item, idx) in displayItems"
            :key="item.isMock ? `mock-top-${item.id}` : `top-${item.id}`"
            class="topten"
            :class="{ 'is-loading': item.isMock }"
        >
            <span class="topten__numeral" aria-hidden="true">{{ idx + 1 }}</span>
            <div v-if="item.isMock" class="topten__poster topten__skeleton-shimmer" />
            <router-link
                v-else
                :to="routeFor(item)"
                class="topten__poster"
                :aria-label="`${idx + 1}. ${item.title}`"
            >
                <img
                    v-if="posterFor(item)"
                    :src="posterFor(item)"
                    :alt="item.title"
                    :loading="idx < 6 ? 'eager' : 'lazy'"
                    decoding="async"
                    :fetchpriority="idx < 3 ? 'high' : 'low'"
                    class="topten__img"
                />
                <div v-else class="topten__placeholder" aria-hidden="true">
                    <span>{{ (item.title?.[0] || '·').toUpperCase() }}</span>
                </div>
            </router-link>
        </article>
    </LmRail>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref } from 'vue';
import LmRail from './Rail.vue';
import { useWebImage } from '../../utils/useWebImage';
import { useAppPaths } from '../../composables/useAppPaths';

export interface TopItem {
    id: number | string;
    title: string;
    posterPath: string | null;
    type?: 'movie' | 'tv';
    isMock?: boolean;
}

export default defineComponent({
    name: 'TopTenRail',
    components: { LmRail },
    props: {
        items: { type: Array as PropType<TopItem[]>, required: true },
        title: { type: String, default: 'Top 10 Today' },
        eyebrow: { type: String, default: 'The Marquee' },
        description: { type: String, default: '' },
        moreTo: { type: [String, Object], default: null },
        loading: { type: Boolean, default: false },
        catalog: { type: String as PropType<'tmdb' | 'netflix'>, default: 'tmdb' }
    },
    setup(props) {
        const { detailPath } = useAppPaths();
        const loadedImages = ref<Record<string | number, boolean>>({});

        const displayItems = computed(() => {
            if (props.items.length > 0) {
                return props.items.slice(0, 10);
            }
            if (!props.loading) {
                return [];
            }
            return Array.from({ length: 10 }, (_, i) => ({
                id: i,
                title: '',
                posterPath: null,
                isMock: true
            }));
        });

        const posterFor = (item: TopItem) =>
            item.posterPath ? useWebImage(item.posterPath, 'medium') : '';

        const routeFor = (item: TopItem) => {
            if (props.catalog === 'netflix') {
                const type = item.type === 'tv' ? 'tv' : 'movie';
                return `/nf/${type}/${item.id}`;
            }
            return detailPath(item.type === 'tv' ? 'tv' : 'movie', item.id);
        };

        return { displayItems, posterFor, routeFor, loadedImages };
    }
});
</script>

<style lang="scss" scoped>
.topten {
    position: relative;
    display: flex;
    align-items: stretch;
    overflow: visible;
    min-height: 0;
    padding-inline-start: clamp(3rem, 9vw, 9rem);

    &__numeral {
        position: absolute;
        left: 0;
        bottom: -0.05em;
        font-family: var(--font-display);
        font-weight: 500;
        line-height: 0.78;
        font-size: clamp(10rem, 24vw, 20rem);
        letter-spacing: -0.08em;
        font-variation-settings: 'opsz' 144, 'SOFT' 30;

        // Outline-only numeral that "bleeds" behind the poster
        color: transparent;
        -webkit-text-stroke: 2px var(--bone-50);
        text-stroke: 2px var(--bone-50);
        opacity: 0.9;
        pointer-events: none;
        user-select: none;
        z-index: 1;
        filter: drop-shadow(0 8px 32px rgba(0, 0, 0, 0.55));
        transition:
            -webkit-text-stroke-color var(--dur-base) var(--ease-out),
            opacity var(--dur-base) var(--ease-out);
    }

    &__poster {
        position: relative;
        z-index: 2;
        display: block;
        flex: 1;
        aspect-ratio: 2 / 3;
        border-radius: var(--r-md);
        overflow: hidden;
        background: var(--ink-700);
        box-shadow: var(--shadow-md);
        transition:
            transform var(--dur-base) var(--ease-out),
            box-shadow var(--dur-base) var(--ease-out);

        &:hover,
        &:focus-visible {
            transform: translateY(-4px);
            box-shadow:
                var(--shadow-lg),
                0 0 0 1px rgba(255, 90, 31, 0.28);

            .topten__img { transform: scale(1.04); }
        }
    }

    &__img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-slow) var(--ease-out);
    }

    &__skeleton-shimmer {
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
            animation: topten-skeleton-shimmer 1.6s infinite ease-in-out;
        }
    }

    &__placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        font-family: var(--font-display);
        font-size: 4rem;
        color: var(--bone-500);
        background:
            radial-gradient(70% 80% at 40% 30%, var(--ink-600), var(--ink-800));
    }

    // On hover, tint the numeral toward ember
    &:hover &__numeral {
        -webkit-text-stroke-color: var(--ember);
        text-stroke-color: var(--ember);
    }
}

@keyframes topten-skeleton-shimmer {
    100% {
        transform: translateX(100%);
    }
}

@media (prefers-reduced-motion: reduce) {
    .topten__poster, .topten__img {
        transition: none;
        transform: none !important;
    }
}
</style>
