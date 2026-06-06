<template>
    <aside v-if="visibleStats.length || loading" class="stats-block" :class="{ 'is-loading': loading }" :aria-label="ariaLabel">
        <p v-if="eyebrow" class="eyebrow stats-block__eyebrow">{{ eyebrow }}</p>
        <h3 v-if="title" class="stats-block__title">{{ title }}</h3>

        <ul class="stats-block__list" role="list">
            <template v-if="loading">
                <li v-for="i in 3" :key="i" class="stats-block__item">
                    <span class="stats-block__label">
                        <div class="stats-block__skeleton-line stats-block__skeleton-shimmer" style="width: 80px; height: 10px; border-radius: 2px" />
                    </span>
                    <span class="stats-block__value">
                        <div class="stats-block__skeleton-line stats-block__skeleton-shimmer" style="width: 120px; height: 20px; margin-top: 4px; border-radius: 4px" />
                    </span>
                </li>
            </template>
            <template v-else v-for="stat in visibleStats" :key="stat.label">
                <li class="stats-block__item">
                    <span class="stats-block__label">{{ stat.label }}</span>
                    <span class="stats-block__value" :class="{ 'stats-block__value--accent': stat.accent }">
                        {{ stat.value }}
                        <span v-if="stat.suffix" class="stats-block__suffix">{{ stat.suffix }}</span>
                    </span>
                    <span v-if="stat.hint" class="stats-block__hint">{{ stat.hint }}</span>
                </li>
            </template>
        </ul>
    </aside>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue';

export interface StatEntry {
    label: string;
    value: string | number | null | undefined;
    suffix?: string;
    hint?: string;
    accent?: boolean;
}

export default defineComponent({
    name: 'StatsBlock',
    props: {
        stats: { type: Array as PropType<StatEntry[]>, default: () => [] },
        title: { type: String, default: '' },
        eyebrow: { type: String, default: 'By the numbers' },
        ariaLabel: { type: String, default: 'Statistics' },
        loading: { type: Boolean, default: false }
    },
    setup(props) {
        const visibleStats = computed(() =>
            (props.stats ?? []).filter(
                s => s && s.value !== null && s.value !== undefined && s.value !== '' && s.value !== 0
            )
        );
        return { visibleStats };
    }
});
</script>

<style lang="scss" scoped>
.stats-block {
    background: var(--ink-800);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-6);
    position: relative;
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 3px;
        height: 40px;
        background: var(--ember);
    }

    &__eyebrow {
        color: var(--ember);
        margin: 0 0 var(--s-3);
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-lg);
        color: var(--bone-50);
        margin: 0 0 var(--s-5);
        letter-spacing: -0.01em;
    }

    &__list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: var(--s-5);
    }

    &__item {
        display: grid;
        gap: var(--s-1);
        padding-bottom: var(--s-4);
        border-bottom: 1px solid var(--rule);

        &:last-child {
            padding-bottom: 0;
            border-bottom: 0;
        }
    }

    &__label {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--bone-400);
    }

    &__value {
        font-family: var(--font-display);
        font-size: var(--fs-xl);
        font-weight: 500;
        color: var(--bone-50);
        line-height: 1.1;
        font-variation-settings: 'opsz' 60;

        &--accent {
            color: var(--gold-leaf);
        }
    }

    &__suffix {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        color: var(--bone-400);
        margin-left: 0.25rem;
        letter-spacing: 0.08em;
    }

    &__hint {
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        color: var(--bone-400);
        font-style: italic;
    }
}

.stats-block__skeleton-line {
    background: var(--ink-750);
}

.stats-block__skeleton-shimmer {
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
        animation: stats-block-skeleton-shimmer-anim 1.6s infinite ease-in-out;
    }
}

@keyframes stats-block-skeleton-shimmer-anim {
    100% {
        transform: translateX(100%);
    }
}
</style>
