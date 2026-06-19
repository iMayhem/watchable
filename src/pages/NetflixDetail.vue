<template>
    <div class="nf-detail">
        <SiteHeader />

        <main id="main" class="nf-detail__main" role="main">
            <section class="nf-detail__snap-slide">
                <TitleMasthead
                    :id="meta ? meta.id : ''"
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
                    :loading="loading && !meta"
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
    resolveLanguageTagsForItem,
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
    mapWithConcurrency,
    pickCatalogArtwork,
    resolveArtworkForCatalogItem
} from '../composables/useTmdbArtwork';
import { fetchCatalogAudioCacheByIds } from '../composables/useCatalogAudioCache';
import {
    fetchAnimeCatalogCacheByIds,
    fetchAnimeCatalogCacheByMoovieIds,
    netflixAnimeDetailPath
} from '../composables/useAnimeCatalogCache';
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
        const artwork = ref<{ posterPath: string | null; backdropPath: string | null }>({
            posterPath: null,
            backdropPath: null
        });
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

        const isHydratedForRoute = () => {
            const id = routeId();
            return Boolean(meta.value && String(meta.value.id) === id);
        };

        const toCurated = async (
            item: MoovieCatalogItem,
            languageMap?: Map<string, string[]>,
            audioCache?: Map<string, string[]>
        ): Promise<CuratedItem> => {
            const p = parseCatalogTitle(item.title || '');
            const art = pickCatalogArtwork(await resolveArtworkForCatalogItem(item));
            return {
                id: item.id,
                title: p.displayTitle || item.title,
                originalTitle: p.languages.join(' · '),
                catalogTitle: item.title,
                posterPath: art.posterPath,
                backdropPath: art.backdropPath,
                rating: catalogRating(item.vote_average),
                releaseDate: item.release_date || '',
                type: inferCatalogMediaType(item),
                languageTags: resolveLanguageTagsForItem(item, languageMap, audioCache)
            };
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
            const seoImage = artwork.value.backdropPath || artwork.value.posterPath;
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
            const languageMap = buildCatalogLanguageMap(browseResults);
            const audioCache = await fetchCatalogAudioCacheByIds(similarPool.map((item) => item.id));
            similarItems.value = await mapWithConcurrency(
                similarPool,
                (item) => toCurated(item, languageMap, audioCache),
                4
            );
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

        const loadDetail = async (opts: { background?: boolean } = {}) => {
            const id = routeId();
            const background = opts.background ?? isHydratedForRoute();
            nfDebug('detail:load:start', { id, type: mediaType.value, background });

            if (!background) {
                const animePath = await resolveAnimeDetailRedirect(id);
                if (animePath && route.path !== animePath) {
                    nfDebug('detail:redirect-anime', { id, animePath, source: 'cache' });
                    router.replace(animePath);
                    return;
                }
            }

            if (!background) {
                loading.value = true;
                meta.value = null;
                similarItems.value = [];
                verifiedLanguageTags.value = [];
                artwork.value = { posterPath: null, backdropPath: null };
            }

            try {
                const metaPromise = background && meta.value
                    ? Promise.resolve(meta.value)
                    : fetchMoovieCatalogMetaResolved(mediaType.value, id);

                meta.value = await metaPromise;

                if (!background) {
                    const animePath = await resolveAnimeDetailRedirect(id, meta.value);
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

                const art = pickCatalogArtwork(
                    await resolveArtworkForCatalogItem({
                        id: String(meta.value.id),
                        title: meta.value?.title || '',
                        release_date: meta.value?.release_date,
                        media_type: mediaType.value,
                        backdrop_path: meta.value?.backdrop_path || null
                    })
                );
                artwork.value = {
                    posterPath: art.posterPath,
                    backdropPath: art.backdropPath
                };

                await loadVerifiedLanguages(meta.value);
                await loadEpisodeCatalog(meta.value);
                applySeo(id);
                syncRouteMediaType();

                if (!background || !similarItems.value.length) {
                    void loadSimilar(id);
                }

                nfDebug('detail:load:ok', {
                    id,
                    title: displayTitle.value,
                    background
                });
            } catch (err) {
                nfDebugError('detail:load:fail', { id, type: mediaType.value, err });
            } finally {
                loading.value = false;
            }
        };

        onMounted(() => {
            nfDebug('detail:mount', { id: route.params.id, type: mediaType.value });
            loadDetail();
        });

        onActivated(() => {
            if (isHydratedForRoute()) {
                nfDebug('detail:reactivate', { id: routeId() });
                loading.value = false;
                applySeo(routeId());
                return;
            }
            loadDetail();
        });

        watch(() => route.params.id, (newId, oldId) => {
            if (!newId || newId === oldId) return;
            nfDebug('detail:route-change', { id: newId });
            meta.value = null;
            loading.value = true;
            loadDetail();
        });

        return {
            loading,
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