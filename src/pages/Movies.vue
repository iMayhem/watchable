<template>
    <div class="discover">
        <SiteHeader />

        <main id="main" class="discover__main" role="main">

            <section class="discover__body container-lm">
                <FilterPanel
                    class="discover__filters"
                    kind="movie"
                    :genres="genres"
                    :genres-loading="!genres.length"
                    :filters="filters"
                    :year-bounds="yearBounds"
                    @update:filters="onFiltersChange"
                    @reset="resetFilters"
                />

                <div class="discover__results">
                    <header class="discover__results-head">
                        <div>
                            <p class="eyebrow discover__results-eyebrow">{{ resultsEyebrow }}</p>
                            <h2 class="discover__results-title">{{ resultsTitle }}</h2>
                        </div>
                    </header>

                    <div v-if="activeChips.length" class="discover__active" role="list">
                        <button
                            v-for="chip in activeChips"
                            :key="chip.key"
                            type="button"
                            class="discover__active-chip"
                            @click="chip.clear"
                        >
                            {{ chip.label }}
                            <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6 6 18M6 6l12 12" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>

                    <div v-if="isLoading && !results.length" class="discover__grid">
                        <PosterCard
                            v-for="n in 20"
                            :key="n"
                            loading
                            id=""
                            type="movie"
                            title=""
                            poster-path=""
                            :rating="0"
                            release-date=""
                            :genre-ids="[]"
                            :adult="false"
                        />
                    </div>

                    <div v-else-if="!results.length" class="discover__empty">
                        <div class="discover__empty-icon" aria-hidden="true">
                            <svg viewBox="0 0 64 64" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.4">
                                <circle cx="32" cy="32" r="22"/>
                                <circle cx="32" cy="32" r="7"/>
                                <circle cx="32" cy="14" r="3"/>
                                <circle cx="32" cy="50" r="3"/>
                                <circle cx="14" cy="32" r="3"/>
                                <circle cx="50" cy="32" r="3"/>
                            </svg>
                        </div>
                        <h3 class="discover__empty-title display">Nothing in rotation.</h3>
                        <p class="discover__empty-desc">
                            No features match the current filter set. Try widening the year range
                            or clearing a genre.
                        </p>
                        <button type="button" class="discover__empty-reset" @click="resetFilters">
                            Reset filters
                        </button>
                    </div>

                    <div v-else class="discover__grid">
                        <PosterCard
                            v-for="item in results.slice(0, displayedLimit)"
                            :key="item.id"
                            :id="item.id"
                            type="movie"
                            :title="item.title"
                            :original-title="item.original_title"
                            :poster-path="item.poster_path"
                            :rating="item.vote_average"
                            :release-date="item.release_date"
                            :genre-ids="item.genre_ids"
                            :adult="item.adult"
                        />
                    </div>

                    <div v-if="results.length && (hasMore || isLoadingMore)" class="discover__load-more-container">
                        <button
                            v-if="!isLoadingMore"
                            type="button"
                            class="discover__load-more-btn"
                            @click="loadMoreClick"
                        >
                            Load More
                        </button>
                        <div v-else class="discover__grid" style="width: 100%">
                            <PosterCard
                                v-for="n in 8"
                                :key="`more-${n}`"
                                loading
                                id=""
                                type="movie"
                                title=""
                                poster-path=""
                                :rating="0"
                                release-date=""
                                :genre-ids="[]"
                                :adult="false"
                            />
                        </div>
                    </div>

                </div>
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter, LocationQueryRaw } from 'vue-router';
import { debounce } from '../utils/memoization';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import FilterPanel, { DiscoverFilters, RuntimeBand } from '../components/discover/FilterPanel.vue';
import PosterCard from '../components/cards/PosterCard.vue';
import { useMovies } from '../composables/useMovies';
import { Movie } from '../composables/useHighlights';
import { applyGlobalBrowseCuration } from '../composables/useHomepageCuration';
import { getSettings } from '../composables/useSettings';
import { addSearchTerm } from '../composables/useHistory';
import { primeGenres, getGenres, Genre } from '../composables/useGenreLookup';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_BOUNDS: [number, number] = [1950, CURRENT_YEAR + 2];

const MOVIE_RUNTIME_BANDS: RuntimeBand[] = [
    { value: 'any', label: 'Any length' },
    { value: 'short', label: '< 90m', lte: 89 },
    { value: 'standard', label: '90–119m', gte: 90, lte: 119 },
    { value: 'feature', label: '120–149m', gte: 120, lte: 149 },
    { value: 'epic', label: '150m+', gte: 150 }
];

const DEFAULT_SORT = 'popularity.desc';

const makeDefaultFilters = (): DiscoverFilters => ({
    genres: [],
    yearRange: [...YEAR_BOUNDS] as [number, number],
    minRating: 0,
    runtimeBand: 'any',
    language: '',
    sortBy: DEFAULT_SORT
});

export default defineComponent({
    name: 'Movies',
    components: { SiteHeader, SiteFooter, FilterPanel, PosterCard },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { fetchDiscoverMovies } = useMovies();
        const { region } = getSettings();

        const genres = ref<Genre[]>([]);
        const results = ref<Movie[]>([]);
        const page = ref(1);
        const totalPages = ref(1);
        const totalResults = ref(0);
        const isLoading = ref(false);
        const isLoadingMore = ref(false);

        const filters = ref<DiscoverFilters>(makeDefaultFilters());
        const searchTerm = ref<string>('');
        const companyFilter = ref<{ id: string; name: string } | null>(null);

        const hydrateFromRoute = () => {
            const q = route.query;
            const next = makeDefaultFilters();

            if (typeof q.genre === 'string' && q.genre) {
                next.genres = q.genre.split(',').map(Number).filter(n => !Number.isNaN(n));
            }
            if (typeof q.year === 'string' && q.year.includes('-')) {
                const [lo, hi] = q.year.split('-').map(Number);
                if (!Number.isNaN(lo) && !Number.isNaN(hi)) {
                    next.yearRange = [lo, hi];
                }
            }
            if (typeof q.min_rating === 'string') {
                const v = Number(q.min_rating);
                if (!Number.isNaN(v)) next.minRating = v;
            }
            if (typeof q.runtime === 'string') next.runtimeBand = q.runtime;
            if (typeof q.lang === 'string') next.language = q.lang;
            if (typeof q.sort === 'string') next.sortBy = q.sort;

            filters.value = next;
            searchTerm.value = typeof q.q === 'string' ? q.q : '';

            // Production company filter
            if (typeof q.company === 'string' && q.company) {
                companyFilter.value = {
                    id: q.company,
                    name: typeof q.companyName === 'string' ? q.companyName : q.company
                };
            } else {
                companyFilter.value = null;
            }
        };

        const syncRoute = () => {
            const f = filters.value;
            const q: LocationQueryRaw = {};
            if (f.genres.length) q.genre = f.genres.join(',');
            if (f.yearRange[0] !== YEAR_BOUNDS[0] || f.yearRange[1] !== YEAR_BOUNDS[1]) {
                q.year = `${f.yearRange[0]}-${f.yearRange[1]}`;
            }
            if (f.minRating > 0) q.min_rating = String(f.minRating);
            if (f.runtimeBand && f.runtimeBand !== 'any') q.runtime = f.runtimeBand;
            if (f.language) q.lang = f.language;
            if (f.sortBy !== DEFAULT_SORT) q.sort = f.sortBy;
            if (searchTerm.value) q.q = searchTerm.value;
            // Preserve company filter in URL
            if (companyFilter.value) {
                q.company = companyFilter.value.id;
                q.companyName = companyFilter.value.name;
            }

            if (JSON.stringify(q) !== JSON.stringify(route.query)) {
                router.replace({ query: q });
            }
        };

        const buildDiscoverUrl = (pageNum: number): string => {
            const f = filters.value;
            const params = new URLSearchParams({
                sort_by: f.sortBy,
                page: String(pageNum),
                include_adult: 'false'
            });
            if (f.genres.length) params.set('with_genres', f.genres.join(','));
            if (f.yearRange[0] !== YEAR_BOUNDS[0]) {
                params.set('primary_release_date.gte', `${f.yearRange[0]}-01-01`);
            }
            if (f.yearRange[1] !== YEAR_BOUNDS[1]) {
                params.set('primary_release_date.lte', `${f.yearRange[1]}-12-31`);
            }
            if (f.minRating > 0) {
                params.set('vote_average.gte', String(f.minRating));
                params.set('vote_count.gte', '50');
            }
            const band = MOVIE_RUNTIME_BANDS.find(b => b.value === f.runtimeBand);
            if (band?.gte !== undefined) params.set('with_runtime.gte', String(band.gte));
            if (band?.lte !== undefined) params.set('with_runtime.lte', String(band.lte));
            if (f.language) params.set('with_original_language', f.language);
            // Production company filter
            if (companyFilter.value?.id) {
                params.set('with_companies', companyFilter.value.id);
            }

            return `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
        };

        const buildSearchUrl = (pageNum: number): string => {
            const params = new URLSearchParams({
                query: searchTerm.value,
                page: String(pageNum),
                include_adult: 'false'
            });
            return `https://api.themoviedb.org/3/search/movie?${params.toString()}`;
        };

        const curateBrowseResults = (items: Movie[]) => {
            if (searchTerm.value) return items;
            if (region.value !== 'global') return items;
            if (filters.value.language && filters.value.language !== 'en') return items;
            return applyGlobalBrowseCuration(items, { excludeIndian: true });
        };

        const fetchPage = async (pageNum: number, append: boolean) => {
            if (append) isLoadingMore.value = true;
            else isLoading.value = true;

            try {
                const url = searchTerm.value ? buildSearchUrl(pageNum) : buildDiscoverUrl(pageNum);
                const { data } = await fetchDiscoverMovies(url);
                let fresh = curateBrowseResults((data.value?.results ?? []) as Movie[]);

                // When searching, re-rank page 1 only: exact title match → starts-with → popularity desc
                if (searchTerm.value && !append) {
                    const q = searchTerm.value.trim().toLowerCase();
                    fresh = [...fresh].sort((a, b) => {
                        const ta = (a.title || '').toLowerCase();
                        const tb = (b.title || '').toLowerCase();
                        const sa = ta === q ? 2 : ta.startsWith(q) ? 1 : 0;
                        const sb = tb === q ? 2 : tb.startsWith(q) ? 1 : 0;
                        if (sa !== sb) return sb - sa;
                        return ((b as any).popularity ?? 0) - ((a as any).popularity ?? 0);
                    });
                }

                totalPages.value = data.value?.total_pages ?? 0;
                totalResults.value = data.value?.total_results ?? 0;
                page.value = pageNum;
                const combined = append ? [...results.value, ...fresh] : fresh;
                const seen = new Set();
                results.value = combined.filter((item) => {
                    const uid = String(item.id || '');
                    if (!uid || seen.has(uid)) return false;
                    seen.add(uid);
                    return true;
                });
            } finally {
                isLoading.value = false;
                isLoadingMore.value = false;
            }
        };


        const displayedLimit = ref(25);

        const reload = () => {
            page.value = 1;
            results.value = [];
            displayedLimit.value = 25;
            void fetchPage(1, false);
        };

        const hasMore = computed(() => {
            return results.value.length > displayedLimit.value || page.value < totalPages.value;
        });

        const loadMoreClick = async () => {
            displayedLimit.value += 25;
            while (results.value.length < displayedLimit.value && page.value < totalPages.value) {
                await fetchPage(page.value + 1, true);
            }
        };

        const onFiltersChange = (next: DiscoverFilters) => {
            filters.value = next;
            syncRoute();
            reload();
        };

        const resetFilters = () => {
            filters.value = makeDefaultFilters();
            searchTerm.value = '';
            results.value = [];
            syncRoute();
            reload();
        };

        const debouncedSearch = debounce(() => {
            if (searchTerm.value) addSearchTerm(searchTerm.value);
            syncRoute();
            reload();
        }, 400);

        const onSearchInput = (e: Event) => {
            searchTerm.value = (e.target as HTMLInputElement).value;
            debouncedSearch();
        };

        const clearSearch = () => {
            searchTerm.value = '';
            results.value = [];
            syncRoute();
            reload();
        };

        const resultsEyebrow = computed(() => {
            if (searchTerm.value) return 'Searching';
            if (companyFilter.value) return companyFilter.value.name;
            return 'The programme';
        });

        const resultsTitle = computed(() => {
            if (searchTerm.value) return `"${searchTerm.value}"`;
            if (companyFilter.value) return `${companyFilter.value.name} Films`;
            const g = filters.value.genres
                .map(id => genres.value.find(x => x.id === id)?.name)
                .filter(Boolean)
                .join(' · ');
            return g || 'Now showing';
        });

        const activeChips = computed(() => {
            const chips: Array<{ key: string; label: string; clear: () => void }> = [];
            const f = filters.value;

            for (const id of f.genres) {
                const name = genres.value.find(g => g.id === id)?.name;
                if (!name) continue;
                chips.push({
                    key: `g-${id}`,
                    label: name,
                    clear: () => onFiltersChange({ ...f, genres: f.genres.filter(x => x !== id) })
                });
            }
            if (f.yearRange[0] !== YEAR_BOUNDS[0] || f.yearRange[1] !== YEAR_BOUNDS[1]) {
                chips.push({
                    key: 'year',
                    label: `${f.yearRange[0]}–${f.yearRange[1]}`,
                    clear: () => onFiltersChange({ ...f, yearRange: [...YEAR_BOUNDS] as [number, number] })
                });
            }
            if (f.minRating > 0) {
                chips.push({
                    key: 'rating',
                    label: `★ ${f.minRating.toFixed(0)}+`,
                    clear: () => onFiltersChange({ ...f, minRating: 0 })
                });
            }
            if (f.runtimeBand && f.runtimeBand !== 'any') {
                const band = MOVIE_RUNTIME_BANDS.find(b => b.value === f.runtimeBand);
                if (band) chips.push({
                    key: 'runtime',
                    label: band.label,
                    clear: () => onFiltersChange({ ...f, runtimeBand: 'any' })
                });
            }
            if (f.language) {
                chips.push({
                    key: 'lang',
                    label: f.language.toUpperCase(),
                    clear: () => onFiltersChange({ ...f, language: '' })
                });
            }
            return chips;
        });

        onMounted(async () => {
            document.title = 'Discover Movies — Moovie';
            primeGenres();
            hydrateFromRoute();
            if (companyFilter.value) {
                document.title = `${companyFilter.value.name} — Moovie`;
            }

            genres.value = await getGenres('movie');
            await fetchPage(1, false);

            window.addEventListener('movora_settings_change', reload);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('movora_settings_change', reload);
        });

        watch(
            () => route.query,
            () => {
                hydrateFromRoute();
            }
        );

        return {
            genres,
            results,
            page,
            totalPages,
            totalResults,
            isLoading,
            isLoadingMore,
            filters,
            searchTerm,
            companyFilter,
            yearBounds: YEAR_BOUNDS,
            hasMore,
            displayedLimit,
            loadMoreClick,
            resultsEyebrow,
            resultsTitle,
            activeChips,
            onFiltersChange,
            resetFilters,
            onSearchInput,
            clearSearch
        };
    }
});
</script>

<style lang="scss" scoped>
.discover {
    position: relative;
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        padding-block: clamp(var(--s-6), 6vw, var(--s-8));
    }

    &__masthead {
        padding-block: var(--s-4);
        border-bottom: 1px solid var(--rule);
        margin-bottom: clamp(var(--s-6), 6vw, var(--s-8));
    }

    &__eyebrow {
        color: var(--ember);
        margin: 0 0 var(--s-2);
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(2.4rem, 6vw, 4.5rem);
        line-height: 1;
        letter-spacing: -0.02em;
        color: var(--bone-50);
        margin: 0;
        font-variation-settings: 'opsz' 144, 'SOFT' 30;
    }

    &__subtitle {
        margin: var(--s-4) 0 0;
        color: var(--bone-300);
        font-family: var(--font-ui);
        line-height: 1.55;
        max-width: 58ch;
    }

    &__search {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        padding: 0.75rem var(--s-4);
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
        max-width: 520px;
        color: var(--bone-400);
        transition: border-color var(--dur-fast) var(--ease-out);

        &:focus-within {
            border-color: var(--ember);
            color: var(--bone-200);
        }
    }

    &__input {
        flex: 1;
        min-width: 0;
        background: transparent;
        border: 0;
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-base);
        padding: 0;

        &::placeholder { color: var(--bone-400); }
        &:focus { outline: none; }
    }

    &__clear {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        color: var(--bone-400);
        transition: color var(--dur-fast) var(--ease-out);
        &:hover { color: var(--bone-50); }
    }

    &__body {
        display: grid;
        gap: clamp(var(--s-6), 4vw, var(--s-8));
        grid-template-columns: minmax(0, 1fr);

        @media (min-width: 1080px) {
            grid-template-columns: 280px minmax(0, 1fr);
        }
    }

    &__filters {
        min-width: 0;

        @media (max-width: 1079px) {
            position: static;
            max-height: none;
        }
    }

    &__results {
        min-width: 0;
    }

    &__results-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--s-4);
        margin-bottom: var(--s-5);
        padding-bottom: var(--s-4);
        border-bottom: 1px solid var(--rule);
    }

    &__results-eyebrow {
        color: var(--ember);
        margin: 0 0 var(--s-1);
    }

    &__results-title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(1.15rem, 1.5vw, 1.55rem);
        color: var(--bone-50);
        margin: 0;
        line-height: 1.1;
        letter-spacing: -0.01em;
    }

    &__count {
        font-family: var(--font-mono);
        color: var(--bone-400);
    }

    &__active {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-2);
        margin-bottom: var(--s-5);
    }

    &__active-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.75rem;
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ember);
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: var(--r-pill);
        transition: background-color var(--dur-fast) var(--ease-out);

        &:hover, &:focus-visible {
            background: rgba(255, 255, 255, 0.2);
        }
    }

    &__loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--s-3);
        padding: var(--s-9) 0;
        color: var(--bone-300);
    }

    &__spinner {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid var(--rule-strong);
        border-top-color: var(--ember);
        animation: disc-spin 0.8s linear infinite;
    }

    &__empty {
        text-align: center;
        padding: var(--s-9) var(--s-4);
        max-width: 52ch;
        margin: 0 auto;
    }

    &__empty-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--bone-500);
        margin-bottom: var(--s-5);
    }

    &__empty-title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(1.2rem, 1.6vw, 1.65rem);
        color: var(--bone-50);
        margin: 0 0 var(--s-3);
        letter-spacing: -0.01em;
    }

    &__empty-desc {
        color: var(--bone-300);
        margin: 0 0 var(--s-5);
        line-height: 1.55;
    }

    &__empty-reset {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--ember);
        padding: 0.6rem 1.2rem;
        border: 1px solid var(--ember);
        border-radius: var(--r-pill);
        transition: background-color var(--dur-fast) var(--ease-out);

        &:hover, &:focus-visible {
            background: var(--ember);
            color: var(--ink-900);
        }
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: var(--s-3);

        @media (min-width: 640px) {
            grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
            gap: var(--s-4);
        }

        @media (min-width: 1200px) {
            grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
            gap: 1.25rem 1rem;
        }

        @media (min-width: 1600px) {
            grid-template-columns: repeat(auto-fill, minmax(165px, 1fr));
            gap: 1.5rem 1.1rem;
        }
    }

    &__more {
        display: flex;
        justify-content: center;
        padding: var(--s-7) 0 var(--s-4);
    }

    &__load-more-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: var(--s-8);
        width: 100%;
        gap: var(--s-4);
    }

    &__load-more-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1.5px solid var(--ember);
        color: #ffffff;
        padding: 0.75rem 2.5rem;
        border-radius: var(--r-pill);
        font-family: var(--font-ui);
        font-size: var(--fs-base);
        font-weight: 600;
        cursor: pointer;
        transition: transform var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
        box-shadow: 0 4px 15px rgba(255, 255, 255, 0.15);

        &:hover {
            background: var(--ember);
            transform: scale(1.04);
            box-shadow: 0 6px 20px rgba(255, 255, 255, 0.3);
        }

        &:active {
            transform: scale(0.98);
        }
    }
}

@keyframes disc-spin {
    to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
    .discover__spinner { animation: none; }
}
</style>
