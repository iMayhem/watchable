<template>
    <div class="discover netflix-browse">
        <SiteHeader />

        <main id="main" class="discover__main" role="main">
            <section class="discover__body container-lm">
                <div class="discover__results">
                    <header class="discover__results-head">
                        <div>
                            <p class="eyebrow discover__results-eyebrow">{{ rowMeta.eyebrow }}</p>
                            <h1 class="discover__results-title">{{ rowMeta.title }}</h1>
                            <p v-if="rowMeta.description" class="discover__results-desc">
                                {{ rowMeta.description }}
                                <span v-if="rowMeta.netflixCode" class="discover__results-code">
                                    Netflix code {{ rowMeta.netflixCode }}
                                </span>
                            </p>
                        </div>
                    </header>

                    <div v-if="isLoading && !results.length" class="discover__grid">
                        <PosterCard
                            v-for="n in BROWSE_PAGE_SIZE"
                            :key="n"
                            loading
                            id=""
                            :type="rowMeta.defaultType"
                            title=""
                            poster-path=""
                            :rating="0"
                            release-date=""
                            :genre-ids="[]"
                            :adult="false"
                            catalog="netflix"
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
                        <h2 class="discover__empty-title display">Nothing here yet.</h2>
                        <p class="discover__empty-desc">
                            No {{ activeCatalogue.label }} titles match this row in {{ activeLang.label }}.
                        </p>
                        <router-link to="/" class="discover__empty-reset">Back to home</router-link>
                    </div>

                    <div v-else class="discover__grid">
                        <PosterCard
                            v-for="item in results"
                            :key="`${item.type}-${item.id}`"
                            :id="item.id"
                            :type="item.type"
                            :title="item.title"
                            :original-title="item.originalTitle"
                            :poster-path="item.posterPath"
                            :rating="item.rating"
                            :release-date="item.releaseDate"
                            :genre-ids="item.genreIds ?? []"
                            :adult="item.adult ?? false"
                            catalog="netflix"
                            :language-tags="item.languageTags || []"
                            :catalog-title="item.catalogTitle || ''"
                        />
                    </div>

                    <div v-if="hasMore" class="discover__more">
                        <button
                            type="button"
                            class="discover__more-btn"
                            :disabled="isLoadingMore"
                            @click="loadMore"
                        >
                            <span v-if="isLoadingMore">Loading…</span>
                            <span v-else>Load more</span>
                        </button>
                    </div>
                </div>
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import PosterCard from '../components/cards/PosterCard.vue';
import type { CuratedItem } from '../components/rails/CuratedRail.vue';
import {
    browseMoovieCatalog,
    catalogRating,
    inferCatalogMediaType,
    parseCatalogTitle,
    type MoovieCatalogItem
} from '../composables/useMoovieCatalog';
import {
    getCatalogueOption,
    NETFLIX_CATALOGUES,
    type NetflixCatalogueOption
} from '../composables/useNetflixCatalogue';
import {
    getNetflixLanguage,
    getLanguageOption,
    itemMatchesLanguage,
    type NetflixLanguageOption
} from '../composables/useNetflixLanguage';
import {
    enrichCatalogPoolWithTmdb,
    filterCataloguePool,
    getNetflixRowMeta,
    isValidNetflixBrowseRow,
    pickNetflixBrowseItems,
    type CatalogTmdbMeta,
    type NetflixBrowseRowId
} from '../composables/useNetflixRails';
import { useSeo } from '../composables/useSeo';
import {
    buildCatalogLanguageMap,
    fetchCatalogVariantSnapshot,
    resolveLanguageTagsForItem
} from '../composables/useNetflixCatalogLookup';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';
import {
    mapWithConcurrency,
    pickCatalogArtwork,
    resolveArtworkForCatalogItem
} from '../composables/useTmdbArtwork';

const BROWSE_PAGE_SIZE = 40;
const MAX_API_PAGE_FETCHES = 60;

async function toCuratedItem(
    item: MoovieCatalogItem,
    genreIds: number[] = [],
    languageMap?: Map<string, string[]>
): Promise<CuratedItem> {
    const parsed = parseCatalogTitle(item.title || '');
    const resolved = await resolveArtworkForCatalogItem(item);
    const artwork = pickCatalogArtwork(resolved);

    return {
        id: item.id,
        title: parsed.displayTitle || item.title,
        originalTitle: parsed.languages.join(' · '),
        catalogTitle: item.title,
        posterPath: artwork.posterPath,
        backdropPath: artwork.backdropPath,
        rating: catalogRating(item.vote_average),
        releaseDate: item.release_date || '',
        type: inferCatalogMediaType(item),
        languageTags: resolveLanguageTagsForItem(item, languageMap),
        genreIds: genreIds.length ? genreIds : resolved.genreIds || []
    };
}

export default defineComponent({
    name: 'NetflixBrowse',
    components: { SiteHeader, SiteFooter, PosterCard },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const { language } = getNetflixLanguage();

        const isLoading = ref(true);
        const isLoadingMore = ref(false);
        const results = ref<CuratedItem[]>([]);
        const pickedItems = ref<MoovieCatalogItem[]>([]);
        const browsePool = ref<MoovieCatalogItem[]>([]);
        const variantSnapshot = ref<MoovieCatalogItem[]>([]);
        const languageMap = ref<Map<string, string[]>>(new Map());
        const tmdbById = ref<Map<string, CatalogTmdbMeta>>(new Map());
        const displayedCount = ref(0);
        const apiPageCursor = ref(0);
        const apiTotalPages = ref(1);
        const canFetchMoreApi = ref(true);

        const catalogueId = computed(() => String(route.params.catalogue || ''));
        const rowId = computed(() => String(route.params.row || ''));

        const activeLang = computed<NetflixLanguageOption>(() =>
            getLanguageOption(language.value)
        );

        const activeCatalogue = computed<NetflixCatalogueOption>(() =>
            getCatalogueOption(catalogueId.value)
        );

        const validRoute = computed(
            () =>
                NETFLIX_CATALOGUES.some((c) => c.id === catalogueId.value) &&
                isValidNetflixBrowseRow(rowId.value)
        );

        const rowMeta = computed(() => {
            if (!validRoute.value) {
                return {
                    title: 'Browse',
                    eyebrow: '',
                    description: '',
                    defaultType: 'movie' as const
                };
            }
            return getNetflixRowMeta(
                rowId.value as NetflixBrowseRowId,
                activeCatalogue.value,
                activeLang.value
            );
        });

        const hasMore = computed(
            () => displayedCount.value < pickedItems.value.length || canFetchMoreApi.value
        );

        const syncTmdbForPool = async (pool: MoovieCatalogItem[]) => {
            if (!pool.length) return;
            const fresh = await enrichCatalogPoolWithTmdb(pool, 8);
            const merged = new Map(tmdbById.value);
            fresh.forEach((meta, id) => merged.set(id, meta));
            tmdbById.value = merged;
        };

        const rebuildPickedItems = () => {
            const lang = activeLang.value;
            const cat = activeCatalogue.value;
            const pool = filterCataloguePool(browsePool.value, cat.id, lang);
            pickedItems.value = pickNetflixBrowseItems(
                pool,
                rowId.value as NetflixBrowseRowId,
                cat,
                lang,
                tmdbById.value
            );
        };

        const ensureVariantSnapshot = async () => {
            if (variantSnapshot.value.length) return;
            variantSnapshot.value = await fetchCatalogVariantSnapshot();
        };

        const refreshLanguageMap = () => {
            languageMap.value = buildCatalogLanguageMap([
                ...browsePool.value,
                ...variantSnapshot.value
            ]);
        };

        const mapPickedToCurated = async (items: MoovieCatalogItem[]) => {
            await Promise.all([syncTmdbForPool(items), ensureVariantSnapshot()]);
            refreshLanguageMap();
            return mapWithConcurrency(items, (item) => {
                const meta = tmdbById.value.get(String(item.id));
                return toCuratedItem(item, meta?.genreIds || [], languageMap.value);
            }, 5);
        };

        const loadNextApiPage = async () => {
            if (!canFetchMoreApi.value) return false;

            const lang = activeLang.value;
            const page = await browseMoovieCatalog(lang.category, apiPageCursor.value);
            apiTotalPages.value = Math.max(apiTotalPages.value, page.pager?.total_pages ?? 1);

            const seen = new Set(browsePool.value.map((item) => item.id));
            const merged = [...browsePool.value];

            for (const item of page.results || []) {
                if (!itemMatchesLanguage(item, lang) || seen.has(item.id)) continue;
                seen.add(item.id);
                merged.push(item);
            }

            browsePool.value = merged;
            apiPageCursor.value += 1;
            canFetchMoreApi.value = apiPageCursor.value < apiTotalPages.value;
            rebuildPickedItems();
            return true;
        };

        const ensurePickedCount = async (needed: number) => {
            let attempts = 0;
            while (
                pickedItems.value.length < needed &&
                canFetchMoreApi.value &&
                attempts < MAX_API_PAGE_FETCHES
            ) {
                attempts += 1;
                await loadNextApiPage();
            }
        };

        const appendDisplayedBatch = async (size: number) => {
            const target = displayedCount.value + size;
            await ensurePickedCount(target);

            const batch = pickedItems.value.slice(displayedCount.value, target);
            if (!batch.length) return;

            const curated = await mapPickedToCurated(batch);
            results.value = [...results.value, ...curated];
            displayedCount.value += batch.length;
        };

        const loadBrowse = async () => {
            if (!validRoute.value) {
                router.replace({ name: 'NotFound' });
                return;
            }

            const cat = activeCatalogue.value;
            const lang = activeLang.value;
            const row = rowId.value;

            nfDebug('browse:load:start', { catalogue: cat.id, row, language: lang.category });
            isLoading.value = true;
            results.value = [];
            pickedItems.value = [];
            browsePool.value = [];
            tmdbById.value = new Map();
            displayedCount.value = 0;
            apiPageCursor.value = 0;
            apiTotalPages.value = 1;
            canFetchMoreApi.value = true;

            try {
                await appendDisplayedBatch(BROWSE_PAGE_SIZE);

                const meta = getNetflixRowMeta(row as NetflixBrowseRowId, cat, lang);
                updateSeo({
                    title: `${meta.title} · ${cat.label} — Netflix on Moovie`,
                    canonical: `https://moovie.fun/nf/browse/${cat.id}/${row}`,
                    image: 'https://moovie.fun/og-image.png'
                });

                nfDebug('browse:load:ok', {
                    catalogue: cat.id,
                    row,
                    displayed: results.value.length,
                    picked: pickedItems.value.length,
                    pool: browsePool.value.length
                });
            } catch (err) {
                nfDebugError('browse:load:fail', { catalogue: cat.id, row, err });
            } finally {
                isLoading.value = false;
            }
        };

        const loadMore = async () => {
            if (!hasMore.value || isLoadingMore.value) return;
            isLoadingMore.value = true;
            try {
                await appendDisplayedBatch(BROWSE_PAGE_SIZE);
            } catch (err) {
                nfDebugError('browse:load-more:fail', { err });
            } finally {
                isLoadingMore.value = false;
            }
        };

        onMounted(loadBrowse);

        watch(
            () => [route.params.catalogue, route.params.row, language.value],
            () => {
                loadBrowse();
            }
        );

        return {
            BROWSE_PAGE_SIZE,
            isLoading,
            isLoadingMore,
            results,
            rowMeta,
            activeLang,
            activeCatalogue,
            hasMore,
            loadMore
        };
    }
});
</script>

<style lang="scss" scoped>
.netflix-browse {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);
}

.discover {
    &__main {
        padding-top: clamp(var(--s-6), 6vw, var(--s-8));
        padding-bottom: clamp(var(--s-8), 8vw, var(--s-10));
    }

    &__body {
        display: block;
    }

    &__results-head {
        margin-bottom: clamp(var(--s-5), 5vw, var(--s-7));
    }

    &__results-eyebrow {
        margin: 0 0 var(--s-2);
        color: var(--ember);
    }

    &__results-title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(2rem, 4.5vw, 3rem);
        letter-spacing: -0.02em;
        margin: 0 0 var(--s-3);
        color: var(--bone-50);
    }

    &__results-desc {
        margin: 0;
        max-width: 62ch;
        color: var(--bone-300);
        line-height: 1.55;
    }

    &__results-code {
        display: block;
        margin-top: var(--s-2);
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        letter-spacing: 0.08em;
        color: var(--bone-500);
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--s-5) var(--s-4);

        @media (min-width: 720px) {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: var(--s-6) var(--s-5);
        }

        @media (min-width: 1200px) {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        }
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
        display: inline-block;
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--ember);
        padding: 0.6rem 1.2rem;
        border: 1px solid var(--ember);
        border-radius: var(--r-pill);
        transition: background-color var(--dur-fast) var(--ease-out);

        &:hover,
        &:focus-visible {
            background: var(--ember);
            color: var(--ink-900);
        }
    }

    &__more {
        display: flex;
        justify-content: center;
        padding: var(--s-7) 0 var(--s-4);
    }

    &__more-btn {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--bone-100);
        padding: 0.8rem 1.8rem;
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-pill);
        background: var(--surface-tint);
        transition:
            color var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out),
            background-color var(--dur-fast) var(--ease-out);

        &:hover:not(:disabled),
        &:focus-visible:not(:disabled) {
            color: var(--ember);
            border-color: var(--ember);
            background: rgba(255, 90, 31, 0.08);
        }

        &:disabled {
            opacity: 0.5;
            cursor: wait;
        }
    }
}
</style>