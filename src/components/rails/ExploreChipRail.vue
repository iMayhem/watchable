<template>
    <section class="explore-chip-rail">
        <header class="explore-chip-rail__header container-lm">
            <h2 class="explore-chip-rail__title">{{ title }}</h2>
            <div v-if="showArrows" class="explore-chip-rail__arrows">
                <button
                    type="button"
                    class="explore-chip-rail__arrow"
                    :disabled="atStart"
                    aria-label="Scroll backward"
                    @click="scrollBy(-1)"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                        <path d="M15 6l-6 6 6 6" />
                    </svg>
                </button>
                <button
                    type="button"
                    class="explore-chip-rail__arrow"
                    :disabled="atEnd"
                    aria-label="Scroll forward"
                    @click="scrollBy(1)"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                        <path d="M9 6l6 6-6 6" />
                    </svg>
                </button>
            </div>
        </header>

        <div class="explore-chip-rail__viewport container-lm">
            <div
                ref="track"
                class="explore-chip-rail__track no-scrollbar"
                @scroll.passive="onScroll"
            >
                <router-link
                    v-for="item in items"
                    :key="item.key"
                    :to="item.to"
                    class="explore-chip-rail__chip"
                >
                    <span class="explore-chip-rail__chip-label">{{ item.label }}</span>
                </router-link>
            </div>
        </div>
    </section>
</template>

<script lang="ts">
import { defineComponent, nextTick, onBeforeUnmount, onMounted, PropType, ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

export interface ExploreChipItem {
    key: string;
    label: string;
    to: RouteLocationRaw;
}

export default defineComponent({
    name: 'ExploreChipRail',
    props: {
        title: { type: String, required: true },
        items: {
            type: Array as PropType<ExploreChipItem[]>,
            required: true
        }
    },
    setup() {
        const track = ref<HTMLElement | null>(null);
        const atStart = ref(true);
        const atEnd = ref(false);
        const showArrows = ref(false);

        const onScroll = () => {
            const el = track.value;
            if (!el) return;
            atStart.value = el.scrollLeft < 8;
            atEnd.value = Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth - 8;
        };

        const measureArrows = () => {
            const el = track.value;
            if (!el) return;
            showArrows.value = el.scrollWidth > el.clientWidth + 8;
        };

        const scrollBy = (dir: number) => {
            const el = track.value;
            if (!el) return;
            el.scrollBy({ left: Math.round(el.clientWidth * 0.85) * dir, behavior: 'smooth' });
        };

        let ro: ResizeObserver | null = null;

        onMounted(() => {
            nextTick(() => {
                onScroll();
                measureArrows();
                if (track.value && typeof ResizeObserver !== 'undefined') {
                    ro = new ResizeObserver(() => {
                        measureArrows();
                        onScroll();
                    });
                    ro.observe(track.value);
                }
            });
        });

        onBeforeUnmount(() => {
            ro?.disconnect();
            ro = null;
        });

        return {
            track,
            atStart,
            atEnd,
            showArrows,
            onScroll,
            scrollBy
        };
    }
});
</script>

<style lang="scss" scoped>
.explore-chip-rail {
    margin-top: clamp(var(--s-6), 5vw, var(--s-8));

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);
        margin-bottom: var(--s-4);
    }

    &__title {
        margin: 0;
        font-family: var(--font-display);
        font-size: clamp(0.9rem, 1.1vw, 1.1rem);
        font-weight: 600;
        letter-spacing: -0.02em;
        color: var(--bone-50);
    }

    &__arrows {
        display: inline-flex;
        gap: var(--s-1);

        @media (max-width: 768px) {
            display: none;
        }
    }

    &__arrow {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        color: var(--bone-200);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition:
            background-color var(--dur-fast),
            color var(--dur-fast),
            border-color var(--dur-fast),
            opacity var(--dur-fast);

        svg {
            width: 15px;
            height: 15px;
        }

        &:hover:not(:disabled) {
            background: var(--surface-tint-hover);
            color: var(--bone-50);
            border-color: var(--rule-strong);
        }

        &:disabled {
            opacity: 0.35;
            cursor: not-allowed;
        }
    }

    &__viewport {
        position: relative;

        &::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 48px;
            height: 100%;
            pointer-events: none;
            background: linear-gradient(90deg, transparent, var(--ink-900));
        }
    }

    &__track {
        display: flex;
        gap: var(--s-3);
        overflow-x: auto;
        padding-bottom: var(--s-2);
        scroll-snap-type: x proximity;
    }

    &__chip {
        flex: 0 0 auto;
        scroll-snap-align: start;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 112px;
        min-height: 88px;
        padding: var(--s-3) var(--s-4);
        border-radius: var(--r-md);
        border: 1px solid var(--rule);
        background: linear-gradient(160deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
        color: var(--bone-100);
        text-decoration: none;
        transition:
            transform var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast),
            background-color var(--dur-fast),
            color var(--dur-fast);

        &:hover {
            transform: translateY(-2px);
            border-color: rgba(255, 255, 255, 0.45);
            color: var(--bone-50);
            background: rgba(255, 255, 255, 0.1);
        }
    }

    &__chip-label {
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 600;
        text-align: center;
        line-height: 1.25;
    }
}
</style>