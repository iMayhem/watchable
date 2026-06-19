<template>
    <div class="home netflix-home">
        <SiteHeader />

        <main id="main" class="home__main" role="main">
            <BillboardHero
                :id="hero ? hero.id : ''"
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
                :loading="isLoading"
            />

            <TopTenRail
                v-if="top10Movies.length || isLoading"
                class="home__section"
                :items="top10Movies"
                title="Top 10 Movies Today"
                eyebrow="Top 10"
                catalog="netflix"
                :more-to="top10MoviesBrowseTo"
                :loading="isLoading"
            />

            <TopTenRail
                v-if="top10Tv.length || isLoading"
                class="home__section"
                :items="top10Tv"
                title="Top 10 TV Shows Today"
                eyebrow="Top 10"
                catalog="netflix"
                :more-to="top10TvBrowseTo"
                :loading="isLoading"
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
import { computed, defineComponent, onActivated, onBeforeUnmount, onMounted, ref } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import BillboardHero from '../components/hero/BillboardHero.vue';
import CuratedRail, { type CuratedItem } from '../components/rails/CuratedRail.vue';
import TopTenRail from '../components/rails/TopTenRail.vue';
import {
    browseMoovieCatalog,
    catalogRating,
    inferCatalogMediaType,
    parseCatalogTitle,
    type MoovieCatalogItem
} from '../composables/useMoovieCatalog';
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
import { useSeo } from '../composables/useSeo';
import {
    mapWithConcurrency,
    resolveArtworkForCatalogItem
} from '../composables/useTmdbArtwork';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';

async function toCuratedItem(
    item: MoovieCatalogItem,
    genreIds: number[] = []
): Promise<CuratedItem> {
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
        languageTags: parsed.languages,
        genreIds: genreIds.length ? genreIds : artwork.genreIds || []
    };
}

export default defineComponent({
    name: 'NetflixHome',
    components: { SiteHeader, SiteFooter, BillboardHero, CuratedRail, TopTenRail },
    setup() {
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
                type: first.type || 'movie',
                title: first.title,
                overview: '',
                backdropPath: first.backdropPath || first.posterPath,
                posterPath: first.posterPath,
                rating: first.rating || 0,
                releaseDate: first.releaseDate || ''
            };
        });

        const heroPlayRoute = computed(() => {
            if (!hero.value) return undefined;
            const h = hero.value;
            if (h.type === 'tv') {
                return { path: `/stream/nf/tv/${h.id}/season/1/episode/1` };
            }
            return { path: `/stream/nf/movie/${h.id}` };
        });

        const heroDetailRoute = computed(() => {
            if (!hero.value) return undefined;
            const h = hero.value;
            return { path: `/nf/${h.type}/${h.id}` };
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

        const loadCatalogue = async () => {
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
                const pages = await Promise.all(
                    Array.from({ length: 5 }, (_, page) =>
                        browseMoovieCatalog(lang.category, page)
                    )
                );

                const browsePool = pages
                    .flatMap((page) => page.results || [])
                    .filter((item) => itemMatchesLanguage(item, lang));

                const pool = filterCataloguePool(browsePool, cat.id, lang);
                const tmdbById = await enrichCatalogPoolWithTmdb(pool, 8);
                const artworkTargets = collectArtworkIdsForCurated(
                    browsePool,
                    cat.id,
                    lang,
                    cat.label,
                    tmdbById
                );
                const curated = await mapWithConcurrency(artworkTargets, (item) => {
                    const meta = tmdbById.get(String(item.id));
                    return toCuratedItem(item, meta?.genreIds || []);
                }, 5);
                const byId = new Map(curated.map((item) => [String(item.id), item]));

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

                lastLoadKey.value = loadKey;

                nfDebug('home:load:ok', {
                    catalogue: cat.id,
                    language: lang.category,
                    pool: pool.length,
                    tmdbEnriched: tmdbById.size,
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
            } finally {
                isLoading.value = false;
            }
        };

        const onCatalogueOrLanguageChange = () => {
            nfDebug('home:filter-change');
            loadCatalogue();
        };

        const hasCatalogue = () =>
            trendingItems.value.length > 0 || catalogueRails.value.length > 0;

        onMounted(() => {
            nfDebug('home:mount');
            loadCatalogue();
            window.addEventListener('movora_netflix_catalogue_change', onCatalogueOrLanguageChange);
            window.addEventListener('movora_netflix_language_change', onCatalogueOrLanguageChange);
        });

        onActivated(() => {
            if (hasCatalogue() && lastLoadKey.value === currentLoadKey()) {
                nfDebug('home:reactivate');
                isLoading.value = false;
                return;
            }
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