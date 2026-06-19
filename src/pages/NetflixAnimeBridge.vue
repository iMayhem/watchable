<template>
    <div class="nf-anime-detail">
        <SiteHeader />

        <main id="main" class="nf-anime-detail__main" role="main">
            <section class="nf-anime-detail__snap-slide">
                <TitleMasthead
                    :id="anilistId"
                    type="anime"
                    :title="displayTitle"
                    :tagline="tagline"
                    eyebrow="Anime"
                    :backdrop-path="backdropPath"
                    :poster-path="posterPath"
                    :rating="rating"
                    :release-date="releaseYear"
                    :genres="mastheadGenres"
                    :audio-tags="languageTags"
                    :genre-ids="[]"
                    :play-route="playRoute"
                    play-label="Play"
                    :show-trailer="false"
                    :loading="loading"
                />
            </section>

            <section
                v-if="supportsEpisodes && catalogMatch"
                class="nf-anime-detail__section nf-anime-detail__episodes container-lm"
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

            <section
                v-if="!resolvingCatalog && !catalogMatch"
                class="nf-anime-detail__notice container-lm"
            >
                <p>This anime is not in the catalogue yet. Browse other titles below.</p>
            </section>

            <section v-if="similarItems.length" class="nf-anime-detail__section container-lm">
                <CuratedRail
                    :items="similarItems"
                    title="More anime"
                    eyebrow="Keep watching"
                    catalog="netflix"
                />
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
import TitleMasthead from '../components/detail/TitleMasthead.vue';
import CuratedRail, { type CuratedItem } from '../components/rails/CuratedRail.vue';
import NetflixEpisodePicker from '../components/player/NetflixEpisodePicker.vue';
import { useNetflixCatalogEpisodes } from '../composables/useNetflixCatalogEpisodes';
import { fetchAnimeBrowseMedia, fetchAnimeMediaById, type AnimeMedia } from '../composables/useAniList';
import { resolveMoovieCatalogForAnilist } from '../composables/useNetflixAnimeResolve';
import { animeMediaToCuratedItem } from '../composables/useNetflixAnimeBrowse';
import {
    catalogStreamPath,
    catalogStreamTarget
} from '../composables/useNetflixCatalogLookup';
import { getNetflixLanguage, getLanguageOption } from '../composables/useNetflixLanguage';
import { useSeo } from '../composables/useSeo';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';
import type { MoovieCatalogItem } from '../composables/useMoovieCatalog';

export default defineComponent({
    name: 'NetflixAnimeDetail',
    components: { SiteHeader, SiteFooter, TitleMasthead, CuratedRail, NetflixEpisodePicker },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const { language } = getNetflixLanguage();

        const loading = ref(true);
        const resolvingCatalog = ref(true);
        const anime = ref<AnimeMedia | null>(null);
        const catalogMatch = ref<MoovieCatalogItem | null>(null);
        const languageTags = ref<string[]>([]);
        const similarItems = ref<CuratedItem[]>([]);
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

        const anilistId = computed(() => Number(route.params.id));

        const displayTitle = computed(() => {
            if (!anime.value) return '';
            return (
                anime.value.title.english ||
                anime.value.title.romaji ||
                anime.value.title.native
            );
        });

        const tagline = computed(() => {
            if (!anime.value) return '';
            const native = anime.value.title.native;
            const romaji = anime.value.title.romaji;
            if (native && native !== displayTitle.value) return native;
            if (romaji && romaji !== displayTitle.value) return romaji;
            return '';
        });

        const posterPath = computed(
            () =>
                anime.value?.coverImage.extraLarge ||
                anime.value?.coverImage.large ||
                anime.value?.coverImage.medium ||
                null
        );

        const backdropPath = computed(
            () =>
                anime.value?.bannerImage ||
                anime.value?.coverImage.extraLarge ||
                anime.value?.coverImage.large ||
                null
        );

        const rating = computed(() =>
            anime.value?.averageScore ? anime.value.averageScore / 10 : 0
        );

        const releaseYear = computed(() =>
            anime.value?.seasonYear ? String(anime.value.seasonYear) : ''
        );

        const mastheadGenres = computed(() => anime.value?.genres || []);

        const playRoute = computed(() => {
            if (!catalogMatch.value) return '';
            return catalogStreamTarget(
                {
                    id: catalogMatch.value.id,
                    title: catalogMatch.value.title,
                    media_type: catalogMatch.value.media_type
                },
                {
                    supportsEpisodes: supportsEpisodes.value,
                    season: selectedSeason.value,
                    episode: selectedEpisode.value
                }
            ).path;
        });

        const loadEpisodeCatalog = async (item: MoovieCatalogItem) => {
            selectedSeason.value = 1;
            selectedEpisode.value = 1;
            const episodeHint =
                anime.value?.episodes && anime.value.episodes > 1
                    ? anime.value.episodes
                    : undefined;

            await loadEpisodes(
                {
                    id: String(item.id),
                    title: item.title || '',
                    release_date: item.release_date,
                    media_type: item.media_type
                },
                { season: 1, episodeCountHint: episodeHint }
            );
        };

        const onEpisodeSeasonChange = async (season: number) => {
            selectedSeason.value = season;
            selectedEpisode.value = 1;
            await setPickerSeason(season);
        };

        const onEpisodeSelect = (episode: number) => {
            selectedEpisode.value = episode;
            if (!catalogMatch.value) return;
            router.push(
                catalogStreamPath(
                    String(catalogMatch.value.id),
                    selectedSeason.value,
                    episode
                )
            );
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

        const applySeo = () => {
            const image = backdropPath.value || posterPath.value;
            updateSeo({
                title: `${displayTitle.value} — Anime on Moovie`,
                canonical: `https://moovie.fun/nf/anime/${anilistId.value}`,
                image: image || 'https://moovie.fun/og-image.png'
            });
        };

        const loadSimilar = async (currentId: number) => {
            try {
                const response = await fetchAnimeBrowseMedia({ page: 1, perPage: 24 });
                const media = (response.data.Page.media || []).filter(
                    (entry) => entry.id !== currentId
                );
                similarItems.value = media
                    .slice(0, 12)
                    .map((entry) => animeMediaToCuratedItem(entry));
            } catch (err) {
                nfDebugError('anime-detail:similar:fail', { err });
            }
        };

        const applyCatalogResolve = async (
            resolved: Awaited<ReturnType<typeof resolveMoovieCatalogForAnilist>>
        ) => {
            catalogMatch.value = resolved.item;
            languageTags.value = resolved.languageTags;

            if (resolved.item) {
                await loadEpisodeCatalog(resolved.item);
            } else {
                supportsEpisodes.value = false;
            }

            if (route.query.play === '1' && resolved.item) {
                router.replace(
                    catalogStreamTarget(
                        {
                            id: resolved.item.id,
                            title: resolved.item.title,
                            media_type: resolved.item.media_type
                        },
                        { supportsEpisodes: supportsEpisodes.value }
                    ).path
                );
            }
        };

        const resolveCatalog = async (id: number) => {
            resolvingCatalog.value = true;
            catalogMatch.value = null;
            languageTags.value = [];

            try {
                const lang = getLanguageOption(language.value);
                const resolved = await resolveMoovieCatalogForAnilist(id, lang);
                await applyCatalogResolve(resolved);
            } catch (err) {
                nfDebugError('anime-detail:catalog:fail', { id, err });
            } finally {
                resolvingCatalog.value = false;
            }
        };

        const loadAnime = async () => {
            const id = anilistId.value;
            if (!Number.isFinite(id)) {
                loading.value = false;
                resolvingCatalog.value = false;
                return;
            }

            loading.value = true;
            resolvingCatalog.value = true;
            nfDebug('anime-detail:load:start', { id });

            try {
                const lang = getLanguageOption(language.value);
                const [response, resolved] = await Promise.all([
                    fetchAnimeMediaById(id),
                    resolveMoovieCatalogForAnilist(id, lang).catch(() => ({
                        item: null,
                        languageTags: [],
                        anilistTitles: []
                    }))
                ]);

                anime.value = (response?.data?.Media as AnimeMedia | undefined) || null;
                if (!anime.value) {
                    return;
                }

                await applyCatalogResolve(resolved);
                applySeo();
                void loadSimilar(id);

                nfDebug('anime-detail:load:ok', { id, title: displayTitle.value });
            } catch (err) {
                nfDebugError('anime-detail:load:fail', { id, err });
            } finally {
                loading.value = false;
                resolvingCatalog.value = false;
            }
        };

        onMounted(loadAnime);

        watch(
            () => route.params.id,
            (next, prev) => {
                if (!next || next === prev) return;
                loadAnime();
            }
        );

        watch(language, () => {
            if (!Number.isFinite(anilistId.value)) return;
            void resolveCatalog(anilistId.value);
        });

        return {
            loading,
            resolvingCatalog,
            anilistId,
            displayTitle,
            tagline,
            posterPath,
            backdropPath,
            rating,
            releaseYear,
            mastheadGenres,
            languageTags,
            playRoute,
            catalogMatch,
            similarItems,
            supportsEpisodes,
            episodeSeasons,
            episodeList,
            episodesLoading,
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
.nf-anime-detail {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__notice {
        margin: var(--s-6) auto var(--s-4);
        color: var(--bone-300);
        font-size: var(--fs-sm);
        line-height: 1.55;
    }

    &__section {
        margin: var(--s-8) auto var(--s-10);
    }

    &__episodes {
        margin-top: var(--s-6);
        margin-bottom: var(--s-8);
    }
}
</style>