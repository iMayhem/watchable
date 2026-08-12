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
                eyebrow=""
                :loading="isHomeLoading && !hero"
            />

            <CuratedRail
                class="home__section"
                :items="trendingItems"
                title="Trending Now"
                :more-to="{ name: 'Movies' }"
            />

            <ContinueShelf class="home__section" />

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
                eyebrow=""
                :pull-quote="spotlightQuote"
            />

            <CuratedRail
                class="home__section"
                :items="pantheonItems"
                title="Top Rated"
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
import CuratedRail from '../components/rails/CuratedRail.vue';
import { useHighlights, highLightOptions } from '../composables/useHighlights';
import { primeGenres } from '../composables/useGenreLookup';

export default defineComponent({
    name: 'Home',
    components: {
        SiteHeader,
        SiteFooter,
        BillboardHero,
        SpotlightModule,
        ContinueShelf,
        CuratedRail
    },
    setup() {
        const { fetchHighlights } = useHighlights();
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

        const trendingItems = computed(() =>
            (highLightOptions.featured.data ?? []).slice(0, 10).map(m => ({
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

        const loadData = async () => {
            console.log('[📍 HOME PAGE] loadData starting');
            isHomeLoading.value = true;
            highLightOptions.featured.data = [];
            highLightOptions.popular.data = [];
            highLightOptions.new.data = [];

            try {
                const restPromise = Promise.all([
                    fetchHighlights('popular'),
                    fetchHighlights('new')
                ]);
                await fetchHighlights('featured');
                await restPromise;
                console.log('[📍 HOME PAGE] All data fetched ✅', {
                    featured: highLightOptions.featured.data.length,
                    popular: highLightOptions.popular.data.length,
                    new: highLightOptions.new.data.length
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
            trendingItems,
            pantheonItems
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
        margin-top: var(--shelf-gap);

        &:last-of-type {
            margin-bottom: var(--shelf-gap-mobile);
        }
    }
}
</style>
