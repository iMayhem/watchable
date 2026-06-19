<template>
    <div class="nf-detail">
        <SiteHeader />

        <main id="main" class="nf-detail__main" role="main">
            <section class="nf-detail__snap-slide">
                <TitleMasthead
                    :id="meta ? meta.id : ''"
                    party-source="netflix"
                    :type="supportsEpisodes ? 'tv' : mediaType"
                    :title="displayTitle"
                    :tagline="languageLine"
                    :eyebrow="supportsEpisodes ? 'Series' : mediaType === 'tv' ? 'Series' : 'Film'"
                    :backdrop-path="artwork.backdropPath"
                    :poster-path="artwork.posterPath"
                    :rating="rating"
                    :release-date="meta ? meta.release_date : ''"
                    :genres="languageTags"
                    :genre-ids="[]"
                    :play-route="playRoute"
                    :show-trailer="false"
                    strict-backdrop
                    :loading="mastheadLoading"
                />
            </section>

            <section
                v-if="supportsEpisodes && meta"
                class="nf-detail__section nf-detail__episodes container-lm"
                aria-label="Episodes"
            >
                <NetflixEpisodePicker
                    :seasons="episodeSeasons"
                    :episodes="episodeList"
                    :current-season="selectedSeason"
                    :current-episode="selectedEpisode"
                    :loading="episodesLoading"
                    @season-change="onEpisodeSeasonChange"
                    @select="onEpisodeSelect"
                    @previous="onEpisodePrevious"
                    @next="onEpisodeNext"
                />
            </section>

            <section v-if="similarItems.length" class="nf-detail__section container-lm">
                <CuratedRail
                    :items="similarItems"
                    title="More like this"
                    eyebrow="Keep watching"
                    catalog="netflix"
                />
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
import TitleMasthead from '../components/detail/TitleMasthead.vue';
import CuratedRail, { type CuratedItem } from '../components/rails/CuratedRail.vue';
import NetflixEpisodePicker from '../components/player/NetflixEpisodePicker.vue';
import {
    browseMoovieCatalog,
    fetchMoovieCatalogMetaResolved,
    catalogRating,
    inferCatalogMediaType,
    parseCatalogTitle,
    type MoovieCatalogItem
} from '../composables/useMoovieCatalog';
import {
    ANIME_CATALOG_MIN_MATCH_SCORE,
    bestTitleMatchScore,
    buildCatalogLanguageMap,
    catalogStreamPath,
    catalogStreamTarget,
    findCatalogueLanguageVariants,
    resolveVerifiedLanguageTags
} from '../composables/useNetflixCatalogLookup';
import { fetchAnimeMediaById } from '../composables/useAniList';
import { useNetflixCatalogEpisodes } from '../composables/useNetflixCatalogEpisodes';
import {
    getNetflixLanguage,
    getLanguageOption,
    itemMatchesLanguage
} from '../composables/useNetflixLanguage';
import { useSeo } from '../composables/useSeo';
import {
    getCachedArtworkForCatalogItem,
    mapWithConcurrency,
    pickCatalogArtwork,
    resolveArtworkForCatalogItem
} from '../composables/useTmdbArtwork';
import {
    resolveInstantCatalogArtwork,
    toCuratedItemFast,
    toCuratedItemUpgraded
} from '../composables/useNetflixArtwork';
import { fetchCatalogArtworkUrlsByIds } from '../composables/usePosterCache';
import { prefetchArtworkImages } from '../utils/useWebImage';
import { fetchCatalogAudioCacheByIds } from '../composables/useCatalogAudioCache';
import {
    fetchAnimeCatalogCacheByIds,
    fetchAnimeCatalogCacheByMoovieIds,
    netflixAnimeDetailPath
} from '../composables/useAnimeCatalogCache';
import { fetchEnrichmentByCatalogIds } from '../composables/useCatalogEnrichmentCache';
import {
    prefetchMoovieResolve,
    warmMooviePlayerAssets
} from '../composables/useMooviePlayer';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';

export default defineComponent({
    name: 'NetflixDetail',
    components: { SiteHeader, SiteFooter, TitleMasthead, CuratedRail, NetflixEpisodePicker },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const loading = ref(true);
        const meta = ref<any>(null);
        const similarItems = ref<CuratedItem[]>([]);
        const artworkReady = ref(false);
        const artwork = ref<{ posterPath: string | null; backdropPath: string | null }>({
            posterPath: null,
            backdropPath: null
        });
        let detailLoadSeq = 0;
        const selectedSeason = ref(1);
        const selectedEpisode = ref(1);


        const {
            seasons: episodeSeasons,
            episodes: episodeList,
            loading: episodesLoading,
            supportsEpisodes,
            load: loadEpisodes,
            setSeason: setPickerSeason
        } = useNetflixCatalogEpisodes();

        const mediaType = computed((): 'movie' | 'tv' => {
            if (meta.value) {
                return inferCatalogMediaType({
                    title: meta.value.title,
                    media_type: meta.value.media_type
                });
            }
            return route.params.type === 'tv' ? 'tv' : 'movie';
        });

        const parsed = computed(() =>
            parseCatalogTitle(meta.value?.title || '')
        );

        const displayTitle = computed(() => parsed.value.displayTitle || meta.value?.title || '');
        const verifiedLanguageTags = ref<string[]>([]);
        const languageTags = computed(() => verifiedLanguageTags.value);
        const languageLine = computed(() => languageTags.value.join(' · '));
        const rating = computed(() => catalogRating(meta.value?.vote_average));



        const playRoute = computed(() => {
            if (!meta.value) {
                return `/stream/nf/${mediaType.value}/${route.params.id}`;
            }
            const id = String(meta.value.id || route.params.id);
            return catalogStreamTarget(
                {
                    id,
                    title: meta.value.title,
                    media_type: meta.value.media_type
                },
                {
                    supportsEpisodes: supportsEpisodes.value,
                    season: selectedSeason.value,
                    episode: selectedEpisode.value
                }
            ).path;
        });

        const syncRouteMediaType = () => {
            const id = routeId();
            if (!meta.value || String(meta.value.id) !== id) return;
            const canonical = supportsEpisodes.value ? 'tv' : mediaType.value;
            if (route.params.type === canonical) return;
            nfDebug('detail:canonical-type', {
                id,
                routeType: route.params.type,
                canonical
            });
            router.replace(`/nf/${canonical}/${id}`);
        };

        const routeId = () => String(route.params.id || '');

        const isCurrentDetailLoad = (seq: number, id = routeId()) =>
            seq === detailLoadSeq && routeId() === id;

        const isHydratedForRoute = () => {
            const id = routeId();
            return Boolean(
                meta.value &&
                String(meta.value.id) === id &&
                artworkReady.value
            );
        };

        const mastheadLoading = computed(() => !meta.value);

        const resetDetailState = () => {
            detailLoadSeq += 1;
            meta.value = null;
            similarItems.value = [];
            verifiedLanguageTags.value = [];
            artwork.value = { posterPath: null, backdropPath: null };
            artworkReady.value = false;
            loading.value = true;
            return detailLoadSeq;
        };

        const applyInstantArtwork = (
            item: MoovieCatalogItem,
            trustedTmdbId?: number | null,
            artworkUrls?: Awaited<ReturnType<typeof fetchCatalogArtworkUrlsByIds>>
        ) => {
            const cached = getCachedArtworkForCatalogItem(item, { trustedTmdbId });
            const cachedArt = cached ? pickCatalogArtwork(cached) : null;
            const instant = resolveInstantCatalogArtwork(
                item,
                cachedArt || { posterPath: null, backdropPath: null },
                artworkUrls
            );
            artwork.value = instant;
            artworkReady.value = Boolean(instant.backdropPath || instant.posterPath);
            if (instant.backdropPath) {
                prefetchArtworkImages([instant.backdropPath], 'hero', 1);
            }
            return artworkReady.value;
        };

        const loadVerifiedLanguages = async (item: MoovieCatalogItem) => {
            const audioCache = await fetchCatalogAudioCacheByIds([item.id]);
            const cached = audioCache.get(String(item.id));
            if (cached?.length) {
                verifiedLanguageTags.value = cached;
                return;
            }

            const parsedTitle = parseCatalogTitle(item.title || '');
            if (!parsedTitle.displayTitle) {
                verifiedLanguageTags.value = [];
                return;
            }

            const variants = await findCatalogueLanguageVariants(parsedTitle.displayTitle, {
                anchor: item
            });
            verifiedLanguageTags.value = resolveVerifiedLanguageTags(item, variants);
        };

        const applySeo = (id: string) => {
            const seoImage = artwork.value.backdropPath;
            updateSeo({
                title: `${displayTitle.value} — Netflix on Moovie`,
                canonical: `https://moovie.fun/nf/${mediaType.value}/${id}`,
                image: seoImage?.startsWith('http')
                    ? seoImage
                    : seoImage
                      ? `https://moovie.fun/api/img?path=${encodeURIComponent(seoImage)}`
                      : 'https://moovie.fun/og-image.png'
            });
        };

        const loadSimilar = async (id: string) => {
            const { language } = getNetflixLanguage();
            const lang = getLanguageOption(language.value);
            const browse = await browseMoovieCatalog(lang.category, 0);
            const browseResults = browse.results || [];
            const similarPool = browseResults
                .filter((item) => item.id !== id && itemMatchesLanguage(item, lang))
                .slice(0, 10);
            if (!similarPool.length) return;

            const languageMap = buildCatalogLanguageMap(browseResults);
            const [audioCache, enrichmentMap, artworkUrls] = await Promise.all([
                fetchCatalogAudioCacheByIds(similarPool.map((item) => item.id)),
                fetchEnrichmentByCatalogIds(similarPool.map((item) => item.id)),
                fetchCatalogArtworkUrlsByIds(similarPool.map((item) => item.id))
            ]);

            similarItems.value = similarPool.map((item) =>
                toCuratedItemFast(
                    item,
                    enrichmentMap.get(String(item.id))?.tmdb_genre_ids || [],
                    languageMap,
                    audioCache,
                    enrichmentMap.get(String(item.id)),
                    artworkUrls
                )
            );

            void mapWithConcurrency(
                similarPool,
                (item) =>
                    toCuratedItemUpgraded(
                        item,
                        enrichmentMap.get(String(item.id))?.tmdb_genre_ids || [],
                        languageMap,
                        audioCache,
                        enrichmentMap.get(String(item.id))
                    ),
                8
            ).then((upgraded) => {
                if (routeId() !== id) return;
                similarItems.value = upgraded;
            });
        };

        const loadEpisodeCatalog = async (item: MoovieCatalogItem) => {
            const parsedTitle = parseCatalogTitle(item.title || '');
            selectedSeason.value = parsedTitle.season || 1;
            selectedEpisode.value = 1;

            await loadEpisodes(
                {
                    id: String(item.id),
                    title: item.title || '',
                    release_date: item.release_date,
                    media_type: item.media_type
                },
                { season: selectedSeason.value }
            );
        };

        const onEpisodeSeasonChange = async (season: number) => {
            selectedSeason.value = season;
            selectedEpisode.value = 1;
            await setPickerSeason(season);
        };

        const onEpisodeSelect = (episode: number) => {
            selectedEpisode.value = episode;
            if (!meta.value) return;
            const path = catalogStreamPath(
                String(meta.value.id || route.params.id),
                selectedSeason.value,
                episode
            );
            router.push(path);
        };

        const onEpisodePrevious = () => {
            if (selectedEpisode.value > 1) {
                onEpisodeSelect(selectedEpisode.value - 1);
            }
        };

        const onEpisodeNext = () => {
            if (!episodeList.value.length) return;
            const max = Math.max(...episodeList.value.map((ep) => ep.episode_number));
            if (selectedEpisode.value < max) {
                onEpisodeSelect(selectedEpisode.value + 1);
            }
        };

        const resolveAnimeDetailRedirect = async (
            id: string,
            meta?: { title?: string } | null
        ): Promise<string | null> => {
            const numericId = Number(id);
            if (Number.isFinite(numericId)) {
                const byAnilist = await fetchAnimeCatalogCacheByIds([numericId]);
                if (byAnilist.has(numericId)) {
                    return netflixAnimeDetailPath(numericId);
                }
            }

            const byMoovie = await fetchAnimeCatalogCacheByMoovieIds([id]);
            const mapped = byMoovie.get(id);
            if (mapped) {
                return netflixAnimeDetailPath(mapped.anilist_id);
            }

            if (!meta?.title || !Number.isFinite(numericId)) {
                return null;
            }

            try {
                const response = await fetchAnimeMediaById(numericId);
                const media = response?.data?.Media as
                    | {
                          title?: {
                              english?: string | null;
                              romaji?: string | null;
                              native?: string | null;
                          };
                      }
                    | undefined;
                if (!media?.title) return null;

                const anilistTitles = [
                    media.title.english,
                    media.title.romaji,
                    media.title.native
                ].filter(Boolean) as string[];
                const catalogDisplay =
                    parseCatalogTitle(meta.title).displayTitle || meta.title;
                const score = bestTitleMatchScore(anilistTitles, catalogDisplay);
                if (score < ANIME_CATALOG_MIN_MATCH_SCORE) {
                    return netflixAnimeDetailPath(numericId);
                }
            } catch {
                return null;
            }

            return null;
        };

        const loadDetail = async (opts: { background?: boolean; seq?: number } = {}) => {
            const id = routeId();
            const seq = opts.seq ?? detailLoadSeq;
            const background = opts.background ?? isHydratedForRoute();
            nfDebug('detail:load:start', { id, type: mediaType.value, background, seq });

            if (!isCurrentDetailLoad(seq, id)) return;

            if (!background) {
                const animePath = await resolveAnimeDetailRedirect(id);
                if (!isCurrentDetailLoad(seq, id)) return;
                if (animePath && route.path !== animePath) {
                    nfDebug('detail:redirect-anime', { id, animePath, source: 'cache' });
                    router.replace(animePath);
                    return;
                }
            }

            try {
                const metaPromise =
                    background && meta.value
                        ? Promise.resolve(meta.value)
                        : fetchMoovieCatalogMetaResolved(mediaType.value, id);
                const [resolvedMeta, enrichmentMap, artworkUrls] = await Promise.all([
                    metaPromise,
                    fetchEnrichmentByCatalogIds([id]),
                    fetchCatalogArtworkUrlsByIds([id])
                ]);
                if (!isCurrentDetailLoad(seq, id)) return;

                meta.value = resolvedMeta;

                if (!background) {
                    const animePath = await resolveAnimeDetailRedirect(id, meta.value);
                    if (!isCurrentDetailLoad(seq, id)) return;
                    if (animePath && route.path !== animePath) {
                        nfDebug('detail:redirect-anime', {
                            id,
                            animePath,
                            source: 'collision'
                        });
                        router.replace(animePath);
                        return;
                    }
                }

                const enrichment = enrichmentMap.get(String(meta.value.id));
                const resolvedType = inferCatalogMediaType({
                    title: meta.value.title,
                    media_type: meta.value.media_type
                });
                const trustedTmdbId = enrichment?.tmdb_id ?? null;

                applyInstantArtwork(
                    {
                        id: String(meta.value.id),
                        title: meta.value.title || '',
                        release_date: meta.value.release_date,
                        media_type: resolvedType,
                        vote_average: meta.value.vote_average ?? 0,
                        backdrop_path: meta.value.backdrop_path || null
                    },
                    trustedTmdbId,
                    artworkUrls
                );

                const [, art] = await Promise.all([
                    Promise.all([
                        loadVerifiedLanguages(meta.value),
                        loadEpisodeCatalog(meta.value)
                    ]),
                    resolveArtworkForCatalogItem({
                        id: String(meta.value.id),
                        title: meta.value?.title || '',
                        release_date: meta.value?.release_date,
                        media_type: resolvedType,
                        tmdbId: trustedTmdbId ?? undefined
                    }).then((resolved) => pickCatalogArtwork(resolved))
                ]);
                if (!isCurrentDetailLoad(seq, id)) return;

                artwork.value = {
                    posterPath: art.posterPath || artwork.value.posterPath,
                    backdropPath: art.backdropPath || artwork.value.backdropPath
                };
                artworkReady.value = Boolean(
                    artwork.value.backdropPath || artwork.value.posterPath
                );
                void warmMooviePlayerAssets();
                prefetchMoovieResolve({
                    type: supportsEpisodes.value ? 'tv' : mediaType.value,
                    id: String(meta.value.id),
                    season: supportsEpisodes.value ? 1 : 0,
                    episode: supportsEpisodes.value ? 1 : 0
                });
                applySeo(id);
                syncRouteMediaType();

                if (!background || !similarItems.value.length) {
                    void loadSimilar(id);
                }

                nfDebug('detail:load:ok', {
                    id,
                    title: displayTitle.value,
                    background,
                    seq
                });
            } catch (err) {
                nfDebugError('detail:load:fail', { id, type: mediaType.value, err });
            } finally {
                if (isCurrentDetailLoad(seq, id)) {
                    loading.value = false;
                }
            }
        };

        onMounted(() => {
            nfDebug('detail:mount', { id: route.params.id, type: mediaType.value });
            const seq = resetDetailState();
            void loadDetail({ seq });
        });

        onActivated(() => {
            if (!isHydratedForRoute()) return;
            nfDebug('detail:reactivate', { id: routeId() });
            loading.value = false;
            applySeo(routeId());
        });

        watch(() => route.params.id, (newId, oldId) => {
            if (!newId || newId === oldId) return;
            nfDebug('detail:route-change', { id: newId });
            const seq = resetDetailState();
            void loadDetail({ seq });
        });

        return {
            loading,
            mastheadLoading,
            meta,
            mediaType,
            displayTitle,

            languageLine,
            languageTags,
            rating,
            playRoute,
            similarItems,
            artwork,
            episodeSeasons,
            episodeList,
            episodesLoading,
            supportsEpisodes,
            selectedSeason,
            selectedEpisode,
            onEpisodeSeasonChange,
            onEpisodeSelect,
            onEpisodePrevious,
            onEpisodeNext
        };
    }
});
</script>

<style lang="scss" scoped>
.nf-detail {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__section {
        margin: var(--s-8) auto var(--s-10);
    }

    &__episodes {
        margin-top: var(--s-6);
        margin-bottom: var(--s-8);
    }
}
</style>