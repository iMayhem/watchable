<template>
    <div class="discover-page">
        <SiteHeader />

        <main id="main" class="discover-page__main" role="main">
            <header class="discover-page__header container-lm">
                <span class="eyebrow discover-page__eyebrow">Browse</span>
                <h1 class="discover-page__title">Discover</h1>
                <p class="discover-page__desc">
                    Explore the biggest movies across every era — sorted the way you like.
                </p>
            </header>

            <div class="discover-page__toolbar container-lm">
                <div class="discover-page__controls">
                    <div class="discover-page__sorts" role="group" aria-label="Sort results">
                        <button
                            v-for="sort in sorts"
                            :key="sort.key"
                            type="button"
                            class="discover-page__sort"
                            :class="{ 'is-active': activeSort === sort.key }"
                            :aria-pressed="activeSort === sort.key"
                            @click="selectSort(sort)"
                        >
                            {{ sort.label }}
                        </button>
                    </div>

                    <div ref="platformWrap" class="discover-page__platform">
                        <button
                            type="button"
                            class="discover-page__platform-trigger"
                            :class="{ 'is-active': activeProvider !== null }"
                            aria-haspopup="listbox"
                            :aria-expanded="platformOpen"
                            @click="platformOpen = !platformOpen"
                        >
                            <img
                                v-if="activeProvider && providerLogo(activeProvider)"
                                :src="providerLogo(activeProvider)"
                                alt=""
                                class="discover-page__platform-logo"
                            />
                            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                                <rect x="2" y="4" width="20" height="16" rx="2"/>
                                <path d="M2 9h20M7 17h4"/>
                            </svg>
                            <span class="discover-page__platform-label">{{ activeProviderLabel }}</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" class="discover-page__platform-chevron">
                                <path d="m6 9 6 6 6-6"/>
                            </svg>
                        </button>

                        <div v-if="platformOpen" class="discover-page__platform-menu" role="listbox" aria-label="Browse by streaming platform">
                            <button
                                type="button"
                                role="option"
                                class="discover-page__platform-option"
                                :class="{ 'is-active': activeProvider === null }"
                                :aria-selected="activeProvider === null"
                                @click="selectProvider(null)"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                                    <path d="M2 9h20M7 17h4"/>
                                </svg>
                                <span>All platforms</span>
                            </button>
                            <button
                                v-for="provider in providers"
                                :key="provider.key"
                                type="button"
                                role="option"
                                class="discover-page__platform-option"
                                :class="{ 'is-active': activeProvider === provider.key }"
                                :aria-selected="activeProvider === provider.key"
                                @click="selectProvider(provider)"
                            >
                                <img
                                    v-if="providerLogo(provider.key)"
                                    :src="providerLogo(provider.key)"
                                    alt=""
                                    class="discover-page__platform-option-logo"
                                />
                                <span>{{ provider.label }}</span>
                                <span v-if="provider.region" class="discover-page__platform-option-region">{{ provider.region }}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <p v-if="totalResults > 0" class="discover-page__count">
                    {{ totalResults.toLocaleString() }} titles
                </p>
            </div>

            <section class="discover-page__results container-lm">
                <div v-if="isLoading" class="discover-page__grid">
                    <PosterCard
                        v-for="n in 20"
                        :key="n"
                        loading
                        id=""
                        type="movie"
                        title=""
                        poster-path=""
                        class="discover-page__card"
                    />
                </div>

                <div v-else-if="!results.length" class="discover-page__empty">
                    <p>No titles found for this combination.</p>
                    <p class="discover-page__empty-sub">
                        Try switching the sort or picking another platform.
                    </p>
                </div>

                <div v-else class="discover-page__grid">
                    <PosterCard
                        v-for="item in results.slice(0, displayedLimit)"
                        :key="item.id"
                        :id="item.id"
                        :type="item.type || 'movie'"
                        :title="item.title"
                        :poster-path="item.poster_path"
                        :rating="item.vote_average"
                        :release-date="item.release_date"
                        class="discover-page__card"
                    />
                </div>

                <div v-if="results.length && (hasMore || isLoadingMore)" class="discover-page__load-more-container">
                    <button
                        v-if="!isLoadingMore"
                        type="button"
                        class="discover-page__load-more-btn"
                        @click="loadMoreClick"
                    >
                        Load More
                    </button>
                    <div v-else class="discover-page__loading">
                        <span>Loading more…</span>
                    </div>
                </div>

                <p v-if="!isLoading && !hasMore && results.length > 0" class="discover-page__empty">
                    You've seen it all.
                </p>
            </section>
        </main>

        <button
            type="button"
            class="discover-page__ai-btn"
            aria-label="AI assistant"
            @click="toggleSuggestion"
        >
            {{ showSuggestion ? '✕' : 'AI' }}
            <span class="discover-page__ai-new-badge">NEW</span>
        </button>

        <div v-if="showSuggestion" class="discover-page__ai-backdrop" />
        <div v-if="showSuggestion" class="discover-page__ai-wrapper">
            <!-- If loading -->
            <div v-if="geminiLoading" class="discover-page__ai-loading-pill">
                <span class="discover-page__ai-spinner" />
                <span>Thinking... 🧠</span>
            </div>

            <!-- If suggestions are loaded -->
            <template v-else-if="geminiSuggestions.length">
                <!-- Navigatable recommendation pills -->
                <div
                    v-for="sug in geminiSuggestions"
                    :key="sug.title"
                    class="discover-page__ai-recommend-container"
                >
                    <router-link
                        :to="getDetailRoute(sug)"
                        class="discover-page__ai-recommend-pill"
                    >
                        <img
                            v-if="sug.posterPath"
                            :src="getPosterUrl(sug.posterPath)"
                            class="discover-page__ai-pill-poster"
                            alt=""
                            loading="lazy"
                        />
                        <span v-else class="discover-page__ai-pill-icon">{{ sug.type === 'tv' ? '📺' : '🎬' }}</span>
                        <span class="discover-page__ai-pill-title">{{ sug.title }}</span>
                    </router-link>
                    <div class="discover-page__ai-pill-reason-tooltip">{{ sug.reason }}</div>
                </div>

                <!-- Utility actions -->
                <button type="button" class="discover-page__ai-action-pill is-filter" @click="showAiResultsInGrid">
                    Filter Grid 🔍
                </button>
                <button type="button" class="discover-page__ai-action-pill is-retry" @click="retryAiOption">
                    Try Again ➔
                </button>
                <button type="button" class="discover-page__ai-action-pill is-close" @click="clearSuggestion">
                    Reset AI Menu ✕
                </button>
            </template>

            <!-- If error -->
            <template v-else-if="geminiError">
                <div class="discover-page__ai-error-pill">
                    ⚠️ {{ geminiError }}
                </div>
                <button type="button" class="discover-page__ai-action-pill is-retry" @click="retryAiOption">
                    Try Again ➔
                </button>
                <button type="button" class="discover-page__ai-action-pill is-close" @click="clearSuggestion">
                    Reset AI Menu ✕
                </button>
            </template>

            <!-- Initial Option Vibe Buttons + Search Input -->
            <template v-else>
                <form @submit.prevent="handleAiSearch" class="discover-page__ai-search-pill">
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Ask AI... (e.g. 90s sci-fi)"
                        class="discover-page__ai-pill-input"
                    />
                    <button type="submit" class="discover-page__ai-pill-submit">➔</button>
                </form>
                <button
                    v-for="opt in aiOptions"
                    :key="opt.label"
                    type="button"
                    class="discover-page__ai-opt-pill"
                    @click="selectAiOption(opt)"
                >
                    {{ opt.label }}
                </button>
            </template>
        </div>

        <button
            v-if="showScrollTop"
            type="button"
            class="discover-page__scroll-top"
            aria-label="Back to top"
            @click="scrollToTop"
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M18 15l-6-6-6 6"/>
            </svg>
        </button>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import PosterCard from '../components/cards/PosterCard.vue';
import { useGemini } from '../composables/useGemini';

interface SortOption {
    key: string;
    label: string;
    params: Record<string, string | number>;
}

interface Provider {
    key: string;
    label: string;
    tmdbId: number;
    region: string;
}

interface MovieResult {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date: string;
    type: 'movie' | 'tv' | 'anime';
}

// TMDB watch provider IDs (verified via /watch/providers) — not to be confused
// with Watchmode source IDs. flatrate = subscription streaming.
const PROVIDER_API = 'https://hahaevilcraft.site/tmdb-api/3/';

// Legacy ?category= values from the old tabbed page, mapped to the new sort keys
const LEGACY_CATEGORY_TO_SORT: Record<string, string> = {
    'highest-grossing': 'highest-grossing',
    'most-voted': 'most-voted',
    'top-rated': 'top-rated'
};

const SORTS: SortOption[] = [
    { key: 'popular', label: 'Popular', params: { sort_by: 'popularity.desc' } },
    { key: 'top-rated', label: 'Top Rated', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 500 } },
    { key: 'highest-grossing', label: 'Highest Grossing', params: { sort_by: 'revenue.desc' } },
    { key: 'most-voted', label: 'Most Voted', params: { sort_by: 'vote_count.desc' } }
];

const PROVIDERS: Provider[] = [
    { key: 'netflix', label: 'Netflix', tmdbId: 8, region: 'US' },
    { key: 'prime', label: 'Prime Video', tmdbId: 9, region: 'US' },
    { key: 'dplus', label: 'Disney+', tmdbId: 337, region: 'US' },
    { key: 'hbomax', label: 'HBO Max', tmdbId: 1899, region: 'US' },
    { key: 'hulu', label: 'Hulu', tmdbId: 15, region: 'US' },
    { key: 'appletv', label: 'Apple TV+', tmdbId: 350, region: 'US' },
    { key: 'paramount', label: 'Paramount+', tmdbId: 2303, region: 'US' },
    { key: 'peacock', label: 'Peacock', tmdbId: 386, region: 'US' },
    { key: 'starz', label: 'Starz', tmdbId: 43, region: 'US' },
    { key: 'crunchyroll', label: 'Crunchyroll', tmdbId: 283, region: 'US' },
    { key: 'mubi', label: 'MUBI', tmdbId: 11, region: 'US' },
    { key: 'shudder', label: 'Shudder', tmdbId: 99, region: 'US' },
    { key: 'criterion', label: 'Criterion', tmdbId: 258, region: 'US' },
    { key: 'britbox', label: 'BritBox', tmdbId: 151, region: 'US' },
    { key: 'acorn', label: 'Acorn TV', tmdbId: 87, region: 'US' },
    { key: 'viki', label: 'Viki', tmdbId: 344, region: 'US' },
    { key: 'curiosity', label: 'CuriosityStream', tmdbId: 190, region: 'US' },
    { key: 'hayu', label: 'Hayu', tmdbId: 296, region: 'GB' },
    { key: 'lionsgate', label: 'Lionsgate+', tmdbId: 2358, region: 'GB' }
];

export default defineComponent({
    name: 'Discover',
    components: { SiteHeader, SiteFooter, PosterCard },
    setup() {
        const router = useRouter();

        const legacyCategory = (router.currentRoute.value.query.category as string) || '';
        const sortParam = (router.currentRoute.value.query.sort as string) || '';
        const providerParam = (router.currentRoute.value.query.provider as string) || '';
        const initialKey = SORTS.some(s => s.key === sortParam)
            ? sortParam
            : (LEGACY_CATEGORY_TO_SORT[legacyCategory] || 'popular');
        const initialProvider = PROVIDERS.some(p => p.key === providerParam)
            ? providerParam
            : null;

        const activeSort = ref(initialKey);
        const activeProvider = ref<string | null>(initialProvider);
        const platformOpen = ref(false);
        const platformWrap = ref<HTMLElement | null>(null);
        const results = ref<MovieResult[]>([]);
        const totalResults = ref(0);
        const isLoading = ref(true);
        const isLoadingMore = ref(false);
        const page = ref(1);
        const totalPages = ref(1);
        const currentSort = ref<SortOption>(SORTS.find(s => s.key === initialKey) || SORTS[0]);
        const showScrollTop = ref(false);
        const showSuggestion = ref(false);

        const activeProviderLabel = computed(() => {
            if (!activeProvider.value) return 'All platforms';
            return PROVIDERS.find(p => p.key === activeProvider.value)?.label ?? 'All platforms';
        });

        const { suggestion: geminiSuggestion, suggestions: geminiSuggestions, loading: geminiLoading, error: geminiError, getSuggestion: getGeminiSuggestion, clearSuggestion } = useGemini();

        const aiOptions = [
            { label: 'Epic Action 💥', query: 'action and adventure, epic battles' },
            { label: 'Need a Laugh 😂', query: 'comedy, hilarious movies or shows' },
            { label: 'Scary / Spooky 👻', query: 'horror, thriller, scary movies' },
            { label: 'Mind-Bending 🧠', query: 'sci-fi, mystery, complex plots' },
            { label: 'Feel Good 🥰', query: 'heartwarming, romance, feel good' },
            { label: 'Surprise Me 🎲', query: '' }
        ];

        const selectedOption = ref<{ label: string; query: string } | null>(null);
        const searchQuery = ref('');

        const selectAiOption = (opt: { label: string; query: string }) => {
            selectedOption.value = opt;
            void getGeminiSuggestion(opt.query);
        };

        const handleAiSearch = () => {
            const queryVal = searchQuery.value.trim();
            if (!queryVal) return;
            selectedOption.value = { label: queryVal, query: queryVal };
            void getGeminiSuggestion(queryVal);
            searchQuery.value = '';
        };

        const showAiResultsInGrid = () => {
            if (!geminiSuggestions.value.length) return;
            results.value = geminiSuggestions.value.map(s => ({
                id: s.id,
                title: s.title,
                poster_path: s.posterPath,
                vote_average: 0,
                release_date: '',
                type: s.type
            }));
            // Close the floating AI panel
            showSuggestion.value = false;
        };

        const retryAiOption = () => {
            if (selectedOption.value) {
                void getGeminiSuggestion(selectedOption.value.query);
            } else {
                void getGeminiSuggestion();
            }
        };

        const getDetailRoute = (sug: any) => {
            if (!sug) return '';
            const type = sug.type === 'tv' ? 'TVShow' : 'Movie';
            return { name: type, params: { id: sug.id.toString() } };
        };

        const getPosterUrl = (posterPath: string | null) => {
            if (!posterPath) return '';
            return `https://image.tmdb.org/t/p/w185${posterPath}`;
        };

        const toggleSuggestion = () => {
            showSuggestion.value = !showSuggestion.value;
            if (!showSuggestion.value) {
                clearSuggestion();
                selectedOption.value = null;
                searchQuery.value = '';
            }
        };

        const onScroll = () => {
            showScrollTop.value = window.scrollY > 600;
        };

        const scrollToTop = () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        const closePlatformOnOutside = (e: MouseEvent) => {
            if (platformWrap.value && !platformWrap.value.contains(e.target as Node)) {
                platformOpen.value = false;
            }
        };

        const closePlatformOnKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') platformOpen.value = false;
        };

        onMounted(() => {
            window.addEventListener('scroll', onScroll, { passive: true });
            document.addEventListener('click', closePlatformOnOutside);
            document.addEventListener('keydown', closePlatformOnKey);
        });
        onBeforeUnmount(() => {
            window.removeEventListener('scroll', onScroll);
            document.removeEventListener('click', closePlatformOnOutside);
            document.removeEventListener('keydown', closePlatformOnKey);
        });

        const hasMore = computed(() => page.value < totalPages.value);

        const providerLogoModules = import.meta.glob<{ default: string }>('../assets/brands/*.svg', { eager: true });
        const providerLogo = (key: string): string | undefined => {
            return providerLogoModules[`../assets/brands/${key}.svg`]?.default;
        };

        let fetchReqId = 0;

        const fetchTmdbDiscover = async (params: Record<string, string>, signal: AbortSignal): Promise<any> => {
            const apiKey = import.meta.env.VITE_API_KEY || 'dfa4c2c7c1de1005adee824dc5593672';
            const qs = new URLSearchParams({ api_key: apiKey, ...params });
            qs.set('language', 'en-US');
            const res = await fetch(`${PROVIDER_API}discover/movie?${qs.toString()}`, { signal });
            if (!res.ok) throw new Error(`TMDB fetch error: ${res.status}`);
            return res.json();
        };

        const fetchPage = async (sort: SortOption, p: number, append: boolean) => {
            const reqId = ++fetchReqId;
            const provider = activeProvider.value
                ? (PROVIDERS.find(pr => pr.key === activeProvider.value) ?? null)
                : null;
            if (append) {
                isLoadingMore.value = true;
            } else {
                isLoading.value = true;
                results.value = [];
            }
            try {
                const params: Record<string, string> = {
                    ...Object.fromEntries(
                        Object.entries(sort.params).map(([k, v]) => [k, String(v)])
                    ),
                    page: String(p)
                };
                if (provider) {
                    params.with_watch_providers = String(provider.tmdbId);
                    params.watch_region = provider.region;
                    params.with_watch_monetization_types = 'flatrate';
                }

                const data = await fetchTmdbDiscover(params, AbortSignal.timeout(15000));

                if (reqId !== fetchReqId) return;

                const items: MovieResult[] = ((data?.results ?? []) as any[]).map((r: any) => ({
                    id: r.id,
                    title: r.title || r.name || '',
                    poster_path: r.poster_path ?? null,
                    vote_average: r.vote_average || 0,
                    release_date: r.release_date || r.first_air_date || '',
                    type: 'movie'
                }));

                if (reqId !== fetchReqId) return;

                if (append) {
                    const existingIds = new Set(results.value.map(r => r.id));
                    const fresh = items.filter(i => !existingIds.has(i.id));
                    results.value = [...results.value, ...fresh];
                } else {
                    results.value = items;
                }
                totalResults.value = data?.total_results ?? 0;
                totalPages.value = Math.min(data?.total_pages ?? 1, 500);
                page.value = p;
            } catch {
                if (!append && reqId === fetchReqId) results.value = [];
            } finally {
                if (reqId === fetchReqId) {
                    isLoading.value = false;
                    isLoadingMore.value = false;
                }
            }
        };

        const displayedLimit = ref(25);

        const loadMoreClick = async () => {
            displayedLimit.value += 25;
            if (results.value.length < displayedLimit.value && page.value < totalPages.value) {
                await fetchPage(currentSort.value, page.value + 1, true);
            }
        };

        const selectSort = (sort: SortOption) => {
            activeSort.value = sort.key;
            currentSort.value = sort;
            page.value = 1;
            totalPages.value = 1;
            displayedLimit.value = 25;
            void router.replace({ query: { ...router.currentRoute.value.query, sort: sort.key } });
            void fetchPage(sort, 1, false);
        };

        const selectProvider = (provider: Provider | null) => {
            activeProvider.value = provider?.key ?? null;
            platformOpen.value = false;
            page.value = 1;
            totalPages.value = 1;
            displayedLimit.value = 25;
            const query = { ...router.currentRoute.value.query };
            if (provider) {
                query.provider = provider.key;
            } else {
                delete query.provider;
            }
            void router.replace({ query });
            void fetchPage(currentSort.value, 1, false);
        };

        void fetchPage(currentSort.value, 1, false);

        return {
            sorts: SORTS,
            providers: PROVIDERS,
            activeSort,
            activeProvider,
            activeProviderLabel,
            platformOpen,
            platformWrap,
            selectProvider,
            providerLogo,
            results,
            totalResults,
            isLoading,
            isLoadingMore,
            hasMore,
            displayedLimit,
            loadMoreClick,
            selectSort,
            showScrollTop,
            scrollToTop,
            showSuggestion,
            toggleSuggestion,
            geminiSuggestion,
            geminiSuggestions,
            geminiLoading,
            geminiError,
            getGeminiSuggestion,
            clearSuggestion,
            aiOptions,
            selectedOption,
            selectAiOption,
            retryAiOption,
            getDetailRoute,
            getPosterUrl,
            searchQuery,
            handleAiSearch,
            showAiResultsInGrid
        };
    }
});
</script>

<style lang="scss" scoped>
.discover-page {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        position: relative;
        padding-top: var(--s-6);
        display: flex;
        flex-direction: column;
        gap: var(--s-6);
    }

    // ── Page header ───────────────────────────────────────────────────────
    &__header {
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
    }

    &__eyebrow {
        color: var(--ember);
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(var(--fs-3xl), 5vw, var(--fs-4xl));
        line-height: 1;
        letter-spacing: -0.02em;
        margin: 0;
        font-variation-settings: 'opsz' 72, 'SOFT' 30;
    }

    &__desc {
        color: var(--bone-300);
        font-size: var(--fs-base);
        line-height: var(--lh-snug);
        max-width: 56ch;
        margin: 0;
    }

    // ── Toolbar (sort chips + platform + count) ───────────────────────────
    &__toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);
        flex-wrap: wrap;
    }

    &__controls {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        flex-wrap: wrap;
    }

    &__sorts {
        display: inline-flex;
        gap: var(--s-1);
        padding: var(--s-1);
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
        max-width: 100%;
        overflow-x: auto;
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }
    }

    &__sort {
        padding: 0.45rem 1rem;
        border: none;
        border-radius: var(--r-pill);
        background: transparent;
        color: var(--bone-400);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        white-space: nowrap;
        cursor: pointer;
        transition:
            color var(--dur-fast) var(--ease-out),
            background-color var(--dur-fast) var(--ease-out);

        &:hover {
            color: var(--bone-100);
        }

        &.is-active {
            background: var(--ember);
            color: var(--ink-950);
            font-weight: 600;
        }
    }

    // ── Platform dropdown ──────────────────────────────────────────────────
    &__platform {
        position: relative;
    }

    &__platform-trigger {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.45rem 0.85rem;
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
        background: var(--surface-tint);
        color: var(--bone-300);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        white-space: nowrap;
        cursor: pointer;
        transition:
            color var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out),
            background-color var(--dur-fast) var(--ease-out);

        &:hover {
            border-color: var(--bone-300);
            color: var(--bone-100);
        }

        &.is-active {
            border-color: var(--ember);
            color: var(--bone-50);
            background: rgba(255, 255, 255, 0.08);
        }

        svg:not(.discover-page__platform-chevron) {
            width: 15px;
            height: 15px;
            flex-shrink: 0;
            color: var(--bone-400);
        }
    }

    &__platform-logo {
        width: 18px;
        height: 18px;
        object-fit: contain;
        flex-shrink: 0;
        pointer-events: none;
    }

    &__platform-label {
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__platform-chevron {
        width: 13px;
        height: 13px;
        flex-shrink: 0;
        color: var(--bone-500);
        transition: transform var(--dur-fast) var(--ease-out);

        .is-active &,
        [aria-expanded='true'] & {
            transform: rotate(180deg);
        }
    }

    &__platform-menu {
        position: absolute;
        top: calc(100% + 0.5rem);
        left: 0;
        z-index: 60;
        display: flex;
        flex-direction: column;
        min-width: 220px;
        max-height: min(60vh, 420px);
        overflow-y: auto;
        padding: var(--s-2);
        background: var(--ink-850);
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-lg);
        box-shadow: var(--shadow-lg);
        scrollbar-width: thin;
        animation: platform-menu-in 0.16s ease-out;
    }

    &__platform-option {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem 0.7rem;
        border: none;
        border-radius: var(--r-md);
        background: transparent;
        color: var(--bone-300);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        text-align: left;
        white-space: nowrap;
        cursor: pointer;
        transition:
            color var(--dur-fast) var(--ease-out),
            background-color var(--dur-fast) var(--ease-out);

        svg {
            width: 16px;
            height: 16px;
            flex-shrink: 0;
            color: var(--bone-500);
        }

        &:hover {
            background: var(--surface-tint);
            color: var(--bone-50);
        }

        &.is-active {
            background: rgba(255, 255, 255, 0.12);
            color: var(--ember);
        }
    }

    &__platform-option-logo {
        width: 20px;
        height: 20px;
        object-fit: contain;
        flex-shrink: 0;
        pointer-events: none;
    }

    &__platform-option-region {
        margin-left: auto;
        padding: 0.05rem 0.4rem;
        border-radius: var(--r-pill);
        background: var(--ink-700);
        color: var(--bone-500);
        font-size: 0.65rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        line-height: 1.4;
    }

    &__count {
        margin: 0;
        color: var(--bone-500);
        font-family: var(--font-mono);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: var(--ls-wide);
    }

    // ── Results ───────────────────────────────────────────────────────────
    &__results {
        display: flex;
        flex-direction: column;
        gap: var(--s-5);
        padding-bottom: var(--s-10);
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

    &__card {
        width: 100%;
        content-visibility: auto;
        contain-intrinsic-size: 240px;
    }

    &__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--s-2);
        color: var(--bone-400);
        text-align: center;
        padding: var(--s-10) var(--s-4);
        margin: 0;
        font-size: var(--fs-base);
    }

    &__empty-sub {
        margin: 0;
        color: var(--bone-500);
        font-size: var(--fs-sm);
    }

    &__loading {
        text-align: center;
        padding: var(--s-6);
        color: var(--bone-400);
        font-size: var(--fs-sm);
    }

    &__load-more-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: var(--s-6);
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

    // ── Floating actions (AI + scroll top) ────────────────────────────────
    &__ai-btn {
        position: fixed;
        bottom: calc(var(--s-6) + 56px);
        right: var(--s-6);
        z-index: 50;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 1px solid var(--ember);
        background: var(--ember);
        color: #fff;
        font-family: var(--font-ui);
        font-size: 0.7rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background-color 0.2s, color 0.2s, border-color 0.2s;
        box-shadow: var(--shadow-lg);

        &:hover {
            background: var(--surface-tint-hover);
            color: var(--bone-50);
            border-color: var(--rule-strong);
        }
    }

    &__ai-new-badge {
        position: absolute;
        top: -6px;
        right: -6px;
        background: var(--ember);
        color: var(--ink-950);
        font-size: 0.55rem;
        font-weight: 850;
        padding: 0.1rem 0.25rem;
        border-radius: 3px;
        letter-spacing: 0.05em;
        line-height: 1;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
    }

    &__ai-backdrop {
        position: fixed;
        inset: 0;
        z-index: 40;
        backdrop-filter: blur(3px);
        pointer-events: none;
        animation: ai-fade-in 0.2s ease-out;
    }

    &__ai-wrapper {
        position: fixed;
        bottom: calc(var(--s-6) + 110px);
        right: var(--s-6);
        z-index: 50;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.35rem;
        pointer-events: auto;
    }

    &__ai-search-pill {
        display: flex;
        align-items: center;
        background: var(--ink-850);
        border: 1px solid var(--ink-700);
        border-radius: var(--r-pill);
        padding: 0.25rem 0.5rem 0.25rem 1rem;
        width: 250px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transition: border-color 0.2s;

        &:focus-within {
            border-color: var(--ember);
        }
    }

    &__ai-pill-input {
        flex: 1;
        background: none;
        border: none;
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: 0.8rem;
        outline: none;
        width: 100%;

        &::placeholder {
            color: var(--bone-500);
        }
    }

    &__ai-pill-submit {
        background: var(--ember);
        color: var(--ink-950);
        border: none;
        border-radius: 50%;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-weight: 700;
        font-size: 0.75rem;
    }

    &__ai-opt-pill {
        padding: 0.5rem 1rem;
        border-radius: var(--r-pill);
        border: 1px solid var(--ink-700);
        background: var(--ink-850);
        color: var(--bone-200);
        font-family: var(--font-ui);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

        &:hover {
            transform: translateY(-2px);
            background: var(--ember);
            color: var(--ink-950);
            border-color: var(--ember);
            box-shadow: 0 6px 16px rgba(255, 255, 255, 0.4);
        }
    }

    &__ai-loading-pill {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        padding: 0.6rem 1.2rem;
        background: var(--ink-850);
        border: 1px solid var(--ink-700);
        border-radius: var(--r-pill);
        color: var(--bone-200);
        font-family: var(--font-ui);
        font-size: 0.85rem;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: ai-fade-in 0.2s ease-out;
    }

    &__ai-error-pill {
        padding: 0.6rem 1.2rem;
        background: var(--ink-850);
        border: 1px solid var(--rose-900);
        border-radius: var(--r-pill);
        color: var(--rose-400);
        font-family: var(--font-ui);
        font-size: 0.85rem;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: ai-fade-in 0.2s ease-out;
    }

    &__ai-recommend-container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }

    &__ai-recommend-pill {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.4rem 0.9rem;
        border-radius: var(--r-pill);
        border: 1px solid var(--ink-650);
        background: var(--ink-800);
        color: var(--bone-100);
        font-family: var(--font-ui);
        font-size: 0.8rem;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        animation: ai-fade-in 0.2s ease-out;

        &:hover {
            transform: translateY(-2px);
            background: var(--ink-700);
            border-color: var(--ember);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
        }
    }

    &__ai-pill-poster {
        width: 34px;
        height: 50px;
        border-radius: 4px;
        object-fit: cover;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
        flex-shrink: 0;
    }

    &__ai-pill-reason-tooltip {
        position: absolute;
        right: calc(100% + 0.5rem);
        top: 50%;
        transform: translateY(-50%) translateX(-10px);
        background: var(--ink-800);
        border: 1px solid var(--ember);
        color: #ffffff;
        padding: 0.5rem 0.9rem;
        border-radius: var(--r-md);
        font-family: var(--font-ui);
        font-size: 0.75rem;
        line-height: 1.4;
        width: 210px;
        opacity: 0;
        pointer-events: none;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
        transition: opacity 0.25s, transform 0.25s;
        z-index: 100;
    }

    &__ai-recommend-container:hover &__ai-pill-reason-tooltip {
        opacity: 1;
        transform: translateY(-50%) translateX(0);
    }

    &__ai-action-pill {
        padding: 0.45rem 1rem;
        border-radius: var(--r-pill);
        border: 1px solid var(--ink-700);
        background: var(--ink-850);
        color: var(--bone-250);
        font-family: var(--font-ui);
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transition: all 0.2s;
        animation: ai-fade-in 0.2s ease-out;

        &:hover {
            transform: translateY(-1px);
        }

        &.is-filter {
            background: var(--ember);
            color: var(--ink-950);
            border-color: var(--ember);

            &:hover {
                box-shadow: 0 4px 12px rgba(255, 255, 255, 0.4);
            }
        }

        &.is-retry, &.is-close {
            background: var(--ink-800);
            border-color: var(--ink-650);
            color: var(--bone-300);

            &:hover {
                border-color: var(--ember);
                color: var(--ember);
            }
        }
    }

    &__ai-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid var(--ink-600);
        border-top-color: var(--ember);
        border-radius: 50%;
        animation: ai-spin 0.7s linear infinite;
    }

    &__scroll-top {
        position: fixed;
        bottom: var(--s-6);
        right: var(--s-6);
        z-index: 50;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 1px solid var(--ember);
        background: var(--ember);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background-color 0.2s, color 0.2s, border-color 0.2s;
        box-shadow: var(--shadow-lg);

        &:hover {
            background: var(--surface-tint-hover);
            color: var(--bone-50);
            border-color: var(--rule-strong);
        }
    }

    @keyframes ai-spin {
        to { transform: rotate(360deg); }
    }

    @keyframes ai-fade-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    @keyframes platform-menu-in {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
    }
}
</style>
