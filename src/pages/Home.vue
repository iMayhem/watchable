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

            <ContinueShelf class="home__section" />

            <TopTenRail
                class="home__section"
                :items="topTenItems"
                title="Top 10 Today"
                eyebrow="The Marquee"
                description="What the house is watching right now."
                :more-to="{ name: 'Movies' }"
                :loading="isHomeLoading"
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
import { computed, defineComponent, onMounted, onBeforeUnmount, ref, watch } from 'vue';
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
import { getSettings } from '../composables/useSettings';

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
        const { fetchAllHighlights } = useHighlights();
        const { fetchNewShows } = useTvShows();
        const { region } = getSettings();

        const upcomingTv = ref<TVShowType[]>([]);
        const isHomeLoading = ref(true);

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
                console.log('[🎭 Upcoming] Fetching upcoming TV...');
                const res = await useAxios().get('tv/on_the_air', {
                    params: {
                        page: 1
                    }
                });
                const data = res.data as UpcomingTvResponse;
                console.log('[🎭 Upcoming] Loaded', data.results?.length || 0, 'items ✅');
                upcomingTv.value = data.results ?? [];
            } catch (err) {
                console.error('[🎭 Upcoming] Error', err);
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

            try {
                console.log('[📍 HOME PAGE] Fetching all data from APIs...');
                await Promise.all([
                    fetchAllHighlights(),
                    fetchNewShows(),
                    fetchUpcomingTv()
                ]);
                console.log('[📍 HOME PAGE] All data fetched ✅', {
                    featured: highLightOptions.featured.data.length,
                    popular: highLightOptions.popular.data.length,
                    new: highLightOptions.new.data.length,
                    newShows: newShows.value.length,
                    upcoming: upcomingTv.value.length
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

        onMounted(() => {
            document.title = 'Moovie — Stream Movies, TV Shows & Anime Free';
            primeGenres();
            console.log('[📍 HOME PAGE] Mounted, loading initial data');
            loadData();
            window.addEventListener('movora_settings_change', handleSettingsChange);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('movora_settings_change', handleSettingsChange);
        });

        // Watch region changes to reload data - this catches the case where the event listener
        // is removed during unmount before it fires
        watch(
            () => region.value,
            (newRegion, oldRegion) => {
                if (newRegion !== oldRegion && oldRegion !== undefined) {
                    console.log('[📍 HOME PAGE] Region changed via watch:', { oldRegion, newRegion });
                    loadData();
                }
            }
        );

        return {
            hero,
            spotlight,
            heroTagline,
            spotlightQuote,
            isHomeLoading,
            topTenItems,
            nowPlayingItems,
            pantheonItems,
            seriesItems,
            upcomingItems
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
