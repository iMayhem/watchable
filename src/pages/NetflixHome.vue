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
                strict-backdrop
                :play-to="heroPlayRoute"
                :detail-to="heroDetailRoute"
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
import { browseMoovieCatalog } from '../composables/useMoovieCatalog';
import { getCatalogueHomeFetchSources } from '../data/netflixCatalogCategories';
import { netflixCatalogDetailPath } from '../composables/useNetflixCatalogLookup';
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
    enrichCatalogPoolWithTmdb,
    filterCataloguePool,
    netflixBrowsePath,
    type NetflixRailSection
} from '../composables/useNetflixRails';
import { loadNetflixAvailabilityIndex } from '../composables/useNetflixProvider';
import { useSeo } from '../composables/useSeo';
import { mapWithConcurrency } from '../composables/useTmdbArtwork';
import {
    toCuratedItemFast,
    toCuratedItemUpgraded
} from '../composables/useNetflixArtwork';
import { fetchCatalogArtworkUrlsByIds } from '../composables/usePosterCache';
import { prefetchArtworkImages } from '../utils/useWebImage';
import { fetchCatalogAudioCacheByIds } from '../composables/useCatalogAudioCache';
import { fetchEnrichmentByCatalogIds } from '../composables/useCatalogEnrichmentCache';
import {
    buildCatalogLanguageMap,
    catalogStreamTarget,
    fetchCatalogVariantSnapshot
} from '../composables/useNetflixCatalogLookup';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';

export default defineComponent({
    name: 'NetflixHome',
    components: { SiteHeader, SiteFooter, BillboardHero, CuratedRail, TopTenRail },
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

        const activeLang = computed<NetflixLanguageOption>(() => activeLanguage());
        const activeCatalogue = computed<NetflixCatalogueOption>(() => resolveCatalogue());

        const hero = computed(() => {
            const first =
                trendingItems.value[0] ||
                catalogueRails.value[0]?.items[0] ||
                null;
            if (!first) return null;
            return {
                id: first.id,
                type: (first.anilistId ? 'anime' : (first.type || 'movie')) as 'movie' | 'tv' | 'anime',
                title: first.title,
                catalogTitle: first.catalogTitle || first.title,
                overview: '',
                backdropPath: first.backdropPath,
                posterPath: first.posterPath,
                rating: first.rating || 0,
                releaseDate: first.releaseDate || ''
            };
        });

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

        const heroDetailRoute = computed(() => {
            if (!hero.value) return undefined;
            const h = hero.value;
            return {
                path: netflixCatalogDetailPath({
                    id: h.id,
                    title: h.catalogTitle || h.title,
                    type: h.type === 'anime' ? undefined : (h.type as 'movie' | 'tv')
                })
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

            const cat = catalogue.value;
            if (t === 'tv') {
                router.replace(netflixBrowsePath(cat, 'exciting-tv'));
                return true;
            }

            const moviesCat = cat === 'korean' ? 'hollywood' : cat;
            router.replace(netflixBrowsePath(moviesCat, 'blockbuster-movies'));
            return true;
        };

        const hasCatalogue = () =>
            trendingItems.value.length > 0 || catalogueRails.value.length > 0;

        const restoreHomeCache = () => {
            if (!hasCatalogue() || lastLoadKey.value !== currentLoadKey()) return false;
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

            try {
                void loadNetflixAvailabilityIndex();
                const fetchSources = getCatalogueHomeFetchSources(cat.id, lang.category);
                const [pages, variantSnapshot] = await Promise.all([
                    Promise.all(
                        fetchSources.flatMap((source) =>
                            Array.from({ length: source.pages }, (_, page) =>
                                browseMoovieCatalog(source.slug, page)
                            )
                        )
                    ),
                    fetchCatalogVariantSnapshot()
                ]);

                const seenPoolIds = new Set<string>();
                const browsePool = pages
                    .flatMap((page) => page.results || [])
                    .filter((item) => {
                        if (!itemMatchesLanguage(item, lang) || seenPoolIds.has(item.id)) {
                            return false;
                        }
                        seenPoolIds.add(item.id);
                        return true;
                    });

                const languageMap = buildCatalogLanguageMap([
                    ...browsePool,
                    ...variantSnapshot
                ]);
                const artworkIds = collectArtworkIdsForCurated(
                    browsePool,
                    cat.id,
                    lang,
                    cat.label,
                    new Map()
                );
                const [audioCache, artworkUrls] = await Promise.all([
                    fetchCatalogAudioCacheByIds(browsePool.map((item) => item.id)),
                    fetchCatalogArtworkUrlsByIds(artworkIds.map((item) => item.id))
                ]);

                const pool = filterCataloguePool(browsePool, cat.id, lang);
                const artworkTargets = artworkIds;

                const applyHomeSections = (
                    byId: Map<string, CuratedItem>,
                    tmdbById: Map<string, import('../composables/useTmdbArtwork').CatalogTmdbMeta>
                ) => {
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
                };

                const fastCurated = artworkTargets.map((item) =>
                    toCuratedItemFast(item, [], languageMap, audioCache, undefined, artworkUrls)
                );
                const fastById = new Map(fastCurated.map((item) => [String(item.id), item]));
                applyHomeSections(fastById, new Map());
                const heroItem = trendingItems.value[0];
                if (heroItem?.backdropPath) {
                    prefetchArtworkImages([heroItem.backdropPath], 'hero', 1);
                }
                prefetchArtworkImages(
                    trendingItems.value.map((item) => item.posterPath || item.backdropPath),
                    'medium',
                    20
                );
                lastLoadKey.value = loadKey;
                isLoading.value = false;

                void (async () => {
                    try {
                        const enrichmentMap = await fetchEnrichmentByCatalogIds(
                            artworkTargets.map((item) => item.id)
                        );
                        const tmdbById = await enrichCatalogPoolWithTmdb(
                            artworkTargets.map((item) => ({
                                id: String(item.id),
                                title: item.title,
                                release_date: item.release_date,
                                media_type: item.media_type,
                                tmdbId: enrichmentMap.get(String(item.id))?.tmdb_id
                            })),
                            14
                        );
                        const upgraded = await mapWithConcurrency(
                            artworkTargets,
                            (item) => {
                                const meta = tmdbById.get(String(item.id));
                                const enrichment = enrichmentMap.get(String(item.id));
                                return toCuratedItemUpgraded(
                                    item,
                                    meta?.genreIds || [],
                                    languageMap,
                                    audioCache,
                                    enrichment
                                );
                            },
                            10
                        );
                        if (currentLoadKey() !== loadKey) return;
                        const byId = new Map(upgraded.map((item) => [String(item.id), item]));
                        applyHomeSections(byId, tmdbById);
                    } catch (err) {
                        nfDebugError('home:artwork-upgrade:fail', { err });
                    }
                })();

                nfDebug('home:load:ok', {
                    catalogue: cat.id,
                    language: lang.category,
                    pool: pool.length,
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
            heroDetailRoute,
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