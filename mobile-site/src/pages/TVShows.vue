<template>
    <MobileShell>
        <div class="m-discover">
            <header class="m-discover__head">
                <p class="eyebrow m-discover__eyebrow">Discover</p>
                <div class="m-discover__title-row">
                    <h1 class="m-discover__title">TV Shows</h1>
                    <button
                        type="button"
                        class="m-discover__filters-btn"
                        :class="{ 'is-open': filtersOpen }"
                        :aria-expanded="filtersOpen"
                        aria-controls="tv-filters"
                        @click="filtersOpen = !filtersOpen"
                    >
                        Filters &amp; sort
                    </button>
                </div>
            </header>

            <div
                v-show="filtersOpen"
                id="tv-filters"
                class="m-discover__filters-panel"
            >
                <FilterPanel
                    kind="tv"
                    :genres="genres"
                    :genres-loading="!genres.length"
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
import { computed, onMounted, ref } from 'vue';
import { usePaginatedInfiniteScroll } from '@/composables/useLazyLoad';
import MobileShell from '../layout/MobileShell.vue';
import MobileMediaGrid from '../components/MobileMediaGrid.vue';
import FilterPanel, { DiscoverFilters } from '@/components/discover/FilterPanel.vue';
import { useTvShows, TVShowType } from '@/composables/useTvShows';
import { primeGenres, getGenres, Genre } from '@/composables/useGenreLookup';
import { dedupeById } from '../utils/dedupe';

const CURRENT_YEAR = new Date().getFullYear();
const yearBounds: [number, number] = [1950, CURRENT_YEAR + 2];

const makeDefaultFilters = (): DiscoverFilters => ({
    genres: [],
    yearRange: [...yearBounds],
    minRating: 0,
    runtimeBand: 'any',
    language: '',
    sortBy: 'popularity.desc'
});

const TV_RUNTIME_BANDS = [
    { value: 'any' },
    { value: 'short', lte: 29 },
    { value: 'standard', gte: 30, lte: 59 },
    { value: 'long', gte: 60 }
];

const { fetchDiscoverShows } = useTvShows();
const genres = ref<Genre[]>([]);
const results = ref<TVShowType[]>([]);
const page = ref(1);
const totalPages = ref(1);
const isLoading = ref(false);
const isLoadingMore = ref(false);
const filters = ref<DiscoverFilters>(makeDefaultFilters());
const filtersOpen = ref(false);

const hasMore = computed(() => page.value < totalPages.value);

const gridItems = computed(() =>
    results.value.map(s => ({
        id: s.id,
        title: s.name,
        posterPath: s.poster_path,
        rating: s.vote_average,
        releaseDate: s.first_air_date,
        genreIds: s.genre_ids,
        adult: s.adult,
        type: 'tv' as const
    }))
);

function buildDiscoverUrl(pageNum: number): string {
    const f = filters.value;
    const params = new URLSearchParams({
        language: 'en-US',
        sort_by: f.sortBy,
        page: String(pageNum),
        include_adult: 'false'
    });
    if (f.genres.length) params.set('with_genres', f.genres.join(','));
    if (f.yearRange[0] !== yearBounds[0]) {
        params.set('first_air_date.gte', `${f.yearRange[0]}-01-01`);
    }
    if (f.yearRange[1] !== yearBounds[1]) {
        params.set('first_air_date.lte', `${f.yearRange[1]}-12-31`);
    }
    if (f.minRating > 0) {
        params.set('vote_average.gte', String(f.minRating));
        params.set('vote_count.gte', '50');
    }
    const band = TV_RUNTIME_BANDS.find(b => b.value === f.runtimeBand);
    if (band && 'gte' in band && band.gte !== undefined) params.set('with_runtime.gte', String(band.gte));
    if (band && 'lte' in band && band.lte !== undefined) params.set('with_runtime.lte', String(band.lte));
    if (f.language) params.set('with_original_language', f.language);
    return `https://api.themoviedb.org/3/discover/tv?${params.toString()}`;
}

async function fetchPage(pageNum: number, append: boolean) {
    if (append) isLoadingMore.value = true;
    else isLoading.value = true;
    try {
        const { data } = await fetchDiscoverShows(buildDiscoverUrl(pageNum));
        const fresh = (data.value?.results ?? []) as TVShowType[];
        totalPages.value = data.value?.total_pages ?? 1;
        page.value = pageNum;
        results.value = dedupeById(append ? [...results.value, ...fresh] : fresh);
    } finally {
        isLoading.value = false;
        isLoadingMore.value = false;
    }
}

function onFiltersChange(next: DiscoverFilters) {
    filters.value = next;
    results.value = [];
    void fetchPage(1, false).then(() => drainPagesIfNeeded());
}

function resetFilters() {
    filters.value = makeDefaultFilters();
    results.value = [];
    void fetchPage(1, false).then(() => drainPagesIfNeeded());
}

const { scrollSentinel, drainPagesIfNeeded } = usePaginatedInfiniteScroll({
    hasMore,
    isLoading,
    isLoadingMore,
    hasResults: computed(() => results.value.length > 0),
    loadNextPage: () => fetchPage(page.value + 1, true)
});

onMounted(async () => {
    document.title = 'TV Shows — Moovie';
    await primeGenres();
    genres.value = await getGenres('tv');
    await fetchPage(1, false);
    void drainPagesIfNeeded();
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
