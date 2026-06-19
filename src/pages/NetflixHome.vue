<template>
    <div class="home netflix-home">
        <SiteHeader />

        <main id="main" class="home__main" role="main">
            <BillboardHero
                :id="hero ? hero.id : ''"
                :type="hero ? hero.type : 'movie'"
                :title="hero ? hero.title : ''"
                :tagline="activeLang.nativeLabel"
                :overview="hero ? hero.overview : ''"
                :backdrop-path="hero ? hero.backdropPath : null"
                :poster-path="hero ? hero.posterPath : null"
                :rating="hero ? hero.rating : 0"
                :release-date="hero ? hero.releaseDate : ''"
                :genre-ids="[]"
                :eyebrow="`Featured · ${activeLang.label}`"
                :loading="isLoading && !hero"
                :play-to="heroPlayRoute"
                :detail-to="heroDetailRoute"
            />

            <CuratedRail
                v-if="trendingItems.length || isLoading"
                class="home__section"
                :items="trendingItems"
                title="Trending now"
                :eyebrow="activeLang.nativeLabel"
                :description="`Top ${activeLang.label} picks right now.`"
                catalog="netflix"
                :loading="isLoading"
            />

            <CuratedRail
                v-if="movieItems.length || isLoading"
                class="home__section"
                :items="movieItems"
                title="Films"
                eyebrow="Movies"
                :description="`${activeLang.label} movies in rotation.`"
                catalog="netflix"
                default-type="movie"
                :loading="isLoading"
            />

            <CuratedRail
                v-if="seriesItems.length || isLoading"
                class="home__section"
                :items="seriesItems"
                title="Series"
                eyebrow="Shows"
                :description="`${activeLang.label} series and seasons.`"
                catalog="netflix"
                default-type="tv"
                :loading="isLoading"
            />
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import BillboardHero from '../components/hero/BillboardHero.vue';
import CuratedRail, { type CuratedItem } from '../components/rails/CuratedRail.vue';
import {
    browseNetmirror,
    netmirrorRating,
    parseNetmirrorTitle,
    type NetmirrorBrowseItem
} from '../composables/useNetmirror';
import {
    getNetflixLanguage,
    getLanguageOption,
    itemMatchesLanguage,
    type NetflixLanguageOption
} from '../composables/useNetflixLanguage';
import { useSeo } from '../composables/useSeo';
import {
    mapWithConcurrency,
    resolveArtworkForNetmirrorItem
} from '../composables/useTmdbArtwork';

async function toCuratedItem(item: NetmirrorBrowseItem): Promise<CuratedItem> {
    const parsed = parseNetmirrorTitle(item.title || '');
    const artwork = await resolveArtworkForNetmirrorItem(item);

    return {
        id: item.id,
        title: parsed.displayTitle || item.title,
        originalTitle: parsed.languages.join(' · '),
        posterPath: artwork.posterPath || artwork.fallbackPath,
        backdropPath: artwork.backdropPath || artwork.fallbackPath,
        rating: netmirrorRating(item.vote_average),
        releaseDate: item.release_date || '',
        type: item.media_type === 'tv' ? 'tv' : 'movie',
        languageTags: parsed.languages
    };
}

export default defineComponent({
    name: 'NetflixHome',
    components: { SiteHeader, SiteFooter, BillboardHero, CuratedRail },
    setup() {
        const { updateSeo } = useSeo();
        const { language, activeLanguage } = getNetflixLanguage();
        const isLoading = ref(true);
        const trendingItems = ref<CuratedItem[]>([]);
        const movieItems = ref<CuratedItem[]>([]);
        const seriesItems = ref<CuratedItem[]>([]);

        const activeLang = computed<NetflixLanguageOption>(() => activeLanguage());

        const hero = computed(() => {
            const first = trendingItems.value[0] || movieItems.value[0] || seriesItems.value[0];
            if (!first) return null;
            return {
                id: first.id,
                type: first.type || 'movie',
                title: first.title,
                overview: '',
                backdropPath: first.backdropPath || first.posterPath,
                posterPath: first.posterPath,
                rating: first.rating || 0,
                releaseDate: first.releaseDate || ''
            };
        });

        const heroPlayRoute = computed(() => {
            if (!hero.value) return undefined;
            const h = hero.value;
            if (h.type === 'tv') {
                return { path: `/stream/nf/tv/${h.id}/season/1/episode/1` };
            }
            return { path: `/stream/nf/movie/${h.id}` };
        });

        const heroDetailRoute = computed(() => {
            if (!hero.value) return undefined;
            const h = hero.value;
            return { path: `/nf/${h.type}/${h.id}` };
        });

        const loadLanguageCatalogue = async () => {
            const lang = getLanguageOption(language.value);
            isLoading.value = true;
            trendingItems.value = [];
            movieItems.value = [];
            seriesItems.value = [];

            try {
                const [page0, page1] = await Promise.all([
                    browseNetmirror(lang.category, 0),
                    browseNetmirror(lang.category, 1)
                ]);

                const pool = [...(page0.results || []), ...(page1.results || [])].filter(
                    (item) => itemMatchesLanguage(item, lang)
                );

                const curated = await mapWithConcurrency(pool, toCuratedItem, 6);
                const movies = curated.filter((item) => item.type === 'movie');
                const series = curated.filter((item) => item.type === 'tv');

                trendingItems.value = curated.slice(0, 12);
                movieItems.value = movies.slice(0, 18);
                seriesItems.value = series.slice(0, 18);

                updateSeo({
                    title: `${lang.label} — Netflix on Moovie`,
                    canonical: 'https://moovie.fun/',
                    image: 'https://moovie.fun/og-image.png'
                });
            } catch (err) {
                console.error('[NetflixHome] Failed to load catalogue:', err);
            } finally {
                isLoading.value = false;
            }
        };

        const onLanguageChange = () => loadLanguageCatalogue();

        onMounted(() => {
            loadLanguageCatalogue();
            window.addEventListener('movora_netflix_language_change', onLanguageChange);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('movora_netflix_language_change', onLanguageChange);
        });

        return {
            isLoading,
            activeLang,
            hero,
            heroPlayRoute,
            heroDetailRoute,
            trendingItems,
            movieItems,
            seriesItems
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