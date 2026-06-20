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
                        :alt="title"
                        class="m-anime-hero__img"
                    />
                    <div class="m-anime-hero__scrim" aria-hidden="true" />
                    <div class="m-anime-hero__body">
                        <h1 class="m-anime-hero__title">{{ title }}</h1>
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
            <template v-else>
                <p v-if="description" class="m-anime-hero__desc" v-html="description" />

                <MobileSection
                    v-if="totalEpisodesCount > 0"
                    :title="`Episodes (${seasonEpisodeTotal})`"
                    eyebrow="Watch"
                >
                    <div v-if="isLoadingTmdb && seasonEpisodeTotal <= 1" class="m-anime-eps">
                        <div v-for="i in 8" :key="i" class="m-anime-eps__skeleton-chip m-anime-hero__skeleton-shimmer" />
                    </div>
                    <template v-else>
                        <div v-if="seasonsList.length > 1" class="m-anime-seasons">
                            <button
                                v-for="s in seasonsList"
                                :key="s.id"
                                type="button"
                                class="m-anime-seasons__tab"
                                :class="{ 'is-active': usesTmdbSeasonTabs ? activeTmdbSeason === s.id : s.id === anime?.id }"
                                @click="goToSeason(s.id)"
                            >
                                {{ s.label }}
                            </button>
                        </div>

                        <div v-if="paginatedEpisodes.length" class="m-anime-eps">
                            <router-link
                                v-for="ep in paginatedEpisodes"
                                :key="ep"
                                :to="anime ? paths.streamAnime(anime.id, ep) : ''"
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
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MobileShell from '../layout/MobileShell.vue';
import MobileSection from '../components/MobileSection.vue';
import { useAniList, AnimeMedia } from '@/composables/useAniList';
import {
    estimateAnimeEpisodeTotal,
    getCachedAnimeTmdbArtwork,
    resolveAnimeTmdbEpisodes,
    resolveAnimeTmdbMeta,
    type AnimeTmdbArtwork
} from '@/composables/useAnimeTmdbArtwork';
import { useAppPaths } from '@/composables/useAppPaths';
import { useSeo } from '../composables/useSeo';
import { useWebImage } from '@/utils/useWebImage';

const route = useRoute();
const router = useRouter();
const paths = useAppPaths();
const { fetchAnimeById } = useAniList();
const { updateSeo } = useSeo();

const anime = ref<AnimeMedia | null>(null);
const loading = ref(true);
const tmdbPoster = ref<string | null>(null);
const tmdbBackdrop = ref<string | null>(null);
const tmdbEpisodes = ref<AnimeTmdbArtwork['episodes']>([]);
const tmdbTotalEpisodeCount = ref(0);
const usesTmdbSeasonTabs = ref(false);
const tmdbSeasonTabs = ref<AnimeTmdbArtwork['seasonTabs']>([]);
const activeTmdbSeason = ref(1);
const isLoadingTmdb = ref(false);
const currentPage = ref(1);
const episodesPerPage = 24;

const title = computed(
    () => anime.value?.title.english || anime.value?.title.romaji || 'Anime'
);

const bannerUrl = computed(() => {
    if (tmdbBackdrop.value) return useWebImage(tmdbBackdrop.value, 'hero');
    if (tmdbPoster.value) return useWebImage(tmdbPoster.value, 'large');
    return anime.value?.bannerImage || anime.value?.coverImage.large || '';
});

const description = computed(() => anime.value?.description?.replace(/<[^>]+>/g, '') ?? '');

const totalEpisodesCount = computed(() =>
    estimateAnimeEpisodeTotal(
        tmdbEpisodes.value,
        tmdbTotalEpisodeCount.value,
        anime.value?.nextAiringEpisode?.episode ?? 0
    )
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
    if (usesTmdbSeasonTabs.value && tmdbSeasonTabs.value.length) {
        return tmdbSeasonTabs.value.map((tab) => ({
            id: tab.seasonNumber,
            label: tab.label
        }));
    }

    if (!anime.value) return [];
    const list = [{
        id: anime.value.id,
        title: anime.value.title.english || anime.value.title.romaji || anime.value.title.native,
        year: anime.value.seasonYear || 0
    }];

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

    return unique.map((item, idx) => ({
        id: item.id,
        label: `Season ${idx + 1}`
    }));
});

const playRoute = computed(() =>
    paths.streamAnime(anime.value?.id ?? Number(route.params.id), 1)
);

const applyTmdbSeasonState = (artwork: AnimeTmdbArtwork | null) => {
    usesTmdbSeasonTabs.value = artwork?.usesTmdbSeasonTabs ?? false;
    tmdbSeasonTabs.value = artwork?.seasonTabs ?? [];
    if (usesTmdbSeasonTabs.value && tmdbSeasonTabs.value.length) {
        if (!tmdbSeasonTabs.value.some((tab) => tab.seasonNumber === activeTmdbSeason.value)) {
            activeTmdbSeason.value = tmdbSeasonTabs.value[0].seasonNumber;
        }
    } else {
        activeTmdbSeason.value = 1;
    }
};

const goToSeason = (id: number) => {
    if (usesTmdbSeasonTabs.value) {
        activeTmdbSeason.value = id;
        currentPage.value = 1;
        return;
    }
    if (id !== anime.value?.id) {
        router.push(`/anime/${id}`);
    }
};

const loadTmdbArtwork = async (anilistMedia: AnimeMedia) => {
    tmdbEpisodes.value = [];
    tmdbTotalEpisodeCount.value = 0;
    usesTmdbSeasonTabs.value = false;
    tmdbSeasonTabs.value = [];
    activeTmdbSeason.value = 1;
    tmdbBackdrop.value = null;
    tmdbPoster.value = null;
    if (!anilistMedia?.id) return;

    isLoadingTmdb.value = true;
    let meta: Awaited<ReturnType<typeof resolveAnimeTmdbMeta>> = null;
    try {
        meta = await resolveAnimeTmdbMeta(anilistMedia.id, anilistMedia);
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
        console.warn('Failed to load TMDB anime meta:', err);
    } finally {
        isLoadingTmdb.value = false;
    }

    try {
        const episodes = await resolveAnimeTmdbEpisodes(anilistMedia.id, anilistMedia);
        if (episodes.length) {
            tmdbEpisodes.value = episodes;
            applyTmdbSeasonState(getCachedAnimeTmdbArtwork(anilistMedia.id) ?? meta);
        }
    } catch (err) {
        console.warn('Failed to load TMDB anime episodes:', err);
    }
};

const loadAnime = async (id: number) => {
    loading.value = true;
    currentPage.value = 1;
    try {
        const res = await fetchAnimeById(id);
        anime.value = res?.data?.Media ?? null;
        if (anime.value) {
            const isMovie = anime.value.format === 'MOVIE';
            const rawAnime = anime.value as AnimeMedia & {
                startDate?: { year?: number; month?: number; day?: number };
            };
            updateSeo({
                title: `${title.value} — Moovie`,
                description: description.value || `Watch ${title.value} online on Moovie.`,
                image: bannerUrl.value || 'https://m.moovie.fun/og-image.png',
                canonical: `https://m.moovie.fun/anime/${anime.value.id}`,
                type: isMovie ? 'video.movie' : 'video.tv_show',
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@type': isMovie ? 'Movie' : 'TVSeries',
                    'name': title.value,
                    'description': description.value,
                    'image': bannerUrl.value || undefined,
                    'dateCreated': rawAnime.startDate?.year
                        ? `${rawAnime.startDate.year}-${String(rawAnime.startDate.month || 1).padStart(2, '0')}-${String(rawAnime.startDate.day || 1).padStart(2, '0')}`
                        : undefined,
                    'aggregateRating': anime.value.averageScore ? {
                        '@type': 'AggregateRating',
                        'bestRating': '100',
                        'worstRating': '1',
                        'ratingValue': anime.value.averageScore,
                        'ratingCount': 100
                    } : undefined
                }
            });
            void loadTmdbArtwork(anime.value);
        } else {
            document.title = `${title.value} — Moovie`;
        }
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    loadAnime(Number(route.params.id));
});

watch(
    () => route.params.id,
    (newId) => {
        if (newId) loadAnime(Number(newId));
    }
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