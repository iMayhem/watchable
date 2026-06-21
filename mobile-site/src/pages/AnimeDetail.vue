<template>
    <MobileShell>
        <div class="m-detail">
            <div class="m-anime-hero">
                <template v-if="loading">
                    <div class="m-anime-hero__skeleton-img m-anime-hero__skeleton-shimmer" />
                    <div class="m-anime-hero__scrim" aria-hidden="true" />
                    <div class="m-anime-hero__body">
                        <div class="m-anime-hero__skeleton-title m-anime-hero__skeleton-shimmer" />
                        <div class="m-anime-hero__skeleton-btn m-anime-hero__skeleton-shimmer" />
                    </div>
                </template>
                <template v-else>
                    <img
                        v-if="bannerUrl"
                        :src="bannerUrl"
                        :alt="displayTitle"
                        class="m-anime-hero__img"
                    />
                    <div class="m-anime-hero__scrim" aria-hidden="true" />
                    <div class="m-anime-hero__body">
                        <h1 class="m-anime-hero__title">{{ displayTitle }}</h1>
                        <router-link :to="playRoute" class="m-anime-hero__play">Play</router-link>
                    </div>
                </template>
            </div>

            <template v-if="loading">
                <div class="m-anime-hero__desc">
                    <div class="m-anime-hero__skeleton-line m-anime-hero__skeleton-shimmer" style="width: 100%; height: 14px; margin-bottom: 8px" />
                    <div class="m-anime-hero__skeleton-line m-anime-hero__skeleton-shimmer" style="width: 95%; height: 14px; margin-bottom: 8px" />
                    <div class="m-anime-hero__skeleton-line m-anime-hero__skeleton-shimmer" style="width: 70%; height: 14px" />
                </div>
                <MobileSection title="Episodes" eyebrow="Watch">
                    <div class="m-anime-eps">
                        <div v-for="i in 8" :key="i" class="m-anime-eps__skeleton-chip m-anime-hero__skeleton-shimmer" />
                    </div>
                </MobileSection>
            </template>
            <template v-else-if="tmdbShow">
                <div v-if="description" class="m-anime-hero__desc">
                    <span v-html="isDescriptionExpanded || description.length <= 180 ? description : description.slice(0, 180) + '...'" />
                    <button
                        v-if="description.length > 180"
                        type="button"
                        class="m-anime-hero__see-more"
                        @click="isDescriptionExpanded = !isDescriptionExpanded"
                    >
                        {{ isDescriptionExpanded ? ' See less' : ' See more' }}
                    </button>
                </div>

                <MobileSection
                    v-if="totalEpisodesCount > 0"
                    :title="`Episodes (${seasonEpisodeTotal})`"
                    eyebrow="Watch"
                >
                    <div v-if="seasonEpisodeTotal <= 0" class="m-anime-eps">
                        <div v-for="i in 8" :key="i" class="m-anime-eps__skeleton-chip m-anime-hero__skeleton-shimmer" />
                    </div>
                    <template v-else>
                        <div v-if="seasonsList.length > 1" class="m-anime-seasons">
                            <button
                                v-for="s in seasonsList"
                                :key="s.id"
                                type="button"
                                class="m-anime-seasons__tab"
                                :class="{ 'is-active': activeTmdbSeason === s.id }"
                                @click="goToSeason(s.id)"
                            >
                                {{ s.label }}
                            </button>
                        </div>

                        <div v-if="paginatedEpisodes.length" class="m-anime-eps">
                            <router-link
                                v-for="ep in paginatedEpisodes"
                                :key="ep"
                                :to="streamPath(ep)"
                                class="m-anime-eps__chip"
                            >
                                Ep {{ ep }}
                            </router-link>
                        </div>

                        <div v-if="totalPages > 1" class="m-anime-eps__pagination">
                            <button
                                type="button"
                                class="m-anime-eps__page-btn"
                                :disabled="currentPage === 1"
                                @click="currentPage > 1 ? currentPage-- : null"
                            >
                                Prev
                            </button>
                            <span class="m-anime-eps__page-info">
                                {{ paginationStart }}–{{ paginationEnd }} of {{ seasonEpisodeTotal }}
                            </span>
                            <button
                                type="button"
                                class="m-anime-eps__page-btn"
                                :disabled="currentPage === totalPages"
                                @click="currentPage < totalPages ? currentPage++ : null"
                            >
                                Next
                            </button>
                        </div>
                    </template>
                </MobileSection>
            </template>
            <p v-else class="m-anime-hero__desc">Could not load anime details.</p>
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MobileShell from '../layout/MobileShell.vue';
import MobileSection from '../components/MobileSection.vue';
import { useAniList } from '@/composables/useAniList';
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
} from '@/composables/useAnimeTmdbArtwork';
import { useAppPaths } from '@/composables/useAppPaths';
import { useSeo } from '../composables/useSeo';
import { useWebImage } from '@/utils/useWebImage';

const route = useRoute();
const router = useRouter();
const paths = useAppPaths();
const { fetchAnimeById } = useAniList();
const { updateSeo } = useSeo();

const tmdbShow = ref<TmdbAnimeShowDetails | null>(null);
const anilistIdRef = ref<number | null>(null);
const loading = ref(true);
const tmdbPoster = ref<string | null>(null);
const tmdbBackdrop = ref<string | null>(null);
const tmdbEpisodes = ref<AnimeTmdbArtwork['episodes']>([]);
const tmdbTotalEpisodeCount = ref(0);
const usesTmdbSeasonTabs = ref(false);
const tmdbSeasonTabs = ref<AnimeTmdbArtwork['seasonTabs']>([]);
const activeTmdbSeason = ref(1);
const currentPage = ref(1);
const episodesPerPage = 24;
const tmdbIdRef = ref<number | null>(null);
const suppressRouteReload = ref(false);
let loadGeneration = 0;

const displayTitle = computed(() => tmdbShow.value?.name || '');

const bannerUrl = computed(() => {
    if (tmdbBackdrop.value) return useWebImage(tmdbBackdrop.value, 'hero');
    if (tmdbPoster.value) return useWebImage(tmdbPoster.value, 'large');
    if (tmdbShow.value?.backdrop_path) return useWebImage(tmdbShow.value.backdrop_path, 'hero');
    if (tmdbShow.value?.poster_path) return useWebImage(tmdbShow.value.poster_path, 'large');
    return '';
});

const description = computed(() => tmdbShow.value?.overview ?? '');
const isDescriptionExpanded = ref(false);

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

const paginatedEpisodes = computed(() => {
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

const playRoute = computed(() => {
    if (!tmdbIdRef.value || !anilistIdRef.value) return '';
    return paths.streamAnime(tmdbIdRef.value, 1, anilistIdRef.value);
});

const streamPath = (episode: number) => {
    if (!tmdbIdRef.value || !anilistIdRef.value) return '';
    return paths.streamAnime(tmdbIdRef.value, episode, anilistIdRef.value);
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

const goToSeason = (seasonNumber: number) => {
    activeTmdbSeason.value = seasonNumber;
    currentPage.value = 1;
};

const loadTmdbArtworkByTmdbId = async (tmdbId: number) => {
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
    }

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
    }
};

const publishAnimePage = (tmdbId: number) => {
    if (!tmdbShow.value) return;

    updateSeo({
        title: `${displayTitle.value} — Moovie`,
        description: description.value || `Watch ${displayTitle.value} online on Moovie.`,
        image: bannerUrl.value || 'https://m.moovie.fun/og-image.png',
        canonical: `https://m.moovie.fun/anime/${tmdbId}`,
        type: 'video.tv_show',
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'TVSeries',
            'name': displayTitle.value,
            'description': description.value,
            'image': bannerUrl.value || undefined,
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
            await router.replace(paths.anime(tmdbId));
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
                    await router.replace(paths.anime(tmdbId));
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
        isDescriptionExpanded.value = false;
        loadAnime(Number(newId));
    },
    { immediate: true }
);
</script>

<style lang="scss" scoped>
.m-anime-hero {
    position: relative;
    margin: 0 var(--s-4) var(--s-4);
    border-radius: var(--r-md);
    overflow: hidden;
    aspect-ratio: 16 / 9;

    &__img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    &__scrim {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, transparent, rgba(11, 10, 8, 0.9));
    }

    &__body {
        position: absolute;
        inset: auto 0 0 0;
        padding: var(--s-4);
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--s-3);
    }

    &__title {
        font-family: var(--font-display);
        font-size: 1.25rem;
        margin: 0;
        flex: 1;
    }

    &__play {
        flex-shrink: 0;
        padding: 0.5rem 1rem;
        border-radius: var(--r-pill);
        background: var(--ember);
        color: var(--ink-900);
        font-weight: 700;
        text-decoration: none;
    }

    &__desc {
        padding: 0 var(--s-4) var(--s-4);
        color: var(--bone-300);
        font-size: var(--fs-sm);
        line-height: var(--lh-base);
    }

    &__see-more {
        all: unset;
        display: inline;
        color: var(--ember);
        font-weight: 600;
        cursor: pointer;
        margin-left: 6px;
        font-family: var(--font-ui);
        transition: color var(--dur-fast);

        &:hover {
            color: var(--bone-50);
        }
    }

    &__skeleton-img {
        width: 100%;
        height: 100%;
        background: var(--ink-800);
    }

    &__skeleton-title {
        width: 180px;
        height: 20px;
        border-radius: 4px;
        background: var(--ink-750);
    }

    &__skeleton-btn {
        width: 60px;
        height: 32px;
        border-radius: var(--r-pill);
        background: var(--ink-750);
    }

    &__skeleton-line {
        background: var(--ink-750);
        border-radius: 2px;
    }

    &__skeleton-shimmer {
        position: relative;
        overflow: hidden;
        background: var(--ink-750);

        &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(
                90deg,
                transparent,
                rgba(255, 255, 255, 0.04),
                transparent
            );
            transform: translateX(-100%);
            animation: mobile-anime-skeleton-shimmer-anim 1.6s infinite ease-in-out;
        }
    }
}

@keyframes mobile-anime-skeleton-shimmer-anim {
    100% {
        transform: translateX(100%);
    }
}

.m-anime-seasons {
    display: flex;
    gap: var(--s-2);
    overflow-x: auto;
    padding: 0 var(--s-4) var(--s-3);
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }

    &__tab {
        flex-shrink: 0;
        padding: 0.4rem 0.85rem;
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);
        background: var(--ink-800);
        color: var(--bone-300);
        font-size: var(--fs-xs);
        font-weight: 600;
        white-space: nowrap;

        &.is-active {
            background: var(--ember);
            border-color: var(--ember);
            color: var(--ink-900);
        }
    }
}

.m-anime-eps {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
    padding: 0 var(--s-4) var(--s-4);

    &__chip {
        min-width: 3.25rem;
        min-height: 2.5rem;
        display: grid;
        place-items: center;
        padding: 0 var(--s-3);
        border-radius: var(--r-sm);
        border: 1px solid var(--rule);
        color: var(--bone-100);
        text-decoration: none;
        font-weight: 600;
        font-size: var(--fs-sm);
    }

    &__skeleton-chip {
        width: 3.25rem;
        height: 2.5rem;
        border-radius: var(--r-sm);
        background: var(--ink-750);
    }

    &__pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--s-3);
        padding: 0 var(--s-4) var(--s-4);
    }

    &__page-btn {
        padding: 0.35rem 0.75rem;
        border-radius: var(--r-sm);
        border: 1px solid var(--rule);
        background: var(--ink-800);
        color: var(--bone-100);
        font-size: var(--fs-xs);
        font-weight: 600;

        &:disabled {
            opacity: 0.4;
        }
    }

    &__page-info {
        font-size: var(--fs-xs);
        color: var(--bone-400);
    }
}
</style>