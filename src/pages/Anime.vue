<template>
    <div class="discover">
        <SiteHeader />

        <main id="main" class="discover__main" role="main">

            <section class="discover__body container-lm">
                <AnimeFilterPanel
                    class="discover__filters"
                    :genres="animeGenresList"
                    :filters="filters"
                    :year-bounds="yearBounds"
                    @update:filters="onFiltersChange"
                    @reset="resetFilters"
                />

                <div class="discover__results">
                    <header class="discover__results-head">
                        <div>
                            <p class="eyebrow discover__results-eyebrow">The Lineup</p>
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
                            type="anime"
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
                            </svg>
                        </div>
                        <h3 class="discover__empty-title display">
                            {{ loadError ? 'Anime feed unavailable.' : 'Nothing found.' }}
                        </h3>
                        <p class="discover__empty-desc">
                            {{
                                loadError
                                    ? loadError
                                    : 'No anime match the current filter set. Try adjusting your filters.'
                            }}
                        </p>
                        <button type="button" class="discover__empty-reset" @click="resetFilters">
                            Reset filters
                        </button>
                    </div>

                    <div v-else class="discover__grid">
                        <PosterCard
                            v-for="anime in results.slice(0, displayedLimit)"
                            :key="anime.id"
                            :id="anime.id"
                            type="anime"
                            :title="anime.title.english || anime.title.romaji"
                            :original-title="anime.title.native || anime.title.romaji"
                            :poster-path="anime.coverImage?.large || anime.coverImage?.medium || null"
                            :rating="anime.averageScore ? anime.averageScore / 10 : 0"
                            :release-date="anime.seasonYear?.toString() || ''"
                            :genre-ids="[]"
                            :adult="false"
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
                                type="anime"
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
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import PosterCard from '../components/cards/PosterCard.vue';
import AnimeFilterPanel, { AnimeFilters } from '../components/discover/AnimeFilterPanel.vue';
import { useAniList, AnimeMedia } from '../composables/useAniList';

const ANIME_GENRES = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy',
    'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological',
    'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_BOUNDS: [number, number] = [1960, CURRENT_YEAR];

export default defineComponent({
    name: 'Anime',
    components: { SiteHeader, SiteFooter, PosterCard, AnimeFilterPanel },
    setup() {
        const { discoverAnime } = useAniList();

        const results = ref<AnimeMedia[]>([]);
        const filters = ref<AnimeFilters>({
            genres: [],
            yearRange: [...YEAR_BOUNDS] as [number, number],
            sortBy: 'TRENDING_DESC'
        });

        const currentPage = ref(1);
        const totalPages = ref(1);
        const totalResults = ref(0);
        const isLoading = ref(false);
        const isLoadingMore = ref(false);
        const loadError = ref('');

        const animeGenresList = ANIME_GENRES.map(genre => ({ id: genre, name: genre }));
        const yearBounds = YEAR_BOUNDS;

        const resultsTitle = computed(() => {
            if (filters.value.genres.length) {
                return filters.value.genres.join(' · ');
            }
            if (filters.value.sortBy === 'TRENDING_DESC') return 'Trending Now';
            if (filters.value.sortBy === 'POPULARITY_DESC') return 'Most Popular';
            if (filters.value.sortBy === 'SCORE_DESC') return 'Highest Rated';
            if (filters.value.sortBy === 'START_DATE_DESC') return 'Latest Releases';
            return 'All Anime';
        });

        const activeChips = computed(() => {
            const chips: Array<{ key: string; label: string; clear: () => void }> = [];
            
            filters.value.genres.forEach(genre => {
                chips.push({
                    key: `genre-${genre}`,
                    label: genre,
                    clear: () => {
                        filters.value.genres = filters.value.genres.filter(g => g !== genre);
                    }
                });
            });

            if (filters.value.yearRange[0] !== YEAR_BOUNDS[0] || filters.value.yearRange[1] !== YEAR_BOUNDS[1]) {
                chips.push({
                    key: 'year',
                    label: `${filters.value.yearRange[0]}–${filters.value.yearRange[1]}`,
                    clear: () => {
                        filters.value.yearRange = [...YEAR_BOUNDS] as [number, number];
                    }
                });
            }

            return chips;
        });

        const hasMore = computed(() => currentPage.value < totalPages.value);

        const onFiltersChange = (next: AnimeFilters) => {
            filters.value = next;
        };

        const resetFilters = () => {
            filters.value = {
                genres: [],
                yearRange: [...YEAR_BOUNDS] as [number, number],
                sortBy: 'TRENDING_DESC'
            };
        };

        const CACHE_KEY = 'anime_initial_discover_cache_v2';

        const fetchAnime = async (page = 1, append = false) => {
            const isInitialDefault = page === 1 && 
                                     !append && 
                                     filters.value.genres.length === 0 && 
                                     filters.value.yearRange[0] === 1960 && 
                                     filters.value.yearRange[1] === CURRENT_YEAR && 
                                     filters.value.sortBy === 'TRENDING_DESC';

            let loadedDefaultCache = false;
            if (isInitialDefault) {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        if (parsed && parsed.results && parsed.results.length) {
                            results.value = parsed.results;
                            totalPages.value = parsed.totalPages || 1;
                            totalResults.value = parsed.totalResults || 0;
                            isLoading.value = false;
                            loadedDefaultCache = true;
                        }
                    } catch (e) {
                        console.error('Failed to parse anime cache', e);
                    }
                }
            }

            // Keep the default trending lineup stable while its 12-hour cache is
            // valid. AniList may reorder TRENDING_DESC between identical requests,
            // which otherwise makes posters visibly shuffle whenever this tab mounts.
            if (loadedDefaultCache && !append) return;

            if (append) {
                isLoadingMore.value = true;
            } else {
                if (!results.value.length) {
                    isLoading.value = true;
                }
            }

            try {
                loadError.value = '';
                const response = await discoverAnime({
                    page,
                    perPage: 20,
                    genres: filters.value.genres,
                    yearStart: filters.value.yearRange[0] !== 1960 ? filters.value.yearRange[0] : undefined,
                    yearEnd: filters.value.yearRange[1] !== CURRENT_YEAR ? filters.value.yearRange[1] : undefined,
                    sort: filters.value.sortBy
                });

                const pageInfo = response.data?.Page?.pageInfo;
                const newResults = response.data?.Page?.media ?? [];

                if (append) {
                    const combined = [...results.value, ...newResults];
                    const seen = new Set();
                    results.value = combined.filter((item) => {
                        const uid = String(item.id || '');
                        if (!uid || seen.has(uid)) return false;
                        seen.add(uid);
                        return true;
                    });
                } else {
                    const seen = new Set();
                    results.value = newResults.filter((item) => {
                        const uid = String(item.id || '');
                        if (!uid || seen.has(uid)) return false;
                        seen.add(uid);
                        return true;
                    });

                    if (isInitialDefault && newResults.length > 0) {
                        localStorage.setItem(CACHE_KEY, JSON.stringify({
                            results: newResults,
                            totalPages: pageInfo?.lastPage ?? 1,
                            totalResults: pageInfo?.total ?? 0
                        }));
                    }
                }

                totalPages.value = pageInfo?.lastPage ?? 1;
                totalResults.value = pageInfo?.total ?? 0;
                currentPage.value = page;
            } catch (err) {
                console.error('Failed to fetch anime:', err);
                loadError.value =
                    err instanceof Error ? err.message : 'Could not load anime right now.';
                if (!append) {
                    results.value = [];
                }
            } finally {
                isLoading.value = false;
                isLoadingMore.value = false;
            }
        };

        const displayedLimit = ref(25);

        const loadMoreClick = async () => {
            displayedLimit.value += 25;
            while (results.value.length < displayedLimit.value && currentPage.value < totalPages.value) {
                await fetchAnime(currentPage.value + 1, true);
            }
        };

        watch(filters, () => {
            currentPage.value = 1;
            displayedLimit.value = 25;
            void fetchAnime(1, false);
        }, { deep: true });

        onMounted(() => {
            document.title = 'Discover Anime — Moovie';
            void fetchAnime(1, false);
        });

        return {
            results,
            filters,
            currentPage,
            totalPages,
            totalResults,
            isLoading,
            isLoadingMore,
            loadError,
            animeGenresList,
            yearBounds,
            resultsTitle,
            activeChips,
            hasMore,
            displayedLimit,
            loadMoreClick,
            onFiltersChange,
            resetFilters
        };
    }
});
</script>

<style lang="scss" scoped>
@import '../assets/styles/main.scss';

.discover {
    position: relative;
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        padding-block: clamp(var(--s-6), 6vw, var(--s-8));
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

    &__results-title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(1.4rem, 2.5vw, 2rem);
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
        font-size: clamp(1.6rem, 3vw, 2.2rem);
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
