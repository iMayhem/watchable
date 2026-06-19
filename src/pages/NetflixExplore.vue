<template>
    <div class="discover netflix-explore">
        <SiteHeader />

        <main id="main" class="discover__main" role="main">
            <section class="discover__body container-lm">
                <div class="discover__results">
                    <header class="discover__results-head discover__results-head--nf">
                        <h1 class="discover__results-title nf-browse-title">
                            {{ pageTitle }}
                        </h1>
                        <p v-if="results.length" class="discover__results-desc">
                            {{ results.length }} titles
                        </p>
                    </header>

                    <section class="nf-explore-filters" aria-label="Genre filters">
                        <div class="nf-explore-filters__group">
                            <h2 class="nf-explore-filters__label">Genre</h2>
                            <nav class="nf-explore-cats" aria-label="Genre">
                                <router-link
                                    :to="genrePath('')"
                                    class="nf-explore-cats__chip"
                                    :class="{ 'is-active': !activeGenreSlug }"
                                >
                                    All
                                </router-link>
                                <router-link
                                    v-for="option in exploreGenreOptions"
                                    :key="option.slug"
                                    :to="genrePath(option.slug)"
                                    class="nf-explore-cats__chip"
                                    :class="{ 'is-active': activeGenreSlug === option.slug }"
                                >
                                    {{ option.label }}
                                </router-link>
                            </nav>
                        </div>
                    </section>

                    <div
                        v-if="isLoading && !results.length"
                        class="discover__grid"
                    >
                        <PosterCard
                            v-for="n in 16"
                            :key="n"
                            loading
                            id=""
                            :type="defaultType"
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
                        <h2 class="discover__empty-title display">Nothing here yet.</h2>
                        <p class="discover__empty-desc">
                            No titles match this explore filter.
                        </p>
                        <router-link to="/nf/categories" class="discover__empty-reset">
                            Browse categories
                        </router-link>
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

                    <div
                        v-if="results.length && (hasMore || isLoadingMore)"
                        ref="scrollSentinel"
                        class="nf-explore-scroll-sentinel"
                        aria-hidden="true"
                    >
                        <span v-if="isLoadingMore" class="nf-explore-scroll-sentinel__label">
                            Loading…
                        </span>
                    </div>
                </div>
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from 'vue';
import { useInfiniteScroll } from '../composables/useLazyLoad';
import { useRoute } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import PosterCard from '../components/cards/PosterCard.vue';
import type { CuratedItem } from '../components/rails/CuratedRail.vue';
import {
    browseMoovieCatalog,
    type MoovieCatalogItem
} from '../composables/useMoovieCatalog';
import {
    activeExploreGenreSlug,
    exploreGenrePath,
    explorePageTitle,
    NETMIRROR_EXPLORE_GENRE_OPTIONS,
    resolveExploreFilterFromRoute,
    type NetmirrorExploreMediaType
} from '../data/netmirrorExploreCategories';
import { toCuratedItemFast } from '../composables/useNetflixArtwork';
import { fetchCatalogArtworkUrlsByIds } from '../composables/usePosterCache';
import { fetchCatalogAudioCacheByIds } from '../composables/useCatalogAudioCache';
import {
    buildCatalogLanguageMap,
    dedupeCatalogItemsByVariantFamily
} from '../composables/useNetflixCatalogLookup';
import { useSeo } from '../composables/useSeo';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';

const PAGE_BATCH = 2;

function normalizeMediaType(value: string): NetmirrorExploreMediaType {
    if (value === 'movie' || value === 'tv' || value === 'animated') return value;
    return 'all';
}

export default defineComponent({
    name: 'NetflixExplore',
    components: { SiteHeader, SiteFooter, PosterCard },
    setup() {
        const route = useRoute();
        const { updateSeo } = useSeo();

        const isLoading = ref(true);
        const isLoadingMore = ref(false);
        const results = ref<CuratedItem[]>([]);
        const variantPool = ref<MoovieCatalogItem[]>([]);
        const pageCursor = ref(0);
        const totalPages = ref(1);
        let loadSeq = 0;

        const mediaType = computed(() =>
            normalizeMediaType(String(route.params.mediaType || 'all'))
        );

        const routeQuery = computed(() => route.query as Record<string, string | string[] | null | undefined>);

        const filterOptions = computed(() =>
            resolveExploreFilterFromRoute(mediaType.value, routeQuery.value)
        );

        const pageTitle = computed(() =>
            explorePageTitle(mediaType.value, routeQuery.value)
        );

        const defaultType = computed<'movie' | 'tv'>(() =>
            mediaType.value === 'tv' ? 'tv' : 'movie'
        );

        const exploreGenreOptions = NETMIRROR_EXPLORE_GENRE_OPTIONS;

        const activeGenreSlug = computed(() =>
            activeExploreGenreSlug(routeQuery.value)
        );

        const genrePath = (genreSlug: string) =>
            exploreGenrePath(mediaType.value, routeQuery.value, genreSlug);

        const scrollSentinel = ref<HTMLElement | null>(null);

        const hasMore = computed(
            () => pageCursor.value < totalPages.value && pageCursor.value < 80
        );

        const appendVariantPool = (items: MoovieCatalogItem[]) => {
            const seen = new Set(variantPool.value.map((item) => item.id));
            for (const item of items) {
                if (seen.has(item.id)) continue;
                seen.add(item.id);
                variantPool.value.push(item);
            }
        };

        const mapDedupedPool = (
            deduped: MoovieCatalogItem[],
            languageMap: Map<string, string[]>,
            audioCache?: Map<string, string[]>,
            artworkUrls?: Awaited<ReturnType<typeof fetchCatalogArtworkUrlsByIds>>
        ): CuratedItem[] =>
            deduped.map((item) =>
                toCuratedItemFast(
                    item,
                    [],
                    languageMap,
                    audioCache,
                    undefined,
                    artworkUrls
                )
            );

        /** Paint grid immediately from API backdrop_path; never block on Supabase/audio. */
        const syncResultsFromPool = (): CuratedItem[] => {
            const deduped = dedupeCatalogItemsByVariantFamily(variantPool.value);
            if (!deduped.length) return [];
            const languageMap = buildCatalogLanguageMap(variantPool.value);
            return mapDedupedPool(deduped, languageMap);
        };

        const upgradeExploreGrid = async (seq: number) => {
            const deduped = dedupeCatalogItemsByVariantFamily(variantPool.value);
            if (!deduped.length || seq !== loadSeq) return;

            const languageMap = buildCatalogLanguageMap(variantPool.value);
            try {
                const [audioCache, artworkUrls] = await Promise.all([
                    fetchCatalogAudioCacheByIds(deduped.map((item) => item.id)),
                    fetchCatalogArtworkUrlsByIds(deduped.map((item) => item.id))
                ]);
                if (seq !== loadSeq) return;
                results.value = mapDedupedPool(
                    deduped,
                    languageMap,
                    audioCache,
                    artworkUrls
                );
            } catch (err) {
                nfDebugError('explore:grid-upgrade:fail', { err });
            }
        };

        const applySeo = () => {
            updateSeo({
                title: `${pageTitle.value} — Netflix on Moovie`,
                canonical: `https://moovie.fun${route.fullPath}`,
                image: 'https://moovie.fun/og-image.png'
            });
        };

        const resetAndLoad = async () => {
            const seq = ++loadSeq;
            isLoading.value = true;
            isLoadingMore.value = false;
            results.value = [];
            variantPool.value = [];
            pageCursor.value = 0;
            totalPages.value = 1;

            nfDebug('explore:load:start', {
                mediaType: mediaType.value,
                filter: filterOptions.value
            });

            try {
                const pages = await Promise.all(
                    Array.from({ length: PAGE_BATCH }, (_, index) =>
                        browseMoovieCatalog('filter', index, filterOptions.value)
                    )
                );

                if (seq !== loadSeq) return;

                const merged: MoovieCatalogItem[] = [];
                const seen = new Set<string>();

                for (const page of pages) {
                    totalPages.value = Math.max(
                        totalPages.value,
                        page.pager?.total_pages ?? 1
                    );
                    for (const item of page.results || []) {
                        if (seen.has(item.id)) continue;
                        seen.add(item.id);
                        merged.push(item);
                    }
                }

                pageCursor.value = pages.length;
                appendVariantPool(merged);
                results.value = syncResultsFromPool();
                void upgradeExploreGrid(seq);
                applySeo();

                nfDebug('explore:load:ok', {
                    count: results.value.length,
                    pool: variantPool.value.length,
                    totalPages: totalPages.value
                });
            } catch (err) {
                nfDebugError('explore:load:fail', { err });
            } finally {
                if (seq === loadSeq) {
                    isLoading.value = false;
                }
            }
        };

        const loadMore = async () => {
            if (!hasMore.value || isLoadingMore.value) return;

            const seq = loadSeq;
            isLoadingMore.value = true;

            try {
                const start = pageCursor.value;
                const pages = await Promise.all(
                    Array.from({ length: PAGE_BATCH }, (_, index) =>
                        browseMoovieCatalog('filter', start + index, filterOptions.value)
                    )
                );

                if (seq !== loadSeq) return;

                const merged: MoovieCatalogItem[] = [];
                const seen = new Set(variantPool.value.map((item) => item.id));

                for (const page of pages) {
                    totalPages.value = Math.max(
                        totalPages.value,
                        page.pager?.total_pages ?? 1
                    );
                    for (const item of page.results || []) {
                        if (seen.has(item.id)) continue;
                        seen.add(item.id);
                        merged.push(item);
                    }
                }

                pageCursor.value += pages.length;
                if (!merged.length) return;

                appendVariantPool(merged);
                if (seq !== loadSeq) return;
                results.value = syncResultsFromPool();
                void upgradeExploreGrid(seq);
            } catch (err) {
                nfDebugError('explore:load-more:fail', { err });
            } finally {
                if (seq === loadSeq) {
                    isLoadingMore.value = false;
                }
            }
        };

        useInfiniteScroll(scrollSentinel, loadMore, {
            enabled: hasMore,
            busy: isLoadingMore
        });

        watch(
            () => [route.params.mediaType, route.fullPath] as const,
            () => {
                void resetAndLoad();
            },
            { immediate: true }
        );

        return {
            isLoading,
            isLoadingMore,
            results,
            pageTitle,
            mediaType,
            defaultType,
            exploreGenreOptions,
            activeGenreSlug,
            genrePath,
            hasMore,
            scrollSentinel
        };
    }
});
</script>

<style lang="scss" scoped>
.netflix-explore {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);
}

.discover {
    &__main {
        padding-top: clamp(var(--s-6), 6vw, var(--s-8));
        padding-bottom: clamp(var(--s-8), 8vw, var(--s-10));
    }

    &__results-head {
        margin-bottom: clamp(var(--s-5), 5vw, var(--s-7));
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
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--s-4) var(--s-3);

        @media (min-width: 640px) {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        @media (min-width: 960px) {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: var(--s-5) var(--s-4);
        }

        @media (min-width: 1200px) {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: var(--s-6) var(--s-5);
        }

        :deep(.poster-card) {
            min-width: 0;
            width: 100%;
        }
    }

    &__empty {
        text-align: center;
        padding: clamp(var(--s-8), 10vw, var(--s-10)) var(--s-4);
        max-width: 36rem;
        margin: 0 auto;
    }

    &__empty-title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(1.6rem, 3vw, 2.2rem);
        color: var(--bone-50);
        margin: 0 0 var(--s-3);
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
        text-decoration: none;
        transition: background-color var(--dur-fast) var(--ease-out);

        &:hover,
        &:focus-visible {
            background: var(--ember);
            color: var(--ink-900);
        }
    }

}

.nf-explore-scroll-sentinel {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 72px;
    padding: var(--s-5) 0 var(--s-8);
    pointer-events: none;

    &__label {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--bone-400);
    }
}

.nf-explore-filters {
    display: grid;
    gap: var(--s-5);
    margin: 0 0 var(--s-6);

    &__group {
        display: grid;
        gap: var(--s-3);
    }

    &__label {
        margin: 0;
        font-size: var(--fs-sm);
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--bone-300);
    }
}

.nf-explore-cats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);

    &__chip {
        display: inline-flex;
        align-items: center;
        padding: 0.45rem 0.85rem;
        border-radius: 999px;
        border: 1px solid var(--rule);
        background: var(--surface-tint);
        color: var(--bone-200);
        font-size: var(--fs-sm);
        text-decoration: none;
        transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;

        &:hover {
            background: var(--surface-tint-hover);
            color: var(--bone-50);
        }

        &.is-active {
            border-color: var(--ember);
            color: var(--bone-50);
            background: rgba(255, 90, 31, 0.12);
        }
    }
}
</style>