<template>
    <div class="home">
        <SiteHeader />

        <main id="main" class="home__main" role="main">
            <BillboardHero
                :id="hero ? hero.id : ''"
                type="movie"
                :title="hero ? hero.title : ''"
                :tagline="heroTagline"
                :overview="hero ? hero.overview : ''"
                :backdrop-path="hero ? hero.backdrop_path : null"
                :poster-path="hero ? hero.poster_path : null"
                :rating="hero ? hero.vote_average : 0"
                :release-date="hero ? hero.release_date : ''"
                :genre-ids="hero ? hero.genre_ids : []"
                :adult="hero ? hero.adult : false"
                eyebrow="This week’s feature"
                :loading="isHomeLoading && !hero"
            />

            <TopTenRail
                class="home__section"
                :items="topTenItems"
                title="Top 10 Today"
                eyebrow="The Marquee"
                description="What the house is watching right now."
                :more-to="{ name: 'Movies' }"
                :loading="isHomeLoading"
            />

            <TopTenRail
                class="home__section"
                :items="topTenAnimeItems"
                title="Top 10 Anime Today"
                eyebrow="Anime"
                description="The most-watched anime blazing up the charts right now."
                :loading="isAnimeLoading"
            />

            <ContinueShelf class="home__section" />

            <CuratedRail
                v-if="fourKItems && fourKItems.length > 0"
                class="home__section"
                :items="fourKItems"
                title="Trending 4K Today"
                eyebrow="Ultra HD"
                description="Experience cinema in stunning 4K quality with our dedicated player."
                default-type="movie"
            />

            <CuratedRail
                v-if="marvelItems.length > 0"
                class="home__section"
                :items="marvelItems"
                title="Marvel Cinematic Universe"
                eyebrow="Marvel Studios"
                description="The legendary franchise — every hero, every battle, every saga."
                default-type="movie"
                :more-to="{ name: 'Movies', query: { company: '420', companyName: 'Marvel Studios' } }"
            />

            <CuratedRail
                v-if="warnerItems.length > 0"
                class="home__section"
                :items="warnerItems"
                title="Warner Bros. Classics & New Releases"
                eyebrow="Warner Bros. Pictures"
                description="A century of iconic storytelling from one of Hollywood's finest."
                default-type="movie"
                :more-to="{ name: 'Movies', query: { company: '174', companyName: 'Warner Bros. Pictures' } }"
            />

            <CuratedRail
                v-if="disneyItems.length > 0"
                class="home__section"
                :items="disneyItems"
                title="Walt Disney Presents"
                eyebrow="Walt Disney Pictures"
                description="Where imagination meets magic — timeless stories for every generation."
                default-type="movie"
                :more-to="{ name: 'Movies', query: { company: '2', companyName: 'Walt Disney Pictures' } }"
            />

            <CuratedRail
                v-if="universalItems.length > 0"
                class="home__section"
                :items="universalItems"
                title="Universal Studios Collection"
                eyebrow="Universal Pictures"
                description="Blockbusters and award-winners from the world's oldest major studio."
                default-type="movie"
                :more-to="{ name: 'Movies', query: { company: '33', companyName: 'Universal Pictures' } }"
            />

            <SpotlightModule
                v-if="spotlight"
                class="home__section"
                :id="spotlight.id"
                type="movie"
                :title="spotlight.title"
                :overview="spotlight.overview"
                :backdrop-path="spotlight.backdrop_path"
                :poster-path="spotlight.poster_path"
                :rating="spotlight.vote_average"
                :release-date="spotlight.release_date"
                eyebrow="The Feature"
                :pull-quote="spotlightQuote"
                attribution="Movieace Review"
            />

            <CuratedRail
                class="home__section"
                :items="nowPlayingItems"
                title="New to the marquee"
                eyebrow="Now Playing"
                description="Theatrical releases currently in rotation."
                :more-to="{ name: 'Movies' }"
            />

            <UpcomingRail
                class="home__section"
                :items="upcomingItems"
                title="Airing this week"
                eyebrow="On the Schedule"
                description="New episodes from shows in season."
                default-type="tv"
                :more-to="{ name: 'TVShows' }"
            />

            <CuratedRail
                class="home__section"
                :items="seriesItems"
                title="Series in rotation"
                eyebrow="Trending in Series"
                default-type="tv"
                :more-to="{ name: 'TVShows' }"
            />

            <CuratedRail
                class="home__section"
                :items="pantheonItems"
                title="The Pantheon"
                eyebrow="Reader Favorites"
                description="Titles our audience returns to, time after time."
                :more-to="{ name: 'Movies' }"
            />
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onBeforeUnmount, ref } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import BillboardHero from '../components/hero/BillboardHero.vue';
import SpotlightModule from '../components/hero/SpotlightModule.vue';
import ContinueShelf from '../components/rails/ContinueShelf.vue';
import TopTenRail from '../components/rails/TopTenRail.vue';
import CuratedRail from '../components/rails/CuratedRail.vue';
import UpcomingRail from '../components/rails/UpcomingRail.vue';
import useAxios from '../composables/useAxios';
import { useHighlights, highLightOptions } from '../composables/useHighlights';
import { useTvShows, newShows } from '../composables/useTvShows';
import type { TVShowType } from '../composables/useTvShows';
import { primeGenres } from '../composables/useGenreLookup';
import { applyGlobalBrowseCuration } from '../composables/useHomepageCuration';
import { getSettings } from '../composables/useSettings';
import { getSupabaseClient } from '../lib/supabase';
import { useAniList } from '../composables/useAniList';

interface UpcomingTvResponse {
    results: TVShowType[];
}

export default defineComponent({
    name: 'Home',
    components: {
        SiteHeader,
        SiteFooter,
        BillboardHero,
        SpotlightModule,
        ContinueShelf,
        TopTenRail,
        CuratedRail,
        UpcomingRail
    },
    setup() {
        const { fetchHighlights } = useHighlights();
        const { fetchNewShows } = useTvShows();
        const { region } = getSettings();

        const upcomingTv = ref<TVShowType[]>([]);
        const fourKItems = ref<any[]>([]);
        const marvelItems = ref<any[]>([]);
        const warnerItems = ref<any[]>([]);
        const disneyItems = ref<any[]>([]);
        const universalItems = ref<any[]>([]);
        const isHomeLoading = ref(true);

        const { fetchTrendingAnime } = useAniList();
        const trendingAnimeRaw = ref<any[]>([]);
        const isAnimeLoading = ref(true);

        const fetch4KMovies = async () => {
            try {
                const supabase = await getSupabaseClient();
                const { data } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', '4k_movies_today')
                    .single();
                if (data && data.value) {
                    const parsed = JSON.parse(data.value);
                    const mapped = parsed.map((m: any) => ({
                        id: m.id,
                        title: m.title,
                        originalTitle: m.originalTitle || m.title,
                        original_language: m.original_language || m.originalLanguage,
                        posterPath: m.posterPath,
                        rating: m.rating || 0,
                        releaseDate: m.releaseDate || '',
                        genreIds: m.genreIds || [],
                        adult: m.adult || false,
                        type: 'movie' as const,
                        query: { mode: '4k' }
                    }));
                    fourKItems.value =
                        region.value === 'global'
                            ? applyGlobalBrowseCuration(mapped, { excludeIndian: true })
                            : mapped;
                }
            } catch (err) {
                console.error('[📍 HOME PAGE] Failed to fetch 4K movies today:', err);
                fourKItems.value = [];
            }
        };

        const COMPANY_IDS = {
            marvel: '420',
            warner: '174',
            disney: '2',
            universal: '33'
        };

        const mapDiscoverResult = (m: any) => ({
            id: m.id,
            title: m.title,
            originalTitle: m.original_title,
            posterPath: m.poster_path,
            rating: m.vote_average,
            releaseDate: m.release_date,
            genreIds: m.genre_ids,
            adult: m.adult,
            type: 'movie' as const
        });

        const fetchCompanyMovies = async (companyId: string, targetRef: any) => {
            try {
                const res = await useAxios().get('discover/movie', {
                    params: {
                        with_companies: companyId,
                        sort_by: 'popularity.desc',
                        'vote_count.gte': 100,
                        page: 1
                    }
                });
                const results = (res.data?.results ?? []) as any[];
                targetRef.value = results.slice(0, 20).map(mapDiscoverResult);
            } catch (err) {
                console.error(`[📍 HOME PAGE] Failed to fetch company movies (${companyId}):`, err);
                targetRef.value = [];
            }
        };

        const hero = computed(() => highLightOptions.featured.data?.[0] ?? null);

        const spotlight = computed(() => {
            const pool = highLightOptions.featured.data ?? [];
            return pool[1] ?? pool[0] ?? null;
        });

        const heroTagline = computed(() => {
            const genres = hero.value?.genre_ids?.slice(0, 2).join(' · ');
            return genres ? '' : '';
        });

        const spotlightQuote = computed(() => {
            const overview = spotlight.value?.overview ?? '';
            if (!overview) return '';
            const firstSentence = overview.split(/(?<=[.!?])\s/)[0] ?? overview;
            return firstSentence.length > 220
                ? `${firstSentence.slice(0, 217).trim()}…`
                : firstSentence;
        });

        const topTenItems = computed(() =>
            (highLightOptions.popular.data ?? []).slice(0, 10).map(m => ({
                id: m.id,
                title: m.title,
                originalTitle: m.original_title,
                posterPath: m.poster_path,
                type: 'movie' as const
            }))
        );

        const topTenAnimeItems = computed(() =>
            trendingAnimeRaw.value.slice(0, 10).map(a => ({
                id: a.id,
                title: a.title?.english || a.title?.romaji || '',
                posterPath: a.coverImage?.large || a.coverImage?.medium || null,
                type: 'anime' as const
            }))
        );

        const nowPlayingItems = computed(() =>
            (highLightOptions.new.data ?? []).slice(0, 18).map(m => ({
                id: m.id,
                title: m.title,
                originalTitle: m.original_title,
                posterPath: m.poster_path,
                rating: m.vote_average,
                releaseDate: m.release_date,
                genreIds: m.genre_ids,
                adult: m.adult,
                type: 'movie' as const
            }))
        );

        const pantheonItems = computed(() =>
            (highLightOptions.popular.data ?? []).slice(10, 28).map(m => ({
                id: m.id,
                title: m.title,
                originalTitle: m.original_title,
                posterPath: m.poster_path,
                rating: m.vote_average,
                releaseDate: m.release_date,
                genreIds: m.genre_ids,
                adult: m.adult,
                type: 'movie' as const
            }))
        );

        const seriesItems = computed(() =>
            (newShows.value ?? []).slice(0, 18).map(s => ({
                id: s.id,
                title: s.name,
                originalTitle: (s as any).original_name || s.original_title,
                posterPath: s.poster_path,
                rating: s.vote_average,
                releaseDate: s.first_air_date || s.release_date,
                genreIds: s.genre_ids,
                adult: s.adult,
                type: 'tv' as const
            }))
        );

        const upcomingItems = computed(() =>
            (upcomingTv.value ?? []).slice(0, 14).map(s => ({
                id: s.id,
                title: s.name,
                originalTitle: (s as any).original_name || s.original_title,
                backdropPath: s.backdrop_path,
                posterPath: s.poster_path,
                rating: s.vote_average,
                releaseDate: s.first_air_date || s.release_date,
                type: 'tv' as const
            }))
        );

        const fetchUpcomingTv = async () => {
            try {
                const res = await useAxios().get('tv/on_the_air', {
                    params: {
                        page: 1
                    }
                });
                const data = res.data as UpcomingTvResponse;
                upcomingTv.value = data.results ?? [];
            } catch (err) {
                upcomingTv.value = [];
            }
        };

        const loadData = async () => {
            console.log('[📍 HOME PAGE] loadData starting');
            isHomeLoading.value = true;
            highLightOptions.featured.data = [];
            highLightOptions.popular.data = [];
            highLightOptions.new.data = [];
            newShows.value = [];
            upcomingTv.value = [];
            fourKItems.value = [];

            try {
                console.log('[📍 HOME PAGE] Fetching all data from APIs...');
                // Fetch trending anime in parallel (non-blocking for rest of UI)
                fetchTrendingAnime(1, 10).then(res => {
                    trendingAnimeRaw.value = res?.data?.Page?.media ?? [];
                    isAnimeLoading.value = false;
                }).catch(() => { isAnimeLoading.value = false; });

                const restPromise = Promise.all([
                    fetchHighlights('popular'),
                    fetchHighlights('new'),
                    fetchNewShows(),
                    fetchUpcomingTv(),
                    fetch4KMovies(),
                    fetchCompanyMovies(COMPANY_IDS.marvel, marvelItems),
                    fetchCompanyMovies(COMPANY_IDS.warner, warnerItems),
                    fetchCompanyMovies(COMPANY_IDS.disney, disneyItems),
                    fetchCompanyMovies(COMPANY_IDS.universal, universalItems)
                ]);
                await fetchHighlights('featured');
                await restPromise;
                console.log('[📍 HOME PAGE] All data fetched ✅', {
                    featured: highLightOptions.featured.data.length,
                    popular: highLightOptions.popular.data.length,
                    new: highLightOptions.new.data.length,
                    newShows: newShows.value.length,
                    upcoming: upcomingTv.value.length,
                    fourKMoviesToday: fourKItems.value.length,
                    marvel: marvelItems.value.length,
                    warner: warnerItems.value.length,
                    disney: disneyItems.value.length,
                    universal: universalItems.value.length
                });
            } catch (err) {
                console.error('[📍 HOME PAGE] Error loading data:', err);
            } finally {
                isHomeLoading.value = false;
            }
        };

        const handleSettingsChange = () => {
            console.log('[📍 HOME PAGE] Region change event received - reloading homepage data');
            loadData();
        };

        const REFRESH_INTERVAL = 30 * 60 * 1000;
        let refreshTimer: ReturnType<typeof setInterval> | null = null;

        onMounted(() => {
            document.title = 'Moovie — Stream Movies, TV Shows & Anime Free';
            primeGenres();
            loadData();
            window.addEventListener('movora_settings_change', handleSettingsChange);
            refreshTimer = setInterval(loadData, REFRESH_INTERVAL);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('movora_settings_change', handleSettingsChange);
            if (refreshTimer) clearInterval(refreshTimer);
        });

        // NOTE: We rely solely on the movora_settings_change window event to reload
        // data when the region changes (see handleSettingsChange above).
        // A watch(region) watcher here would double-fire loadData() concurrently
        // with the event listener, causing both to clear highLightOptions.data and
        // race to repopulate it — leaving all carousels stuck in skeleton state.

        return {
            hero,
            spotlight,
            heroTagline,
            spotlightQuote,
            isHomeLoading,
            topTenItems,
            topTenAnimeItems,
            isAnimeLoading,
            nowPlayingItems,
            pantheonItems,
            seriesItems,
            upcomingItems,
            fourKItems,
            marvelItems,
            warnerItems,
            disneyItems,
            universalItems
        };
    }
});
</script>

<style lang="scss" scoped>
.home {
    position: relative;
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        position: relative;
    }

    &__section {
        margin-top: clamp(var(--s-8), 8vw, var(--s-10));

        &:last-of-type {
            margin-bottom: clamp(var(--s-8), 8vw, var(--s-10));
        }
    }
}
</style>
