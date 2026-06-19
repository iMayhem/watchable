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
                            </p>
                        </div>
                    </header>

                    <div v-if="isLoading && !results.length" class="discover__grid">
                        <PosterCard
                            v-for="n in 20"
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
                            <span v-else>Load more · page {{ nextPage }}/{{ totalPages }}</span>
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
    filterCataloguePool,
    getNetflixRowMeta,
    isValidNetflixBrowseRow,
    pickNetflixBrowseItems,
    type NetflixBrowseRowId
} from '../composables/useNetflixRails';
import { useSeo } from '../composables/useSeo';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';
import {
    mapWithConcurrency,
    resolveArtworkForCatalogItem
} from '../composables/useTmdbArtwork';

const INITIAL_PAGES = 3;

async function toCuratedItem(item: MoovieCatalogItem): Promise<CuratedItem> {
    const parsed = parseCatalogTitle(item.title || '');
    const artwork = await resolveArtworkForCatalogItem(item);

    return {
        id: item.id,
        title: parsed.displayTitle || item.title,
        originalTitle: parsed.languages.join(' · '),
        posterPath: artwork.posterPath || artwork.fallbackPath,
        backdropPath: artwork.backdropPath || artwork.fallbackPath,
        rating: catalogRating(item.vote_average),
        releaseDate: item.release_date || '',
        type: inferCatalogMediaType(item),
        languageTags: parsed.languages
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
        const browsePool = ref<MoovieCatalogItem[]>([]);
        const loadedPageCount = ref(0);
        const totalPages = ref(1);

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

        const nextPage = computed(() => loadedPageCount.value);
        const hasMore = computed(() => loadedPageCount.value < totalPages.value);

        const rebuildResults = async () => {
            const lang = activeLang.value;
            const cat = activeCatalogue.value;
            const pool = filterCataloguePool(browsePool.value, cat.id, lang);
            const picked = pickNetflixBrowseItems(
                pool,
                rowId.value as NetflixBrowseRowId,
                cat,
                lang
            );
            results.value = await mapWithConcurrency(picked, toCuratedItem, 5);
        };

        const loadPages = async (fromPage: number, count: number) => {
            const lang = activeLang.value;
            const pages = await Promise.all(
                Array.from({ length: count }, (_, i) =>
                    browseMoovieCatalog(lang.category, fromPage + i)
                )
            );

            const merged = [...browsePool.value];
            const seen = new Set(merged.map((item) => item.id));

            for (const page of pages) {
                totalPages.value = Math.max(totalPages.value, page.pager?.total_pages ?? 1);
                for (const item of page.results || []) {
                    if (!itemMatchesLanguage(item, lang) || seen.has(item.id)) continue;
                    seen.add(item.id);
                    merged.push(item);
                }
            }

            browsePool.value = merged;
            loadedPageCount.value = fromPage + count;
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
            browsePool.value = [];
            loadedPageCount.value = 0;
            totalPages.value = 1;

            try {
                await loadPages(0, INITIAL_PAGES);
                await rebuildResults();

                const meta = getNetflixRowMeta(row as NetflixBrowseRowId, cat, lang);
                updateSeo({
                    title: `${meta.title} · ${cat.label} — Netflix on Moovie`,
                    canonical: `https://moovie.fun/nf/browse/${cat.id}/${row}`,
                    image: 'https://moovie.fun/og-image.png'
                });

                nfDebug('browse:load:ok', {
                    catalogue: cat.id,
                    row,
                    count: results.value.length,
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
                await loadPages(loadedPageCount.value, 1);
                await rebuildResults();
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
            isLoading,
            isLoadingMore,
            results,
            rowMeta,
            activeLang,
            activeCatalogue,
            hasMore,
            nextPage,
            totalPages,
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