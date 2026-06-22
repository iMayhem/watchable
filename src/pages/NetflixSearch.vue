<template>
    <div class="search-page">
        <SiteHeader />

        <main id="main" class="search-page__main" role="main">
            <section class="search-page__masthead container-lm">
                <p class="eyebrow search-page__eyebrow">Netflix Catalogue</p>
                <h1 class="search-page__title display">Search the catalogue</h1>
                <p class="search-page__subtitle">
                    Search the full catalogue — same index as NetMirror. Results open in the Netflix player.
                </p>

                <form class="search-page__search" role="search" @submit.prevent>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">
                        <circle cx="11" cy="11" r="7"/>
                        <path d="m20 20-3.5-3.5"/>
                    </svg>
                    <input
                        ref="inputEl"
                        type="text"
                        class="search-page__input"
                        placeholder="Search movies and series"
                        :value="searchTerm"
                        aria-label="Search Netflix catalogue"
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
                    <div v-if="isLoading && !currentCount" class="search-page__loading" role="status">
                        <div class="search-page__spinner" aria-hidden="true" />
                        <span class="meta">Searching the catalogue…</span>
                    </div>

                    <template v-else-if="activeTab === 'movies' && movies.length">
                        <div class="search-page__grid">
                            <PosterCard
                                v-for="item in movies"
                                :key="`m-${item.id}`"
                                :id="item.id"
                                type="movie"
                                :title="item.title"
                                :original-title="item.originalTitle"
                                :poster-path="item.posterPath"
                                :rating="item.rating"
                                :release-date="item.releaseDate"
                                :genre-ids="item.genreIds || []"
                                :adult="item.adult || false"
                                catalog="netflix"
                                :language-tags="item.languageTags || []"
                                :catalog-title="item.catalogTitle || ''"
                            />
                        </div>
                    </template>

                    <template v-else-if="activeTab === 'shows' && shows.length">
                        <div class="search-page__grid">
                            <PosterCard
                                v-for="item in shows"
                                :key="`t-${item.id}`"
                                :id="item.id"
                                type="tv"
                                :title="item.title"
                                :original-title="item.originalTitle"
                                :poster-path="item.posterPath"
                                :rating="item.rating"
                                :release-date="item.releaseDate"
                                :genre-ids="item.genreIds || []"
                                :adult="item.adult || false"
                                catalog="netflix"
                                :language-tags="item.languageTags || []"
                                :catalog-title="item.catalogTitle || ''"
                            />
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
                        <h3 class="search-page__empty-title display">Not in this catalogue.</h3>
                        <p class="search-page__empty-desc">
                            No {{ emptyLabel }} matched "{{ searchTerm }}". Try another spelling.
                        </p>
                    </div>

                    <div
                        v-if="isLoading && currentCount"
                        class="search-page__loading search-page__loading--inline"
                        role="status"
                    >
                        <div class="search-page__spinner" aria-hidden="true" />
                        <span class="meta">Loading more results…</span>
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
import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { debounce } from '../utils/memoization';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import LmTabs, { TabDef } from '../components/primitives/Tabs.vue';
import PosterCard from '../components/cards/PosterCard.vue';
import type { CuratedItem } from '../components/rails/CuratedRail.vue';
import {
    searchMoovieCatalog,
    type MoovieCatalogItem
} from '../composables/useMoovieCatalog';
import { getNetflixCatalogue, getCatalogueOption } from '../composables/useNetflixCatalogue';
import { getNetflixLanguage, getLanguageOption } from '../composables/useNetflixLanguage';
import { addNetflixSearchTerm, netflixSearchHistory } from '../composables/useHistory';
import { useSeo } from '../composables/useSeo';
import { fetchCatalogAudioCacheByIds } from '../composables/useCatalogAudioCache';
import {
    buildCatalogLanguageMap,
    dedupeCatalogItemsByVariantFamily,
    sortCatalogBySearchRelevance
} from '../composables/useNetflixCatalogLookup';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';
import {
    toCuratedItemFast
} from '../composables/useNetflixArtwork';
import { fetchCatalogArtworkUrlsByIds } from '../composables/usePosterCache';

type TabKey = 'movies' | 'shows';

export default defineComponent({
    name: 'NetflixSearch',
    components: { SiteHeader, SiteFooter, LmTabs, PosterCard },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const { catalogue } = getNetflixCatalogue();
        const { language } = getNetflixLanguage();

        const inputEl = ref<HTMLInputElement | null>(null);
        const searchTerm = ref<string>(typeof route.query.search === 'string' ? route.query.search : '');
        const activeTab = ref<TabKey>(
            typeof route.query.tab === 'string' && ['movies', 'shows'].includes(route.query.tab)
                ? route.query.tab as TabKey
                : 'movies'
        );
        const isLoading = ref(false);
        const movies = ref<CuratedItem[]>([]);
        const shows = ref<CuratedItem[]>([]);
        const searchVariantPool = ref<MoovieCatalogItem[]>([]);
        const searchGeneration = ref(0);

        const SEARCH_PAGE_BATCH = 4;

        const popularSearches = [
            'Stranger Things', 'Wednesday', 'RRR', 'Sacred Games',
            'Squid Game', 'Money Heist', 'KGF', 'Animal'
        ];

        const activeLang = computed(() => getLanguageOption(language.value));
        const activeCatalogue = computed(() => getCatalogueOption(catalogue.value));

        const recentSearches = computed(() =>
            (netflixSearchHistory.value || []).filter(Boolean).slice(0, 6)
        );

        const tabs = computed<TabDef[]>(() => [
            { label: 'Movies', value: 'movies' },
            { label: 'Shows', value: 'shows' }
        ]);

        const currentCount = computed(() => {
            if (activeTab.value === 'movies') return movies.value.length;
            return shows.value.length;
        });

        const emptyLabel = computed(() =>
            activeTab.value === 'movies' ? 'films' : 'series'
        );

        const clearResults = () => {
            movies.value = [];
            shows.value = [];
            searchVariantPool.value = [];
        };

        const appendToSearchPool = (items: MoovieCatalogItem[]) => {
            const seen = new Set(searchVariantPool.value.map((item) => item.id));
            for (const item of items) {
                if (seen.has(item.id)) continue;
                seen.add(item.id);
                searchVariantPool.value.push(item);
            }
        };

        const chooseDefaultTab = () => {
            if (!movies.value.length && shows.value.length) activeTab.value = 'shows';
            else if (movies.value.length || !shows.value.length) activeTab.value = 'movies';
            syncRoute();
        };

        const splitCuratedByType = (curated: CuratedItem[]) => {
            const nextMovies: CuratedItem[] = [];
            const nextShows: CuratedItem[] = [];
            for (const item of curated) {
                if (item.type === 'tv') nextShows.push(item);
                else nextMovies.push(item);
            }
            return { nextMovies, nextShows };
        };

        const mapFilteredResults = (
            pool: MoovieCatalogItem[],
            languageMap: Map<string, string[]>,
            audioCache?: Map<string, string[]>,
            artworkUrls?: Awaited<ReturnType<typeof fetchCatalogArtworkUrlsByIds>>
        ) => {
            const curated = pool.map((item) =>
                toCuratedItemFast(item, [], languageMap, audioCache, undefined, artworkUrls)
            );
            return splitCuratedByType(curated);
        };

        /** NetMirror shows raw search2 hits — do not apply browse catalogue/language gates. */
        const prepareSearchResults = (pool: MoovieCatalogItem[], query: string) => {
            const lang = activeLang.value;
            const languageMap = buildCatalogLanguageMap(pool);
            const deduped = sortCatalogBySearchRelevance(
                dedupeCatalogItemsByVariantFamily(pool, {
                    preferredLang: lang
                }),
                query
            );
            return { deduped, languageMap };
        };

        const applySearchResults = (
            deduped: MoovieCatalogItem[],
            languageMap: Map<string, string[]>,
            generation: number
        ) => {
            const { nextMovies, nextShows } = mapFilteredResults(deduped, languageMap);
            movies.value = nextMovies;
            shows.value = nextShows;

            void (async () => {
                try {
                    const [audioCache, artworkUrls] = await Promise.all([
                        fetchCatalogAudioCacheByIds(
                            searchVariantPool.value.map((item) => item.id)
                        ),
                        fetchCatalogArtworkUrlsByIds(deduped.map((item) => item.id))
                    ]);
                    if (generation !== searchGeneration.value) return;
                    const upgraded = mapFilteredResults(
                        deduped,
                        languageMap,
                        audioCache,
                        artworkUrls
                    );
                    movies.value = upgraded.nextMovies;
                    shows.value = upgraded.nextShows;
                } catch (err) {
                    nfDebugError('search:grid-upgrade:fail', { err });
                }
            })();
        };

        const performSearch = async (query: string) => {
            const q = query.trim();
            if (!q) return;

            const generation = searchGeneration.value + 1;
            searchGeneration.value = generation;
            isLoading.value = true;
            searchVariantPool.value = [];

            try {
                nfDebug('search:start', {
                    query: q,
                    language: activeLang.value.category
                });

                const first = await searchMoovieCatalog(q, 0);
                if (generation !== searchGeneration.value) return;

                const totalPages = Math.max(1, first.pager?.total_pages ?? 1);
                appendToSearchPool(first.results || []);

                let prepared = prepareSearchResults(searchVariantPool.value, q);
                applySearchResults(prepared.deduped, prepared.languageMap, generation);
                chooseDefaultTab();

                if (totalPages > 1) {
                    const remainingPages = Array.from(
                        { length: totalPages - 1 },
                        (_, index) => index + 1
                    );

                    for (let offset = 0; offset < remainingPages.length; offset += SEARCH_PAGE_BATCH) {
                        if (generation !== searchGeneration.value) return;

                        const batch = remainingPages.slice(offset, offset + SEARCH_PAGE_BATCH);
                        const pages = await Promise.all(
                            batch.map((page) => searchMoovieCatalog(q, page))
                        );
                        if (generation !== searchGeneration.value) return;

                        for (const data of pages) {
                            appendToSearchPool(data.results || []);
                        }

                        prepared = prepareSearchResults(searchVariantPool.value, q);
                        applySearchResults(prepared.deduped, prepared.languageMap, generation);
                    }
                }

                nfDebug('search:complete', {
                    query: q,
                    rawCount: searchVariantPool.value.length,
                    shownCount: prepared.deduped.length,
                    totalPages
                });
            } catch (err) {
                nfDebugError('search:fail', { query: q, err });
                if (generation === searchGeneration.value) clearResults();
            } finally {
                if (generation === searchGeneration.value) {
                    isLoading.value = false;
                }
            }
        };

        const syncRoute = () => {
            const q: Record<string, string> = {};
            if (searchTerm.value) q.search = searchTerm.value;
            if (searchTerm.value && activeTab.value !== 'movies') q.tab = activeTab.value;
            const current = route.query;
            if (JSON.stringify(q) !== JSON.stringify(current)) {
                router.replace({ query: q });
            }
        };

        const syncSeo = () => {
            const cat = activeCatalogue.value;
            const lang = activeLang.value;
            const title = searchTerm.value.trim()
                ? `"${searchTerm.value}" · ${cat.label} — Netflix on Moovie`
                : `Search · ${cat.label} — Netflix on Moovie`;
            updateSeo({
                title,
                description: `Search ${cat.label} titles with ${lang.label} audio on Moovie.`,
                canonical: 'https://moovie.fun/nf/search',
                image: 'https://moovie.fun/og-image.png'
            });
        };

        const handleClearSearch = () => {
            clearResults();
            searchTerm.value = '';
            activeTab.value = 'movies';
            syncRoute();
            syncSeo();
            nextTick(() => inputEl.value?.focus());
        };

        const runSearch = (term: string) => {
            searchTerm.value = term;
            syncRoute();
            addNetflixSearchTerm(term);
            performSearch(term);
            syncSeo();
        };

        const debouncedSearch = debounce((term: string) => {
            const q = term.trim();
            if (!q) {
                clearResults();
                syncRoute();
                syncSeo();
                return;
            }
            addNetflixSearchTerm(q);
            syncRoute();
            performSearch(q);
            syncSeo();
        }, 350);

        const onSearchInput = (e: Event) => {
            searchTerm.value = (e.target as HTMLInputElement).value;
            if (!searchTerm.value.trim()) {
                clearResults();
                syncRoute();
                syncSeo();
            } else {
                debouncedSearch(searchTerm.value);
            }
        };

        const reloadForLanguagePreference = () => {
            if (!searchVariantPool.value.length) return;
            const q = searchTerm.value.trim();
            if (!q) return;
            const { deduped, languageMap } = prepareSearchResults(searchVariantPool.value, q);
            const generation = searchGeneration.value + 1;
            searchGeneration.value = generation;
            applySearchResults(deduped, languageMap, generation);
        };

        watch(activeTab, () => syncRoute());

        watch(
            () => route.query.search,
            query => {
                const q = typeof query === 'string' ? query : '';
                if (q === searchTerm.value) return;
                searchTerm.value = q;
                if (q) performSearch(q);
                else clearResults();
                syncSeo();
            }
        );

        onMounted(() => {
            window.scrollTo(0, 0);
            syncSeo();
            if (searchTerm.value.trim()) {
                performSearch(searchTerm.value);
            } else {
                clearResults();
            }

            window.addEventListener('movora_netflix_language_change', reloadForLanguagePreference);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('movora_netflix_language_change', reloadForLanguagePreference);
        });

        return {
            inputEl,
            searchTerm,
            activeTab,
            isLoading,
            movies,
            shows,
            recentSearches,
            popularSearches,
            tabs,
            currentCount,
            emptyLabel,
            activeLang,
            activeCatalogue,
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
        padding-block: clamp(var(--s-5), 5vw, var(--s-7));
        border-bottom: 1px solid var(--rule);
        margin-bottom: clamp(var(--s-5), 5vw, var(--s-7));
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
        margin-top: var(--s-6);
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

        &--inline {
            padding: var(--s-5) 0 var(--s-2);
        }
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
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--s-5) var(--s-4);

        @media (min-width: 720px) {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: var(--s-6) var(--s-5);
        }

        @media (min-width: 1024px) and (max-width: 1499px) {
            grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        }

        @media (min-width: 1500px) {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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
            border-color: rgba(255, 90, 31, 0.25);
            background: rgba(255, 90, 31, 0.06);

            &:hover, &:focus-visible {
                color: var(--ember);
                background: rgba(255, 90, 31, 0.14);
                border-color: rgba(255, 90, 31, 0.5);
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