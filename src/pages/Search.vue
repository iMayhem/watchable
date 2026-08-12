<template>
    <div class="search-page">
        <SiteHeader />

        <main id="main" class="search-page__main" role="main">
            <section class="search-page__masthead container-lm">
                <form class="search-page__search" role="search" @submit.prevent>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">
                        <circle cx="11" cy="11" r="7"/>
                        <path d="m20 20-3.5-3.5"/>
                    </svg>
                    <input
                        ref="inputEl"
                        type="text"
                        class="search-page__input"
                        placeholder="Search movies, shows, anime, and people"
                        :value="searchTerm"
                        aria-label="Search"
                        autocomplete="off"
                        @input="onSearchInput"
                    />
                    <button
                        v-if="searchTerm"
                        type="button"
                        class="search-page__clear"
                        aria-label="Clear search"
                        @click="handleClearSearch"
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6 6 18M6 6l12 12" stroke-linecap="round"/>
                        </svg>
                    </button>
                </form>
            </section>

            <template v-if="searchTerm">
                <section class="search-page__tabs-wrap container-lm">
                    <LmTabs
                        v-model="activeTab"
                        :tabs="tabs"
                        variant="underline"
                        aria-label="Search result categories"
                    />
                </section>

                <section class="search-page__results container-lm">
                    <div v-if="tabLoading && !currentCount" class="search-page__loading" role="status">
                        <div class="search-page__spinner" aria-hidden="true" />
                        <span class="meta">Searching the archive…</span>
                    </div>

                    <template v-if="activeTab === 'all'">
                        <div v-if="movies.length" class="search-page__subsection">
                            <h3 class="search-page__subsection-title">Movies</h3>
                            <div class="search-page__grid">
                                <PosterCard
                                    v-for="item in movies"
                                    :key="`m-${item.id}`"
                                    :id="item.id"
                                    type="movie"
                                    :title="item.title || item.original_title || ''"
                                    :original-title="item.original_title || ''"
                                    :poster-path="item.poster_path"
                                    :rating="item.vote_average || 0"
                                    :release-date="item.release_date || ''"
                                    :genre-ids="item.genre_ids || []"
                                    :adult="item.adult || false"
                                />
                            </div>
                        </div>

                        <div v-if="shows.length" class="search-page__subsection">
                            <h3 class="search-page__subsection-title">Shows</h3>
                            <div class="search-page__grid">
                                <PosterCard
                                    v-for="item in shows"
                                    :key="`t-${item.id}`"
                                    :id="item.id"
                                    type="tv"
                                    :title="item.name || item.original_name || ''"
                                    :original-title="item.original_name || ''"
                                    :poster-path="item.poster_path"
                                    :rating="item.vote_average || 0"
                                    :release-date="item.first_air_date || ''"
                                    :genre-ids="item.genre_ids || []"
                                    :adult="false"
                                />
                            </div>
                        </div>

                        <div v-if="people.length" class="search-page__subsection">
                            <h3 class="search-page__subsection-title">People</h3>
                            <div class="search-page__people-grid">
                                <PersonCard
                                    v-for="item in people"
                                    :key="`p-${item.id}`"
                                    :id="item.id"
                                    :name="item.name"
                                    :profile-path="item.profile_path"
                                    :department="item.known_for_department || ''"
                                />
                            </div>
                        </div>

                        <div v-if="anime.length" class="search-page__subsection">
                            <h3 class="search-page__subsection-title">Anime</h3>
                            <div class="search-page__grid">
                                <PosterCard
                                    v-for="item in anime"
                                    :key="`a-${item.id}`"
                                    :id="item.id"
                                    type="anime"
                                    :title="item.title.english || item.title.romaji"
                                    :original-title="item.title.native || item.title.romaji"
                                    :poster-path="animePosterPath(item)"
                                    :rating="item.averageScore ? item.averageScore / 10 : 0"
                                    :release-date="animeReleaseDate(item)"
                                    :genre-ids="[]"
                                    :adult="false"
                                />
                            </div>
                        </div>

                        <div v-if="upcomingCount" class="search-page__subsection">
                            <h3 class="search-page__subsection-title">Upcoming</h3>
                            <div class="search-page__grid">
                                <PosterCard
                                    v-for="item in upcomingMovies"
                                    :key="`um-${item.id}`"
                                    :id="item.id"
                                    type="movie"
                                    :title="item.title || item.original_title || ''"
                                    :original-title="item.original_title || ''"
                                    :poster-path="item.poster_path"
                                    :rating="item.vote_average || 0"
                                    :release-date="item.release_date || ''"
                                    :genre-ids="item.genre_ids || []"
                                    :adult="item.adult || false"
                                />
                                <PosterCard
                                    v-for="item in upcomingAnime"
                                    :key="`ua-${item.id}`"
                                    :id="item.id"
                                    type="anime"
                                    :title="item.title.english || item.title.romaji"
                                    :original-title="item.title.native || item.title.romaji"
                                    :poster-path="animePosterPath(item)"
                                    :rating="item.averageScore ? item.averageScore / 10 : 0"
                                    :release-date="animeReleaseDate(item)"
                                    :genre-ids="[]"
                                    :adult="false"
                                />
                            </div>
                        </div>

                        <div v-if="!movies.length && !shows.length && !people.length && !anime.length && !upcomingCount" class="search-page__empty">
                            <div class="search-page__empty-icon" aria-hidden="true">
                                <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.4">
                                    <circle cx="32" cy="32" r="22"/>
                                    <circle cx="32" cy="32" r="7"/>
                                    <circle cx="32" cy="14" r="3"/>
                                    <circle cx="32" cy="50" r="3"/>
                                    <circle cx="14" cy="32" r="3"/>
                                    <circle cx="50" cy="32" r="3"/>
                                </svg>
                            </div>
                            <h3 class="search-page__empty-title display">Not in the archive.</h3>
                            <p class="search-page__empty-desc">
                                No results matched "{{ searchTerm }}". Try a different spelling, or browse a related category.
                            </p>
                        </div>
                    </template>

                    <template v-else-if="activeTab === 'movies' && movies.length">
                        <div class="search-page__grid">
                            <PosterCard
                                v-for="item in movies.slice(0, displayedLimit)"
                                :key="`m-${item.id}`"
                                :id="item.id"
                                type="movie"
                                :title="item.title || item.original_title || ''"
                                :original-title="item.original_title || ''"
                                :poster-path="item.poster_path"
                                :rating="item.vote_average || 0"
                                :release-date="item.release_date || ''"
                                :genre-ids="item.genre_ids || []"
                                :adult="item.adult || false"
                            />
                        </div>
                    </template>

                    <template v-else-if="activeTab === 'shows' && shows.length">
                        <div class="search-page__grid">
                            <PosterCard
                                v-for="item in shows.slice(0, displayedLimit)"
                                :key="`t-${item.id}`"
                                :id="item.id"
                                type="tv"
                                :title="item.name || item.original_name || ''"
                                :original-title="item.original_name || ''"
                                :poster-path="item.poster_path"
                                :rating="item.vote_average || 0"
                                :release-date="item.first_air_date || ''"
                                :genre-ids="item.genre_ids || []"
                                :adult="false"
                            />
                        </div>
                    </template>

                    <template v-else-if="activeTab === 'people' && people.length">
                        <div class="search-page__people-grid">
                            <PersonCard
                                v-for="item in people.slice(0, displayedLimit)"
                                :key="`p-${item.id}`"
                                :id="item.id"
                                :name="item.name"
                                :profile-path="item.profile_path"
                                :department="item.known_for_department || ''"
                            />
                        </div>
                    </template>

                    <template v-else-if="activeTab === 'anime' && anime.length">
                        <div class="search-page__grid">
                            <PosterCard
                                v-for="item in anime.slice(0, displayedLimit)"
                                :key="`a-${item.id}`"
                                :id="item.id"
                                type="anime"
                                :title="item.title.english || item.title.romaji"
                                :original-title="item.title.native || item.title.romaji"
                                :poster-path="animePosterPath(item)"
                                :rating="item.averageScore ? item.averageScore / 10 : 0"
                                :release-date="animeReleaseDate(item)"
                                :genre-ids="[]"
                                :adult="false"
                            />
                        </div>
                    </template>

                    <template v-else-if="activeTab === 'upcoming' && upcomingCount">
                        <div v-if="upcomingMovies.length" class="search-page__subsection">
                            <h3 class="search-page__subsection-title">Films</h3>
                            <div class="search-page__grid">
                                <PosterCard
                                    v-for="item in upcomingMovies.slice(0, displayedLimit)"
                                    :key="`um-${item.id}`"
                                    :id="item.id"
                                    type="movie"
                                    :title="item.title || item.original_title || ''"
                                    :original-title="item.original_title || ''"
                                    :poster-path="item.poster_path"
                                    :rating="item.vote_average || 0"
                                    :release-date="item.release_date || ''"
                                    :genre-ids="item.genre_ids || []"
                                    :adult="item.adult || false"
                                />
                            </div>
                        </div>

                        <div v-if="upcomingAnime.length" class="search-page__subsection">
                            <h3 class="search-page__subsection-title">Anime</h3>
                            <div class="search-page__grid">
                                <PosterCard
                                    v-for="item in upcomingAnime.slice(0, displayedLimit)"
                                    :key="`ua-${item.id}`"
                                    :id="item.id"
                                    type="anime"
                                    :title="item.title.english || item.title.romaji"
                                    :original-title="item.title.native || item.title.romaji"
                                    :poster-path="animePosterPath(item)"
                                    :rating="item.averageScore ? item.averageScore / 10 : 0"
                                    :release-date="animeReleaseDate(item)"
                                    :genre-ids="[]"
                                    :adult="false"
                                />
                            </div>
                        </div>
                    </template>

                    <div v-else class="search-page__empty">
                        <div class="search-page__empty-icon" aria-hidden="true">
                            <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.4">
                                <circle cx="32" cy="32" r="22"/>
                                <circle cx="32" cy="32" r="7"/>
                                <circle cx="32" cy="14" r="3"/>
                                <circle cx="32" cy="50" r="3"/>
                                <circle cx="14" cy="32" r="3"/>
                                <circle cx="50" cy="32" r="3"/>
                            </svg>
                        </div>
                        <h3 class="search-page__empty-title display">Not in the archive.</h3>
                        <p class="search-page__empty-desc">
                            No {{ emptyLabel }} matched "{{ searchTerm }}". Try a different spelling, or
                            browse a related category.
                        </p>
                    </div>

                    <div v-if="currentCount && (hasMore || isLoadingMore)" class="search-page__load-more-container">
                        <button
                            v-if="!isLoadingMore"
                            type="button"
                            class="search-page__load-more-btn"
                            @click="loadMoreClick"
                        >
                            Load More
                        </button>
                        <div v-else class="search-page__grid" style="width: 100%">
                            <PosterCard
                                v-for="n in 8"
                                :key="`more-${n}`"
                                loading
                                id=""
                                :type="activeTab === 'people' ? 'movie' : (activeTab === 'shows' ? 'tv' : 'movie')"
                                title=""
                                poster-path=""
                                :rating="0"
                                release-date=""
                                :genre-ids="[]"
                                :adult="false"
                            />
                        </div>
                    </div>
                </section>
            </template>

            <section v-else class="search-page__idle container-lm">
                <div class="search-page__idle-head">
                    <p class="eyebrow">Start somewhere</p>
                    <h2 class="search-page__idle-title display">A few places to begin.</h2>
                </div>

                <div v-if="recentSearches.length" class="search-page__idle-block">
                    <p class="eyebrow search-page__idle-label">Your recent searches</p>
                    <div class="search-page__suggestions">
                        <button
                            v-for="term in recentSearches"
                            :key="`r-${term}`"
                            type="button"
                            class="search-page__suggestion"
                            @click="runSearch(term)"
                        >
                            {{ term }}
                        </button>
                    </div>
                </div>

                <div class="search-page__idle-block">
                    <p class="eyebrow search-page__idle-label">Popular right now</p>
                    <div class="search-page__suggestions">
                        <button
                            v-for="term in popularSearches"
                            :key="`p-${term}`"
                            type="button"
                            class="search-page__suggestion search-page__suggestion--ember"
                            @click="runSearch(term)"
                        >
                            {{ term }}
                        </button>
                    </div>
                </div>
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { debounce } from '../utils/memoization';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import LmTabs, { TabDef } from '../components/primitives/Tabs.vue';
import PosterCard from '../components/cards/PosterCard.vue';
import PersonCard from '../components/cards/PersonCard.vue';
import {
    useSearch,
    discoveredMovies,
    discoveredTv,
    discoveredPeople,
    discoveredAnime,
    discoveredUpcomingMovies,
    discoveredUpcomingAnime,
    reqMetaData,
    animeMeta,
    upcomingMoviesMeta,
    upcomingAnimeMeta
} from '../composables/useSearch';
import type { AnimeMedia } from '../composables/useAniList';
import { addSearchTerm, searchHistory } from '../composables/useHistory';

const TAB_KEYS = ['all', 'movies', 'shows', 'people', 'anime', 'upcoming'] as const;
type TabKey = typeof TAB_KEYS[number];

const isTabKey = (value: string): value is TabKey =>
    (TAB_KEYS as readonly string[]).includes(value);

export default defineComponent({
    name: 'Search',
    components: { SiteHeader, SiteFooter, LmTabs, PosterCard, PersonCard },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const {
            fetchSearchResults,
            fetchAnimeSearch,
            fetchUpcomingSearch,
            clearSearchResults
        } = useSearch();

        const inputEl = ref<HTMLInputElement | null>(null);
        const searchTerm = ref<string>(typeof route.query.search === 'string' ? route.query.search : '');
        const activeTab = ref<TabKey>(
            typeof route.query.tab === 'string' && isTabKey(route.query.tab)
                ? route.query.tab
                : 'all'
        );
        const isLoading = ref(false);
        const isLoadingAnime = ref(false);
        const isLoadingUpcoming = ref(false);
        const isLoadingMore = ref(false);

        const popularSearches = [
            'Dune', 'The Bear', 'Christopher Nolan', 'Succession',
            'Florence Pugh', 'Studio Ghibli', 'Oppenheimer', 'Severance'
        ];

        const movies = computed(() => discoveredMovies.value);
        const shows = computed(() => discoveredTv.value);
        const people = computed(() => discoveredPeople.value);
        const anime = computed(() => discoveredAnime.value);
        const upcomingMovies = computed(() => discoveredUpcomingMovies.value);
        const upcomingAnime = computed(() => discoveredUpcomingAnime.value);
        const upcomingCount = computed(
            () => upcomingMovies.value.length + upcomingAnime.value.length
        );

        const recentSearches = computed(() =>
            (searchHistory.value || []).filter(Boolean).slice(0, 6)
        );

        const tabs: TabDef[] = [
            { label: 'All', value: 'all' },
            { label: 'Movies', value: 'movies' },
            { label: 'Shows', value: 'shows' },
            { label: 'People', value: 'people' },
            { label: 'Anime', value: 'anime' },
            { label: 'Upcoming', value: 'upcoming' }
        ];

        const tabLoading = computed(() => {
            if (activeTab.value === 'anime') return isLoadingAnime.value;
            if (activeTab.value === 'upcoming') return isLoadingUpcoming.value;
            if (activeTab.value === 'all') return isLoading.value || isLoadingAnime.value || isLoadingUpcoming.value;
            return isLoading.value;
        });

        const currentCount = computed(() => {
            if (activeTab.value === 'all') return movies.value.length + shows.value.length + people.value.length + anime.value.length + upcomingCount.value;
            if (activeTab.value === 'movies') return movies.value.length;
            if (activeTab.value === 'shows') return shows.value.length;
            if (activeTab.value === 'people') return people.value.length;
            if (activeTab.value === 'anime') return anime.value.length;
            return upcomingCount.value;
        });

        const emptyLabel = computed(() => {
            if (activeTab.value === 'all') return 'results';
            if (activeTab.value === 'movies') return 'films';
            if (activeTab.value === 'shows') return 'series';
            if (activeTab.value === 'people') return 'people';
            if (activeTab.value === 'anime') return 'anime';
            return 'upcoming titles';
        });

        const hasMore = computed(() => {
            if (activeTab.value === 'all') return false;
            if (activeTab.value === 'anime') {
                return animeMeta.value.hasNextPage;
            }
            if (activeTab.value === 'upcoming') {
                return (
                    upcomingMoviesMeta.value.page < upcomingMoviesMeta.value.total_pages
                    || upcomingAnimeMeta.value.hasNextPage
                );
            }
            return reqMetaData.value.page > 0 && reqMetaData.value.page < reqMetaData.value.total_pages;
        });

        const animePosterPath = (item: AnimeMedia) =>
            item.coverImage?.extraLarge
            || item.coverImage?.large
            || item.coverImage?.medium
            || null;

        const animeReleaseDate = (item: AnimeMedia) => {
            const date = item.startDate;
            if (date?.year) {
                const month = String(date.month || 1).padStart(2, '0');
                const day = String(date.day || 1).padStart(2, '0');
                return `${date.year}-${month}-${day}`;
            }
            return item.seasonYear?.toString() || '';
        };

        const chooseDefaultTab = () => {
            if (activeTab.value === 'all') return;
            if (!movies.value.length && shows.value.length) activeTab.value = 'shows';
            else if (!movies.value.length && !shows.value.length && people.value.length) {
                activeTab.value = 'people';
            } else {
                activeTab.value = 'movies';
            }
            syncRoute();
        };

        const loadAnimeResults = async (query: string, page = 1) => {
            const q = query.trim();
            if (!q) return;

            if (page === 1) isLoadingAnime.value = true;
            else isLoadingMore.value = true;

            try {
                await fetchAnimeSearch(q, page, page > 1);
            } finally {
                isLoadingAnime.value = false;
                isLoadingMore.value = false;
            }
        };

        const loadUpcomingResults = async (query: string, page = 1) => {
            const q = query.trim();
            if (!q) return;

            if (page === 1) isLoadingUpcoming.value = true;
            else isLoadingMore.value = true;

            try {
                await fetchUpcomingSearch(q, page, page > 1);
            } finally {
                isLoadingUpcoming.value = false;
                isLoadingMore.value = false;
            }
        };

        const ensureTabResults = async (tab: TabKey) => {
            const q = searchTerm.value.trim();
            if (!q) return;

            if (
                (tab === 'all' || tab === 'movies' || tab === 'shows' || tab === 'people')
                && !movies.value.length
                && !shows.value.length
                && !people.value.length
                && !isLoading.value
            ) {
                isLoading.value = true;
                try {
                    await fetchSearchResults(q, 1);
                } finally {
                    isLoading.value = false;
                }
            }

            if ((tab === 'all' || tab === 'anime') && !anime.value.length && !isLoadingAnime.value) {
                await loadAnimeResults(q);
            }
            if ((tab === 'all' || tab === 'upcoming') && !upcomingCount.value && !isLoadingUpcoming.value) {
                await loadUpcomingResults(q);
            }
        };

        const performSearch = async (query: string, page: number = 1) => {
            const q = query.trim();
            if (!q) return;

            if (page === 1) {
                clearSearchResults();
                displayedLimit.value = 25;
                if (activeTab.value === 'anime') isLoadingAnime.value = true;
                else if (activeTab.value === 'upcoming') isLoadingUpcoming.value = true;
                else if (activeTab.value === 'all') {
                    isLoading.value = true;
                    isLoadingAnime.value = true;
                    isLoadingUpcoming.value = true;
                } else isLoading.value = true;
            } else {
                isLoadingMore.value = true;
            }

            try {
                if (activeTab.value === 'anime') {
                    await loadAnimeResults(q, page);
                    return;
                }
                if (activeTab.value === 'upcoming') {
                    await loadUpcomingResults(q, page);
                    return;
                }

                await fetchSearchResults(q, page);
                if (activeTab.value === 'all') {
                    await Promise.all([
                        loadAnimeResults(q),
                        loadUpcomingResults(q)
                    ]);
                }
                if (page === 1) chooseDefaultTab();
            } finally {
                isLoading.value = false;
                isLoadingAnime.value = false;
                isLoadingUpcoming.value = false;
                isLoadingMore.value = false;
            }
        };

        const syncRoute = () => {
            const q: Record<string, string> = {};
            if (searchTerm.value) q.search = searchTerm.value;
            if (searchTerm.value && activeTab.value !== 'all') q.tab = activeTab.value;
            const current = route.query;
            if (JSON.stringify(q) !== JSON.stringify(current)) {
                router.replace({ query: q });
            }
        };

        const handleClearSearch = () => {
            clearSearchResults();
            searchTerm.value = '';
            activeTab.value = 'all';
            syncRoute();
            nextTick(() => inputEl.value?.focus());
        };

        const runSearch = (term: string) => {
            searchTerm.value = term;
            syncRoute();
            addSearchTerm(term);
            performSearch(term);
        };

        const debouncedSearch = debounce((term: string) => {
            const q = term.trim();
            if (!q) {
                clearSearchResults();
                syncRoute();
                return;
            }
            addSearchTerm(q);
            syncRoute();
            performSearch(q);
        }, 350);

        const onSearchInput = (e: Event) => {
            searchTerm.value = (e.target as HTMLInputElement).value;
            if (!searchTerm.value.trim()) {
                clearSearchResults();
                syncRoute();
            } else {
                debouncedSearch(searchTerm.value);
            }
        };

        const loadMore = async () => {
            if (!hasMore.value || !searchTerm.value.trim()) return;

            if (activeTab.value === 'anime') {
                await loadAnimeResults(searchTerm.value, animeMeta.value.page + 1);
                return;
            }

            if (activeTab.value === 'upcoming') {
                const nextPage = Math.max(
                    upcomingMoviesMeta.value.page,
                    upcomingAnimeMeta.value.page
                ) + 1;
                await loadUpcomingResults(searchTerm.value, nextPage);
                return;
            }

            await performSearch(searchTerm.value, reqMetaData.value.page + 1);
        };

        const displayedLimit = ref(25);

        const loadMoreClick = async () => {
            displayedLimit.value += 25;
            while (currentCount.value < displayedLimit.value && hasMore.value) {
                await loadMore();
            }
        };

        watch(activeTab, (tab) => {
            displayedLimit.value = 25;
            syncRoute();
            void ensureTabResults(tab);
        });

        watch(
            () => route.query.search,
            query => {
                const q = typeof query === 'string' ? query : '';
                if (q === searchTerm.value) return;
                searchTerm.value = q;
                if (q) performSearch(q);
                else clearSearchResults();
            }
        );

        const reloadSearch = () => {
            if (searchTerm.value.trim()) {
                performSearch(searchTerm.value);
            }
        };

        onMounted(() => {
            document.title = 'Search — Moovie';
            window.scrollTo(0, 0);

            if (searchTerm.value.trim()) {
                performSearch(searchTerm.value);
            } else {
                clearSearchResults();
            }

            window.addEventListener('movora_settings_change', reloadSearch);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('movora_settings_change', reloadSearch);
        });

        return {
            inputEl,
            searchTerm,
            activeTab,
            tabLoading,
            isLoadingMore,
            movies,
            shows,
            people,
            anime,
            upcomingMovies,
            upcomingAnime,
            upcomingCount,
            recentSearches,
            popularSearches,
            tabs,
            currentCount,
            emptyLabel,
            hasMore,
            displayedLimit,
            loadMoreClick,
            reqMetaData,
            animeMeta,
            animePosterPath,
            animeReleaseDate,
            onSearchInput,
            handleClearSearch,
            runSearch
        };
    }
});
</script>

<style lang="scss" scoped>
.search-page {
    position: relative;
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        padding-block: clamp(var(--s-6), 6vw, var(--s-8));
    }

    &__masthead {
        padding-bottom: var(--s-5);
        border-bottom: 1px solid var(--rule);
        margin-bottom: var(--s-5);
    }

    &__search {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        padding: 0.9rem var(--s-5);
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
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
        font-size: var(--fs-lg);
        padding: 0;

        &::placeholder { color: var(--bone-400); }
        &:focus { outline: none; }
    }

    &__clear {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        color: var(--bone-400);
        transition: color var(--dur-fast) var(--ease-out);
        &:hover { color: var(--bone-50); }
    }

    &__tabs-wrap {
        margin-bottom: var(--s-6);
        overflow-x: auto;
        scrollbar-width: none;
        &::-webkit-scrollbar { display: none; }
    }

    &__subsection {
        display: grid;
        gap: var(--s-4);

        & + & {
            margin-top: var(--s-7);
        }
    }

    &__subsection-title {
        margin: 0;
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--bone-400);
    }

    &__results {
        min-height: 40vh;
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
        animation: search-spin 0.8s linear infinite;
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: var(--s-4);

        @media (min-width: 720px) {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: var(--s-5) var(--s-4);
        }
    }

    &__people-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
        gap: var(--s-6) var(--s-5);

        @media (min-width: 720px) {
            grid-template-columns: repeat(auto-fill, minmax(144px, 1fr));
        }
    }

    &__empty {
        text-align: center;
        padding: var(--s-9) var(--s-4);
        max-width: 54ch;
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
        margin: 0;
        line-height: 1.55;
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

    &__idle {
        padding-block: clamp(var(--s-6), 6vw, var(--s-8));
        display: grid;
        gap: var(--s-7);
    }

    &__idle-head {
        max-width: 54ch;
    }

    &__idle-title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(1.8rem, 3.5vw, 2.6rem);
        color: var(--bone-50);
        margin: var(--s-1) 0 0;
        letter-spacing: -0.01em;
    }

    &__idle-block {
        display: grid;
        gap: var(--s-3);
    }

    &__idle-label {
        color: var(--bone-400);
        margin: 0;
    }

    &__suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-2);
    }

    &__suggestion {
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        color: var(--bone-200);
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
        padding: 0.5rem 1rem;
        transition:
            color var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out),
            background-color var(--dur-fast) var(--ease-out);

        &:hover, &:focus-visible {
            color: var(--bone-50);
            background: var(--surface-tint-hover);
            border-color: var(--rule-strong);
        }

        &--ember {
            color: var(--ember);
            border-color: rgba(255, 255, 255, 0.25);
            background: rgba(255, 255, 255, 0.06);

            &:hover, &:focus-visible {
                color: var(--ember);
                background: rgba(255, 255, 255, 0.14);
                border-color: rgba(255, 255, 255, 0.5);
            }
        }
    }
}

@keyframes search-spin {
    to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
    .search-page__spinner { animation: none; }
}
</style>
