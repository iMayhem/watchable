<template>
    <div class="discover netflix-browse" :class="{ 'netflix-browse--genre': isGenreBrowse }">
        <SiteHeader />

        <main id="main" class="discover__main" role="main">
            <section
                v-if="isGenreBrowse"
                class="nf-genre-hero"
                :class="{ 'nf-genre-hero--has-backdrop': genreHeroBackdrop }"
                :style="genreHeroStyle"
            >
                <div class="nf-genre-hero__scrim">
                    <div class="nf-genre-hero__inner container-lm">
                        <h1 class="nf-genre-hero__title">{{ rowMeta.title }}</h1>
                        <p v-if="rowMeta.description" class="nf-genre-hero__tagline">
                            {{ rowMeta.description }}
                        </p>
                        <div v-if="genreHeroFeatured" class="nf-genre-hero__actions">
                            <LmButton
                                variant="primary"
                                size="lg"
                                :to="genreHeroPlayRoute"
                                aria-label="Play"
                            >
                                <template #leading>
                                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                        <path fill="currentColor" d="M8 5v14l11-7z"/>
                                    </svg>
                                </template>
                                Play
                            </LmButton>
                            <LmButton
                                variant="ghost"
                                size="lg"
                                :to="genreHeroDetailRoute"
                                aria-label="More info"
                            >
                                More info
                            </LmButton>
                            <LmButton
                                variant="outline"
                                size="lg"
                                :href="genreHeroPartyHref"
                                rel="nofollow"
                                aria-label="Watch Together"
                            >
                                <template #leading>
                                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                </template>
                                Watch Together
                            </LmButton>
                        </div>
                    </div>
                </div>
            </section>

            <section class="discover__body container-lm">
                <div class="discover__results">
                    <header v-if="!isGenreBrowse" class="discover__results-head">
                        <div>
                            <p class="eyebrow discover__results-eyebrow">{{ rowMeta.eyebrow }}</p>
                            <h1 class="discover__results-title">{{ rowMeta.title }}</h1>
                            <p v-if="rowMeta.description" class="discover__results-desc">
                                {{ rowMeta.description }}
                            </p>
                        </div>
                    </header>

                    <h2
                        v-if="isGenreBrowse && (results.length || isLoading)"
                        class="nf-your-next-watch"
                    >
                        Your Next Watch
                    </h2>

                    <div
                        v-if="isRefreshing"
                        class="discover__refresh-bar"
                        role="progressbar"
                        aria-label="Loading titles"
                    />

                    <div v-if="isLoading && !results.length" class="discover__grid">
                        <PosterCard
                            v-for="n in BROWSE_FAST_BATCH"
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
                            :key="item.anilistId ? `anilist-${item.anilistId}` : `${item.type}-${item.id}`"
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
                            :anilist-id="item.anilistId || 0"
                            :moovie-catalog-id="item.moovieCatalogId || ''"
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

                    <CuratedRail
                        v-for="rail in genreRails"
                        :key="rail.id"
                        class="nf-genre-rail"
                        :items="rail.items"
                        :title="rail.title"
                        :default-type="rail.defaultType"
                        catalog="netflix"
                    />
                </div>
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onActivated, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import PosterCard from '../components/cards/PosterCard.vue';
import LmButton from '../components/primitives/Button.vue';
import CuratedRail, { type CuratedItem } from '../components/rails/CuratedRail.vue';
import type { MoovieCatalogItem } from '../composables/useMoovieCatalog';
import {
    BROWSE_FAST_GRID_BATCH,
    BROWSE_FAST_INITIAL_PAGES,
    BROWSE_GRID_BATCH,
    createBrowsePoolState,
    ensureBrowsePickCount,
    type BrowsePoolState,
    type EnsureBrowsePickOptions
} from '../composables/useNetflixBrowsePool';
import { isTvEditorialBrowseRow } from '../data/netflixCatalogCategories';
import {
    browseCacheKey,
    readNetflixBrowseCache,
    writeNetflixBrowseCache
} from '../composables/useNetflixBrowseCache';
import { loadNetflixAvailabilityIndex } from '../composables/useNetflixProvider';
import {
    getCatalogueOption,
    getNetflixCatalogue,
    NETFLIX_CATALOGUES,
    type NetflixCatalogueOption
} from '../composables/useNetflixCatalogue';
import {
    getNetflixLanguage,
    getLanguageOption,
    type NetflixLanguageOption
} from '../composables/useNetflixLanguage';
import {
    enrichCatalogPoolWithTmdb,
    filterCataloguePool,
    getNetflixRowMeta,
    isNetflixGenreBrowsePage,
    isValidNetflixBrowseRow,
    netflixBrowsePath,
    pickGenreBrowseRails,
    type GenreBrowseRailPlan,
    type NetflixBrowseRowId
} from '../composables/useNetflixRails';
import { useWebImage } from '../utils/useWebImage';
import { useSeo } from '../composables/useSeo';
import { fetchCatalogAudioCacheByIds } from '../composables/useCatalogAudioCache';
import {
    buildCatalogLanguageMap,
    fetchCatalogVariantSnapshot
} from '../composables/useNetflixCatalogLookup';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';
import { mapWithConcurrency } from '../composables/useTmdbArtwork';
import {
    toCuratedItemFast,
    toCuratedItemUpgraded
} from '../composables/useNetflixArtwork';
import { fetchCatalogArtworkUrlsByIds } from '../composables/usePosterCache';
import {
    animeMediaNeedingLiveResolve,
    applyAnimeCatalogCacheBatch,
    buildAnimeGenreRails,
    fetchAnimeBrowseBatchFast,
    resolveAnimeCatalogMisses,
    type NetflixAnimeBrowseItem
} from '../composables/useNetflixAnimeBrowse';
import type { AnimeMedia } from '../composables/useAniList';
import { fetchAnimeCatalogCacheByMoovieIds } from '../composables/useAnimeCatalogCache';
import {
    catalogStreamTarget,
    netflixCatalogDetailPath
} from '../composables/useNetflixCatalogLookup';
import { buildPartyHref } from '../utils/partyRoom';

const BROWSE_PAGE_SIZE = BROWSE_GRID_BATCH;
const BROWSE_FAST_BATCH = BROWSE_FAST_GRID_BATCH;
const TMDB_CONCURRENCY = 12;

interface GenreRailDisplay {
    id: string;
    title: string;
    defaultType: 'movie' | 'tv';
    items: Array<CuratedItem | NetflixAnimeBrowseItem>;
}

type BrowseResultItem = CuratedItem & {
    anilistId?: number;
    moovieCatalogId?: string;
};

export default defineComponent({
    name: 'NetflixBrowse',
    components: { SiteHeader, SiteFooter, PosterCard, CuratedRail, LmButton },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const { language } = getNetflixLanguage();
        const { setCatalogue: setNetflixCatalogue } = getNetflixCatalogue();

        const isLoading = ref(true);
        const isRefreshing = ref(false);
        const isLoadingMore = ref(false);
        const results = ref<BrowseResultItem[]>([]);
        const animePage = ref(1);
        const animeHasMore = ref(true);
        const variantSnapshot = ref<MoovieCatalogItem[]>([]);
        const languageMap = ref<Map<string, string[]>>(new Map());
        const displayedCount = ref(0);
        const loadGeneration = ref(0);
        const lastLoadKey = ref('');
        const genreRailPlans = ref<GenreBrowseRailPlan[]>([]);
        const genreRails = ref<GenreRailDisplay[]>([]);

        const typeFilter = computed(() => {
            const t = route.query.type;
            if (t === 'tv' || t === 'movie') return t;
            return undefined;
        });

        const currentLoadKey = () => {
            const base = browseCacheKey(catalogueId.value, rowId.value, language.value);
            return typeFilter.value ? `${base}:${typeFilter.value}` : base;
        };

        const isBrowseRouteActive = () => route.name === 'NetflixBrowse';

        const catalogueId = computed(() => String(route.params.catalogue || ''));
        const rowId = computed(() => String(route.params.row || ''));

        const poolState = ref<BrowsePoolState>(
            createBrowsePoolState(rowId.value as NetflixBrowseRowId, catalogueId.value)
        );

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
            const meta = getNetflixRowMeta(
                rowId.value as NetflixBrowseRowId,
                activeCatalogue.value,
                activeLang.value
            );
            let title = meta.title;
            let eyebrow = meta.eyebrow;
            if (isGenreBrowse.value && typeFilter.value) {
                if (typeFilter.value === 'tv') {
                    title = `TV ${meta.title}`;
                    eyebrow = 'TV Shows';
                } else if (typeFilter.value === 'movie') {
                    title = `${meta.title} Movies`;
                    eyebrow = 'Movies';
                }
            }
            return {
                ...meta,
                title,
                eyebrow,
                defaultType: typeFilter.value || meta.defaultType
            };
        });

        const pickedItems = computed(() => poolState.value.pickedItems);
        const browsePool = computed(() => poolState.value.browsePool);
        const tmdbById = computed(() => poolState.value.tmdbById);
        const enrichmentById = computed(() => poolState.value.enrichmentById);
        const canFetchMoreApi = computed(() => poolState.value.canFetchMoreApi);

        const enrichmentFor = (item: MoovieCatalogItem) =>
            enrichmentById.value.get(String(item.id));

        const isAnimeBrowse = computed(() => rowId.value === 'anime');

        const hasMore = computed(() => {
            if (isAnimeBrowse.value) return animeHasMore.value;
            return (
                displayedCount.value < pickedItems.value.length ||
                canFetchMoreApi.value
            );
        });

        const isGenreBrowse = computed(() => isNetflixGenreBrowsePage(rowId.value));

        const genreHeroFeatured = computed(() => {
            if (!isGenreBrowse.value) return null;
            return (
                results.value.find((item) => item.backdropPath) || null
            );
        });

        const genreHeroBackdrop = computed(() => {
            const featured = genreHeroFeatured.value;
            return featured?.backdropPath || null;
        });

        const genreHeroPlayRoute = computed(() => {
            const item = genreHeroFeatured.value;
            if (!item) return undefined;
            return {
                path: catalogStreamTarget({
                    id: String(item.id),
                    title: item.catalogTitle || item.title,
                    media_type: item.type || rowMeta.value.defaultType
                }).path
            };
        });

        const genreHeroDetailRoute = computed(() => {
            const item = genreHeroFeatured.value;
            if (!item) return undefined;
            return {
                path: netflixCatalogDetailPath({
                    id: String(item.id),
                    title: item.catalogTitle || item.title,
                    media_type: item.type || rowMeta.value.defaultType,
                    anilistId: item.anilistId
                })
            };
        });

        const genreHeroPartyHref = computed(() => {
            const item = genreHeroFeatured.value;
            if (!item) return '/party/';
            const mediaType = item.type || rowMeta.value.defaultType;
            return buildPartyHref({
                id: item.id,
                title: item.title,
                type: mediaType === 'tv' ? 'tv' : 'movie',
                source: 'netflix'
            });
        });

        const genreHeroStyle = computed(() => {
            const path = genreHeroBackdrop.value;
            if (!path) return undefined;
            const url = useWebImage(path, 'hero');
            return url ? { backgroundImage: `url(${url})` } : undefined;
        });

        const syncTmdbForPool = async (pool: MoovieCatalogItem[]) => {
            const pending = pool.filter(
                (item) => !poolState.value.tmdbById.has(String(item.id))
            );
            if (!pending.length) return;
            const fresh = await enrichCatalogPoolWithTmdb(
                pending.map((item) => ({
                    id: String(item.id),
                    title: item.title,
                    release_date: item.release_date,
                    media_type: item.media_type,
                    tmdbId: enrichmentFor(item)?.tmdb_id
                })),
                TMDB_CONCURRENCY
            );
            fresh.forEach((meta, id) => poolState.value.tmdbById.set(id, meta));
        };

        const planToGenreRailDisplay = (
            plans: GenreBrowseRailPlan[],
            audioCache?: Map<string, string[]>,
            artworkUrls?: Awaited<ReturnType<typeof fetchCatalogArtworkUrlsByIds>>
        ): GenreRailDisplay[] =>
            plans.map((plan) => ({
                id: plan.id,
                title: plan.title,
                defaultType: plan.defaultType,
                items: plan.items.map((item) => {
                    const meta = tmdbById.value.get(String(item.id));
                    return toCuratedItemFast(
                        item,
                        meta?.genreIds || [],
                        languageMap.value,
                        audioCache,
                        enrichmentFor(item),
                        artworkUrls
                    );
                })
            }));

        const rebuildGenreRails = async (pool: MoovieCatalogItem[]) => {
            if (!isGenreBrowse.value) {
                genreRailPlans.value = [];
                genreRails.value = [];
                return;
            }

            const plans = pickGenreBrowseRails(
                pool,
                rowId.value as NetflixBrowseRowId,
                tmdbById.value,
                undefined,
                poolState.value.enrichmentById,
                typeFilter.value
            );
            genreRailPlans.value = plans;
            const [audioCache, artworkUrls] = await Promise.all([
                fetchCatalogAudioCacheByIds(pool.map((item) => item.id)),
                fetchCatalogArtworkUrlsByIds(pool.map((item) => item.id))
            ]);
            genreRails.value = planToGenreRailDisplay(plans, audioCache, artworkUrls);
        };

        const upgradeGenreRailArtwork = async () => {
            if (!genreRailPlans.value.length) return;

            try {
                const allItems = genreRailPlans.value.flatMap((rail) => rail.items);
                await syncTmdbForPool(allItems);
                await ensureVariantSnapshot();
                refreshLanguageMap();

                const railPool = genreRailPlans.value.flatMap((plan) => plan.items);
                const railAudioCache = await fetchCatalogAudioCacheByIds(
                    railPool.map((item) => item.id)
                );
                const upgraded = await Promise.all(
                    genreRailPlans.value.map(async (plan) => ({
                        id: plan.id,
                        title: plan.title,
                        defaultType: plan.defaultType,
                        items: await mapWithConcurrency(
                            plan.items,
                            (item) => {
                                const meta = tmdbById.value.get(String(item.id));
                                return toCuratedItemUpgraded(
                                    item,
                                    meta?.genreIds || [],
                                    languageMap.value,
                                    railAudioCache,
                                    enrichmentFor(item)
                                );
                            },
                            TMDB_CONCURRENCY
                        )
                    }))
                );
                genreRails.value = upgraded;
            } catch (err) {
                nfDebugError('browse:genre-rails:artwork:fail', { err });
            }
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

        const patchResultRange = (start: number, curated: CuratedItem[]) => {
            if (!curated.length) return;
            const next = [...results.value];
            for (let i = 0; i < curated.length; i += 1) {
                next[start + i] = curated[i];
            }
            results.value = next;
        };

        const upgradeBatchArtwork = async (batch: MoovieCatalogItem[], startIndex: number) => {
            if (!batch.length) return;

            try {
                await Promise.all([
                    syncTmdbForPool(batch),
                    ensureVariantSnapshot()
                ]);
                refreshLanguageMap();

                const audioCache = await fetchCatalogAudioCacheByIds(batch.map((item) => item.id));
                const curated = await mapWithConcurrency(batch, (item) => {
                    const meta = tmdbById.value.get(String(item.id));
                    return toCuratedItemUpgraded(
                        item,
                        meta?.genreIds || [],
                        languageMap.value,
                        audioCache,
                        enrichmentFor(item)
                    );
                }, TMDB_CONCURRENCY);

                patchResultRange(startIndex, curated);
            } catch (err) {
                nfDebugError('browse:artwork-upgrade:fail', { err });
            }
        };

        const ensurePickedCount = async (
            needed: number,
            pickOptions?: EnsureBrowsePickOptions
        ) => {
            await ensureBrowsePickCount(
                poolState.value,
                rowId.value as NetflixBrowseRowId,
                activeCatalogue.value,
                activeLang.value,
                needed,
                {
                    ...pickOptions,
                    typeFilter: typeFilter.value
                }
            );
            await rebuildGenreRails(
                filterCataloguePool(
                    poolState.value.browsePool,
                    activeCatalogue.value.id,
                    activeLang.value
                )
            );
        };

        const mapBatchToCurated = async (
            batch: MoovieCatalogItem[],
            fastPaint = false
        ): Promise<CuratedItem[]> => {
            if (!batch.length) return [];
            await fetchAnimeCatalogCacheByMoovieIds(batch.map((item) => item.id));

            let audioCache: Map<string, string[]> | undefined;
            let artworkUrls: Awaited<ReturnType<typeof fetchCatalogArtworkUrlsByIds>> | undefined;
            if (!fastPaint) {
                [audioCache, artworkUrls] = await Promise.all([
                    fetchCatalogAudioCacheByIds(batch.map((item) => item.id)),
                    fetchCatalogArtworkUrlsByIds(batch.map((item) => item.id))
                ]);
            }

            return batch.map((item) => {
                const meta = tmdbById.value.get(String(item.id));
                return toCuratedItemFast(
                    item,
                    meta?.genreIds || [],
                    languageMap.value,
                    audioCache,
                    enrichmentFor(item),
                    artworkUrls
                );
            });
        };

        const appendDisplayedBatch = async (
            size: number,
            opts: { fastPaint?: boolean; pickOptions?: EnsureBrowsePickOptions } = {}
        ) => {
            const loadKeyAtStart = currentLoadKey();
            const target = displayedCount.value + size;
            await ensurePickedCount(target, opts.pickOptions);

            if (currentLoadKey() !== loadKeyAtStart) return;

            const batch = pickedItems.value.slice(displayedCount.value, target);
            if (!batch.length) return;

            const startIndex = displayedCount.value === 0 ? 0 : results.value.length;
            const fast = await mapBatchToCurated(batch, opts.fastPaint);
            if (currentLoadKey() !== loadKeyAtStart) return;

            results.value =
                displayedCount.value === 0 ? fast : [...results.value, ...fast];
            displayedCount.value += batch.length;

            isLoading.value = false;
            isRefreshing.value = false;

            void upgradeBatchArtwork(batch, startIndex);
        };

        const saveBrowseSnapshot = () => {
            if (!results.value.length) return;
            writeNetflixBrowseCache(currentLoadKey(), {
                results: [...results.value],
                poolState: poolState.value as BrowsePoolState,
                displayedCount: displayedCount.value,
                genreRails: genreRails.value.map((rail) => ({
                    id: rail.id,
                    title: rail.title,
                    defaultType: rail.defaultType,
                    items: [...rail.items]
                })),
                languageMapEntries: [...languageMap.value.entries()],
                variantSnapshot: [...variantSnapshot.value]
            });
        };

        const applyBrowseSnapshot = (snapshot: ReturnType<typeof readNetflixBrowseCache>) => {
            if (!snapshot) return false;
            results.value = [...snapshot.results];
            poolState.value = snapshot.poolState;
            displayedCount.value = snapshot.displayedCount;
            genreRails.value = snapshot.genreRails as GenreRailDisplay[];
            languageMap.value = new Map(snapshot.languageMapEntries);
            variantSnapshot.value = [...snapshot.variantSnapshot];
            lastLoadKey.value = snapshot.loadKey;
            isLoading.value = false;
            isRefreshing.value = false;
            isLoadingMore.value = false;
            return true;
        };

        const hasBrowseData = () =>
            results.value.length > 0 ||
            poolState.value.browsePool.length > 0 ||
            poolState.value.pickedItems.length > 0;

        /** Restore in-memory route snapshot (instant nav between Home / Movies / TV). */
        const restoreBrowseCache = () => {
            if (!isBrowseRouteActive()) return false;

            const loadKey = currentLoadKey();
            const snapshot = readNetflixBrowseCache(loadKey);
            if (snapshot) {
                applyBrowseSnapshot(snapshot);
                nfDebug('browse:restore-snapshot', { key: loadKey });
                return true;
            }

            if (!hasBrowseData() || lastLoadKey.value !== loadKey) return false;
            isLoading.value = false;
            isRefreshing.value = false;
            isLoadingMore.value = false;
            nfDebug('browse:restore-live', { key: lastLoadKey.value });
            return true;
        };

        const loadAnimeBrowse = async () => {
            if (!isBrowseRouteActive()) return;
            if (restoreBrowseCache()) return;
            if (!validRoute.value) {
                router.replace({ name: 'NotFound' });
                return;
            }

            lastLoadKey.value = currentLoadKey();
            const cat = activeCatalogue.value;
            const lang = activeLang.value;
            const row = rowId.value;
            const generation = loadGeneration.value + 1;
            loadGeneration.value = generation;
            const isStale = () => loadGeneration.value !== generation;

            nfDebug('browse:anime:load:start', { catalogue: cat.id, language: lang.category });
            isLoading.value = true;
            results.value = [];
            animePage.value = 1;
            animeHasMore.value = true;
            genreRails.value = [];

            try {
                const [fast] = await Promise.all([
                    fetchAnimeBrowseBatchFast(1),
                    ensureVariantSnapshot()
                ]);
                if (isStale()) return;

                const cached = await applyAnimeCatalogCacheBatch(fast.media);
                if (isStale()) return;

                results.value = cached.items;
                animePage.value = fast.pageInfo.currentPage;
                animeHasMore.value = fast.pageInfo.hasNextPage;
                genreRails.value = buildAnimeGenreRails(cached.items);

                const meta = getNetflixRowMeta(row as NetflixBrowseRowId, cat, lang);
                updateSeo({
                    title: `${meta.title} · ${cat.label} — Netflix on Moovie`,
                    canonical: `https://moovie.fun/nf/browse/${cat.id}/${row}`,
                    image: cached.items[0]?.posterPath || 'https://moovie.fun/og-image.png'
                });

                nfDebug('browse:anime:load:ok', {
                    displayed: results.value.length,
                    page: animePage.value,
                    cacheHits: cached.items.length - cached.misses.length
                });

                void enrichAnimeBrowseResults(
                    animeMediaNeedingLiveResolve(cached),
                    lang,
                    generation,
                    0,
                    variantSnapshot.value
                );
            } catch (err) {
                nfDebugError('browse:anime:load:fail', { catalogue: cat.id, err });
            } finally {
                if (!isStale()) {
                    isLoading.value = false;
                }
            }
        };

        const enrichAnimeBrowseResults = async (
            misses: AnimeMedia[],
            lang: NetflixLanguageOption,
            generation: number,
            _startIndex: number,
            candidatePool: MoovieCatalogItem[] = []
        ) => {
            if (!misses.length) return;

            try {
                const resolved = await resolveAnimeCatalogMisses(
                    misses,
                    lang,
                    candidatePool
                );
                if (loadGeneration.value !== generation) return;

                const resolvedById = new Map(
                    resolved.map((item) => [item.anilistId, item])
                );
                results.value = results.value.map(
                    (item) => resolvedById.get(item.anilistId || 0) || item
                );
                genreRails.value = buildAnimeGenreRails(
                    results.value as NetflixAnimeBrowseItem[]
                );
            } catch (err) {
                nfDebugError('browse:anime:enrich:fail', { err });
            }
        };

        const loadMoreAnime = async () => {
            if (!animeHasMore.value || isLoadingMore.value) return;
            isLoadingMore.value = true;

            const generation = loadGeneration.value;
            const startIndex = results.value.length;

            try {
                const nextPage = animePage.value + 1;
                const fast = await fetchAnimeBrowseBatchFast(nextPage);
                const cached = await applyAnimeCatalogCacheBatch(fast.media);
                results.value = [...results.value, ...cached.items];
                animePage.value = fast.pageInfo.currentPage;
                animeHasMore.value = fast.pageInfo.hasNextPage;
                genreRails.value = buildAnimeGenreRails(
                    results.value as NetflixAnimeBrowseItem[]
                );

                void enrichAnimeBrowseResults(
                    animeMediaNeedingLiveResolve(cached),
                    activeLang.value,
                    generation,
                    startIndex,
                    variantSnapshot.value
                );
            } catch (err) {
                nfDebugError('browse:anime:load-more:fail', { err });
            } finally {
                isLoadingMore.value = false;
            }
        };

        const syncCatalogueFromRoute = () => {
            const id = catalogueId.value;
            if (NETFLIX_CATALOGUES.some((row) => row.id === id)) {
                setNetflixCatalogue(id);
            }
        };

        const loadBrowse = async () => {
            if (!isBrowseRouteActive()) return;
            syncCatalogueFromRoute();
            if (restoreBrowseCache()) return;
            if (!validRoute.value) {
                router.replace({ name: 'NotFound' });
                return;
            }

            if (catalogueId.value === 'korean' && rowId.value === 'anime') {
                router.replace(netflixBrowsePath('hollywood', 'anime'));
                return;
            }

            if (catalogueId.value === 'korean' && rowId.value === 'blockbuster-movies') {
                router.replace(netflixBrowsePath('korean', 'korean-movies'));
                return;
            }

            if (isAnimeBrowse.value) {
                await loadAnimeBrowse();
                return;
            }

            lastLoadKey.value = currentLoadKey();
            const cat = activeCatalogue.value;
            const lang = activeLang.value;
            const row = rowId.value;
            const generation = loadGeneration.value + 1;
            loadGeneration.value = generation;
            const isStale = () => loadGeneration.value !== generation;

            nfDebug('browse:load:start', { catalogue: cat.id, row, language: lang.category });

            results.value = [];
            displayedCount.value = 0;
            isLoading.value = true;
            isRefreshing.value = false;

            poolState.value = createBrowsePoolState(
                row as NetflixBrowseRowId,
                cat.id
            );
            variantSnapshot.value = [];
            languageMap.value = new Map();
            genreRailPlans.value = [];
            genreRails.value = [];

            void loadNetflixAvailabilityIndex();

            void ensureVariantSnapshot()
                .then(() => refreshLanguageMap())
                .catch((err) => nfDebugError('browse:variant-snapshot:fail', { err }));

            const fastPick = {
                initialPageCap: isTvEditorialBrowseRow(row as NetflixBrowseRowId)
                    ? 8
                    : BROWSE_FAST_INITIAL_PAGES,
                deferEnrichment: true,
                skipTmdbEnrich: true
            };

            try {
                await appendDisplayedBatch(BROWSE_FAST_BATCH, {
                    fastPaint: true,
                    pickOptions: fastPick
                });
                if (isStale()) return;

                lastLoadKey.value = currentLoadKey();
                saveBrowseSnapshot();

                if (isGenreBrowse.value) {
                    void upgradeGenreRailArtwork();
                }

                const meta = getNetflixRowMeta(row as NetflixBrowseRowId, cat, lang);
                updateSeo({
                    title: `${meta.title} · ${cat.label} — Netflix on Moovie`,
                    canonical: `https://moovie.fun/nf/browse/${cat.id}/${row}`,
                    image: results.value[0]?.posterPath || 'https://moovie.fun/og-image.png'
                });

                nfDebug('browse:load:ok', {
                    catalogue: cat.id,
                    row,
                    displayed: results.value.length,
                    picked: poolState.value.pickedItems.length,
                    pool: poolState.value.browsePool.length,
                    pages: poolState.value.apiPageCursor
                });

                void (async () => {
                    try {
                        if (isStale()) return;
                        await ensurePickedCount(BROWSE_PAGE_SIZE);
                        if (isStale()) return;
                        if (displayedCount.value < BROWSE_PAGE_SIZE) {
                            await appendDisplayedBatch(BROWSE_PAGE_SIZE - displayedCount.value);
                        }
                        if (isStale()) return;
                        saveBrowseSnapshot();
                    } catch (err) {
                        nfDebugError('browse:load:deep:fail', { catalogue: cat.id, row, err });
                    }
                })();
            } catch (err) {
                nfDebugError('browse:load:fail', { catalogue: cat.id, row, err });
            } finally {
                if (!isStale()) {
                    isLoading.value = false;
                    isRefreshing.value = false;
                }
            }
        };

        const loadMore = async () => {
            if (!hasMore.value || isLoadingMore.value) return;
            if (isAnimeBrowse.value) {
                await loadMoreAnime();
                return;
            }
            isLoadingMore.value = true;
            try {
                await appendDisplayedBatch(BROWSE_PAGE_SIZE);
            } catch (err) {
                nfDebugError('browse:load-more:fail', { err });
            } finally {
                isLoadingMore.value = false;
            }
        };

        onMounted(() => {
            lastLoadKey.value = currentLoadKey();
            loadBrowse();
        });

        onActivated(() => {
            if (restoreBrowseCache()) return;
            if (!isBrowseRouteActive()) return;
            lastLoadKey.value = currentLoadKey();
            loadBrowse();
        });

        watch(
            () => [route.params.catalogue, route.params.row, language.value, route.query.type],
            () => {
                loadGeneration.value += 1;
                if (restoreBrowseCache()) return;
                if (!isBrowseRouteActive()) return;
                lastLoadKey.value = currentLoadKey();
                loadBrowse();
            }
        );

        return {
            BROWSE_PAGE_SIZE,
            BROWSE_FAST_BATCH,
            isLoading,
            isRefreshing,
            isLoadingMore,
            results,
            rowMeta,
            activeLang,
            activeCatalogue,
            hasMore,
            loadMore,
            isGenreBrowse,
            genreHeroFeatured,
            genreHeroPlayRoute,
            genreHeroDetailRoute,
            genreHeroPartyHref,
            genreHeroBackdrop,
            genreHeroStyle,
            genreRails
        };
    }
});
</script>

<style lang="scss" scoped>
.netflix-browse {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &--genre {
        .discover__main {
            padding-top: 0;
        }
    }
}

.nf-genre-hero {
    position: relative;
    min-height: clamp(220px, 32vw, 360px);
    background:
        linear-gradient(135deg, var(--ink-750, #1a1a1a) 0%, var(--ink-800) 55%, var(--ink-900) 100%);
    background-size: cover;
    background-position: center top;

    &--has-backdrop {
        min-height: clamp(260px, 38vw, 420px);
    }

    &__scrim {
        min-height: inherit;
        background: linear-gradient(
            180deg,
            rgba(10, 10, 10, 0.35) 0%,
            rgba(10, 10, 10, 0.72) 55%,
            var(--ink-900) 100%
        );
    }

    &__inner {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        min-height: inherit;
        padding-top: clamp(var(--s-8), 10vw, var(--s-10));
        padding-bottom: clamp(var(--s-5), 5vw, var(--s-7));
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(2.25rem, 5vw, 3.5rem);
        letter-spacing: -0.02em;
        margin: 0 0 var(--s-3);
        color: var(--bone-50);
    }

    &__tagline {
        margin: 0;
        max-width: 62ch;
        color: var(--bone-200);
        line-height: 1.55;
        font-size: clamp(0.95rem, 1.6vw, 1.1rem);
    }

    &__actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-3);
        margin-top: clamp(var(--s-4), 4vw, var(--s-5));
    }
}

.nf-your-next-watch {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: clamp(1.35rem, 2.5vw, 1.75rem);
    letter-spacing: -0.01em;
    margin: 0 0 clamp(var(--s-5), 5vw, var(--s-6));
    color: var(--bone-50);
}

.nf-genre-rail {
    margin-top: clamp(var(--s-8), 8vw, var(--s-10));
}

.discover {
    &__main {
        padding-top: clamp(var(--s-6), 6vw, var(--s-8));
        padding-bottom: clamp(var(--s-8), 8vw, var(--s-10));
    }

    &__body {
        display: block;
    }

    &__refresh-bar {
        height: 2px;
        margin: 0 0 var(--s-4);
        border-radius: var(--r-pill);
        background: linear-gradient(
            90deg,
            transparent 0%,
            var(--ember) 35%,
            var(--violet) 65%,
            transparent 100%
        );
        background-size: 200% 100%;
        animation: discover-refresh 1.1s linear infinite;
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

@keyframes discover-refresh {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}
</style>