<template>
    <div class="anime-detail">
        <SiteHeader />

        <main id="main" class="anime-detail__main" role="main">
            <section class="anime-detail__snap-slide">
                <TitleMasthead
                    :id="tmdbIdRef || ''"
                    :party-id="anime?.id"
                    type="anime"
                    :title="anime ? (anime.title.english || anime.title.romaji || anime.title.native) : ''"
                    :tagline="anime ? anime.title.native : ''"
                    :eyebrow="mastheadEyebrow"
                    :backdrop-path="backdropPath"
                    :poster-path="posterPath"
                    :rating="anime && anime.averageScore ? anime.averageScore / 10 : 0"
                    :release-date="anime ? String(anime.seasonYear || '') : ''"
                    :genres="anime ? anime.genres : []"
                    :adult="false"
                    :play-route="playRoute"
                    play-label="Play"
                    :show-trailer="false"
                    :loading="loading"
                />
            </section>

            <section v-if="loading || anime" class="anime-detail__section anime-detail__snap-slide container-lm">
                <div class="episode-guide">
                    <p class="eyebrow">The Schedule</p>
                    <h3 class="episode-guide__title display">Episode guide</h3>
                    <p class="episode-guide__desc">Every installment, in running order.</p>

                    <!-- Premium Custom Season Changer tabs -->
                    <div v-if="loading || isLoadingTmdb" class="anime-detail__seasons-rail" aria-hidden="true">
                        <div v-for="i in 3" :key="i" class="season-tab-btn-skeleton" />
                    </div>
                    <div v-else-if="seasonsList.length > 1" class="anime-detail__seasons-rail">
                        <button
                            v-for="s in seasonsList"
                            :key="s.id"
                            type="button"
                            class="season-tab-btn"
                            :class="{ 'is-active': usesTmdbSeasonTabs ? activeTmdbSeason === s.id : s.id === anime.id }"
                            @click="goToSeason(s.id)"
                        >
                            {{ s.label }}
                        </button>
                    </div>

                    <div v-if="loading || (isLoadingTmdb && totalEpisodesCount <= 1)" class="episode-guide__grid" aria-hidden="true">
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
                            :to="`/stream/anime/${tmdbIdRef}/episode/${ep}`"
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

                    <div v-if="!loading && !isLoadingTmdb" class="episode-guide__pagination">
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

        <div v-if="!anime && !loading" class="anime-detail__loading">
            <span class="meta">Could not load anime details.</span>
        </div>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
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
    getCachedAnimeTmdbArtwork,
    resolveAnimeTmdbEpisodesByTmdbId,
    resolveAnimeTmdbMetaByTmdbId,
    getAnilistIdForTmdbId,
    resolveAnimeTmdbMeta,
    type AnimeTmdbArtwork
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


        const anime = ref<any | null>(null);
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
        const seasonsTmdbIds = ref<Record<number, number>>({});

        const posterPath = computed(() => {
            return tmdbPoster.value || anime.value?.coverImage?.large || null;
        });

        const backdropPath = computed(() => {
            return tmdbBackdrop.value || tmdbPoster.value || anime.value?.bannerImage || anime.value?.coverImage?.large || null;
        });

        const cleanDescription = computed(() => {
            if (!anime.value?.description) return '';
            // Remove HTML tags often returned in AniList descriptions
            return anime.value.description.replace(/<[^>]*>/g, '');
        });

        const mastheadEyebrow = computed(() => {
            const format = anime.value?.format ? ` · ${anime.value.format}` : '';
            return `Anime${format}`;
        });

        const studiosLabel = computed(() => {
            const list = anime.value?.studios?.nodes ?? [];
            if (!list.length) return '';
            return list.map((s: any) => s.name).slice(0, 2).join(', ');
        });

        const metaItems = computed<MetaEntry[]>(() => {
            if (!anime.value) return [];
            
            const start = anime.value.startDate;
            const premiered = start && start.year 
                ? `${start.month || 1}/${start.day || 1}/${start.year}` 
                : String(anime.value.seasonYear || '');

            return [
                { label: 'Premiered', value: premiered },
                { label: 'Format', value: anime.value.format || 'TV' },
                { label: 'Studio', value: studiosLabel.value || 'N/A' },
                { label: 'Status', value: anime.value.status || 'FINISHED' },
                { label: 'Genres', value: anime.value.genres?.slice(0, 3).join(', ') || '' }
            ];
        });

        const statsItems = computed<StatEntry[]>(() => {
            if (!anime.value) return [];
            return [
                { label: 'Episodes', value: String(totalEpisodesCount.value) },
                { label: 'Score', value: anime.value.averageScore ? `${anime.value.averageScore}%` : 'N/A' },
                { label: 'Year', value: String(anime.value.seasonYear || '') }
            ];
        });

        const playRoute = computed(() => {
            return tmdbIdRef.value ? `/stream/anime/${tmdbIdRef.value}/episode/1` : '';
        });

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
            if (usesTmdbSeasonTabs.value && tmdbSeasonTabs.value.length) {
                return tmdbSeasonTabs.value.map((tab) => ({
                    id: tab.seasonNumber,
                    label: tab.label
                }));
            }

            if (!anime.value) return [];
            const list = [];

            list.push({
                id: anime.value.id,
                title: anime.value.title.english || anime.value.title.romaji || anime.value.title.native,
                year: anime.value.seasonYear || 0
            });

            const edges = anime.value.relations?.edges || [];
            for (const edge of edges) {
                const node = edge.node;
                if (node.type !== 'ANIME' || (edge.relationType !== 'PREQUEL' && edge.relationType !== 'SEQUEL')) {
                    continue;
                }
                if (node.format === 'MOVIE' || node.format === 'SPECIAL' || node.format === 'MUSIC') {
                    continue;
                }
                if (node.episodes != null && node.episodes <= 2) {
                    continue;
                }
                list.push({
                    id: node.id,
                    title: node.title.english || node.title.romaji || node.title.native,
                    year: node.seasonYear || 0
                });
            }

            const unique = list.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
            unique.sort((a, b) => a.year - b.year);

            return unique.map((item, idx) => {
                let label = `Season ${idx + 1}`;
                const lowerName = item.title.toLowerCase();
                if (lowerName.includes('entertainment district')) {
                    label = `Season ${idx + 1} (Entertainment District)`;
                } else if (lowerName.includes('swordsmith village')) {
                    label = `Season ${idx + 1} (Swordsmith Village)`;
                } else if (lowerName.includes('hashira training')) {
                    label = `Season ${idx + 1} (Hashira Training)`;
                } else if (lowerName.includes('mugen train')) {
                    label = `Season ${idx + 1} (Mugen Train)`;
                } else if (lowerName.includes('final season')) {
                    label = 'Final Season';
                }

                return { id: item.id, label };
            });
        });

        const goToSeason = (id: number) => {
            if (usesTmdbSeasonTabs.value) {
                activeTmdbSeason.value = id;
                currentPage.value = 1;
                return;
            }
            const targetTmdbId = seasonsTmdbIds.value[id] || id;
            if (targetTmdbId !== tmdbIdRef.value) {
                router.push(`/anime/${targetTmdbId}`);
            }
        };

        const applyTmdbSeasonState = (artwork: AnimeTmdbArtwork | null) => {
            usesTmdbSeasonTabs.value = artwork?.usesTmdbSeasonTabs ?? false;
            tmdbSeasonTabs.value = artwork?.seasonTabs ?? [];
            if (usesTmdbSeasonTabs.value && tmdbSeasonTabs.value.length) {
                const matchedTab = tmdbSeasonTabs.value.find((tab) => tab.anilistId === anime.value?.id);
                if (matchedTab) {
                    activeTmdbSeason.value = matchedTab.seasonNumber;
                } else if (!tmdbSeasonTabs.value.some((tab) => tab.seasonNumber === activeTmdbSeason.value)) {
                    activeTmdbSeason.value = tmdbSeasonTabs.value[0].seasonNumber;
                }
            } else {
                activeTmdbSeason.value = 1;
            }
        };

        const resolveSeasonsTmdbIds = async () => {
            if (usesTmdbSeasonTabs.value || !anime.value) return;
            const edges = anime.value.relations?.edges || [];
            const idsToResolve = [anime.value.id];
            for (const edge of edges) {
                const node = edge.node;
                if (node.type === 'ANIME' && (edge.relationType === 'PREQUEL' || edge.relationType === 'SEQUEL')) {
                    if (node.format === 'MOVIE' || node.format === 'SPECIAL' || node.format === 'MUSIC') continue;
                    if (node.episodes != null && node.episodes <= 2) continue;
                    idsToResolve.push(node.id);
                }
            }

            for (const aniId of idsToResolve) {
                if (seasonsTmdbIds.value[aniId]) continue;
                const cached = getCachedAnimeTmdbArtwork(aniId);
                if (cached?.tmdbId) {
                    seasonsTmdbIds.value[aniId] = cached.tmdbId;
                    continue;
                }
                try {
                    const res = await fetchAnimeById(aniId);
                    const media = res?.data?.Media;
                    if (media) {
                        const meta = await resolveAnimeTmdbMeta(aniId, media);
                        if (meta?.tmdbId) {
                            seasonsTmdbIds.value[aniId] = meta.tmdbId;
                        }
                    }
                } catch (err) {
                    console.warn(`Failed to resolve TMDB ID for season AniList ID ${aniId}:`, err);
                }
            }
        };

        const loadTmdbArtworkByTmdbId = async (tmdbId: number) => {
            tmdbEpisodes.value = [];
            tmdbTotalEpisodeCount.value = 0;
            usesTmdbSeasonTabs.value = false;
            tmdbSeasonTabs.value = [];
            activeTmdbSeason.value = 1;
            tmdbBackdrop.value = null;
            tmdbPoster.value = null;

            isLoadingTmdb.value = true;
            let meta: Awaited<ReturnType<typeof resolveAnimeTmdbMetaByTmdbId>> = null;
            try {
                meta = await resolveAnimeTmdbMetaByTmdbId(tmdbId);
                if (meta) {
                    tmdbPoster.value = meta.posterPath;
                    tmdbBackdrop.value = meta.backdropPath;
                    tmdbTotalEpisodeCount.value = meta.totalEpisodeCount;
                    applyTmdbSeasonState(meta);
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
                    const matchedCached = getCachedAnimeTmdbArtwork(getAnilistIdForTmdbId(tmdbId) || 0) || meta;
                    applyTmdbSeasonState(matchedCached);
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
            return anime.value?.bannerImage || anime.value?.coverImage?.large || '';
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

        const loadAnime = async (id: number) => {
            loading.value = true;
            anime.value = null;
            tmdbBackdrop.value = null;
            tmdbPoster.value = null;
            currentPage.value = 1;
            tmdbIdRef.value = id;

            try {
                let meta = await resolveAnimeTmdbMetaByTmdbId(id);
                let matchedAnilistId = getAnilistIdForTmdbId(id);

                if (!meta || !matchedAnilistId) {
                    const aniResponse = await fetchAnimeById(id);
                    const aniMedia = aniResponse?.data?.Media;
                    if (aniMedia) {
                        const resolvedMeta = await resolveAnimeTmdbMeta(id, aniMedia);
                        if (resolvedMeta?.tmdbId) {
                            router.replace(`/anime/${resolvedMeta.tmdbId}`);
                            return;
                        }
                    }
                }

                const anilistIdToFetch = matchedAnilistId || id;
                const response = await fetchAnimeById(anilistIdToFetch);
                anime.value = response?.data?.Media ?? null;

                if (anime.value) {
                    const title = anime.value.title.english || anime.value.title.romaji || anime.value.title.native;
                    const isMovie = anime.value.format === 'MOVIE';
                    updateSeo({
                        title: `${title} — Moovie`,
                        description: cleanDescription.value || `Watch ${title} online on Moovie.`,
                        image: posterPath.value || 'https://moovie.fun/og-image.png',
                        canonical: `https://moovie.fun/anime/${tmdbIdRef.value}`,
                        type: isMovie ? 'video.movie' : 'video.tv_show',
                        jsonLd: {
                            '@context': 'https://schema.org',
                            '@type': isMovie ? 'Movie' : 'TVSeries',
                            'name': title,
                            'description': cleanDescription.value,
                            'image': posterPath.value || undefined,
                            'dateCreated': anime.value.startDate?.year ? `${anime.value.startDate.year}-${String(anime.value.startDate.month || 1).padStart(2, '0')}-${String(anime.value.startDate.day || 1).padStart(2, '0')}` : undefined,
                            'aggregateRating': anime.value.averageScore ? {
                                '@type': 'AggregateRating',
                                'bestRating': '100',
                                'worstRating': '1',
                                'ratingValue': anime.value.averageScore,
                                'ratingCount': 100
                            } : undefined
                        }
                    });
                    
                    addViewedItem({
                        id: tmdbIdRef.value,
                        title: title,
                        image: posterPath.value || anime.value.coverImage.large,
                        rating: anime.value.averageScore ? anime.value.averageScore / 10 : 0,
                        categories: [],
                        adult: false,
                        type: 'anime'
                    });
                }
                
                loading.value = false;

                if (anime.value) {
                    loadTmdbArtworkByTmdbId(id).then(() => {
                        resolveSeasonsTmdbIds();
                    }).catch(err => {
                        console.error('Failed to load TMDB anime artwork:', err);
                    });
                }
            } catch (err) {
                console.error('Failed to load anime:', err);
                loading.value = false;
            }
        };

        onMounted(() => {
            if (route.params.id) {
                loadAnime(Number(route.params.id));
            }
        });

        watch(
            () => route.params.id,
            newId => {
                if (newId && route.name === 'AnimeDetail') {
                    loadAnime(Number(newId));
                }
            }
        );

        watch(loading, (newVal) => {
            if (!newVal) {
                setTimeout(() => {
                    const container = document.querySelector('.anime-detail');
                    if (container && container.scrollTop < 20) {
                        container.scrollTo({ top: 120, behavior: 'smooth' });
                    }
                }, 150);
            }
        });

        return {
            anime,
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
            tmdbIdRef
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
