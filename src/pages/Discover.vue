<template>
    <div class="discover-page">
        <SiteHeader />

        <main id="main" class="discover-page__main" role="main">
            <div class="discover-page__tabs">
                <button
                    v-for="cat in categories"
                    :key="cat.key"
                    type="button"
                    class="discover-page__tab"
                    :class="{ 'is-active': activeCategory === cat.key, 'has-logo': !!brandLogo(cat.key) }"
                    @click="selectCategory(cat)"
                >
                    <img v-if="brandLogo(cat.key)" :src="brandLogo(cat.key)" alt="" class="discover-page__tab-logo" />
                    <span class="discover-page__tab-label">{{ cat.label }}</span>
                    <span v-if="cat.region" class="discover-page__region-badge">{{ cat.region }}</span>
                </button>
            </div>

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
                type="button"
                class="discover-page__scroll-top"
                aria-label="Back to top"
                @click="scrollToTop"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                    <path d="M18 15l-6-6-6 6"/>
                </svg>
            </button>

            <section class="discover-page__results">
                <div v-if="isLoading && !results.length" class="discover-page__grid">
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

                <div v-else class="discover-page__grid">
                    <PosterCard
                        v-for="item in results"
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

                <div v-if="isLoadingMore" class="discover-page__loading">
                    <span>Loading more…</span>
                </div>

                <div
                    v-if="!isLoading && hasMore"
                    ref="scrollSentinel"
                    class="discover-page__sentinel"
                />

                <p v-if="!isLoading && !hasMore && results.length > 0" class="discover-page__empty">
                    You've seen it all.
                </p>
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import PosterCard from '../components/cards/PosterCard.vue';
import SuggestionRail from '../components/rails/SuggestionRail.vue';
import useAxios from '../composables/useAxios';
import { usePaginatedInfiniteScroll } from '../composables/useLazyLoad';
import { useGemini } from '../composables/useGemini';

interface Category {
    key: string;
    label: string;
    params: Record<string, string | number>;
    useWatchmode?: boolean;
    sourceId?: number;
    region?: string;
    isTv?: boolean;
}

interface WatchmodeTitle {
    id: number;
    title: string;
    year: number;
    poster: string;
    rating: number;
    tmdb_id: number;
    type: string;
}

// Watchmode API key is server-side in functions/api/watchmode-cache.ts
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

const DB_NAME = 'discover_cache';
const DB_VERSION = 1;
const STORE_NAME = 'watchmode';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet<T>(key: string): Promise<T | null> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => {
                const entry = req.result;
                if (!entry) return resolve(null);
                if (Date.now() - entry.ts > CACHE_TTL) {
                    store.delete(key);
                    resolve(null);
                } else {
                    resolve(entry.data as T);
                }
            };
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => db.close();
        });
    } catch {
        return null;
    }
}

async function idbSet(key: string, data: any): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ key, data, ts: Date.now() });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => reject(tx.error);
        });
    } catch {}
}

async function getWatchmodeFromCache(sourceId: number, page: number, region?: string): Promise<any | null> {
    const key = `wm_v2_${sourceId}_${page}${region ? `_${region}` : ''}`;
    const fromIdb = await idbGet<any>(key);
    if (fromIdb) return fromIdb;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (Date.now() - entry.ts > CACHE_TTL) {
            localStorage.removeItem(key);
            return null;
        }
        return entry.data;
    } catch {
        return null;
    }
}

async function setWatchmodeCache(sourceId: number, page: number, data: any, region?: string): Promise<void> {
    const key = `wm_v2_${sourceId}_${page}${region ? `_${region}` : ''}`;
    await idbSet(key, data);
    try {
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch {}
}

interface MovieResult {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date: string;
    type: 'movie' | 'tv' | 'anime';
}

export default defineComponent({
    name: 'Discover',
    components: { SiteHeader, SiteFooter, PosterCard, SuggestionRail },
    setup() {
        const router = useRouter();
        const activeCategory = ref((router.currentRoute.value.query.category as string) || 'highest-grossing');
        const results = ref<MovieResult[]>([]);
        const isLoading = ref(false);
        const isLoadingMore = ref(false);
        const page = ref(1);
        const totalPages = ref(1);
        const currentCat = ref<Category | null>(null);
        const showScrollTop = ref(false);
        const showSuggestion = ref(false);

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

        onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
        onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));

        const hasMore = computed(() => page.value < totalPages.value);

        const brandLogoModules = import.meta.glob<{ default: string }>('../assets/brands/*.svg', { eager: true });
        const brandLogo = (key: string): string | undefined => {
            const mappedKey = key === 'disney' ? 'dplus' : key;
            return brandLogoModules[`../assets/brands/${mappedKey}.svg`]?.default;
        };

        const brandColor = (key: string): string => {
            const colors: Record<string, string> = {
                'highest-grossing': '#f59e0b', 'most-voted': '#3b82f6', 'top-rated': '#fbbf24',
                'marvel': '#ed1d24', 'dc': '#0477f2', 'warner': '#00aeef', 'universal': '#000',
                'disney': '#113cc2', 'sony': '#000', 'paramount': '#006fa6',
                'a24': '#000', 'focus': '#f5a623', 'dreamworks': '#f8981d',
                'pixar': '#0071bc', 'lionsgate': '#000',
                'netflix': '#e50914', 'hulu': '#1ce783', 'hbomax': '#5822b4',
                'prime': '#ff9900', 'dplus': '#113cc2', 'appletv': '#555',
                'hayu': '#e31b54', 'shudder': '#ee3a3a', 'crunchyroll': '#f47521',
                'viki': '#1ab7ea', 'curiosity': '#0d6e4b', 'criterion': '#000',
                'britbox': '#003b5c', 'acorn': '#6bb24a',
            };
            return colors[key] || '#666';
        };
        const brandLetter = (key: string): string => {
            const letters: Record<string, string> = {
                'highest-grossing': '$$', 'most-voted': '✓', 'top-rated': '★',
                'a24': 'A24', 'focus': 'Fc', 'hbo': 'HBO', 'hbomax': 'Mx',
                'dplus': 'D+', 'appletv': 'A+', 'prime': '▶',
                'curiosity': 'C?', 'criterion': 'CC',
            };
            return letters[key] || key.charAt(0).toUpperCase();
        };

        const categories: Category[] = [
            { key: 'highest-grossing', label: 'Highest Grossing', params: { sort_by: 'revenue.desc' } },
            { key: 'most-voted', label: 'Most Voted', params: { sort_by: 'vote_count.desc' } },
            { key: 'top-rated', label: 'Top Rated', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 500 } },
            { key: 'marvel', label: 'Marvel', params: { with_companies: '420', sort_by: 'popularity.desc' } },
            { key: 'dc', label: 'DC', params: { with_companies: '429|9993', sort_by: 'popularity.desc' } },
            { key: 'warner', label: 'Warner Bros.', params: { with_companies: '174', sort_by: 'popularity.desc' } },
            { key: 'universal', label: 'Universal', params: { with_companies: '33', sort_by: 'popularity.desc' } },
            { key: 'disney', label: 'Disney', params: { with_companies: '2', sort_by: 'popularity.desc' } },
            { key: 'sony', label: 'Sony', params: { with_companies: '559', sort_by: 'popularity.desc' } },
            { key: 'paramount', label: 'Paramount', params: { with_companies: '4', sort_by: 'popularity.desc' } },
            { key: 'lionsgate', label: 'Lionsgate', params: {}, useWatchmode: true, sourceId: 533, region: 'GB' },
            { key: 'a24', label: 'A24', params: { with_companies: '41077', sort_by: 'popularity.desc' } },
            { key: 'focus', label: 'Focus Features', params: { with_companies: '10163', sort_by: 'popularity.desc' } },
            { key: 'dreamworks', label: 'DreamWorks', params: { with_companies: '521', sort_by: 'popularity.desc' } },
            { key: 'pixar', label: 'Pixar', params: { with_companies: '3', sort_by: 'popularity.desc' } },
            { key: 'netflix', label: 'Netflix', params: {}, useWatchmode: true, sourceId: 203 },
            { key: 'hulu', label: 'Hulu', params: {}, useWatchmode: true, sourceId: 157 },
            { key: 'hbomax', label: 'HBO Max', params: {}, useWatchmode: true, sourceId: 387 },
            { key: 'prime', label: 'Prime Video', params: {}, useWatchmode: true, sourceId: 26 },
            { key: 'dplus', label: 'Disney+', params: {}, useWatchmode: true, sourceId: 372 },
            { key: 'appletv', label: 'Apple TV+', params: {}, useWatchmode: true, sourceId: 371 },
            { key: 'hayu', label: 'Hayu', params: {}, useWatchmode: true, sourceId: 392, region: 'GB' },
            { key: 'shudder', label: 'Shudder', params: {}, useWatchmode: true, sourceId: 252 },
            { key: 'crunchyroll', label: 'Crunchyroll', params: {}, useWatchmode: true, sourceId: 80 },
            { key: 'viki', label: 'Viki', params: {}, useWatchmode: true, sourceId: 471 },
            { key: 'curiosity', label: 'CuriosityStream', params: {}, useWatchmode: true, sourceId: 421 },
            { key: 'criterion', label: 'The Criterion Channel', params: {}, useWatchmode: true, sourceId: 366 },
            { key: 'britbox', label: 'BritBox', params: {}, useWatchmode: true, sourceId: 376 },
            { key: 'acorn', label: 'Acorn TV', params: {}, useWatchmode: true, sourceId: 17 }
        ];

        const fetchPage = async (cat: Category, p: number, append: boolean) => {
            if (append) {
                isLoadingMore.value = true;
            } else {
                isLoading.value = true;
                results.value = [];
            }
            try {
                let items: MovieResult[];
                let total: number;

                if (cat.useWatchmode) {
                    const sid = cat.sourceId!;
                    const region = cat.region || '';
                    const cached = await getWatchmodeFromCache(sid, p, region);
                    let titles: WatchmodeTitle[];
                    let totalPages: number;
                    if (cached) {
                        titles = cached.titles;
                        totalPages = cached.total_pages;
                    } else {
                        const regionParam = region ? `&regions=${region}` : '';
                        const res = await fetch(
                            `/api/watchmode-cache?sourceId=${sid}&page=${p}${regionParam}`
                        );
                        const data = await res.json();
                        titles = data?.titles ?? [];
                        totalPages = data?.total_pages ?? 1;
                        if (titles.length > 0) {
                            await setWatchmodeCache(sid, p, { titles, total_pages: totalPages, total_results: data?.total_results ?? 0 }, region);
                        }
                    }
                    const validTitles = titles.filter((t: WatchmodeTitle) => t.type === 'movie' || t.type === 'tv_series' || t.type === 'tv_miniseries');
                    const posterPaths = await Promise.all(
                        validTitles.map(async (t: WatchmodeTitle) => {
                            if (!t.tmdb_id) return null;
                            const tmdbEndpoint = t.type === 'movie' ? 'movie' : 'tv';
                            try {
                                const tmdb = await useAxios().get(`${tmdbEndpoint}/${t.tmdb_id}`);
                                return tmdb.data?.poster_path ?? null;
                            } catch {
                                return null;
                            }
                        })
                    );
                    const isCrunchyroll = cat.key === 'crunchyroll';
                    items = validTitles.map((t: WatchmodeTitle, i: number) => ({
                        id: t.tmdb_id || t.id,
                        title: t.title,
                        poster_path: posterPaths[i],
                        vote_average: t.rating || 0,
                        release_date: t.year ? String(t.year) : '',
                        type: isCrunchyroll ? 'anime' : (t.type === 'movie' ? 'movie' as const : 'tv' as const)
                    }));
                    total = totalPages;
                } else {
                    const endpoint = cat.isTv ? 'discover/tv' : 'discover/movie';
                    const res = await useAxios().get(endpoint, {
                        params: { ...cat.params, page: p }
                    });
                    items = ((res.data?.results ?? []) as any[]).map((r: any) => ({
                        id: r.id,
                        title: r.title || r.name || '',
                        poster_path: r.poster_path ?? null,
                        vote_average: r.vote_average || 0,
                        release_date: r.release_date || r.first_air_date || '',
                        type: cat.isTv ? 'tv' : 'movie'
                    }));
                    total = res.data?.total_pages ?? 1;
                }

                if (append) {
                    const existingIds = new Set(results.value.map(r => r.id));
                    const fresh = items.filter(i => !existingIds.has(i.id));
                    results.value = [...results.value, ...fresh];
                } else {
                    results.value = items;
                }
                totalPages.value = Math.min(total, 500);
                page.value = p;
            } catch {
                if (!append) results.value = [];
            } finally {
                isLoading.value = false;
                isLoadingMore.value = false;
            }
        };

        const loadNextPage = async () => {
            if (!currentCat.value) return;
            await fetchPage(currentCat.value, page.value + 1, true);
            await nextTick();
        };

        const selectCategory = (cat: Category) => {
            activeCategory.value = cat.key;
            currentCat.value = cat;
            page.value = 1;
            totalPages.value = 1;
            void router.replace({ query: { ...router.currentRoute.value.query, category: cat.key } });
            void fetchPage(cat, 1, false).then(() => drainPagesIfNeeded());
        };

        const { scrollSentinel, drainPagesIfNeeded } = usePaginatedInfiniteScroll({
            hasMore,
            isLoading,
            isLoadingMore,
            hasResults: computed(() => results.value.length > 0),
            loadNextPage
        });

        const initialCat = categories.find(c => c.key === activeCategory.value) || categories[0];
        currentCat.value = initialCat;
        void fetchPage(initialCat, 1, false);

        return {
            activeCategory,
            categories,
            results,
            isLoading,
            isLoadingMore,
            hasMore,
            scrollSentinel,
            selectCategory,
            showScrollTop,
            scrollToTop,
            brandColor,
            brandLetter,
            brandLogo,
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
        padding-top: var(--s-4);
    }

    &__tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0 var(--s-4) var(--s-3);
        max-width: var(--max-content);
        margin: 0 auto;
    }

    &__tab {
        display: inline-flex;
        align-items: center;
        position: relative;
        overflow: hidden;
        padding: 0.5rem 1rem;
        border: 1px solid var(--ink-600);
        border-radius: var(--r-pill);
        background: transparent;
        color: var(--bone-400);
        font-family: var(--font-ui);
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.2s, color 0.2s, background 0.2s;

        &:hover {
            border-color: var(--bone-300);
            color: var(--bone-100);
        }

        &.is-active {
            border-color: var(--ember);
            background: rgba(255, 90, 31, 0.1);
            color: var(--ember);
        }

        &.has-logo {
            background: var(--ink-800);
        }

        &.has-logo:hover {
            background: var(--ink-700);
        }

        &.has-logo.is-active {
            background: rgba(255, 90, 31, 0.1);
            border-color: var(--ember);
        }
    }

    &__tab-logo {
        width: 20px;
        height: 20px;
        object-fit: contain;
        margin-right: 0.35rem;
        flex-shrink: 0;
        pointer-events: none;
    }

    &__tab-label {
        position: relative;
        z-index: 1;
    }

    &__tab-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 4px;
        margin-right: 0.35rem;
        font-size: 0.6rem;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
        line-height: 1;
    }

    &__region-badge {
        display: inline-block;
        margin-left: 0.35rem;
        padding: 0.05rem 0.35rem;
        border-radius: var(--r-pill);
        background: var(--ink-600);
        color: var(--bone-500);
        font-size: 0.65rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        vertical-align: middle;
        line-height: 1.4;
    }

    .is-active &__region-badge {
        background: rgba(255, 90, 31, 0.25);
        color: var(--ember);
    }

    &__results {
        max-width: var(--max-content);
        margin: 0 auto;
        padding: 0 var(--s-4) var(--s-10);
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: var(--s-5) var(--s-4);
    }

    &__card {
        width: 100%;
        content-visibility: auto;
        contain-intrinsic-size: 240px;
    }

    &__empty {
        color: var(--bone-400);
        text-align: center;
        padding: var(--s-10);
    }

    &__sentinel {
        height: 1px;
        pointer-events: none;
    }

    &__loading {
        text-align: center;
        padding: var(--s-6);
        color: var(--bone-400);
        font-size: var(--fs-sm);
    }

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

    &__ai-options {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.35rem;
        animation: ai-fade-in 0.2s ease-out;

        &-title {
            font-family: var(--font-ui);
            font-size: 0.75rem;
            color: var(--bone-450);
            margin-right: 0.5rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
    }

    &__ai-search-pill {
        display: flex;
        align-items: center;
        background: var(--ink-850);
        border: 1px solid var(--ink-700);
        border-radius: var(--r-pill);
        padding: 0.25rem 0.5rem 0.25rem 1rem;
        width: 250px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);

        &:hover {
            transform: translateY(-2px);
            background: var(--ember);
            color: var(--ink-950);
            border-color: var(--ember);
            box-shadow: 0 6px 16px rgba(255, 90, 31, 0.4);
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
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        animation: ai-fade-in 0.2s ease-out;

        &:hover {
            transform: translateY(-2px);
            background: var(--ink-700);
            border-color: var(--ember);
            box-shadow: 0 6px 16px rgba(0,0,0,0.45);
        }
    }

    &__ai-pill-poster {
        width: 34px;
        height: 50px;
        border-radius: 4px;
        object-fit: cover;
        box-shadow: 0 2px 5px rgba(0,0,0,0.4);
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
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
                box-shadow: 0 4px 12px rgba(255, 90, 31, 0.4);
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

    @keyframes ai-spin {
        to { transform: rotate(360deg); }
    }

    @keyframes ai-fade-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
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
}
</style>
