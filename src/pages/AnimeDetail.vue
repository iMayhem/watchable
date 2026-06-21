<template>
    <div class="anime-detail">
        <SiteHeader />

        <main id="main" class="anime-detail__main" role="main">
            <section class="anime-detail__snap-slide">
                <TitleMasthead
                    :id="tmdbIdRef || ''"
                    :party-id="anilistIdRef ?? undefined"
                    type="anime"
                    :title="displayTitle"
                    :tagline="displayTagline"
                    :eyebrow="mastheadEyebrow"
                    :backdrop-path="backdropPath"
                    :poster-path="posterPath"
                    :rating="displayRating"
                    :release-date="releaseYear"
                    :genres="tmdbGenreNames"
                    :adult="false"
                    :play-route="playRoute"
                    play-label="Play"
                    :show-trailer="false"
                    :loading="loading"
                />
            </section>

            <section v-if="loading || tmdbShow" class="anime-detail__section anime-detail__snap-slide container-lm">
                <div class="episode-guide">
                    <p class="eyebrow">The Schedule</p>
                    <h3 class="episode-guide__title display">Episode guide</h3>
                    <p class="episode-guide__desc">Every installment, in running order.</p>

                    <!-- Premium Custom Season Changer tabs -->
                    <div v-if="loading" class="anime-detail__seasons-rail" aria-hidden="true">
                        <div v-for="i in 3" :key="i" class="season-tab-btn-skeleton" />
                    </div>
                    <div v-else-if="seasonsList.length > 1" class="anime-detail__seasons-rail">
                        <button
                            v-for="s in seasonsList"
                            :key="s.id"
                            type="button"
                            class="season-tab-btn"
                            :class="{ 'is-active': activeTmdbSeason === s.id }"
                            @click="goToSeason(s.id)"
                        >
                            {{ s.label }}
                        </button>
                    </div>

                    <div v-if="loading || totalEpisodesCount <= 0" class="episode-guide__grid" aria-hidden="true">
                        <div v-for="i in 12" :key="i" class="episode-card-skeleton">
                            <div class="episode-card-skeleton__still episode-card-skeleton__shimmer" />
                            <div class="episode-card-skeleton__meta">
                                <div class="episode-card-skeleton__line episode-card-skeleton__title episode-card-skeleton__shimmer" />
                                <div class="episode-card-skeleton__line episode-card-skeleton__desc episode-card-skeleton__shimmer" />
                            </div>
                        </div>
                    </div>
                    <div v-else class="episode-guide__grid">
                        <router-link
                            v-for="ep in paginatedEpisodesList"
                            :key="ep"
                            :to="streamPath(ep)"
                            class="episode-card"
                        >
                            <div class="episode-card__image-container">
                                <img :src="getEpisodeStill(ep)" class="episode-card__image" alt="Episode Cover" loading="lazy" />
                                <div class="episode-card__play">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z"/>
                                    </svg>
                                </div>
                            </div>
                            <div class="episode-card__meta">
                                <h4 class="episode-card__title">Episode {{ getEpisodeInSeasonNumber(ep) }} · {{ getEpisodeTitle(ep) }}</h4>
                                <p class="episode-card__subtitle">{{ truncate(getEpisodeOverview(ep), 90) }}</p>
                            </div>
                        </router-link>
                    </div>

                    <div v-if="!loading && totalEpisodesCount > 0" class="episode-guide__pagination">
                        <button 
                            @click="currentPage > 1 ? currentPage-- : null"
                            :disabled="currentPage === 1"
                            class="pagination-btn"
                            aria-label="Previous Page"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                            </svg>
                            Prev
                        </button>
                        <span class="pagination-info">
                            Showing {{ paginationStart }}–{{ paginationEnd }} of {{ seasonEpisodeTotal }} episodes
                        </span>
                        <button 
                            @click="currentPage < totalPages ? currentPage++ : null"
                            :disabled="currentPage === totalPages"
                            class="pagination-btn"
                            aria-label="Next Page"
                        >
                            Next
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </section>

            <section class="anime-detail__section anime-detail__snap-slide container-lm anime-detail__opening">
                <MetaBar :items="metaItems" :loading="loading" aria-label="Anime metadata" />

                <div class="anime-detail__columns">
                    <div class="anime-detail__col--main">
                        <DropCapSynopsis
                            :body="cleanDescription"
                            eyebrow="The Synopsis"
                            :loading="loading"
                        />
                    </div>

                    <div class="anime-detail__col--side">
                        <StatsBlock
                            :stats="statsItems"
                            title="By the numbers"
                            eyebrow="Ledger"
                            :loading="loading"
                        />
                    </div>
                </div>
            </section>
        </main>

        <div v-if="!tmdbShow && !loading" class="anime-detail__loading">
            <span class="meta">Could not load anime details.</span>
        </div>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import TitleMasthead from '../components/detail/TitleMasthead.vue';
import MetaBar, { MetaEntry } from '../components/detail/MetaBar.vue';
import DropCapSynopsis from '../components/detail/DropCapSynopsis.vue';
import StatsBlock, { StatEntry } from '../components/detail/StatsBlock.vue';
import { useAniList } from '../composables/useAniList';
import { addViewedItem } from '../composables/useHistory';
import { useSeo } from '../composables/useSeo';
import { useWebImage } from '../utils/useWebImage';
import {
    estimateAnimeEpisodeTotal,
    resolveAnimeTmdbEpisodesByTmdbId,
    resolveAnimeTmdbMetaByTmdbId,
    resolveAnimeRouteIds,
    resolveAnilistIdForPlayback,
    fetchTmdbAnimeShowDetails,
    getCachedAnimeTmdbArtwork,
    getCachedTmdbArtworkByTmdbId,
    resolvePreferredTmdbSeason,
    type AnimeTmdbArtwork,
    type TmdbAnimeShowDetails
} from '../composables/useAnimeTmdbArtwork';


export default defineComponent({
    name: 'AnimeDetail',
    components: {
        SiteHeader,
        SiteFooter,
        TitleMasthead,
        MetaBar,
        DropCapSynopsis,
        StatsBlock
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { fetchAnimeById } = useAniList();
        const { updateSeo } = useSeo();


        const tmdbShow = ref<TmdbAnimeShowDetails | null>(null);
        const anilistIdRef = ref<number | null>(null);
        const loading = ref(true);
        const tmdbPoster = ref<string | null>(null);
        const tmdbBackdrop = ref<string | null>(null);
        const tmdbEpisodes = ref<any[]>([]);
        const tmdbTotalEpisodeCount = ref(0);
        const usesTmdbSeasonTabs = ref(false);
        const tmdbSeasonTabs = ref<AnimeTmdbArtwork['seasonTabs']>([]);
        const activeTmdbSeason = ref(1);
        const isLoadingTmdb = ref(false);
        const isLoadingEpisodes = ref(false);
        const tmdbIdRef = ref<number | null>(null);
        const suppressRouteReload = ref(false);
        let loadGeneration = 0;

        const posterPath = computed(() => tmdbPoster.value || tmdbShow.value?.poster_path || null);

        const backdropPath = computed(() =>
            tmdbBackdrop.value || tmdbShow.value?.backdrop_path || tmdbPoster.value || tmdbShow.value?.poster_path || null
        );

        const displayTitle = computed(() => tmdbShow.value?.name || '');

        const displayTagline = computed(() => {
            const original = tmdbShow.value?.original_name || '';
            if (!original || original === displayTitle.value) return '';
            return original;
        });

        const cleanDescription = computed(() => tmdbShow.value?.overview || '');

        const tmdbGenreNames = computed(() =>
            (tmdbShow.value?.genres ?? []).map((g) => g.name).filter(Boolean)
        );

        const displayRating = computed(() => tmdbShow.value?.vote_average ?? 0);

        const releaseYear = computed(() => {
            const date = tmdbShow.value?.first_air_date;
            return date ? date.slice(0, 4) : '';
        });

        const mastheadEyebrow = computed(() => {
            const genre = tmdbGenreNames.value[0];
            return genre ? `Anime · ${genre}` : 'Anime';
        });

        const networkLabel = computed(() =>
            (tmdbShow.value?.networks ?? []).map((n) => n.name).slice(0, 2).join(', ')
        );

        const formatPremiered = (iso?: string) => {
            if (!iso) return '';
            try {
                return new Date(iso).toLocaleDateString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric'
                });
            } catch {
                return iso;
            }
        };

        const metaItems = computed<MetaEntry[]>(() => {
            if (!tmdbShow.value) return [];
            return [
                { label: 'Premiered', value: formatPremiered(tmdbShow.value.first_air_date) },
                { label: 'Format', value: 'TV' },
                { label: 'Network', value: networkLabel.value || 'N/A' },
                { label: 'Status', value: tmdbShow.value.status || 'N/A' },
                { label: 'Genres', value: tmdbGenreNames.value.slice(0, 3).join(', ') || '' }
            ];
        });

        const statsItems = computed<StatEntry[]>(() => {
            if (!tmdbShow.value) return [];
            const score = tmdbShow.value.vote_average
                ? `${Math.round(tmdbShow.value.vote_average * 10)}%`
                : 'N/A';
            return [
                { label: 'Episodes', value: String(totalEpisodesCount.value) },
                { label: 'Score', value: score },
                { label: 'Year', value: releaseYear.value }
            ];
        });

        const streamPath = (episode: number) => {
            if (!tmdbIdRef.value || !anilistIdRef.value) return '';
            return `/stream/anime/${tmdbIdRef.value}/episode/${episode}?ani=${anilistIdRef.value}`;
        };

        const playRoute = computed(() => streamPath(1));

        const currentPage = ref(1);
        const episodesPerPage = 20;

        const totalEpisodesCount = computed(() =>
            estimateAnimeEpisodeTotal(tmdbEpisodes.value, tmdbTotalEpisodeCount.value)
        );

        const seasonEpisodeNumbers = computed(() => {
            if (!usesTmdbSeasonTabs.value) {
                const total = totalEpisodesCount.value;
                const list: number[] = [];
                for (let i = 1; i <= total; i++) list.push(i);
                return list;
            }

            const tab = tmdbSeasonTabs.value.find((s) => s.seasonNumber === activeTmdbSeason.value);
            if (!tab) return [];
            const list: number[] = [];
            for (let i = tab.firstEpisode; i <= tab.lastEpisode; i++) list.push(i);
            return list;
        });

        const seasonEpisodeTotal = computed(() => seasonEpisodeNumbers.value.length);

        const totalPages = computed(() =>
            Math.max(1, Math.ceil(seasonEpisodeTotal.value / episodesPerPage))
        );

        const paginatedEpisodesList = computed(() => {
            const startIndex = (currentPage.value - 1) * episodesPerPage;
            return seasonEpisodeNumbers.value.slice(startIndex, startIndex + episodesPerPage);
        });

        const paginationStart = computed(() => {
            if (!seasonEpisodeTotal.value) return 0;
            return (currentPage.value - 1) * episodesPerPage + 1;
        });

        const paginationEnd = computed(() =>
            Math.min(currentPage.value * episodesPerPage, seasonEpisodeTotal.value)
        );

        const seasonsList = computed(() => {
            if (!usesTmdbSeasonTabs.value || !tmdbSeasonTabs.value.length) return [];
            return tmdbSeasonTabs.value.map((tab) => ({
                id: tab.seasonNumber,
                label: tab.label
            }));
        });

        const goToSeason = (seasonNumber: number) => {
            activeTmdbSeason.value = seasonNumber;
            currentPage.value = 1;
        };

        const applyTmdbSeasonState = (
            artwork: AnimeTmdbArtwork | null,
            anilistHintId?: number | null
        ) => {
            usesTmdbSeasonTabs.value = artwork?.usesTmdbSeasonTabs ?? false;
            tmdbSeasonTabs.value = artwork?.seasonTabs ?? [];

            const preferredSeason = resolvePreferredTmdbSeason(artwork, anilistHintId);
            if (preferredSeason) {
                activeTmdbSeason.value = preferredSeason;
            }

            if (usesTmdbSeasonTabs.value && tmdbSeasonTabs.value.length) {
                const preferredTab = preferredSeason
                    ? tmdbSeasonTabs.value.find((tab) => tab.seasonNumber === preferredSeason)
                    : null;
                if (preferredTab) {
                    activeTmdbSeason.value = preferredTab.seasonNumber;
                } else if (!tmdbSeasonTabs.value.some((tab) => tab.seasonNumber === activeTmdbSeason.value)) {
                    activeTmdbSeason.value = tmdbSeasonTabs.value[0].seasonNumber;
                }
            } else if (!preferredSeason) {
                activeTmdbSeason.value = 1;
            }
        };

        const loadTmdbArtworkByTmdbId = async (tmdbId: number) => {
            isLoadingTmdb.value = true;
            let meta: Awaited<ReturnType<typeof resolveAnimeTmdbMetaByTmdbId>> = null;
            try {
                meta = await resolveAnimeTmdbMetaByTmdbId(tmdbId);
                if (meta) {
                    tmdbPoster.value = meta.posterPath;
                    tmdbBackdrop.value = meta.backdropPath;
                    tmdbTotalEpisodeCount.value = meta.totalEpisodeCount;
                    applyTmdbSeasonState(meta, anilistIdRef.value);
                    if (meta.episodes.length) {
                        tmdbEpisodes.value = meta.episodes;
                    }
                }
            } catch (err) {
                console.warn('Failed to load TMDb anime meta by TMDB ID:', err);
            } finally {
                isLoadingTmdb.value = false;
            }

            isLoadingEpisodes.value = true;
            try {
                const episodes = await resolveAnimeTmdbEpisodesByTmdbId(tmdbId);
                if (episodes.length) {
                    tmdbEpisodes.value = episodes;
                    applyTmdbSeasonState(
                        getCachedTmdbArtworkByTmdbId(tmdbId) || meta,
                        anilistIdRef.value
                    );
                }
            } catch (err) {
                console.warn('Failed to load TMDb anime episodes by TMDB ID:', err);
            } finally {
                isLoadingEpisodes.value = false;
            }
        };

        const getEpisodeStill = (epNum: number) => {
            const match = tmdbEpisodes.value.find(e => e.episode_number === epNum);
            if (match?.still_path) {
                return useWebImage(match.still_path, 'large');
            }
            if (tmdbPoster.value) {
                return useWebImage(tmdbPoster.value, 'medium');
            }
            if (tmdbBackdrop.value) {
                return useWebImage(tmdbBackdrop.value, 'medium');
            }
            return posterPath.value ? useWebImage(posterPath.value, 'medium') : '';
        };

        const getEpisodeTitle = (epNum: number) => {
            const match = tmdbEpisodes.value.find(e => e.episode_number === epNum);
            if (match && match.name) {
                return match.name;
            }
            return `Episode ${epNum}`;
        };

        const getEpisodeInSeasonNumber = (epNum: number) => {
            const match = tmdbEpisodes.value.find(e => e.episode_number === epNum);
            return match ? match.episode_in_season : epNum;
        };

        const getEpisodeOverview = (epNum: number) => {
            const match = tmdbEpisodes.value.find(e => e.episode_number === epNum);
            if (match?.overview) return match.overview;
            return 'Sub/Dub available';
        };

        const truncate = (text: string, max: number = 80) => {
            if (!text) return '';
            if (text.length <= max) return text;
            return text.substring(0, max) + '...';
        };

        const publishAnimePage = (tmdbId: number) => {
            if (!tmdbShow.value) return;

            const title = displayTitle.value;
            updateSeo({
                title: `${title} — Moovie`,
                description: cleanDescription.value || `Watch ${title} online on Moovie.`,
                image: posterPath.value || 'https://moovie.fun/og-image.png',
                canonical: `https://moovie.fun/anime/${tmdbId}`,
                type: 'video.tv_show',
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@type': 'TVSeries',
                    'name': title,
                    'description': cleanDescription.value,
                    'image': posterPath.value || undefined,
                    'dateCreated': tmdbShow.value.first_air_date || undefined,
                    'aggregateRating': tmdbShow.value.vote_average ? {
                        '@type': 'AggregateRating',
                        'bestRating': '10',
                        'worstRating': '0',
                        'ratingValue': tmdbShow.value.vote_average,
                        'ratingCount': 100
                    } : undefined
                }
            });

            addViewedItem({
                id: tmdbId,
                title,
                image: posterPath.value || '',
                rating: displayRating.value,
                categories: [],
                adult: false,
                type: 'anime'
            });
        };

        const loadAnime = async (routeId: number) => {
            const generation = ++loadGeneration;
            loading.value = true;
            currentPage.value = 1;

            try {
                const { tmdbId: resolvedTmdbId, anilistId } = await resolveAnimeRouteIds(routeId, async (id) => {
                    try {
                        const res = await fetchAnimeById(id);
                        return res?.data?.Media ?? null;
                    } catch {
                        return null;
                    }
                });
                if (generation !== loadGeneration) return;

                let tmdbId = resolvedTmdbId;
                tmdbIdRef.value = tmdbId;
                anilistIdRef.value = anilistId;

                if (tmdbId !== routeId) {
                    suppressRouteReload.value = true;
                    await router.replace(`/anime/${tmdbId}`);
                }

                let show = await fetchTmdbAnimeShowDetails(tmdbId);
                if (generation !== loadGeneration) return;

                if (!show && anilistIdRef.value) {
                    const cached = getCachedAnimeTmdbArtwork(anilistIdRef.value);
                    if (cached?.tmdbId && cached.tmdbId !== tmdbId) {
                        tmdbId = cached.tmdbId;
                        tmdbIdRef.value = tmdbId;
                        show = await fetchTmdbAnimeShowDetails(tmdbId);
                        if (generation !== loadGeneration) return;
                        if (tmdbId !== routeId) {
                            suppressRouteReload.value = true;
                            await router.replace(`/anime/${tmdbId}`);
                        }
                    }
                }

                if (!show) return;

                tmdbShow.value = show;
                tmdbPoster.value = show.poster_path ?? null;
                tmdbBackdrop.value = show.backdrop_path ?? null;
                tmdbTotalEpisodeCount.value = estimateAnimeEpisodeTotal(
                    [],
                    show.number_of_episodes ?? 0,
                    0
                );

                if (!anilistIdRef.value) {
                    anilistIdRef.value = await resolveAnilistIdForPlayback(tmdbId);
                }
                if (generation !== loadGeneration) return;

                await loadTmdbArtworkByTmdbId(tmdbId);
                if (generation !== loadGeneration) return;

                publishAnimePage(tmdbId);
            } catch (err) {
                console.error('Failed to load anime:', err);
            } finally {
                if (generation === loadGeneration) {
                    loading.value = false;
                }
            }
        };

        watch(
            () => route.params.id,
            (newId) => {
                if (!newId || route.name !== 'AnimeDetail') return;
                if (suppressRouteReload.value) {
                    suppressRouteReload.value = false;
                    return;
                }
                loadAnime(Number(newId));
            },
            { immediate: true }
        );

        return {
            tmdbShow,
            anilistIdRef,
            displayTitle,
            displayTagline,
            displayRating,
            releaseYear,
            tmdbGenreNames,
            loading,
            isLoadingTmdb,
            usesTmdbSeasonTabs,
            activeTmdbSeason,
            backdropPath,
            posterPath,
            cleanDescription,
            mastheadEyebrow,
            metaItems,
            statsItems,
            playRoute,
            totalEpisodesCount,
            seasonEpisodeTotal,
            paginationStart,
            paginationEnd,
            seasonsList,
            goToSeason,
            getEpisodeStill,
            getEpisodeTitle,
            getEpisodeOverview,
            getEpisodeInSeasonNumber,
            truncate,
            currentPage,
            totalPages,
            paginatedEpisodesList,
            tmdbIdRef,
            streamPath
        };
    }
});
</script>

<style lang="scss" scoped>
.anime-detail {
    position: relative;
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    height: 100dvh;
    overflow-y: scroll;
    scroll-snap-type: y proximity;
    scroll-behavior: smooth;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }

    &__main {
        position: relative;
    }

    &__snap-slide {
        scroll-snap-align: start;
        scroll-snap-stop: normal;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        box-sizing: border-box;

        &.anime-detail__opening {
            justify-content: flex-start;
            padding-top: clamp(var(--s-8), 8vh, var(--s-10));
            padding-bottom: clamp(var(--s-8), 8vh, var(--s-10));
        }
    }

    &__section {
        &:last-of-type {
            margin-bottom: 0;
        }
    }

    &__opening {
        display: grid;
        gap: clamp(var(--s-6), 6vw, var(--s-8));
    }

    &__columns {
        display: grid;
        gap: clamp(var(--s-6), 5vw, var(--s-8));
        grid-template-columns: minmax(0, 1fr);

        @media (min-width: 960px) {
            grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
            align-items: start;
        }
    }

    &__col--main,
    &__col--side {
        min-width: 0;
    }

    &__loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--s-3);
        min-height: 60vh;
        color: var(--bone-300);
    }

    &__spinner {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid var(--rule-strong);
        border-top-color: var(--ember);
        animation: anime-spin 0.8s linear infinite;
    }
}

@keyframes anime-spin {
    to { transform: rotate(360deg); }
}

.episode-guide {
    padding-top: var(--s-6);
    padding-bottom: var(--s-10);

    &__title {
        margin-top: var(--s-1);
        margin-bottom: var(--s-2);
        color: var(--bone-50);
    }

    &__desc {
        color: var(--bone-400);
        margin-bottom: var(--s-6);
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: var(--s-4);
    }
}

.episode-card {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    border-radius: var(--r-md);
    overflow: hidden;
    background: var(--ink-800);
    border: 1px solid var(--rule);
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);

    &:hover {
        transform: translateY(-4px);
        border-color: var(--ember);
    }

    &__image-container {
        position: relative;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        background: var(--ink-950);
    }

    &__image {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    &__play {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(11, 10, 8, 0.4);
        opacity: 0;
        transition: opacity var(--dur-fast) var(--ease-out);

        svg {
            width: 32px;
            height: 32px;
            color: var(--ember);
        }
    }

    &:hover &__play {
        opacity: 1;
    }

    &__meta {
        padding: var(--s-3);
    }

    &__title {
        font-family: var(--font-ui);
        font-weight: 600;
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--bone-100);
    }

    &__subtitle {
        font-size: var(--fs-xs);
        color: var(--bone-450);
        margin-top: var(--s-1);
        margin-bottom: 0;
    }
}

.episode-guide__pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--s-4);
    margin-top: var(--s-8);
    padding-top: var(--s-6);
    border-top: 1px solid var(--rule);

    .pagination-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--s-1);
        background: var(--ink-800);
        border: 1px solid var(--rule);
        color: var(--bone-100);
        padding: var(--s-2) var(--s-4);
        border-radius: var(--r-md);
        font-family: var(--font-ui);
        font-weight: 500;
        font-size: var(--fs-sm);
        cursor: pointer;
        transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), opacity var(--dur-fast);

        &:hover:not(:disabled) {
            background: var(--surface-tint);
            border-color: var(--ember);
            color: var(--ember);
        }

        &:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        svg {
            display: inline-block;
        }
    }

    .pagination-info {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        color: var(--bone-400);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
}

.anime-detail__seasons-rail {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-3);
    margin-bottom: var(--s-6);
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
    &::-webkit-scrollbar { display: none; }
}

.season-tab-btn {
    padding: 0.5rem 1rem;
    background: var(--ink-800);
    border: 1px solid var(--rule);
    color: var(--bone-300);
    font-family: var(--font-ui);
    font-weight: 500;
    font-size: var(--fs-sm);
    border-radius: var(--r-pill);
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--dur-fast) var(--ease-out);

    &:hover {
        border-color: var(--ember);
        color: var(--bone-50);
    }

    &.is-active {
        background: var(--ember);
        border-color: var(--ember);
        color: #000;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(229, 9, 20, 0.2);
    }
}

.season-tab-btn-skeleton {
    width: 90px;
    height: 34px;
    border-radius: var(--r-pill);
    background: var(--ink-800);
    position: relative;
    overflow: hidden;
    &::after {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        transform: translateX(-100%);
        background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.05) 20%,
            rgba(255, 255, 255, 0.1) 60%,
            rgba(255, 255, 255, 0) 100%
        );
        animation: anime-shimmer 1.6s infinite ease-in-out;
        content: '';
    }
}

.episode-card-skeleton {
    display: flex;
    flex-direction: column;
    border-radius: var(--r-md);
    overflow: hidden;
    background: var(--ink-800);
    border: 1px solid var(--rule);

    &__still {
        width: 100%;
        aspect-ratio: 16 / 9;
        background: var(--ink-700);
    }

    &__meta {
        padding: var(--s-3);
        display: grid;
        gap: var(--s-2);
    }

    &__line {
        height: 12px;
        background: var(--ink-700);
        border-radius: 4px;

        &.episode-card-skeleton__title {
            width: 70%;
            height: 14px;
        }

        &.episode-card-skeleton__desc {
            width: 90%;
            height: 10px;
        }
    }

    &__shimmer {
        position: relative;
        overflow: hidden;

        &::after {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-100%);
            background-image: linear-gradient(
                90deg,
                rgba(255, 255, 255, 0) 0%,
                rgba(255, 255, 255, 0.05) 20%,
                rgba(255, 255, 255, 0.1) 60%,
                rgba(255, 255, 255, 0) 100%
            );
            animation: anime-shimmer 1.6s infinite ease-in-out;
            content: '';
        }
    }
}

@keyframes anime-shimmer {
    100% {
        transform: translateX(100%);
    }
}
</style>
