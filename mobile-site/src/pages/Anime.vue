<template>
    <MobileShell>
        <div class="m-discover">
            <header class="m-discover__head">
                <p class="eyebrow m-discover__eyebrow">Discover</p>
                <div class="m-discover__title-row">
                    <h1 class="m-discover__title">Anime</h1>
                    <button
                        type="button"
                        class="m-discover__filters-btn"
                        :class="{ 'is-open': filtersOpen }"
                        :aria-expanded="filtersOpen"
                        aria-controls="anime-filters"
                        @click="filtersOpen = !filtersOpen"
                    >
                        Filters &amp; sort
                    </button>
                </div>
            </header>

            <div
                v-show="filtersOpen"
                id="anime-filters"
                class="m-discover__filters-panel"
            >
                <AnimeFilterPanel
                    :genres="animeGenresList"
                    :filters="filters"
                    :year-bounds="yearBounds"
                    @update:filters="onFiltersChange"
                    @reset="resetFilters"
                />
            </div>

            <MobileMediaGrid v-if="results.length || (isLoading && !results.length)" :items="isLoading && !results.length ? [] : gridItems" dense size="sm" />

            <div
                v-if="results.length && (hasMore || isLoadingMore)"
                ref="scrollSentinel"
                class="m-discover__sentinel"
                aria-hidden="true"
            >
                <div v-if="isLoadingMore" class="m-discover__spinner" />
            </div>
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { usePaginatedInfiniteScroll } from '@/composables/useLazyLoad';
import MobileShell from '../layout/MobileShell.vue';
import MobileMediaGrid from '../components/MobileMediaGrid.vue';
import AnimeFilterPanel, { AnimeFilters } from '@/components/discover/AnimeFilterPanel.vue';
import { useAniList, AnimeMedia } from '@/composables/useAniList';
import { dedupeById } from '../utils/dedupe';

const ANIME_GENRES = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
    'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
];

const CURRENT_YEAR = new Date().getFullYear();
const yearBounds: [number, number] = [1960, CURRENT_YEAR];

const { discoverAnime } = useAniList();
const results = ref<AnimeMedia[]>([]);
const filters = ref<AnimeFilters>({
    genres: [],
    yearRange: [...yearBounds],
    sortBy: 'TRENDING_DESC'
});
const filtersOpen = ref(false);
const currentPage = ref(1);
const totalPages = ref(1);
const isLoading = ref(false);
const isLoadingMore = ref(false);

const animeGenresList = ANIME_GENRES.map(genre => ({ id: genre, name: genre }));
const hasMore = computed(() => currentPage.value < totalPages.value);
const gridItems = computed(() =>
    results.value.map(anime => ({
        id: anime.id,
        title: anime.title.english || anime.title.romaji,
        posterPath: anime.coverImage?.large || anime.coverImage?.medium || '',
        rating: anime.averageScore ? anime.averageScore / 10 : 0,
        releaseDate: anime.seasonYear?.toString() || '',
        type: 'anime' as const
    }))
);

async function load(page = 1, append = false) {
    if (append) isLoadingMore.value = true;
    else isLoading.value = true;
    try {
        const response = await discoverAnime({
            page,
            perPage: 20,
            genres: filters.value.genres,
            yearStart: filters.value.yearRange[0] !== yearBounds[0] ? filters.value.yearRange[0] : undefined,
            yearEnd: filters.value.yearRange[1] !== yearBounds[1] ? filters.value.yearRange[1] : undefined,
            sort: filters.value.sortBy
        });
        const batch = response.data?.Page?.media ?? [];
        results.value = dedupeById(append ? [...results.value, ...batch] : batch);
        totalPages.value = response.data?.Page?.pageInfo?.lastPage ?? 1;
        currentPage.value = page;
    } finally {
        isLoading.value = false;
        isLoadingMore.value = false;
    }
}

function onFiltersChange(next: AnimeFilters) {
    filters.value = next;
}

function resetFilters() {
    filters.value = { genres: [], yearRange: [...yearBounds], sortBy: 'TRENDING_DESC' };
}

const { scrollSentinel, drainPagesIfNeeded } = usePaginatedInfiniteScroll({
    hasMore,
    isLoading,
    isLoadingMore,
    hasResults: computed(() => results.value.length > 0),
    loadNextPage: () => load(currentPage.value + 1, true)
});

watch(filters, () => {
    void load(1, false).then(() => drainPagesIfNeeded());
}, { deep: true });

onMounted(() => {
    document.title = 'Anime — Moovie';
    void load(1, false).then(() => drainPagesIfNeeded());
});
</script>

<style lang="scss" scoped>
.m-discover {
    padding-bottom: var(--s-6);

    &__head {
        padding: var(--s-4) var(--s-4) var(--s-3);
    }

    &__eyebrow {
        margin: 0 0 var(--s-2);
    }

    &__title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
    }

    &__title {
        flex: 1;
        min-width: 0;
        font-family: var(--font-display);
        font-size: 1.6rem;
        margin: 0;
    }

    &__filters-btn {
        flex-shrink: 0;
        min-height: 2.5rem;
        padding: 0 var(--s-3);
        border-radius: var(--r-pill);
        border: 1px solid var(--rule-strong);
        background: var(--ink-850);
        color: var(--bone-100);
        font-family: var(--font-ui);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        white-space: nowrap;
        -webkit-tap-highlight-color: transparent;
        transition:
            color var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out),
            background var(--dur-fast) var(--ease-out);

        &.is-open {
            color: var(--bone-50);
            border-color: var(--ember);
            background: rgba(232, 122, 58, 0.12);
        }
    }

    &__filters-panel {
        margin: 0 var(--s-4) var(--s-4);
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        background: var(--ink-850);
        overflow: hidden;
    }

    &__loading {
        display: flex;
        justify-content: center;
        padding: var(--s-8);
    }

    &__spinner {
        width: 2rem;
        height: 2rem;
        border: 2px solid var(--rule);
        border-top-color: var(--ember);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    &__sentinel {
        display: flex;
        justify-content: center;
        padding: var(--s-5) var(--s-4);
        min-height: 1px;
    }
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
