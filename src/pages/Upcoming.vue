<template>
    <div class="upcoming-page">
        <SiteHeader />

        <main id="main" class="upcoming-page__main" role="main">
            <div class="upcoming-page__content container-lm">
                <div class="upcoming-page__tabs-wrap">
                    <LmTabs
                        v-model="activeTab"
                        :tabs="tabs"
                        variant="pill"
                        aria-label="Upcoming categories"
                    />
                </div>

                <template v-if="activeTab === 'movies'">
                <section v-if="spotlightLoading" class="upcoming-spotlight upcoming-spotlight--skeleton" aria-hidden="true">
                    <div class="upcoming-spotlight__copy">
                        <div class="upcoming-spotlight__shimmer upcoming-spotlight__shimmer--eyebrow" />
                        <div class="upcoming-spotlight__shimmer upcoming-spotlight__shimmer--title" />
                        <div class="upcoming-spotlight__shimmer upcoming-spotlight__shimmer--date" />
                        <div class="upcoming-spotlight__shimmer upcoming-spotlight__shimmer--overview" />
                        <div class="upcoming-spotlight__shimmer upcoming-spotlight__shimmer--overview upcoming-spotlight__shimmer--overview-short" />
                        <div class="upcoming-spotlight__actions">
                            <div class="upcoming-spotlight__shimmer upcoming-spotlight__shimmer--btn" />
                            <div class="upcoming-spotlight__shimmer upcoming-spotlight__shimmer--btn" />
                        </div>
                    </div>
                    <div class="upcoming-spotlight__shimmer upcoming-spotlight__shimmer--video" />
                </section>

                <section v-else-if="spotlight" class="upcoming-spotlight">
                    <div class="upcoming-spotlight__copy">
                        <p class="eyebrow upcoming-spotlight__eyebrow">Next up</p>
                        <h2 class="upcoming-spotlight__title">{{ spotlight.title }}</h2>
                        <p class="upcoming-spotlight__date">{{ formatReleaseDate(spotlight.release_date) }}</p>
                        <p v-if="spotlight.overview" class="upcoming-spotlight__overview">
                            {{ spotlight.overview }}
                        </p>
                        <div class="upcoming-spotlight__actions">
                            <button
                                type="button"
                                class="btn btn-primary"
                                @click="openTrailer(spotlight)"
                            >
                                Watch trailer
                            </button>
                            <router-link :to="`/movie/${spotlight.id}`" class="btn btn-secondary">
                                View details
                            </router-link>
                        </div>
                    </div>

                    <button
                        type="button"
                        class="upcoming-spotlight__video"
                        :aria-label="`Play trailer for ${spotlight.title}`"
                        @click="openTrailer(spotlight)"
                    >
                        <img
                            :src="`https://i.ytimg.com/vi/${spotlight.trailers[0].key}/hqdefault.jpg`"
                            :alt="`${spotlight.title} trailer`"
                            loading="eager"
                            decoding="async"
                        />
                        <span class="upcoming-spotlight__play" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </span>
                    </button>
                </section>

                <header class="upcoming-page__section-head">
                    <div>
                        <p class="eyebrow">On the marquee</p>
                        <h2 class="upcoming-page__section-title">Opening soon</h2>
                    </div>
                </header>

                <div v-if="isLoading && !items.length" class="upcoming-page__grid">
                    <article v-for="n in 12" :key="n" class="upcoming-card upcoming-card--skeleton">
                        <div class="upcoming-card__poster upcoming-card__shimmer" />
                        <div class="upcoming-card__body">
                            <div class="upcoming-card__line upcoming-card__shimmer" style="width: 72%" />
                            <div class="upcoming-card__line upcoming-card__shimmer" style="width: 48%; margin-top: 8px" />
                            <div class="upcoming-card__trailer upcoming-card__shimmer" style="margin-top: 12px" />
                        </div>
                    </article>
                </div>

                <div v-else-if="!items.length" class="upcoming-page__empty">
                    <h3 class="display">Nothing scheduled yet.</h3>
                    <p class="meta">Check back soon — new release dates are filed weekly.</p>
                </div>

                <div v-else class="upcoming-page__grid">
                    <article
                        v-for="item in items"
                        :key="item.id"
                        class="upcoming-card"
                    >
                        <router-link :to="`/movie/${item.id}`" class="upcoming-card__poster-link">
                            <div class="upcoming-card__poster">
                                <img
                                    v-if="posterUrl(item.poster_path)"
                                    :src="posterUrl(item.poster_path)"
                                    :alt="item.title"
                                    loading="lazy"
                                    decoding="async"
                                />
                                <div v-else class="upcoming-card__poster-fallback">
                                    <span class="display display--italic">{{ item.title?.[0] ?? '·' }}</span>
                                </div>
                                <span class="upcoming-card__date-badge">{{ shortReleaseDate(item.release_date) }}</span>
                            </div>
                        </router-link>

                        <div class="upcoming-card__body">
                            <router-link :to="`/movie/${item.id}`" class="upcoming-card__title-link">
                                <h3 class="upcoming-card__title">{{ item.title }}</h3>
                            </router-link>
                            <p class="upcoming-card__date meta">{{ formatReleaseDate(item.release_date) }}</p>

                            <div v-if="item.trailersLoading" class="upcoming-card__trailer upcoming-card__trailer--loading">
                                <span class="meta">Checking for trailer…</span>
                            </div>

                            <button
                                v-else-if="item.trailers.length"
                                type="button"
                                class="upcoming-card__trailer"
                                @click="openTrailer(item)"
                            >
                                <span class="upcoming-card__trailer-thumb">
                                    <img
                                        :src="`https://i.ytimg.com/vi/${item.trailers[0].key}/mqdefault.jpg`"
                                        :alt="item.trailers[0].name"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <span class="upcoming-card__trailer-play" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </span>
                                </span>
                                <span class="upcoming-card__trailer-copy">
                                    <span class="upcoming-card__trailer-label">
                                        {{ item.trailers[0].official ? 'Official trailer' : item.trailers[0].type }}
                                    </span>
                                    <span class="upcoming-card__trailer-name">{{ item.trailers[0].name }}</span>
                                </span>
                            </button>

                            <p v-else class="upcoming-card__no-trailer meta">Trailer not published yet</p>
                        </div>
                    </article>
                </div>

                <div
                    v-if="items.length && (hasMore || isLoadingMore)"
                    ref="scrollSentinel"
                    class="upcoming-page__sentinel"
                    aria-hidden="true"
                >
                    <div v-if="isLoadingMore" class="upcoming-page__sentinel-grid">
                        <article
                            v-for="n in 4"
                            :key="`more-${n}`"
                            class="upcoming-card upcoming-card--skeleton"
                        >
                            <div class="upcoming-card__poster upcoming-card__shimmer" />
                            <div class="upcoming-card__body">
                                <div class="upcoming-card__line upcoming-card__shimmer" style="width: 72%" />
                                <div class="upcoming-card__line upcoming-card__shimmer" style="width: 48%; margin-top: 8px" />
                            </div>
                        </article>
                    </div>
                    <span v-else class="meta upcoming-page__sentinel-label">Loading more releases…</span>
                </div>
                </template>

                <template v-else>
                <header class="upcoming-page__section-head">
                    <div>
                        <p class="eyebrow">Season pipeline</p>
                        <h2 class="upcoming-page__section-title">Upcoming anime</h2>
                    </div>
                </header>

                <div v-if="animeLoading && !animeItems.length" class="upcoming-page__grid">
                    <article v-for="n in 8" :key="`anime-skel-${n}`" class="upcoming-card upcoming-card--skeleton">
                        <div class="upcoming-card__poster upcoming-card__shimmer" />
                        <div class="upcoming-card__body">
                            <div class="upcoming-card__line upcoming-card__shimmer" style="width: 72%" />
                            <div class="upcoming-card__line upcoming-card__shimmer" style="width: 48%; margin-top: 8px" />
                        </div>
                    </article>
                </div>

                <div v-else-if="!animeItems.length" class="upcoming-page__empty upcoming-page__empty--compact">
                    <p class="meta">No upcoming anime filed on AniList right now.</p>
                </div>

                <div v-else class="upcoming-page__grid">
                    <article
                        v-for="item in animeItems"
                        :key="`anime-${item.id}`"
                        class="upcoming-card"
                    >
                        <router-link :to="`/anime/${item.id}`" class="upcoming-card__poster-link">
                            <div class="upcoming-card__poster">
                                <img
                                    v-if="animePosterUrl(item)"
                                    :src="animePosterUrl(item)"
                                    :alt="item.title"
                                    loading="lazy"
                                    decoding="async"
                                />
                                <div v-else class="upcoming-card__poster-fallback">
                                    <span class="display display--italic">{{ item.title?.[0] ?? '·' }}</span>
                                </div>
                                <span class="upcoming-card__date-badge">{{ shortAnimeDate(item) }}</span>
                            </div>
                        </router-link>

                        <div class="upcoming-card__body">
                            <router-link :to="`/anime/${item.id}`" class="upcoming-card__title-link">
                                <h3 class="upcoming-card__title">{{ item.title }}</h3>
                            </router-link>
                            <p v-if="item.format" class="upcoming-card__format meta">{{ item.format }}</p>
                            <p class="upcoming-card__date meta">{{ animeScheduleLabel(item) }}</p>

                            <button
                                v-if="item.trailers.length"
                                type="button"
                                class="upcoming-card__trailer"
                                @click="openAnimeTrailer(item)"
                            >
                                <span class="upcoming-card__trailer-thumb">
                                    <img
                                        :src="`https://i.ytimg.com/vi/${item.trailers[0].key}/mqdefault.jpg`"
                                        :alt="item.trailers[0].name"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <span class="upcoming-card__trailer-play" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </span>
                                </span>
                                <span class="upcoming-card__trailer-copy">
                                    <span class="upcoming-card__trailer-label">Trailer</span>
                                    <span class="upcoming-card__trailer-name">{{ item.trailers[0].name }}</span>
                                </span>
                            </button>

                            <p v-else class="upcoming-card__no-trailer meta">Trailer not published yet</p>
                        </div>
                    </article>
                </div>

                <div
                    v-if="animeItems.length && (animeHasMore || animeLoadingMore)"
                    ref="animeScrollSentinel"
                    class="upcoming-page__sentinel"
                    aria-hidden="true"
                >
                    <div v-if="animeLoadingMore" class="upcoming-page__sentinel-grid">
                        <article
                            v-for="n in 4"
                            :key="`anime-more-${n}`"
                            class="upcoming-card upcoming-card--skeleton"
                        >
                            <div class="upcoming-card__poster upcoming-card__shimmer" />
                            <div class="upcoming-card__body">
                                <div class="upcoming-card__line upcoming-card__shimmer" style="width: 72%" />
                            </div>
                        </article>
                    </div>
                    <span v-else class="meta upcoming-page__sentinel-label">Loading more anime…</span>
                </div>
                </template>
            </div>
        </main>

        <TrailerDialog
            v-model="trailerOpen"
            :videos="activeTrailers"
            :title="activeTitle"
            @close="closeTrailer"
        />

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import TrailerDialog from '../components/detail/TrailerDialog.vue';
import LmTabs, { type TabDef } from '../components/primitives/Tabs.vue';
import useAxios from '../composables/useAxios';
import { getSettings } from '../composables/useSettings';
import { useSeo } from '../composables/useSeo';
import { useInfiniteScroll } from '../composables/useLazyLoad';
import { fetchTrailerVideos, type TrailerVideo } from '../composables/useTrailer';
import {
    queryAniListApi,
    type AniListFuzzyDate,
    type AniListMediaTrailer,
    type AnimeMedia,
    type AnimeResponse
} from '../composables/useAniList';
import {
    getCachedAnimeTmdbArtwork,
    resolveAnimeTmdbPosterBatch
} from '../composables/useAnimeTmdbArtwork';
import { useWebImage } from '../utils/useWebImage';
import type { Movie } from '../composables/useHighlights';
import type { MovieResponse } from '../composables/useMovies';

interface UpcomingEntry extends Movie {
    trailers: TrailerVideo[];
    trailersLoading: boolean;
}

interface UpcomingAnimeEntry {
    id: number;
    title: string;
    originalTitle: string;
    posterPath: string | null;
    overview: string;
    release_date: string;
    nextAiringAt: number | null;
    nextEpisode: number | null;
    format: string | null;
    trailers: TrailerVideo[];
}

const TRAILER_BATCH = 6;

const UPCOMING_ANIME_QUERY = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
            pageInfo {
                total
                currentPage
                lastPage
                hasNextPage
                perPage
            }
            media(
                type: ANIME,
                status: NOT_YET_RELEASED,
                sort: $sort,
                format_in: [TV, ONA, MOVIE, SPECIAL]
            ) {
                id
                idMal
                title {
                    romaji
                    english
                    native
                }
                coverImage {
                    extraLarge
                    large
                    medium
                }
                bannerImage
                description
                averageScore
                genres
                seasonYear
                episodes
                format
                status
                startDate {
                    year
                    month
                    day
                }
                trailer {
                    id
                    site
                }
                nextAiringEpisode {
                    airingAt
                    episode
                }
            }
        }
    }
`;

const fuzzyDateToIso = (date?: AniListFuzzyDate | null) => {
    if (!date?.year) return '';
    const month = String(date.month || 1).padStart(2, '0');
    const day = String(date.day || 1).padStart(2, '0');
    return `${date.year}-${month}-${day}`;
};

const anilistTrailerToVideos = (trailer?: AniListMediaTrailer | null): TrailerVideo[] => {
    if (!trailer?.id || trailer.site?.toLowerCase() !== 'youtube') return [];
    return [
        {
            id: trailer.id,
            key: trailer.id,
            name: 'Trailer',
            type: 'Trailer',
            site: 'YouTube',
            size: 1080,
            official: true
        }
    ];
};

const stripMarkup = (value: string | null | undefined) =>
    (value || '').replace(/<[^>]+>/g, '').trim();

const isUpcomingRelease = (dateStr: string) => {
    if (!dateStr) return true;
    const release = new Date(`${dateStr}T23:59:59`);
    return release.getTime() >= Date.now();
};

const formatReleaseDate = (dateStr: string) => {
    if (!dateStr) return 'Release date TBA';
    const release = new Date(`${dateStr}T12:00:00`);
    const now = new Date();
    const diffDays = Math.round((release.getTime() - now.getTime()) / 86400000);
    const formatted = release.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
    if (diffDays === 0) return `Opens today · ${formatted}`;
    if (diffDays === 1) return `Opens tomorrow · ${formatted}`;
    if (diffDays > 1 && diffDays < 14) return `Opens in ${diffDays} days · ${formatted}`;
    return `Opens ${formatted}`;
};

const shortReleaseDate = (dateStr: string) => {
    if (!dateStr) return 'TBA';
    const release = new Date(`${dateStr}T12:00:00`);
    return release.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
};

type UpcomingTab = 'movies' | 'anime';

export default defineComponent({
    name: 'Upcoming',
    components: { SiteHeader, SiteFooter, TrailerDialog, LmTabs },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const { region } = getSettings();

        const activeTab = ref<UpcomingTab>(
            route.query.tab === 'anime' ? 'anime' : 'movies'
        );
        const animeBootstrapped = ref(false);

        const items = ref<UpcomingEntry[]>([]);
        const isLoading = ref(true);
        const isLoadingMore = ref(false);
        const page = ref(1);
        const totalPages = ref(1);
        const scrollSentinel = ref<HTMLElement | null>(null);
        const animeScrollSentinel = ref<HTMLElement | null>(null);

        const animeItems = ref<UpcomingAnimeEntry[]>([]);
        const animeTmdbPosters = ref<Record<number, string>>({});
        const animeLoading = ref(false);
        const animeLoadingMore = ref(false);
        const animePage = ref(1);
        const animeHasMore = ref(false);

        const trailerOpen = ref(false);
        const activeTrailers = ref<TrailerVideo[]>([]);
        const activeTitle = ref('Trailers');

        const posterUrl = (path: string | null) =>
            path ? useWebImage(path, 'medium') : '';

        const animePosterUrl = (item: UpcomingAnimeEntry): string => {
            const tmdbPath = animeTmdbPosters.value[item.id];
            if (tmdbPath) return useWebImage(tmdbPath, 'large');
            return item.posterPath || '';
        };

        const animeScheduleLabel = (item: UpcomingAnimeEntry) => {
            if (item.release_date) {
                return formatReleaseDate(item.release_date).replace(/^Opens/, 'Airs');
            }
            if (item.nextAiringAt) {
                const iso = new Date(item.nextAiringAt * 1000).toISOString().slice(0, 10);
                const label = formatReleaseDate(iso).replace(/^Opens/, 'Airs');
                return item.nextEpisode ? `${label} · Ep ${item.nextEpisode}` : label;
            }
            return 'Air date TBA';
        };

        const shortAnimeDate = (item: UpcomingAnimeEntry) => {
            if (item.release_date) return shortReleaseDate(item.release_date);
            if (item.nextAiringAt) {
                return new Date(item.nextAiringAt * 1000).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
            }
            return 'TBA';
        };

        const spotlight = computed(() => {
            const withTrailers = items.value.filter(item => item.trailers.length > 0);
            return withTrailers[0] ?? null;
        });

        const spotlightLoading = computed(() => {
            if (isLoading.value) return true;
            if (spotlight.value) return false;
            if (!items.value.length) return false;
            return items.value.some(item => item.trailersLoading);
        });

        const hasMore = computed(() => page.value < totalPages.value);

        const tabs: TabDef[] = [
            { label: 'Movies', value: 'movies' },
            { label: 'Anime', value: 'anime' }
        ];

        const moviesScrollEnabled = computed(
            () => activeTab.value === 'movies' && hasMore.value
        );

        const animeScrollEnabled = computed(
            () => activeTab.value === 'anime' && animeHasMore.value
        );

        const releaseTime = (dateStr: string) =>
            dateStr ? new Date(dateStr).getTime() : Number.POSITIVE_INFINITY;

        const mergeUnique = (incoming: UpcomingEntry[], appendOnly = false) => {
            const seen = new Set(items.value.map(item => item.id));
            const fresh: UpcomingEntry[] = [];

            for (const entry of incoming) {
                if (seen.has(entry.id)) continue;
                seen.add(entry.id);
                fresh.push(entry);
            }

            if (!fresh.length) return;

            if (appendOnly) {
                items.value.push(...fresh);
                return;
            }

            items.value.push(...fresh);
            items.value.sort(
                (a, b) => releaseTime(a.release_date) - releaseTime(b.release_date)
            );
        };

        const hydrateTrailers = async (entries: UpcomingEntry[]) => {
            for (let i = 0; i < entries.length; i += TRAILER_BATCH) {
                const batch = entries.slice(i, i + TRAILER_BATCH);
                await Promise.all(
                    batch.map(async (entry) => {
                        try {
                            entry.trailers = await fetchTrailerVideos(entry.id, 'movie');
                        } catch {
                            entry.trailers = [];
                        } finally {
                            entry.trailersLoading = false;
                        }
                    })
                );
            }
        };

        const fetchPage = async (targetPage: number) => {
            const params: Record<string, string | number> = { page: targetPage };
            if (region.value && region.value !== 'global') {
                params.region = region.value;
            }

            const res = await useAxios().get('movie/upcoming', { params });
            const data = res.data as MovieResponse;

            page.value = data.page ?? targetPage;
            totalPages.value = data.total_pages ?? 1;

            const mapped = (data.results ?? [])
                .filter(movie => isUpcomingRelease(movie.release_date))
                .map(movie => ({
                    ...movie,
                    trailers: [] as TrailerVideo[],
                    trailersLoading: true
                }));

            mergeUnique(mapped, targetPage > 1);
            void hydrateTrailers(mapped);
        };

        const mapAnimeMedia = (media: AnimeMedia): UpcomingAnimeEntry => ({
            id: media.id,
            title: media.title.english || media.title.romaji,
            originalTitle: media.title.native || media.title.romaji,
            posterPath:
                media.coverImage?.extraLarge ||
                media.coverImage?.large ||
                media.coverImage?.medium ||
                null,
            overview: stripMarkup(media.description),
            release_date: fuzzyDateToIso(media.startDate),
            nextAiringAt: media.nextAiringEpisode?.airingAt ?? null,
            nextEpisode: media.nextAiringEpisode?.episode ?? null,
            format: media.format,
            trailers: anilistTrailerToVideos(media.trailer)
        });

        const mergeAnimeUnique = (incoming: UpcomingAnimeEntry[]) => {
            const seen = new Set(animeItems.value.map(item => item.id));
            const fresh: UpcomingAnimeEntry[] = [];

            for (const entry of incoming) {
                if (seen.has(entry.id)) continue;
                seen.add(entry.id);
                fresh.push(entry);
            }

            if (!fresh.length) return;

            animeItems.value.push(...fresh);
        };

        const hydrateAnimePosters = async (media: AnimeMedia[]) => {
            if (!media.length) return;

            const updates: Record<number, string> = {};
            const pending: AnimeMedia[] = [];

            for (const item of media) {
                const cached = getCachedAnimeTmdbArtwork(item.id);
                if (cached?.posterPath) {
                    updates[item.id] = cached.posterPath;
                } else {
                    pending.push(item);
                }
            }

            if (pending.length) {
                const resolved = await resolveAnimeTmdbPosterBatch(
                    pending.map(entry => ({
                        id: entry.id,
                        title: entry.title,
                        format: entry.format,
                        seasonYear: entry.seasonYear,
                        startDate: entry.startDate
                    }))
                ).catch(() => ({} as Record<number, string>));

                for (const [id, posterPath] of Object.entries(resolved)) {
                    if (posterPath) updates[Number(id)] = posterPath;
                }
            }

            if (Object.keys(updates).length) {
                animeTmdbPosters.value = { ...animeTmdbPosters.value, ...updates };
            }
        };

        const fetchAnimePage = async (targetPage: number) => {
            const response = (await queryAniListApi(UPCOMING_ANIME_QUERY, {
                page: targetPage,
                perPage: 24,
                sort: ['POPULARITY_DESC']
            })) as AnimeResponse;
            const pageInfo = response.data?.Page?.pageInfo;
            const media = response.data?.Page?.media ?? [];

            animePage.value = pageInfo?.currentPage ?? targetPage;
            animeHasMore.value = Boolean(pageInfo?.hasNextPage);

            const mapped = media.map(mapAnimeMedia);
            mergeAnimeUnique(mapped);
            void hydrateAnimePosters(media);
        };

        const loadMoviesInitial = async () => {
            isLoading.value = true;
            items.value = [];
            try {
                await fetchPage(1);
            } catch {
                items.value = [];
            } finally {
                isLoading.value = false;
            }
        };

        const ensureAnimeLoaded = async () => {
            if (animeBootstrapped.value || animeLoading.value) return;
            animeLoading.value = true;
            animeItems.value = [];
            animeTmdbPosters.value = {};
            try {
                await fetchAnimePage(1);
                animeBootstrapped.value = true;
                await drainAnimePagesIfNeeded();
            } catch {
                animeItems.value = [];
            } finally {
                animeLoading.value = false;
            }
        };

        const loadMore = async () => {
            if (!hasMore.value || isLoadingMore.value) return;
            isLoadingMore.value = true;
            try {
                await fetchPage(page.value + 1);
            } finally {
                isLoadingMore.value = false;
                void drainPagesIfNeeded();
            }
        };

        const sentinelNearViewport = () => {
            const el = scrollSentinel.value;
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.top <= window.innerHeight + 640;
        };

        const drainPagesIfNeeded = async () => {
            await nextTick();
            if (!hasMore.value || isLoadingMore.value || !sentinelNearViewport()) return;
            await loadMore();
            await drainPagesIfNeeded();
        };

        const loadMoreAnime = async () => {
            if (!animeHasMore.value || animeLoadingMore.value) return;
            animeLoadingMore.value = true;
            try {
                await fetchAnimePage(animePage.value + 1);
            } finally {
                animeLoadingMore.value = false;
                void drainAnimePagesIfNeeded();
            }
        };

        const animeSentinelNearViewport = () => {
            const el = animeScrollSentinel.value;
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.top <= window.innerHeight + 640;
        };

        const drainAnimePagesIfNeeded = async () => {
            await nextTick();
            if (!animeHasMore.value || animeLoadingMore.value || !animeSentinelNearViewport()) return;
            await loadMoreAnime();
            await drainAnimePagesIfNeeded();
        };

        useInfiniteScroll(scrollSentinel, loadMore, {
            enabled: moviesScrollEnabled,
            busy: isLoadingMore
        });

        useInfiniteScroll(animeScrollSentinel, loadMoreAnime, {
            enabled: animeScrollEnabled,
            busy: animeLoadingMore
        });

        watch(activeTab, (tab) => {
            const query = { ...route.query };
            if (tab === 'anime') {
                query.tab = 'anime';
                void ensureAnimeLoaded();
            } else {
                delete query.tab;
            }
            router.replace({ query });
        });

        const openTrailerFor = (title: string, trailers: TrailerVideo[]) => {
            if (!trailers.length) return;
            activeTrailers.value = trailers;
            activeTitle.value = title;
            trailerOpen.value = true;
        };

        const openTrailer = (item: UpcomingEntry) => openTrailerFor(item.title, item.trailers);

        const openAnimeTrailer = (item: UpcomingAnimeEntry) =>
            openTrailerFor(item.title, item.trailers);

        const closeTrailer = () => {
            trailerOpen.value = false;
        };

        onMounted(() => {
            updateSeo({
                title: 'Upcoming Movies, Anime & Trailers — Moovie',
                description:
                    'Browse upcoming theatrical releases and not-yet-aired anime with opening dates and YouTube trailers.',
                canonical: 'https://moovie.fun/upcoming'
            });
            if (activeTab.value === 'anime') {
                void ensureAnimeLoaded();
            } else {
                void loadMoviesInitial().then(() => drainPagesIfNeeded());
            }
        });

        return {
            activeTab,
            tabs,
            items,
            animeItems,
            isLoading,
            animeLoading,
            isLoadingMore,
            animeLoadingMore,
            hasMore,
            animeHasMore,
            scrollSentinel,
            animeScrollSentinel,
            spotlight,
            spotlightLoading,
            posterUrl,
            animePosterUrl,
            formatReleaseDate,
            shortReleaseDate,
            animeScheduleLabel,
            shortAnimeDate,
            trailerOpen,
            activeTrailers,
            activeTitle,
            openTrailer,
            openAnimeTrailer,
            closeTrailer
        };
    }
});
</script>

<style lang="scss" scoped>
.upcoming-page {
    position: relative;
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        padding-block: clamp(var(--s-5), 4vw, var(--s-6));
    }

    &__content {
        padding-top: var(--s-2);
    }

    &__tabs-wrap {
        margin-bottom: var(--s-6);
        overflow-x: auto;
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }
    }

    &__section-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--s-4);
        margin-bottom: var(--s-5);
    }

    &__section-title {
        font-family: var(--font-display);
        font-size: clamp(1.6rem, 3vw, 2.2rem);
        margin: var(--s-1) 0 0;
        font-weight: 500;
    }

    &__grid {
        display: grid;
        gap: var(--s-5);
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    }

    &__empty {
        padding: var(--s-8) 0;
        text-align: center;
        color: var(--bone-300);

        &--compact {
            padding: var(--s-4) 0 var(--s-6);
        }
    }

    &__sentinel {
        margin-top: var(--s-6);
        min-height: 1px;
    }

    &__sentinel-grid {
        display: grid;
        gap: var(--s-5);
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    }

    &__sentinel-label {
        display: block;
        text-align: center;
        padding: var(--s-4) 0 var(--s-6);
    }
}

.upcoming-spotlight {
    display: grid;
    gap: var(--s-6);
    margin-bottom: clamp(var(--s-6), 5vw, var(--s-8));
    padding: var(--s-6);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    background:
        radial-gradient(80% 120% at 0% 0%, rgba(255, 90, 31, 0.08), transparent 55%),
        var(--surface-tint);

    @media (min-width: 900px) {
        grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
        align-items: center;
    }

    &__eyebrow {
        color: var(--ember);
        margin: 0 0 var(--s-2);
    }

    &__title {
        font-family: var(--font-display);
        font-size: clamp(1.8rem, 4vw, 2.8rem);
        line-height: 1.05;
        margin: 0;
        font-weight: 500;
    }

    &__date {
        margin: var(--s-3) 0 0;
        color: var(--gold-leaf);
        font-family: var(--font-mono);
        font-size: var(--fs-sm);
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    &__overview {
        margin: var(--s-4) 0 0;
        color: var(--bone-300);
        line-height: 1.55;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    &__actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-3);
        margin-top: var(--s-5);
    }

    &__video {
        position: relative;
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        border: 0;
        padding: 0;
        border-radius: var(--r-md);
        overflow: hidden;
        cursor: pointer;
        background: var(--ink-800);
        box-shadow: var(--shadow-lg);

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform var(--dur-slow) var(--ease-out);
        }

        &:hover img {
            transform: scale(1.03);
        }
    }

    &__play {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(11, 10, 8, 0.35);

        svg {
            width: 56px;
            height: 56px;
            color: var(--bone-50);
            filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.45));
        }
    }

    &__shimmer {
        position: relative;
        overflow: hidden;
        border-radius: var(--r-sm);
        background: var(--ink-800);

        &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
            transform: translateX(-100%);
            animation: upcoming-shimmer 1.6s infinite ease-in-out;
        }

        &--eyebrow {
            width: 5.5rem;
            height: 0.75rem;
            margin-bottom: var(--s-2);
        }

        &--title {
            width: min(100%, 28rem);
            height: clamp(2rem, 5vw, 2.8rem);
        }

        &--date {
            width: 12rem;
            height: 0.875rem;
            margin-top: var(--s-3);
        }

        &--overview {
            width: 100%;
            height: 0.875rem;
            margin-top: var(--s-4);

            &-short {
                width: 72%;
                margin-top: var(--s-2);
            }
        }

        &--btn {
            width: 8.5rem;
            height: 2.75rem;
            border-radius: var(--r-pill);
        }

        &--video {
            width: 100%;
            aspect-ratio: 16 / 9;
            border-radius: var(--r-md);
        }
    }

    &--skeleton {
        pointer-events: none;
    }
}

.upcoming-card {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    background: var(--surface-tint);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    padding: var(--s-3);
    transition:
        border-color var(--dur-base) var(--ease-out),
        transform var(--dur-base) var(--ease-out);

    &:hover {
        border-color: rgba(255, 90, 31, 0.35);
        transform: translateY(-2px);
    }

    &__poster-link {
        color: inherit;
        text-decoration: none;
    }

    &__poster {
        position: relative;
        aspect-ratio: 2 / 3;
        border-radius: var(--r-sm);
        overflow: hidden;
        background: var(--ink-800);

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }

    &__poster-fallback {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: var(--bone-500);
        background: radial-gradient(80% 80% at 50% 30%, var(--ink-700), var(--ink-900));
        font-size: 2.5rem;
    }

    &__date-badge {
        position: absolute;
        top: 0.45rem;
        left: 0.45rem;
        padding: 0.2rem 0.45rem;
        border-radius: var(--r-sm);
        background: rgba(11, 10, 8, 0.78);
        backdrop-filter: blur(6px);
        color: var(--gold-leaf);
        font-family: var(--font-mono);
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }

    &__title-link {
        color: inherit;
        text-decoration: none;
    }

    &__title {
        margin: 0;
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 600;
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    &__date {
        margin: 0.25rem 0 0;
    }

    &__format {
        margin: 0.15rem 0 0;
        font-size: 0.625rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }

    &__no-trailer {
        margin: var(--s-2) 0 0;
        font-size: 0.6875rem;
    }

    &__trailer {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        width: 100%;
        margin-top: var(--s-2);
        padding: 0.35rem;
        border: 1px solid var(--rule);
        border-radius: var(--r-sm);
        background: rgba(11, 10, 8, 0.45);
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition:
            border-color var(--dur-fast) var(--ease-out),
            background-color var(--dur-fast) var(--ease-out);

        &:hover {
            border-color: rgba(255, 90, 31, 0.45);
            background: rgba(255, 90, 31, 0.08);
        }

        &--loading {
            justify-content: center;
            cursor: default;
            padding: 0.55rem;
        }
    }

    &__trailer-thumb {
        position: relative;
        flex: 0 0 72px;
        aspect-ratio: 16 / 9;
        border-radius: var(--r-xs);
        overflow: hidden;
        background: var(--ink-800);

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }

    &__trailer-play {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(11, 10, 8, 0.35);

        svg {
            width: 18px;
            height: 18px;
            color: var(--bone-50);
        }
    }

    &__trailer-copy {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
    }

    &__trailer-label {
        font-family: var(--font-mono);
        font-size: 0.58rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ember);
    }

    &__trailer-name {
        font-size: 0.6875rem;
        color: var(--bone-200);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__line {
        height: 12px;
        border-radius: var(--r-xs);
    }

    &__shimmer {
        position: relative;
        overflow: hidden;
        background: var(--ink-750);

        &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.04), transparent);
            transform: translateX(-100%);
            animation: upcoming-shimmer 1.6s infinite ease-in-out;
        }
    }

    &--skeleton {
        pointer-events: none;
    }
}

@keyframes upcoming-shimmer {
    100% {
        transform: translateX(100%);
    }
}
</style>