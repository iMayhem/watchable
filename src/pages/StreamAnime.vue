<template>
    <div class="watch-stage">
        <header class="watch-stage__chrome">
            <div class="watch-stage__chrome-inner">
                <div class="watch-stage__crumb">
                    <button
                        type="button"
                        class="watch-stage__back"
                        aria-label="Back to anime"
                        @click="goBack"
                    >
                        <ArrowLeft />
                    </button>
                    <p class="eyebrow">Now projecting</p>
                </div>

                <div class="watch-stage__title-block">
                    <h1 v-if="anime" class="watch-stage__title">{{ animeTitle }}</h1>
                    <span v-else class="watch-stage__title-skeleton" aria-hidden="true" />
                    <div class="watch-stage__episode-nav">
                        <button
                            type="button"
                            class="watch-stage__nav-btn"
                            :disabled="currentEpisode <= seasonFirstEpisode"
                            @click="goToEpisode(currentEpisode - 1)"
                            aria-label="Previous Episode"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                        <p class="meta watch-stage__code">
                            Episode {{ getEpisodeInSeasonNumber(currentEpisode) }}
                        </p>
                        <button
                            type="button"
                            class="watch-stage__nav-btn"
                            :disabled="currentEpisode >= seasonLastEpisode"
                            @click="goToEpisode(currentEpisode + 1)"
                            aria-label="Next Episode"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="watch-stage__actions">
                    <details
                        v-if="seasonsList.length > 1 || availableServers[activeServerIndex]?.name !== 'Videasy'"
                        class="watch-stage__options"
                    >
                        <summary class="watch-stage__options-trigger">
                            <span>Options</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </summary>

                        <div class="watch-stage__options-menu">
                            <div v-if="seasonsList.length > 1" class="watch-stage__option-group">
                                <label class="eyebrow watch-stage__option-label" for="anime-season-select">
                                    Season / Arc
                                </label>
                                <select
                                    id="anime-season-select"
                                    :value="activeSeasonSelectValue"
                                    class="watch-stage__option-select"
                                    @change="goToSeason(Number(($event.target as HTMLSelectElement).value))"
                                >
                                    <option
                                        v-for="s in seasonsList"
                                        :key="s.id"
                                        :value="s.id"
                                    >
                                        {{ s.label }}
                                    </option>
                                </select>
                            </div>

                            <div
                                v-if="availableServers[activeServerIndex]?.name !== 'Videasy'"
                                class="watch-stage__option-group"
                            >
                                <p class="eyebrow watch-stage__option-label">Language Pref</p>
                                <div class="watch-stage__language-tabs">
                                    <button
                                        type="button"
                                        class="watch-stage__language-btn"
                                        :class="{ 'is-active': activeLanguage === 'sub' }"
                                        @click="activeLanguage = 'sub'"
                                    >
                                        Subtitled
                                    </button>
                                    <button
                                        type="button"
                                        class="watch-stage__language-btn"
                                        :class="{ 'is-active': activeLanguage === 'dub' }"
                                        @click="activeLanguage = 'dub'"
                                    >
                                        Dubbed
                                    </button>
                                </div>
                            </div>
                        </div>
                    </details>

                    <ServerAccordion
                        variant="dropdown"
                        :servers="availableServers"
                        :active-server-index="activeServerIndex"
                        @server-change="activeServerIndex = $event"
                    />

                    <a
                        v-if="anime"
                        :href="partyHref"
                        class="watch-stage__party-btn"
                        title="Watch Together with friends!"
                        rel="nofollow"
                        @click.prevent="handleWatchTogether"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="watch-stage__party-icon">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span class="button-text">Watch Together</span>
                    </a>
                </div>
            </div>
        </header>

        <main class="watch-stage__main" id="main">
            <div class="watch-stage__theater">
                <div class="watch-stage__player-container">
                    <StreamFrame
                        :embed-url="currentEmbedUrl"
                        :title="animeTitle || 'Anime Player'"
                        :backdrop-path="tmdbBackdropPath || anime?.bannerImage || anime?.coverImage?.large || ''"
                        :poster-path="tmdbPosterPath || anime?.coverImage?.large || ''"
                        :media-id="animeId"
                        media-type="anime"
                        :embed-provider="isAnimeplayServer ? 'animeplay' : 'default'"
                        :episode="currentEpisode"
                        @switch-to-server="activeServerIndex = $event"
                    />
                </div>

            </div>

            <!-- Highly Optimized Paginated Square Grid Episode Navigator with Search filter -->
            <section v-if="anime" class="watch-stage__rack">
                <div class="episode-navigator">
                    <header class="episode-navigator__head">
                        <div class="episode-navigator__heading">
                            <p class="eyebrow">Reel order</p>
                            <h3 class="episode-navigator__title">
                                Episodes
                                <span v-if="!isLoadingTmdb" class="meta episode-navigator__count">
                                    · {{ totalEpisodes }} episodes
                                </span>
                                <span v-else class="meta episode-navigator__count">· Loading…</span>
                            </h3>
                        </div>

                        <!-- Find Episode and Range controls -->
                        <div class="episode-navigator__actions-row">
                            <!-- Direct Search Input -->
                            <div class="episode-search-bar">
                                <span class="search-hash">#</span>
                                <input
                                    type="text"
                                    placeholder="Find EP..."
                                    v-model="searchQuery"
                                    class="episode-search-input"
                                />
                            </div>

                            <!-- Range Stepper (Hidden if searching) -->
                            <div v-if="!searchQuery && ranges.length > 1" class="episode-navigator__controls" role="group" aria-label="Episode range selector">
                                <button
                                    type="button"
                                    class="episode-navigator__nav"
                                    :disabled="activeRangeIndex <= 0"
                                    aria-label="Previous episode range"
                                    @click="activeRangeIndex--"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width: 16px; height: 16px;">
                                        <path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </button>
                                <span class="episode-navigator__current" aria-live="polite">
                                    {{ ranges[activeRangeIndex]?.label }}
                                </span>
                                <button
                                    type="button"
                                    class="episode-navigator__nav"
                                    :disabled="activeRangeIndex >= ranges.length - 1"
                                    aria-label="Next episode range"
                                    @click="activeRangeIndex++"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width: 16px; height: 16px;">
                                        <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </header>

                    <!-- paginated grid of episodes matching reference design -->
                    <div class="episode-grid-container">
                        <div v-if="displayedEpisodes.length === 0" class="no-results meta">
                            No matching episodes found.
                        </div>
                        <div v-else class="episode-squares-grid">
                            <button
                                v-for="ep in displayedEpisodes"
                                :key="ep"
                                type="button"
                                class="ep-square"
                                :class="{ 
                                    'is-active': ep === currentEpisode,
                                    'has-progress': animeProgress(ep) > 0
                                }"
                                :title="getEpisodeTooltip(ep)"
                                @click="goToEpisode(ep)"
                            >
                                <span class="ep-square__number">{{ getEpisodeInSeasonNumber(ep) }}</span>
                                <div
                                    v-if="animeProgress(ep) > 0"
                                    class="ep-square__progress-dot"
                                    :style="{ opacity: ep === currentEpisode ? 0.9 : 0.6 }"
                                />
                            </button>
                        </div>
                    </div>

                </div>
            </section>



            <section v-if="anime" class="watch-stage__rack">
                <CommentsSection :media-id="animeId" media-type="anime" />
            </section>

            <p class="watch-stage__disclaimer meta">
                Streams are mirrored from third-party providers. moovie does not host video files.
            </p>
        </main>

        <UpNextDrawer
            v-if="anime && seasonsList.length"
            :current-season="currentSeasonNumber"
            :current-episode="currentEpisode"
            :season-episodes="seasonEpisodes"
            :next-season-number="nextSeasonNumber"
            :next-season-episodes="nextSeasonEpisodes"
            :is-loading="isLoadingTmdb"
            :seasons="seasonsDropdownList"
            :preview-episodes="previewEpisodes"
            :is-preview-loading="isPreviewLoading"
            @select="onUpNextSelect"
            @season-change="onUpNextSeasonChange"
            @preview-season="onPreviewSeason"
        />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAniList } from '../composables/useAniList';
import { saveProgress, getProgressPercent } from '../composables/useProgress';
import { addViewedItem } from '../composables/useHistory';
import { Server } from '../composables/useStream';
import { Episode } from '../composables/useTvShows';
import StreamFrame from '../components/player/StreamFrame.vue';
import ServerAccordion from '../components/player/ServerAccordion.vue';
import UpNextDrawer from '../components/player/UpNextDrawer.vue';
import ArrowLeft from '../components/svg/outline/arrow-left-long.vue';
import { useAppPaths } from '../composables/useAppPaths';
import CommentsSection from '../components/player/CommentsSection.vue';
import {
    findEpisodeByNumber,
    sortEpisodes,
    type EpisodeLike
} from '../utils/episodeAvailability';
import { resolveAnimeplayStreamEpisode } from '../composables/useAnimeplay';
import {
    buildAnimeEmbedUrl,
    estimateAnimeEpisodeTotal,
    findTmdbSeasonTabForEpisode,
    getCachedAnimeTmdbArtwork,
    resolveAnimeTmdbEpisodes,
    resolveAnimeTmdbMeta,
    resolveAnimeTmdbMetaByTmdbId,
    getAnilistIdForTmdbId,
    type AnimeTmdbArtwork,
    type AnimeTmdbEpisode
} from '../composables/useAnimeTmdbArtwork';
import { useWebImage } from '../utils/useWebImage';

export default defineComponent({
    name: 'StreamAnime',
    components: {
        ArrowLeft,
        ServerAccordion,
        StreamFrame,
        UpNextDrawer,
        CommentsSection
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const paths = useAppPaths();
        const { fetchAnimeById } = useAniList();

        const animeId = ref<number>(Number(route.params.id));
        const anime = ref<any | null>(null);
        const currentEpisode = ref<number>(1);
        const activeServerIndex = ref<number>(0);
        const activeLanguage = ref<'sub' | 'dub'>('sub');
        const activeRangeIndex = ref<number>(0);
        const searchQuery = ref<string>('');
        const seasonsTmdbIds = ref<Record<number, number>>({});

        const tmdbArtwork = ref<AnimeTmdbArtwork | null>(null);
        const nextSeasonTmdbArtwork = ref<AnimeTmdbArtwork | null>(null);
        const isLoadingTmdb = ref(false);
        const activeTmdbSeason = ref(1);

        const usesTmdbSeasonTabs = computed(() => tmdbArtwork.value?.usesTmdbSeasonTabs ?? false);

        const tmdbEpisodes = computed(() => tmdbArtwork.value?.episodes ?? []);

        const tmdbPosterPath = computed(() => {
            const path = tmdbArtwork.value?.posterPath;
            return path ? useWebImage(path, 'medium') : '';
        });

        const tmdbBackdropPath = computed(() => {
            const path = tmdbArtwork.value?.backdropPath || tmdbArtwork.value?.posterPath;
            return path ? useWebImage(path, 'large') : '';
        });

        const browsableTmdbEpisodes = computed(() => sortEpisodes(tmdbEpisodes.value));

        const browsableNextSeasonTmdbEpisodes = computed(() => {
            const eps = nextSeasonTmdbArtwork.value?.episodes ?? [];
            return sortEpisodes(eps);
        });

        const getEpisodeInSeasonNumber = (epNum: number) => {
            const match = tmdbEpisodes.value.find(e => e.episode_number === epNum);
            return match ? match.episode_in_season : epNum;
        };

        const getEpisodeTooltip = (epNum: number) => {
            const ep = findEpisodeByNumber(seasonEpisodes.value, epNum);
            const relEp = getEpisodeInSeasonNumber(epNum);
            if (!ep) return `Episode ${relEp}`;
            return ep.name ? `Episode ${relEp}: ${ep.name}` : `Episode ${relEp}`;
        };

        const animeTitle = computed(() => {
            if (!anime.value) return '';
            return anime.value.title.english || anime.value.title.romaji || anime.value.title.native;
        });

        const availableServers: Server[] = [
            { name: 'Shrikhand', urlTemplate: 'https://animeplay.cfd/stream/ani/{id}/{episode}/{lang}' },
            { name: 'Rabri', urlTemplate: 'https://megaplay.buzz/stream/ani/{id}/{episode}/{lang}' },
            { name: 'Barfi', urlTemplate: 'https://player.videasy.net/anime/{id}/{episode}?color=E05A47&autoplayNextEpisode=true&overlay=true' }
        ];

        const isAnimeplayServer = computed(() => {
            const server = availableServers[activeServerIndex.value];
            return server?.name === 'Shrikhand' || server?.name === 'Rabri';
        });

        const globalMaxEpisode = computed(() =>
            estimateAnimeEpisodeTotal(
                tmdbEpisodes.value,
                tmdbArtwork.value?.totalEpisodeCount ?? 0,
                anime.value?.nextAiringEpisode?.episode ?? 0
            )
        );



        const animeplayMaxEpisode = computed(() => {
            if (!isAnimeplayServer.value) return globalMaxEpisode.value;
            return resolveAnimeplayStreamEpisode(
                globalMaxEpisode.value,
                anime.value,
                globalMaxEpisode.value
            );
        });

        const syncSeasonTabForEpisode = (ep: number) => {
            if (!usesTmdbSeasonTabs.value) return;
            const tab = findTmdbSeasonTabForEpisode(ep, tmdbArtwork.value?.seasonTabs ?? []);
            if (tab) activeTmdbSeason.value = tab.seasonNumber;
        };

        const activeTmdbSeasonTab = computed(() => {
            if (!usesTmdbSeasonTabs.value) return null;
            return tmdbArtwork.value?.seasonTabs.find((tab) => tab.seasonNumber === activeTmdbSeason.value) ?? null;
        });

        const seasonEpisodeBounds = computed(() => {
            if (usesTmdbSeasonTabs.value && activeTmdbSeasonTab.value) {
                return {
                    first: activeTmdbSeasonTab.value.firstEpisode,
                    last: activeTmdbSeasonTab.value.lastEpisode
                };
            }
            const total = estimateAnimeEpisodeTotal(
                tmdbEpisodes.value,
                tmdbArtwork.value?.totalEpisodeCount ?? 0
            );
            return { first: 1, last: total };
        });

        const seasonFirstEpisode = computed(() => seasonEpisodeBounds.value.first);
        const seasonLastEpisode = computed(() => seasonEpisodeBounds.value.last);

        const totalEpisodes = computed(() => {
            if (isLoadingTmdb.value && !tmdbArtwork.value?.totalEpisodeCount) return 0;
            return seasonLastEpisode.value - seasonFirstEpisode.value + 1;
        });

        const ranges = computed(() => {
            const list = [];
            const step = 100;
            const { first, last } = seasonEpisodeBounds.value;
            for (let i = first; i <= last; i += step) {
                const end = Math.min(i + step - 1, last);
                list.push({
                    start: i,
                    end,
                    label: `${String(i).padStart(3, '0')}-${String(end).padStart(3, '0')}`
                });
            }
            return list;
        });

        // Watch currentEpisode to automatically set the range page index
        watch(
            [currentEpisode, ranges],
            ([ep, rgs]) => {
                if (rgs && rgs.length > 0) {
                    const idx = rgs.findIndex((r: any) => ep >= r.start && ep <= r.end);
                    if (idx !== -1) {
                        activeRangeIndex.value = idx;
                    }
                }
            },
            { immediate: true }
        );

        const displayedEpisodes = computed(() => {
            const { first, last } = seasonEpisodeBounds.value;
            if (searchQuery.value) {
                const cleanQuery = searchQuery.value.trim();
                const matched: number[] = [];
                const searchLast = usesTmdbSeasonTabs.value ? globalMaxEpisode.value : last;
                const searchFirst = usesTmdbSeasonTabs.value ? 1 : first;
                for (let ep = searchFirst; ep <= searchLast; ep++) {
                    if (String(ep).includes(cleanQuery)) {
                        matched.push(ep);
                    }
                }
                return matched.slice(0, 100);
            }

            const range = ranges.value[activeRangeIndex.value];
            if (!range) return [];
            const eps = [];
            for (let ep = range.start; ep <= range.end; ep++) {
                eps.push(ep);
            }
            return eps;
        });

        const isNavigatingToParty = ref(false);

        const currentEmbedUrl = computed(() => {
            if (isNavigatingToParty.value || !animeId.value || !anime.value) return '';
            const server = availableServers[activeServerIndex.value];
            const isMovie = anime.value?.format === 'MOVIE' || totalEpisodes.value === 1;

            const matchedAnilistId = getAnilistIdForTmdbId(animeId.value) || anime.value.id;

            return buildAnimeEmbedUrl(
                server.name,
                animeId.value,
                matchedAnilistId,
                currentEpisode.value,
                tmdbEpisodes.value,
                {
                    lang: activeLanguage.value,
                    isMovie,
                    seasonTabs: tmdbArtwork.value?.seasonTabs ?? []
                }
            );
        });

        const partyHref = computed(() => {
            const titleStr = `${animeTitle.value} - Episode ${currentEpisode.value}`;
            return `/party/?room=anime_${animeId.value}_ep${currentEpisode.value}&title=${encodeURIComponent(titleStr)}`;
        });

        const seasonsList = computed(() => {
            if (usesTmdbSeasonTabs.value && tmdbArtwork.value?.seasonTabs.length) {
                return tmdbArtwork.value.seasonTabs.map((tab) => ({
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

        const activeSeasonSelectValue = computed(() =>
            usesTmdbSeasonTabs.value ? activeTmdbSeason.value : animeId.value
        );

        const seasonsDropdownList = computed(() => {
            return seasonsList.value.map((s, idx) => ({
                number: idx + 1,
                label: s.label
            }));
        });

        const goToSeason = (id: number) => {
            if (usesTmdbSeasonTabs.value) {
                activeTmdbSeason.value = id;
                activeRangeIndex.value = 0;
                const tab = tmdbArtwork.value?.seasonTabs.find((s) => s.seasonNumber === id);
                if (tab) goToEpisode(tab.firstEpisode);
                return;
            }
            const targetTmdbId = seasonsTmdbIds.value[id] || id;
            if (targetTmdbId !== animeId.value) {
                router.push(paths.streamAnime(targetTmdbId, 1));
            }
        };

        const animeProgress = (epNumber: number) => {
            return getProgressPercent(animeId.value, 'anime', 1, epNumber) / 100;
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

        const loadAnime = async (id: number) => {
            try {
                let meta = await resolveAnimeTmdbMetaByTmdbId(id);
                let matchedAnilistId = getAnilistIdForTmdbId(id);

                if (!meta || !matchedAnilistId) {
                    const aniResponse = await fetchAnimeById(id);
                    const aniMedia = aniResponse?.data?.Media;
                    if (aniMedia) {
                        const resolvedMeta = await resolveAnimeTmdbMeta(id, aniMedia);
                        if (resolvedMeta?.tmdbId) {
                            router.replace(paths.streamAnime(resolvedMeta.tmdbId, currentEpisode.value));
                            return;
                        }
                    }
                }

                const anilistIdToFetch = matchedAnilistId || id;
                const response = await fetchAnimeById(anilistIdToFetch);
                const media = response?.data?.Media ?? null;
                anime.value = media;

                if (media) {
                    const cachedArtwork = getCachedAnimeTmdbArtwork(anilistIdToFetch) || meta;
                    addViewedItem({
                        id: id,
                        title: animeTitle.value,
                        image: cachedArtwork?.posterPath ? useWebImage(cachedArtwork.posterPath, 'medium') : media.coverImage.large,
                        rating: media.averageScore ? media.averageScore / 10 : 0,
                        categories: [],
                        adult: false,
                        type: 'anime'
                    });

                    resolveSeasonsTmdbIds();
                }
            } catch (err) {
                console.error('Failed to load anime for streaming:', err);
            }
        };

        const goBack = () => {
            router.push(paths.anime(animeId.value));
        };

        const handleWatchTogether = (event: MouseEvent) => {
            isNavigatingToParty.value = true;
            const target = event.currentTarget as HTMLAnchorElement;
            const href = target.href;
            setTimeout(() => {
                window.location.href = href;
            }, 50);
        };

        const goToEpisode = (ep: number) => {
            const maxEp = isAnimeplayServer.value
                ? animeplayMaxEpisode.value
                : globalMaxEpisode.value;
            if (ep < 1 || ep > maxEp) return;
            syncSeasonTabForEpisode(ep);
            currentEpisode.value = ep;
            router.push(paths.streamAnime(animeId.value, ep));
        };

        const currentSeasonIdx = computed(() => {
            if (!seasonsList.value.length) return -1;
            if (usesTmdbSeasonTabs.value) {
                return seasonsList.value.findIndex((s) => s.id === activeTmdbSeason.value);
            }
            if (!anime.value) return -1;
            return seasonsList.value.findIndex((s) => s.id === animeId.value);
        });

        const currentSeasonNumber = computed(() => {
            return currentSeasonIdx.value !== -1 ? currentSeasonIdx.value + 1 : 1;
        });

        const nextSeasonId = computed(() => {
            const idx = currentSeasonIdx.value;
            if (idx === -1 || idx + 1 >= seasonsList.value.length) return null;
            return seasonsList.value[idx + 1].id;
        });

        const nextSeasonNumber = computed(() => {
            return nextSeasonId.value ? (currentSeasonIdx.value + 2) : 0;
        });

        const nextSeasonCoverImage = ref<string>('');
        const nextSeasonTitle = ref<string>('');
        const nextSeasonMedia = ref<any | null>(null);

        const loadTmdbArtwork = async (media: any, target: 'current' | 'next' = 'current') => {
            if (!media?.id) {
                if (target === 'current') tmdbArtwork.value = null;
                else nextSeasonTmdbArtwork.value = null;
                return;
            }
            const setArtwork = (value: AnimeTmdbArtwork | null) => {
                if (target === 'current') tmdbArtwork.value = value;
                else nextSeasonTmdbArtwork.value = value;
            };

            if (target === 'current') isLoadingTmdb.value = true;
            try {
                const meta = await resolveAnimeTmdbMeta(media.id, media);
                if (meta) {
                    setArtwork(meta);
                    if (target === 'current' && meta.posterPath && anime.value) {
                        addViewedItem({
                            id: animeId.value,
                            title: animeTitle.value,
                            image: meta.posterPath,
                            rating: anime.value.averageScore ? anime.value.averageScore / 10 : 0,
                            categories: [],
                            adult: false,
                            type: 'anime'
                        });
                    }
                    if (target === 'current' && meta.usesTmdbSeasonTabs && meta.seasonTabs.length) {
                        syncSeasonTabForEpisode(currentEpisode.value);
                        if (!findTmdbSeasonTabForEpisode(currentEpisode.value, meta.seasonTabs)) {
                            activeTmdbSeason.value = meta.seasonTabs[0].seasonNumber;
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch TMDB meta for anime:', err);
                if (target === 'current') setArtwork(null);
            } finally {
                if (target === 'current') isLoadingTmdb.value = false;
            }

            try {
                await resolveAnimeTmdbEpisodes(media.id, media);
                const cached = getCachedAnimeTmdbArtwork(media.id);
                if (cached) {
                    setArtwork(cached);
                    if (target === 'current' && cached.usesTmdbSeasonTabs && cached.seasonTabs.length) {
                        syncSeasonTabForEpisode(currentEpisode.value);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch TMDB episodes for anime:', err);
            }
        };

        watch(nextSeasonId, async (id) => {
            if (!id) {
                nextSeasonCoverImage.value = '';
                nextSeasonTitle.value = '';
                nextSeasonMedia.value = null;
                nextSeasonTmdbArtwork.value = null;
                return;
            }

            if (usesTmdbSeasonTabs.value) {
                const tab = tmdbArtwork.value?.seasonTabs.find((s) => s.seasonNumber === id);
                nextSeasonTitle.value = tab?.label ?? '';
                nextSeasonCoverImage.value = tmdbPosterPath.value || anime.value?.coverImage?.large || '';
                nextSeasonMedia.value = anime.value;
                nextSeasonTmdbArtwork.value = tmdbArtwork.value;
                return;
            }

            nextSeasonMedia.value = null;
            nextSeasonTmdbArtwork.value = null;
            try {
                const response = await fetchAnimeById(id);
                const media = response?.data?.Media ?? null;
                nextSeasonMedia.value = media;
                if (media) {
                    nextSeasonCoverImage.value = media.coverImage.large || '';
                    nextSeasonTitle.value = media.title.english || media.title.romaji || media.title.native || '';
                    await loadTmdbArtwork(media, 'next');
                }
            } catch (err) {
                console.error('Failed to load next season details:', err);
                nextSeasonMedia.value = null;
            }
        }, { immediate: true });

        watch(anime, (media) => {
            if (media) {
                activeTmdbSeason.value = 1;
                loadTmdbArtwork(media, 'current');
            } else {
                tmdbArtwork.value = null;
            }
        }, { immediate: true });

        const mapBrowsableToEpisodes = (
            eps: EpisodeLike[],
            seasonNumber: number,
            fallbackImg: string,
            fallbackDesc: string
        ): Episode[] => {
            return eps.map((ep) => {
                const tmdbEp = ep as AnimeTmdbEpisode;
                const stillPath = tmdbEp.still_path
                    ? useWebImage(tmdbEp.still_path, 'medium')
                    : fallbackImg;
                return {
                    ...ep,
                    id: ep.episode_number,
                    name: ep.name || `Episode ${ep.episode_number}`,
                    overview: tmdbEp.overview || fallbackDesc,
                    still_path: stillPath,
                    air_date: ep.air_date || '',
                    episode_number: ep.episode_number,
                    season_number: tmdbEp.season_number ?? seasonNumber,
                    crew: [],
                    guest_stars: [],
                    production_code: '',
                    runtime: 0,
                    vote_average: 0,
                    vote_count: 0
                };
            }) as unknown as Episode[];
        };

        const episodesForTmdbTab = (seasonNumber: number) => {
            const tab = tmdbArtwork.value?.seasonTabs.find((s) => s.seasonNumber === seasonNumber);
            if (!tab) return [];
            return browsableTmdbEpisodes.value.filter(
                (ep) => ep.episode_number >= tab.firstEpisode && ep.episode_number <= tab.lastEpisode
            );
        };

        const seasonEpisodes = computed(() => {
            const fallbackImg = tmdbPosterPath.value || anime.value?.coverImage?.large || '';
            const desc = anime.value?.description || '';
            const eps = usesTmdbSeasonTabs.value
                ? episodesForTmdbTab(activeTmdbSeason.value)
                : browsableTmdbEpisodes.value;

            return mapBrowsableToEpisodes(
                eps,
                currentSeasonNumber.value,
                fallbackImg,
                desc
            );
        });

        const nextSeasonEpisodes = computed(() => {
            if (!nextSeasonId.value) return [];
            const fallbackImg = tmdbPosterPath.value || nextSeasonCoverImage.value;

            if (usesTmdbSeasonTabs.value) {
                return mapBrowsableToEpisodes(
                    episodesForTmdbTab(nextSeasonId.value),
                    nextSeasonNumber.value,
                    fallbackImg,
                    ''
                );
            }

            const poster = nextSeasonTmdbArtwork.value?.posterPath
                ? useWebImage(nextSeasonTmdbArtwork.value.posterPath, 'medium')
                : nextSeasonCoverImage.value;
            return mapBrowsableToEpisodes(
                browsableNextSeasonTmdbEpisodes.value,
                nextSeasonNumber.value,
                poster,
                ''
            );
        });

        const onUpNextSelect = (payload: { season: number; episode: number }) => {
            if (usesTmdbSeasonTabs.value) {
                const tab = tmdbArtwork.value?.seasonTabs[payload.season - 1];
                if (tab) {
                    activeTmdbSeason.value = tab.seasonNumber;
                    goToEpisode(payload.episode);
                }
                return;
            }

            const targetSeasonIdx = payload.season - 1;
            const targetAnime = seasonsList.value[targetSeasonIdx];
            if (targetAnime) {
                const targetTmdbId = seasonsTmdbIds.value[targetAnime.id] || targetAnime.id;
                if (targetTmdbId !== animeId.value) {
                    router.push(paths.streamAnime(targetTmdbId, payload.episode));
                } else {
                    goToEpisode(payload.episode);
                }
            } else {
                goToEpisode(payload.episode);
            }
        };

        const onUpNextSeasonChange = (next: number) => {
            if (usesTmdbSeasonTabs.value) {
                const tab = tmdbArtwork.value?.seasonTabs[next - 1];
                if (tab) goToSeason(tab.seasonNumber);
                return;
            }

            const targetSeasonIdx = next - 1;
            const targetAnime = seasonsList.value[targetSeasonIdx];
            if (targetAnime) {
                const targetTmdbId = seasonsTmdbIds.value[targetAnime.id] || targetAnime.id;
                if (targetTmdbId !== animeId.value) {
                    router.push(paths.streamAnime(targetTmdbId, 1));
                }
            }
        };

        // Keyboard navigation for step increment
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            // Only change episode with Ctrl+Arrow, let plain arrows seek in video
            if (e.key === 'ArrowLeft' && e.ctrlKey) {
                e.preventDefault();
                if (currentEpisode.value > 1) {
                    goToEpisode(currentEpisode.value - 1);
                }
            } else if (e.key === 'ArrowRight' && e.ctrlKey) {
                e.preventDefault();
                if (currentEpisode.value < seasonLastEpisode.value) {
                    goToEpisode(currentEpisode.value + 1);
                }
            }
        };

        // Real-time message listener for auto-next and watch progress saving
        const handlePlayerMessage = (event: MessageEvent) => {
            let data = event.data;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    return;
                }
            }
            if (!data) return;

            // Handle Videasy progress tracking
            if (data.timestamp !== undefined && data.duration !== undefined) {
                saveProgress(animeId.value, 'anime', Number(data.timestamp), Number(data.duration), undefined, currentEpisode.value);
            }

            // Sync current episode from player if it auto-advances
            if (data.episode !== undefined && Number(data.episode) !== currentEpisode.value) {
                goToEpisode(Number(data.episode));
            }

            // Handle watch progress saving
            if (data.event === 'time' && data.time !== undefined && data.duration !== undefined) {
                saveProgress(animeId.value, 'anime', data.time, data.duration, undefined, currentEpisode.value);
            } else if (data.type === 'watching-log' && data.currentTime !== undefined && data.duration !== undefined) {
                saveProgress(animeId.value, 'anime', data.currentTime, data.duration, undefined, currentEpisode.value);
            }

            // Handle auto-next
            if (data.event === 'complete') {
                const nextEp = currentEpisode.value + 1;
                if (nextEp <= seasonLastEpisode.value) {
                    goToEpisode(nextEp);
                }
            }
        };

        const previewEpisodes = ref<Episode[]>([]);
        const isPreviewLoading = ref(false);

        const onPreviewSeason = async (seasonIdx: number) => {
            if (seasonIdx === currentSeasonNumber.value) {
                previewEpisodes.value = [];
                return;
            }
            isPreviewLoading.value = true;
            try {
                const targetSeason = seasonsList.value[seasonIdx - 1];
                if (targetSeason) {
                    const animeRes = await fetchAnimeById(targetSeason.id);
                    const media = animeRes?.data?.Media ?? null;
                    if (media) {
                        const meta = await resolveAnimeTmdbMeta(targetSeason.id, media);
                        const episodes = await resolveAnimeTmdbEpisodes(targetSeason.id, media);
                        const browsable = sortEpisodes(episodes.length ? episodes : meta?.episodes ?? []);
                        const poster = meta?.posterPath
                            ? useWebImage(meta.posterPath, 'medium')
                            : media.coverImage?.large || '';
                        previewEpisodes.value = mapBrowsableToEpisodes(
                            browsable,
                            seasonIdx,
                            poster,
                            media.description || ''
                        );
                    }
                }
            } catch (err) {
                console.error('Failed to load anime season preview:', err);
            } finally {
                isPreviewLoading.value = false;
            }
        };

        onMounted(() => {
            const epParam = route.params.episode;
            if (epParam) {
                currentEpisode.value = parseInt(epParam as string) || 1;
            }
            loadAnime(animeId.value);
            window.addEventListener('message', handlePlayerMessage);
            window.addEventListener('keydown', handleKeyDown);
        });

        onUnmounted(() => {
            window.removeEventListener('message', handlePlayerMessage);
            window.removeEventListener('keydown', handleKeyDown);
        });

        watch(
            () => route.params.id,
            (id) => {
                const parsed = Number(id);
                if (!parsed || parsed === animeId.value) return;
                animeId.value = parsed;
                loadAnime(parsed);
            }
        );

        watch(
            () => route.params.episode,
            (newEp) => {
                if (!newEp) return;
                const ep = parseInt(newEp as string) || 1;
                const maxEp = isAnimeplayServer.value
                    ? animeplayMaxEpisode.value
                    : globalMaxEpisode.value;
                const resolved = ep > maxEp && maxEp > 0 ? maxEp : ep;
                syncSeasonTabForEpisode(resolved);
                currentEpisode.value = resolved;
                if (resolved !== ep && maxEp > 0) {
                    router.replace(paths.streamAnime(animeId.value, resolved));
                }
            }
        );

        watch([globalMaxEpisode, animeplayMaxEpisode, tmdbArtwork, activeServerIndex], () => {
            const maxEp = isAnimeplayServer.value
                ? animeplayMaxEpisode.value
                : globalMaxEpisode.value;
            if (maxEp > 0 && currentEpisode.value > maxEp) {
                goToEpisode(maxEp);
            } else {
                syncSeasonTabForEpisode(currentEpisode.value);
            }
        });

        return {
            animeId,
            anime,
            animeTitle,
            currentEpisode,
            totalEpisodes,
            seasonFirstEpisode,
            seasonLastEpisode,
            activeSeasonSelectValue,
            tmdbPosterPath,
            tmdbBackdropPath,
            activeServerIndex,
            availableServers,
            isAnimeplayServer,
            currentEmbedUrl,
            partyHref,
            seasonsList,
            goToSeason,
            activeLanguage,
            animeProgress,
            ranges,
            activeRangeIndex,
            searchQuery,
            displayedEpisodes,
            currentSeasonNumber,
            seasonEpisodes,
            nextSeasonNumber,
            nextSeasonEpisodes,
            onUpNextSelect,
            onUpNextSeasonChange,
            goBack,
            handleWatchTogether,
            goToEpisode,
            getEpisodeTooltip,
            getEpisodeInSeasonNumber,
            isLoadingTmdb,
            seasonsDropdownList,
            previewEpisodes,
            isPreviewLoading,
            onPreviewSeason
        };
    }
});
</script>

<style lang="scss" scoped>
.watch-stage {
    height: 100vh;
    height: 100dvh;
    overflow-y: scroll;
    scroll-snap-type: y proximity;
    scroll-behavior: smooth;
    background-color: var(--ink-950);
    color: var(--bone-50);

    // Hide scrollbar visually but keep it functional
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }

    @media (max-width: 1023px) {
        height: auto;
        min-height: 100dvh;
        scroll-snap-type: none;
        overflow-x: hidden;
    }

    &__chrome {
        background: rgba(10, 10, 12, 0.85);
        backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--rule);
        position: sticky;
        top: 0;
        z-index: 10;
    }

    &__chrome-inner {
        max-width: 1440px;
        margin: 0 auto;
        padding: 0.75rem var(--s-6);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);

        @media (max-width: 1023px) {
            display: grid;
            grid-template-columns: auto 1fr auto;
            grid-template-areas: 'crumb title actions';
            gap: var(--s-3) var(--s-4);
        }

        @media (max-width: 640px) {
            grid-template-columns: auto 1fr;
            grid-template-areas:
                'crumb actions'
                'title title';
            padding: var(--s-2) var(--s-3);
            gap: var(--s-2);
        }
    }

    &__crumb {
        grid-area: crumb;
        display: flex;
        align-items: center;
        gap: var(--s-3);

        @media (max-width: 1023px) {
            .eyebrow {
                display: none !important;
            }
        }
    }

    &__back {
        background: none;
        border: none;
        color: var(--bone-200);
        cursor: pointer;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color var(--dur-fast), transform var(--dur-fast);

        &:hover {
            color: var(--ember);
            transform: translateX(-2px);
        }

        svg {
            width: 20px;
            height: 20px;
        }

        @media (max-width: 640px) {
            display: grid;
            place-items: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: var(--surface-tint);
            color: var(--bone-100);
            padding: 0;

            svg {
                width: 18px;
                height: 18px;
            }
        }
    }

    &__title-block {
        grid-area: title;
        text-align: center;
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 1.15rem;
        margin: 0;
        color: var(--bone-50);

        @media (max-width: 1023px) {
            display: none !important;
        }
    }

    &__title-skeleton {
        @media (max-width: 1023px) {
            display: none !important;
        }
    }

    &__code {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        color: var(--ember);
        margin-top: 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    &__episode-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 4px;
    }

    &__nav-btn {
        background: none;
        border: none;
        color: var(--bone-400);
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--r-sm);
        transition: color var(--dur-fast), background-color var(--dur-fast);

        &:hover:not(:disabled) {
            color: var(--ember);
            background: rgba(255, 255, 255, 0.08);
        }

        &:disabled {
            color: var(--bone-700);
            cursor: not-allowed;
            opacity: 0.35;
        }

        svg {
            width: 14px;
            height: 14px;
        }
    }

    &__actions {
        grid-area: actions;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--s-2);
        min-width: 0;
        flex-wrap: wrap;
    }

    &__options {
        position: relative;

        &[open] .watch-stage__options-trigger svg {
            transform: rotate(180deg);
        }
    }

    &__options-trigger {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        min-height: 38px;
        padding: 0.45rem 0.9rem;
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-pill);
        background: rgba(255, 255, 255, 0.08);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 700;
        list-style: none;
        cursor: pointer;

        &::-webkit-details-marker {
            display: none;
        }

        svg {
            width: 16px;
            height: 16px;
            transition: transform var(--dur-base) var(--ease-out);
        }

        @media (max-width: 640px) {
            width: 36px;
            min-height: 36px;
            padding: 0;
            justify-content: center;

            span {
                display: none;
            }
        }
    }

    &__options-menu {
        position: absolute;
        top: calc(100% + var(--s-2));
        right: 0;
        z-index: calc(var(--z-header) + 1);
        width: min(340px, calc(100vw - var(--s-4)));
        display: grid;
        gap: var(--s-4);
        padding: var(--s-4);
        border: 1px solid var(--rule);
        border-radius: var(--r-lg);
        background: rgba(19, 17, 14, 0.98);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(16px);
    }

    &__option-group {
        display: grid;
        gap: var(--s-2);
    }

    &__option-label {
        margin: 0;
        color: var(--bone-400);
    }

    &__option-select {
        width: 100%;
        min-height: 40px;
        padding: 0 2.4rem 0 0.9rem;
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        background: var(--ink-800);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
    }

    &__language-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s-2);
        padding: 4px;
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        background: rgba(0, 0, 0, 0.2);
    }

    &__language-btn {
        min-height: 34px;
        padding: 0.45rem 0.7rem;
        border-radius: var(--r-sm);
        color: var(--bone-300);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 600;
        transition: color var(--dur-fast), background-color var(--dur-fast);

        &:hover {
            color: var(--bone-50);
        }

        &.is-active {
            background: var(--ember);
            color: var(--ink-900);
        }
    }

    &__party-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        padding: 0.5rem 1rem;
        border-radius: var(--r-pill);
        background: linear-gradient(135deg, var(--ember) 0%, #ff8a00 100%);
        color: #000;
        font-weight: 600;
        font-size: 0.85rem;
        text-decoration: none;
        transition: transform var(--dur-fast), box-shadow var(--dur-fast);

        &:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 15px rgba(255, 90, 31, 0.35);
        }

        @media (max-width: 640px) {
            width: 36px;
            min-height: 36px;
            padding: 0;
            display: inline-grid;
            place-items: center;

            .button-text {
                display: none;
            }
        }
    }

    &__party-icon {
        width: 16px;
        height: 16px;
    }

    &__main {
        display: grid;
        gap: 0;
    }

    &__theater {
        display: grid;
        gap: var(--s-5);
        max-width: 1440px;
        width: 100%;
        margin: 0 auto;
        box-sizing: border-box;

        @media (max-width: 1023px) {
            display: flex;
            flex-direction: column;
            gap: var(--s-4);
            padding: var(--s-3);
            height: auto;
            min-height: 0;
        }

        @media (min-width: 1024px) {
            scroll-snap-align: start;
            scroll-snap-stop: always;
            height: 100dvh;
            padding: 72px var(--s-5) var(--s-2) var(--s-5);
            grid-template-columns: 1fr;
            align-items: stretch;
        }
    }

    &__player-container {
        min-width: 0;
        flex-shrink: 0;
        background: #000;
        border-radius: var(--r-md);
        overflow: hidden;
        border: 1px solid var(--rule);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);

        @media (max-width: 1023px) {
            width: 100%;

            :deep(.stream-frame__stage) {
                padding: 0;
            }

            :deep(.stream-frame__player) {
                border-radius: var(--r-md);
            }
        }

        @media (min-width: 1024px) {
            :deep(.stream-frame__stage) {
                padding: 0;
            }

            :deep(.stream-frame__player) {
                aspect-ratio: auto;
                height: clamp(300px, 38vw, 520px);
            }
        }
    }

    .player-stage-container {
        width: 100%;
        height: 100%;
    }

    .stream-iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: #000;
    }

    &__aside {
        min-width: 0;
        flex-shrink: 0;

        @media (max-width: 1023px) {
            padding: 0;
            width: 100%;
        }

        @media (min-width: 1024px) {
            position: relative;
            align-self: stretch;
        }

        :deep(.server-accordion) {
            @media (max-width: 1023px) {
                display: none !important;
            }
        }
    }

    &__server-picker {
        display: none;

        @media (max-width: 1023px) {
            position: relative;
            display: inline-flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--rule-strong);
            border-radius: var(--r-pill);
            padding: 0.5rem 2.25rem 0.5rem 1rem;
            min-height: 38px;
            font-family: var(--font-ui);
            font-size: var(--fs-sm);
            font-weight: 600;
            color: var(--bone-50);
            cursor: pointer;
            transition: background-color var(--dur-fast), border-color var(--dur-fast);

            &:hover {
                background: rgba(255, 255, 255, 0.12);
                border-color: var(--bone-400);
            }

            @media (max-width: 640px) {
                min-height: 36px;
                padding: 0.4rem 2rem 0.4rem 0.85rem;
            }
        }
    }

    &__server-select {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        -webkit-appearance: none;
    }

    &__server-select-arrow {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        color: var(--bone-300);

        svg {
            width: 100%;
            height: 100%;
        }

        @media (max-width: 640px) {
            right: 8px;
        }
    }

    &__rack {
        max-width: 1280px;
        width: 100%;
        margin: 0 auto;
        padding: 0 var(--s-4);
        box-sizing: border-box;

        @media (max-width: 1023px) {
            height: auto;
            min-height: 0;
            scroll-snap-align: none;
            align-content: start;
            padding: var(--s-5) var(--s-3) var(--s-4);
        }

        @media (min-width: 1024px) {
            scroll-snap-align: start;
            scroll-snap-stop: always;
            height: 100dvh;
            align-content: center;
            padding: 72px var(--s-5) var(--s-4) var(--s-5);
        }

        @media (min-width: 768px) {
            padding: 0 var(--s-5);
        }
    }

    &__feature {
        display: grid;
        gap: var(--s-6);
        max-width: 1280px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
        padding: var(--s-6) var(--s-4);

        @media (max-width: 1023px) {
            height: auto;
            min-height: 0;
            scroll-snap-align: none;
            align-content: start;
            padding: var(--s-5) var(--s-3) var(--s-4);
            grid-template-columns: 1fr;
        }

        @media (min-width: 1024px) {
            scroll-snap-align: start;
            scroll-snap-stop: always;
            height: 100dvh;
            align-content: center;
            padding: 72px var(--s-5) var(--s-4) var(--s-5);
            grid-template-columns: 280px 1fr;
            align-items: center;
        }

        @media (min-width: 768px) and (max-width: 1023px) {
            grid-template-columns: 1fr;
            align-items: start;
        }
    }

    &__poster {
        position: relative;
        aspect-ratio: 2 / 3;
        max-width: 280px;
        border-radius: var(--r-lg);
        overflow: hidden;
        box-shadow: var(--shadow-lg);
        margin: 0 auto;

        @media (max-width: 1023px) {
            display: none !important;
        }

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
    }

    &__feature-body {
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    &__feature-title {
        font-family: var(--font-display);
        font-size: 1.5rem;
        font-weight: 600;
        margin-top: var(--s-1);
        margin-bottom: var(--s-3);
    }

    &__meta {
        list-style: none;
        padding: 0;
        margin: 0 0 var(--s-4) 0;
        display: flex;
        gap: var(--s-5);
        font-size: var(--fs-sm);

        li {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .meta {
            font-size: var(--fs-xs);
            color: var(--bone-450);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
    }

    &__overview {
        color: var(--bone-300);
        line-height: 1.6;
        font-size: var(--fs-sm);
        max-width: 60ch;
    }

    &__disclaimer {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 var(--s-4);
        text-align: center;
        color: var(--bone-500);

        @media (max-width: 1023px) {
            padding: 0 var(--s-3) calc(var(--s-8) + env(safe-area-inset-bottom, 0px));
        }

        @media (min-width: 768px) {
            padding: 0 var(--s-5);
        }
    }
}

// Hide scroll car on all watch/stream pages
:global(.scroll-car-container) {
    display: none !important;
}

.language-switcher {
    background: var(--ink-800);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-4);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    min-width: 0;

    &__header {
        margin: 0;
    }

    &__tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s-2);
        background: rgba(0, 0, 0, 0.2);
        padding: 4px;
        border-radius: var(--r-sm);
        border: 1px solid var(--rule);
    }

    &__btn {
        padding: 0.5rem;
        border-radius: var(--r-sm);
        border: none;
        background: transparent;
        color: var(--bone-300);
        font-weight: 500;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all var(--dur-fast);

        &:hover {
            color: var(--bone-50);
        }

        &.is-active {
            background: var(--ember);
            color: #000;
            font-weight: 600;
        }
    }
}

.episode-navigator {
    background: var(--ink-800);
    border-radius: var(--r-lg);
    box-shadow: inset 0 0 0 1px var(--rule);
    padding: var(--s-5) var(--s-5);
    display: grid;
    gap: var(--s-5);

    @media (min-width: 768px) {
        padding: var(--s-6);
    }

    &__head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);
    }

    &__heading {
        display: grid;
        gap: 0.15rem;
    }

    &__title {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-2xl);
        letter-spacing: var(--ls-tight);
        color: var(--bone-50);
    }

    &__count {
        color: var(--bone-400);
    }

    &__actions-row {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        flex-wrap: wrap;
    }

    &__controls {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        background: var(--ink-700);
        padding: var(--s-1);
        border-radius: var(--r-pill);
        box-shadow: inset 0 0 0 1px var(--rule);
    }

    &__nav {
        all: unset;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        color: var(--bone-100);
        transition: background-color var(--dur-fast) var(--ease-out);

        &:hover:not(:disabled) {
            background: var(--ember);
            color: var(--ink-900);
        }

        &:disabled {
            opacity: 0.35;
            cursor: not-allowed;
        }

        svg {
            width: 16px;
            height: 16px;
        }
    }

    &__current {
        font-family: var(--font-mono);
        font-size: var(--fs-sm);
        color: var(--bone-50);
        padding: 0 var(--s-3);
    }
}

.episode-search-bar {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    background: var(--ink-700);
    padding: 0.4rem 0.8rem;
    border-radius: var(--r-md);
    box-shadow: inset 0 0 0 1px var(--rule);
    max-width: 160px;

    .search-hash {
        color: var(--ember);
        font-family: var(--font-mono);
        font-weight: bold;
        font-size: var(--fs-base);
    }

    .episode-search-input {
        background: transparent;
        border: none;
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        width: 100%;
        outline: none;

        &::placeholder {
            color: var(--bone-500);
        }
    }
}

.episode-grid-container {
    margin-top: var(--s-2);
}

.episode-squares-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    gap: var(--s-2);
    height: 280px;
    overflow-y: auto;
    padding-right: 4px;

    @media (max-width: 640px) {
        grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
        gap: 6px;
    }

    &::-webkit-scrollbar {
        width: 6px;
    }
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    &::-webkit-scrollbar-thumb {
        background: var(--rule-strong);
        border-radius: var(--r-pill);
    }
}

.ep-square {
    all: unset;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ink-700);
    border-radius: var(--r-sm);
    box-shadow: inset 0 0 0 1px var(--rule);
    cursor: pointer;
    position: relative;
    box-sizing: border-box;
    transition: all var(--dur-fast) var(--ease-out);

    @media (max-width: 640px) {
        border-radius: var(--r-xs);
    }

    &.is-upcoming {
        opacity: 0.45;
        cursor: not-allowed !important;
        background: rgba(255, 255, 255, 0.03);
        border: 1px dashed rgba(255, 255, 255, 0.15);
        color: var(--bone-500);

        &:hover {
            background: rgba(255, 255, 255, 0.03);
            border-color: rgba(255, 255, 255, 0.15);
            color: var(--bone-500);
            transform: none !important;
        }
    }

    &__number {
        font-family: var(--font-mono);
        font-size: var(--fs-base);
        font-weight: 500;
        color: var(--bone-200);

        @media (max-width: 640px) {
            font-size: var(--fs-xs);
        }
    }

    &:hover:not(.is-active):not(.is-upcoming):not(:disabled) {
        background: var(--ink-600);
        box-shadow: inset 0 0 0 1px var(--rule-strong);
        transform: scale(1.05);

        .ep-square__number {
            color: var(--bone-50);
        }
    }

    &:disabled {
        pointer-events: none;
    }

    &.is-active {
        background: var(--ember);
        box-shadow: 0 0 12px var(--ember-glow);
        transform: scale(1.05);

        .ep-square__number {
            color: var(--ink-950);
            font-weight: 700;
        }
    }

    &__progress-dot {
        position: absolute;
        bottom: 6px;
        right: 6px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ember);
        box-shadow: 0 0 6px var(--ember-glow);
    }
}

.no-results {
    text-align: center;
    padding: var(--s-5);
    color: var(--bone-400);
}

.season-switcher {
    background: var(--ink-800);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-4);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    min-width: 0;

    &__header {
        margin: 0;
    }

    &__select-wrapper {
        position: relative;
        width: 100%;
    }

    &__select {
        width: 100%;
        padding: 0.6rem 2.5rem 0.6rem 1rem;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--rule);
        border-radius: var(--r-sm);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        appearance: none;
        outline: none;
        transition: border-color var(--dur-fast), box-shadow var(--dur-fast);

        &:hover, &:focus {
            border-color: var(--ember);
        }
    }

    &__chevron {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        color: var(--bone-400);
        display: flex;
        align-items: center;
        justify-content: center;

        svg {
            width: 16px;
            height: 16px;
        }
    }
}

// Side-by-side row for season & language controls
.aside-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-3);

    // If only one child (no season or no language), stretch to full width
    > *:only-child {
        grid-column: span 2;
    }

    @media (max-width: 480px) {
        grid-template-columns: 1fr;

        > *:only-child {
            grid-column: span 1;
        }
    }
}

.episode-navigator__upcoming {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    margin-top: var(--s-4);
    padding: var(--s-3) var(--s-4);
    background: rgba(255, 90, 31, 0.05);
    border: 1px solid rgba(255, 90, 31, 0.25);
    border-radius: var(--r-md);
    font-size: var(--fs-sm);
    color: var(--bone-200);

    .upcoming-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        padding: 0.2rem 0.5rem;
        background: rgba(255, 90, 31, 0.12);
        border: 1px solid rgba(255, 90, 31, 0.3);
        border-radius: var(--r-pill);
        color: var(--ember);
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: var(--ls-micro);
        font-weight: 500;
        flex-shrink: 0;

        &__pulse {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--ember);
            box-shadow: 0 0 8px rgba(255, 90, 31, 0.4);
            animation: upcomingPulse 2s infinite;
        }
    }

    .upcoming-text {
        line-height: var(--lh-base);
        strong {
            color: var(--bone-50);
        }
    }
}

@keyframes upcomingPulse {
    0% { transform: scale(0.95); opacity: 0.5; }
    50% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 12px var(--ember); }
    100% { transform: scale(0.95); opacity: 0.5; }
}
</style>
