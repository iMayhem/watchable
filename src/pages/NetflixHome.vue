<template>
    <div class="home netflix-home">
        <SiteHeader />

        <main id="main" class="home__main" role="main">
            <BillboardHero
                :id="hero ? hero.id : ''"
                party-source="netflix"
                :type="hero ? hero.type : 'movie'"
                :title="hero ? hero.title : ''"
                :tagline="activeLang.nativeLabel"
                :overview="hero ? hero.overview : ''"
                :backdrop-path="hero ? hero.backdropPath : null"
                :poster-path="hero ? hero.posterPath : null"
                :rating="hero ? hero.rating : 0"
                :release-date="hero ? hero.releaseDate : ''"
                :genre-ids="[]"
                :eyebrow="`Featured · ${activeCatalogue.label}`"
                :loading="isLoading && !hero"
                :play-to="heroPlayRoute"
            />

            <CuratedRail
                v-if="trendingItems.length || isLoading"
                class="home__section"
                :items="trendingItems"
                title="Trending Now"
                :eyebrow="activeCatalogue.eyebrow"
                catalog="netflix"
                :more-to="trendingBrowseTo"
                :loading="isLoading && !trendingItems.length"
            />

            <TopTenRail
                v-if="top10Movies.length || isLoading"
                class="home__section"
                :items="top10Movies"
                title="Top 10 Movies Today"
                eyebrow="Top 10"
                catalog="netflix"
                :more-to="top10MoviesBrowseTo"
                :loading="isLoading && !top10Movies.length"
            />

            <TopTenRail
                v-if="top10Tv.length || isLoading"
                class="home__section"
                :items="top10Tv"
                title="Top 10 TV Shows Today"
                eyebrow="Top 10"
                catalog="netflix"
                :more-to="top10TvBrowseTo"
                :loading="isLoading && !top10Tv.length"
            />

            <CuratedRail
                v-for="rail in catalogueRails"
                :key="rail.id"
                class="home__section"
                :items="rail.items"
                :title="rail.title"
                :eyebrow="rail.eyebrow"
                :description="rail.description"
                :default-type="rail.defaultType"
                :more-to="browseToForRail(rail)"
                catalog="netflix"
            />

            <CuratedRail
                v-if="isLoading && !catalogueRails.length"
                class="home__section"
                :items="[]"
                title="Loading catalogues"
                :eyebrow="activeCatalogue.label"
                catalog="netflix"
                :loading="true"
            />
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import BillboardHero from '../components/hero/BillboardHero.vue';
import CuratedRail, { type CuratedItem } from '../components/rails/CuratedRail.vue';
import TopTenRail from '../components/rails/TopTenRail.vue';
import {
    NETFLIX_MOVIE_EXPLORE_PATH,
    NETFLIX_TV_EXPLORE_PATH
} from '../data/netmirrorExploreCategories';
import { browseMoovieCatalog } from '../composables/useMoovieCatalog';
import {
    getCatalogueHomeFetchSources,
    getCatalogueHomeInitialPageCount,
    type CatalogueHomeFetchSource
} from '../data/netflixCatalogCategories';

import {
    getNetflixCatalogue,
    getCatalogueOption,
    type NetflixCatalogueOption
} from '../composables/useNetflixCatalogue';
import {
    getNetflixLanguage,
    getLanguageOption,
    itemMatchesLanguage,
    type NetflixLanguageOption
} from '../composables/useNetflixLanguage';
import {
    buildNetflixHomeSections,
    buildTrendingItems,
    collectArtworkIdsForCurated,
    filterCataloguePool,
    netflixBrowsePath,
    type NetflixRailSection
} from '../composables/useNetflixRails';
import { loadNetflixAvailabilityIndex } from '../composables/useNetflixProvider';
import { useSeo } from '../composables/useSeo';
import {
    toCuratedItemFast
} from '../composables/useNetflixArtwork';
import {
    emptyCatalogArtworkUrlMaps,
    fetchCatalogArtworkUrlsByIds,
    type CatalogArtworkUrlMaps
} from '../composables/usePosterCache';
import { prefetchArtworkImages } from '../utils/useWebImage';
import { fetchCatalogAudioCacheByIds } from '../composables/useCatalogAudioCache';
import {
    enrichmentRowToTmdbMeta,
    fetchEnrichmentByCatalogIds
} from '../composables/useCatalogEnrichmentCache';
import {
    buildCatalogLanguageMap,
    catalogStreamTarget,
    fetchCatalogVariantSnapshot
} from '../composables/useNetflixCatalogLookup';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';
import type { MoovieCatalogItem } from '../composables/useMoovieCatalog';

function dedupeCataloguePool(
    pages: Array<{ results?: MoovieCatalogItem[] }>,
    lang: NetflixLanguageOption
) {
    const seenPoolIds = new Set<string>();
    return pages
        .flatMap((page) => page.results || [])
        .filter((item) => {
            if (!itemMatchesLanguage(item, lang) || seenPoolIds.has(item.id)) {
                return false;
            }
            seenPoolIds.add(item.id);
            return true;
        });
}

async function fetchCataloguePages(sources: CatalogueHomeFetchSource[]) {
    return Promise.all(
        sources.flatMap((source) =>
            Array.from({ length: source.pages }, (_, page) =>
                browseMoovieCatalog(source.slug, page)
            )
        )
    );
}

type HomeHeroSnapshot = {
    id: string | number;
    type: 'movie' | 'tv' | 'anime';
    title: string;
    catalogTitle: string;
    anilistId?: number;
    overview: string;
    backdropPath: string | null;
    posterPath: string | null;
    rating: number;
    releaseDate: string;
};

function heroSnapshotFromItem(item: CuratedItem): HomeHeroSnapshot {
    return {
        id: item.id,
        type: (item.type === 'anime' || item.anilistId
            ? 'anime'
            : (item.type || 'movie')) as 'movie' | 'tv' | 'anime',
        anilistId: item.anilistId,
        title: item.title,
        catalogTitle: item.catalogTitle || item.title,
        overview: '',
        backdropPath: item.backdropPath ?? null,
        posterPath: item.posterPath ?? null,
        rating: item.rating || 0,
        releaseDate: item.releaseDate || ''
    };
}

function mergeCuratedItems(
    existing: CuratedItem[],
    byId: Map<string, CuratedItem>
): CuratedItem[] {
    return existing.map((item) => byId.get(String(item.id)) || item);
}

function prefetchVisibleHomePosters(
    trending: CuratedItem[],
    topMovies: CuratedItem[],
    topTv: CuratedItem[],
    rails: NetflixRailSection[]
) {
    const paths = [
        ...trending,
        ...topMovies,
        ...topTv,
        ...rails.slice(0, 2).flatMap((rail) => rail.items)
    ]
        .map((item) => item.posterPath || item.backdropPath)
        .filter(Boolean) as string[];
    prefetchArtworkImages(paths, 'large', 56);
}

export default defineComponent({
    name: 'NetflixHome',
    components: {
        SiteHeader,
        SiteFooter,
        BillboardHero,
        CuratedRail,
        TopTenRail
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const { language, activeLanguage } = getNetflixLanguage();
        const { catalogue, activeCatalogue: resolveCatalogue } = getNetflixCatalogue();
        const isLoading = ref(true);
        const trendingItems = ref<CuratedItem[]>([]);
        const top10Movies = ref<CuratedItem[]>([]);
        const top10Tv = ref<CuratedItem[]>([]);
        const catalogueRails = ref<NetflixRailSection[]>([]);
        const lastLoadKey = ref('');
        const pinnedHero = ref<HomeHeroSnapshot | null>(null);

        const activeLang = computed<NetflixLanguageOption>(() => activeLanguage());
        const activeCatalogue = computed<NetflixCatalogueOption>(() => resolveCatalogue());

        const hero = computed(() => pinnedHero.value);

        const heroPlayRoute = computed(() => {
            if (!hero.value) return undefined;
            const h = hero.value;
            return {
                path: catalogStreamTarget({
                    id: String(h.id),
                    title: h.catalogTitle || h.title,
                    media_type: h.type
                }).path
            };
        });

        const trendingBrowseTo = computed(() =>
            netflixBrowsePath(activeCatalogue.value.id, 'trending')
        );

        const top10MoviesBrowseTo = computed(() =>
            netflixBrowsePath(activeCatalogue.value.id, 'top10-movies')
        );

        const top10TvBrowseTo = computed(() =>
            netflixBrowsePath(activeCatalogue.value.id, 'top10-tv')
        );

        const browseToForRail = (rail: NetflixRailSection) =>
            netflixBrowsePath(activeCatalogue.value.id, rail.rowId);

        const currentLoadKey = () => `${catalogue.value}:${language.value}`;

        /** Legacy bookmarks: /?type=tv|movie → dedicated browse pages. */
        const redirectLegacyTypeQuery = () => {
            const t = route.query.type;
            if (t !== 'tv' && t !== 'movie') return false;

            if (t === 'tv') {
                router.replace(NETFLIX_TV_EXPLORE_PATH);
                return true;
            }

            router.replace(NETFLIX_MOVIE_EXPLORE_PATH);
            return true;
        };

        const hasCatalogue = () =>
            trendingItems.value.length > 0 || catalogueRails.value.length > 0;

        const restoreHomeCache = () => {
            if (!hasCatalogue() || lastLoadKey.value !== currentLoadKey()) return false;
            if (!pinnedHero.value && trendingItems.value[0]) {
                pinnedHero.value = heroSnapshotFromItem(trendingItems.value[0]);
            }
            isLoading.value = false;
            nfDebug('home:restore-cache', { key: lastLoadKey.value });
            return true;
        };

        const loadCatalogue = async () => {
            if (restoreHomeCache()) return;

            const lang = getLanguageOption(language.value);
            const cat = getCatalogueOption(catalogue.value);
            const loadKey = currentLoadKey();
            nfDebug('home:load:start', {
                catalogue: cat.id,
                language: lang.category,
                label: lang.label
            });
            isLoading.value = true;
            trendingItems.value = [];
            top10Movies.value = [];
            top10Tv.value = [];
            catalogueRails.value = [];
            pinnedHero.value = null;

            const applyHomeSections = (
                browsePool: MoovieCatalogItem[],
                byId: Map<string, CuratedItem>,
                tmdbById: Map<string, import('../composables/useTmdbArtwork').CatalogTmdbMeta>
            ) => {
                const pool = filterCataloguePool(browsePool, cat.id, lang);
                trendingItems.value = buildTrendingItems(pool, byId);
                const home = buildNetflixHomeSections(
                    browsePool,
                    cat.id,
                    cat.label,
                    lang,
                    byId,
                    tmdbById
                );
                top10Movies.value = home.top10Movies;
                top10Tv.value = home.top10Tv;
                catalogueRails.value = home.rails;
                if (trendingItems.value[0]) {
                    pinnedHero.value = heroSnapshotFromItem(trendingItems.value[0]);
                }
            };

            const upgradeHomeSectionsInPlace = (byId: Map<string, CuratedItem>) => {
                trendingItems.value = mergeCuratedItems(trendingItems.value, byId);
                top10Movies.value = mergeCuratedItems(top10Movies.value, byId);
                top10Tv.value = mergeCuratedItems(top10Tv.value, byId);
                catalogueRails.value = catalogueRails.value.map((rail) => ({
                    ...rail,
                    items: mergeCuratedItems(rail.items, byId)
                }));
                if (pinnedHero.value) {
                    const upgraded = byId.get(String(pinnedHero.value.id));
                    if (upgraded) {
                        pinnedHero.value = heroSnapshotFromItem(upgraded);
                    }
                }
            };

            const buildCuratedById = (
                browsePool: MoovieCatalogItem[],
                languageMap: Map<string, string[]>,
                audioCache: Map<string, string[]>,
                artworkUrls: CatalogArtworkUrlMaps
            ) => {
                const artworkTargets = collectArtworkIdsForCurated(
                    browsePool,
                    cat.id,
                    lang,
                    cat.label,
                    new Map()
                );
                const fastCurated = artworkTargets.map((item) =>
                    toCuratedItemFast(
                        item,
                        [],
                        languageMap,
                        audioCache,
                        undefined,
                        artworkUrls
                    )
                );
                return {
                    artworkTargets,
                    byId: new Map(fastCurated.map((item) => [String(item.id), item]))
                };
            };

            try {
                void loadNetflixAvailabilityIndex();
                const fetchSources = getCatalogueHomeFetchSources(cat.id, lang.category);
                const initialSources = fetchSources.map((source) => ({
                    slug: source.slug,
                    pages: getCatalogueHomeInitialPageCount(cat.id, source.pages)
                }));
                const initialPages = await fetchCataloguePages(initialSources);
                let browsePool = dedupeCataloguePool(initialPages, lang);
                let languageMap = buildCatalogLanguageMap(browsePool);

                const { byId: fastById } = buildCuratedById(
                    browsePool,
                    languageMap,
                    new Map(),
                    emptyCatalogArtworkUrlMaps
                );
                applyHomeSections(browsePool, fastById, new Map());

                const heroItem = trendingItems.value[0];
                if (heroItem?.backdropPath) {
                    prefetchArtworkImages([heroItem.posterPath || heroItem.backdropPath], 'large', 1);
                }
                prefetchVisibleHomePosters(
                    trendingItems.value,
                    top10Movies.value,
                    top10Tv.value,
                    catalogueRails.value
                );
                lastLoadKey.value = loadKey;
                isLoading.value = false;

                const remainingSources: CatalogueHomeFetchSource[] = [];
                for (const source of fetchSources) {
                    const initial = getCatalogueHomeInitialPageCount(cat.id, source.pages);
                    if (source.pages > initial) {
                        remainingSources.push({
                            slug: source.slug,
                            pages: source.pages - initial
                        });
                    }
                }

                void (async () => {
                    try {
                        const remainingPageTasks = remainingSources.flatMap((source) => {
                            const start = initialSources.find((row) => row.slug === source.slug)
                                ?.pages ?? 0;
                            return Array.from({ length: source.pages }, (_, offset) =>
                                browseMoovieCatalog(source.slug, start + offset)
                            );
                        });

                        const artworkTargetIds = collectArtworkIdsForCurated(
                            browsePool,
                            cat.id,
                            lang,
                            cat.label,
                            new Map()
                        ).map((item) => item.id);

                        const [remainingPages, variantSnapshot, artworkUrls, audioCache] =
                            await Promise.all([
                                remainingPageTasks.length
                                    ? Promise.all(remainingPageTasks)
                                    : Promise.resolve([]),
                                fetchCatalogVariantSnapshot(),
                                fetchCatalogArtworkUrlsByIds(artworkTargetIds),
                                fetchCatalogAudioCacheByIds(artworkTargetIds)
                            ]);

                        if (currentLoadKey() !== loadKey) return;

                        if (remainingPages.length) {
                            browsePool = dedupeCataloguePool(
                                [...initialPages, ...remainingPages],
                                lang
                            );
                        }
                        languageMap = buildCatalogLanguageMap([
                            ...browsePool,
                            ...variantSnapshot
                        ]);

                        const { artworkTargets, byId: upgradedById } = buildCuratedById(
                            browsePool,
                            languageMap,
                            audioCache,
                            artworkUrls
                        );
                        upgradeHomeSectionsInPlace(upgradedById);
                        prefetchVisibleHomePosters(
                            trendingItems.value,
                            top10Movies.value,
                            top10Tv.value,
                            catalogueRails.value
                        );

                        const enrichmentMap = await fetchEnrichmentByCatalogIds(
                            artworkTargets.map((item) => item.id)
                        );
                        if (currentLoadKey() !== loadKey) return;

                        const tmdbById = new Map<
                            string,
                            import('../composables/useTmdbArtwork').CatalogTmdbMeta
                        >();
                        enrichmentMap.forEach((row, id) => {
                            if (row.tmdb_genre_ids.length) {
                                tmdbById.set(id, enrichmentRowToTmdbMeta(row));
                            }
                        });
                        upgradeHomeSectionsInPlace(upgradedById);
                    } catch (err) {
                        nfDebugError('home:upgrade:fail', { err });
                    }
                })();

                nfDebug('home:load:ok', {
                    catalogue: cat.id,
                    language: lang.category,
                    pool: browsePool.length,
                    trending: trendingItems.value.length,
                    rails: catalogueRails.value.length,
                    railTitles: catalogueRails.value.slice(0, 12).map((r) => r.title)
                });

                updateSeo({
                    title: `${cat.label} · ${lang.label} — Netflix on Moovie`,
                    canonical: 'https://moovie.fun/',
                    image: 'https://moovie.fun/og-image.png'
                });
            } catch (err) {
                nfDebugError('home:load:fail', { catalogue: cat.id, language: lang.category, err });
                isLoading.value = false;
            }
        };

        const onCatalogueOrLanguageChange = () => {
            nfDebug('home:filter-change');
            loadCatalogue();
        };

        watch(
            () => route.query.type,
            () => {
                redirectLegacyTypeQuery();
            }
        );

        onMounted(() => {
            nfDebug('home:mount');
            if (redirectLegacyTypeQuery()) return;
            loadCatalogue();
            window.addEventListener('movora_netflix_catalogue_change', onCatalogueOrLanguageChange);
            window.addEventListener('movora_netflix_language_change', onCatalogueOrLanguageChange);
        });

        onActivated(() => {
            if (redirectLegacyTypeQuery()) return;
            if (restoreHomeCache()) return;
            loadCatalogue();
        });

        onBeforeUnmount(() => {
            window.removeEventListener('movora_netflix_catalogue_change', onCatalogueOrLanguageChange);
            window.removeEventListener('movora_netflix_language_change', onCatalogueOrLanguageChange);
        });

        return {
            isLoading,
            activeLang,
            activeCatalogue,
            hero,
            heroPlayRoute,
            trendingItems,
            top10Movies,
            top10Tv,
            catalogueRails,
            trendingBrowseTo,
            top10MoviesBrowseTo,
            top10TvBrowseTo,
            browseToForRail
        };
    }
});
</script>

<style lang="scss" scoped>
.home {
    position: relative;
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        position: relative;
    }

    &__section {
        margin-top: clamp(var(--s-8), 8vw, var(--s-10));

        &:last-of-type {
            margin-bottom: clamp(var(--s-8), 8vw, var(--s-10));
        }
    }
}
</style>