<template>
    <section
        class="nf-episodes"
        :class="{
            'nf-episodes--compact': compact && !panel,
            'nf-episodes--panel': panel
        }"
    >
        <header
            class="nf-episodes__head"
            :class="{ 'nf-episodes__head--panel': panel }"
        >
            <div v-if="!panel" class="nf-episodes__heading">
                <p v-if="!compact" class="eyebrow">Episodes</p>
                <h3 class="nf-episodes__title">
                    {{ compact ? 'Episodes' : `Season ${currentSeason}` }}
                </h3>
            </div>

            <div v-if="seasons.length" class="nf-episodes__season-wrap">
                <label class="nf-episodes__season-sr" :for="seasonSelectId">Season</label>
                <select
                    :id="seasonSelectId"
                    class="nf-episodes__season-select"
                    :value="currentSeason"
                    @change="onSeasonChange(($event.target as HTMLSelectElement).value)"
                >
                    <option
                        v-for="season in seasons"
                        :key="season.season_number"
                        :value="season.season_number"
                    >
                        {{ season.name || `Season ${season.season_number}` }}
                        <template v-if="season.episode_count">
                            ({{ season.episode_count }})
                        </template>
                    </option>
                </select>
            </div>
        </header>

        <div v-if="loading" class="nf-episodes__loading" role="status">
            <span class="nf-episodes__spinner" aria-hidden="true" />
            <span>Loading episodes…</span>
        </div>

        <div v-else class="nf-episodes__grid" role="listbox" aria-label="Episodes">
            <button
                v-for="ep in episodes"
                :key="ep.episode_number"
                type="button"
                class="nf-episodes__card"
                :class="{ 'is-active': ep.episode_number === currentEpisode }"
                role="option"
                :aria-selected="ep.episode_number === currentEpisode"
                @click.stop="emit('select', ep.episode_number)"
                @mouseenter="emit('prefetch', ep.episode_number)"
                @focus="emit('prefetch', ep.episode_number)"
            >
                <div class="nf-episodes__thumb">
                    <img
                        v-if="ep.still_path"
                        :src="stillUrl(ep.still_path)"
                        :alt="`Episode ${ep.episode_number}`"
                        loading="lazy"
                    />
                    <div v-else class="nf-episodes__thumb-fallback" aria-hidden="true">
                        {{ ep.episode_number }}
                    </div>
                    <span
                        v-if="ep.episode_number === currentEpisode"
                        class="nf-episodes__playing"
                        aria-hidden="true"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </span>
                </div>
                <div class="nf-episodes__meta">
                    <span class="nf-episodes__num">{{ ep.episode_number }}</span>
                    <span class="nf-episodes__name">{{ ep.name }}</span>
                    <span v-if="ep.runtime" class="nf-episodes__runtime">{{ ep.runtime }}m</span>
                </div>
            </button>
        </div>
    </section>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { useWebImage } from '../../utils/useWebImage';
import type {
    NetflixCatalogEpisode,
    NetflixCatalogSeason
} from '../../composables/useNetflixCatalogEpisodes';

let seasonSelectCounter = 0;

export default defineComponent({
    name: 'NetflixEpisodePicker',
    props: {
        seasons: { type: Array as PropType<NetflixCatalogSeason[]>, default: () => [] },
        episodes: { type: Array as PropType<NetflixCatalogEpisode[]>, default: () => [] },
        currentSeason: { type: Number, required: true },
        currentEpisode: { type: Number, required: true },
        loading: { type: Boolean, default: false },
        compact: { type: Boolean, default: false },
        panel: { type: Boolean, default: false }
    },
    emits: ['season-change', 'select', 'previous', 'next', 'prefetch'],
    setup(props, { emit }) {
        const seasonSelectId = `nf-ep-season-${++seasonSelectCounter}`;

        const onSeasonChange = (value: string) => {
            const season = Number(value);
            if (Number.isFinite(season) && season !== props.currentSeason) {
                emit('season-change', season);
            }
        };

        const stillUrl = (path: string) => useWebImage(path, 'medium');

        return {
            seasonSelectId,
            onSeasonChange,
            stillUrl,
            emit
        };
    }
});
</script>

<style lang="scss" scoped>
.nf-episodes {
    display: grid;
    gap: var(--s-4);
    color: var(--bone-50);

    &--compact {
        gap: var(--s-3);

        .nf-episodes__grid {
            max-height: min(42vh, 360px);
        }
    }

    &--panel {
        height: 100%;
        min-height: 0;
        gap: var(--s-3);

        .nf-episodes__grid {
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
            max-height: none;
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            padding-right: 0.25rem;
        }

        .nf-episodes__card {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem 0.45rem;
            border-radius: 0.35rem;
        }

        .nf-episodes__thumb {
            flex: 0 0 112px;
            width: 112px;
            aspect-ratio: 16 / 9;
        }

        .nf-episodes__meta {
            flex: 1;
            min-width: 0;
            gap: 0.2rem;
        }

        .nf-episodes__num {
            font-size: 0.72rem;
        }

        .nf-episodes__name {
            -webkit-line-clamp: 3;
            line-clamp: 3;
        }
    }

    &__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
        flex-wrap: wrap;

        &--panel {
            justify-content: stretch;

            .nf-episodes__season-wrap {
                width: 100%;
                min-width: 0;
            }
        }
    }

    &__title {
        margin: 0;
        font-family: var(--font-display);
        font-size: clamp(1.1rem, 2vw, 1.5rem);
        font-weight: 500;
    }

    &__season-wrap {
        flex-shrink: 0;
        min-width: min(220px, 42vw);
    }

    &__season-sr {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    &__season-select {
        appearance: none;
        width: 100%;
        padding: 0.55rem 2rem 0.55rem 0.85rem;
        border-radius: var(--r-sm);
        border: 1px solid rgba(255, 255, 255, 0.22);
        background:
            rgba(20, 20, 20, 0.92)
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")
            no-repeat right 0.75rem center;
        color: #fff;
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 600;
        cursor: pointer;
    }

    &__loading {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        color: var(--bone-300);
        padding: var(--s-4) 0;
    }

    &__spinner {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.15);
        border-top-color: var(--ember);
        animation: nfEpSpin 0.9s linear infinite;
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
        gap: var(--s-3);
        overflow-y: auto;
        padding-right: 0.15rem;

        @media (min-width: 900px) {
            grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
        }
    }

    &__card {
        all: unset;
        box-sizing: border-box;
        display: grid;
        gap: 0.55rem;
        cursor: pointer;
        border-radius: var(--r-sm);
        padding: 0.35rem;
        transition:
            transform var(--dur-fast) var(--ease-out),
            background-color var(--dur-fast) var(--ease-out);

        &:hover {
            background: rgba(255, 255, 255, 0.06);
            transform: translateY(-1px);
        }

        &.is-active {
            background: rgba(229, 9, 20, 0.14);
            box-shadow: inset 0 0 0 1px rgba(229, 9, 20, 0.45);
        }
    }

    &__thumb {
        position: relative;
        aspect-ratio: 16 / 9;
        border-radius: 0.35rem;
        overflow: hidden;
        background: #141414;

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
    }

    &__thumb-fallback {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-family: var(--font-display);
        font-size: 1.75rem;
        color: rgba(255, 255, 255, 0.35);
    }

    &__playing {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(0, 0, 0, 0.45);
        color: #e50914;

        svg {
            width: 28px;
            height: 28px;
        }
    }

    &__meta {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
    }

    &__num {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        color: var(--bone-400);
    }

    &__name {
        font-size: var(--fs-sm);
        line-height: 1.35;
        color: #fff;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    &__runtime {
        font-size: var(--fs-xs);
        color: var(--bone-400);
    }
}

@keyframes nfEpSpin {
    to {
        transform: rotate(360deg);
    }
}
</style>