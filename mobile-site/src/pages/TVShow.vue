<template>
    <MobileShell>
        <div class="m-detail">
            <TitleMasthead
                :id="show ? show.id : ''"
                type="tv"
                :title="show ? show.name : ''"
                :tagline="show ? show.tagline : ''"
                :eyebrow="mastheadEyebrow"
                :backdrop-path="show ? show.backdrop_path : null"
                :poster-path="show ? show.poster_path : null"
                :rating="show ? show.vote_average : 0"
                :release-date="show ? show.first_air_date : ''"
                :genres="genreNames"
                :genre-ids="genreIds"
                :adult="false"
                :play-route="playRoute"
                play-label="Play"
                :loading="loading"
            />

            <section class="m-detail__section container-lm">
                <DropCapSynopsis :body="show ? show.overview : ''" eyebrow="Synopsis" :loading="loading" />
            </section>

            <section class="m-detail__section container-lm">
                <CastGrid :casts="cast" title="Cast" :limit="8" :loading="loading" />
            </section>
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import MobileShell from '../layout/MobileShell.vue';
import TitleMasthead from '@/components/detail/TitleMasthead.vue';
import DropCapSynopsis from '@/components/detail/DropCapSynopsis.vue';
import CastGrid from '@/components/detail/CastGrid.vue';
import { useTvShows, TVShowDetails } from '@/composables/useTvShows';
import { Cast } from '@/composables/useMovies';
import { primeGenres } from '@/composables/useGenreLookup';
import { useAppPaths } from '@/composables/useAppPaths';
import { useSeo } from '../composables/useSeo';
import { buildProxiedImageUrl } from '@/utils/useWebImage';


const route = useRoute();
const paths = useAppPaths();
const { fetchTvShow, fetchTvShowCredit } = useTvShows();
const { updateSeo } = useSeo();


const show = ref<TVShowDetails | null>(null);
const cast = ref<Cast[]>([]);
const loading = ref(true);

const genreNames = computed(() => (show.value?.genres ?? []).map(g => g.name));
const genreIds = computed(() => (show.value?.genres ?? []).map(g => g.id));
const mastheadEyebrow = computed(() => genreNames.value[0] ? `${genreNames.value[0]} · Series` : 'Series');

const playRoute = computed(() => {
    const season = show.value?.seasons?.find(s => s.season_number === 1)?.season_number ?? 1;
    return paths.streamTvShow(String(route.params.id), season, 1);
});

async function load(id: string) {
    loading.value = true;
    show.value = null;
    cast.value = [];
    try {
        const [{ data: showData }, { data: creditsData }] = await Promise.all([
            fetchTvShow(id),
            fetchTvShowCredit(id)
        ]);
        show.value = showData.value ?? null;
        cast.value = creditsData.value?.cast ?? [];
        if (show.value) {
            const rawPosterUrl = show.value.poster_path 
                ? buildProxiedImageUrl(`w500${show.value.poster_path}`) 
                : '/og-image.png';
            const posterUrl = rawPosterUrl.startsWith('/')
                ? `https://m.moovie.fun${rawPosterUrl}`
                : rawPosterUrl;
            updateSeo({
                title: `${show.value.name} — Moovie`,
                description: show.value.overview || `Watch ${show.value.name} online on Moovie.`,
                image: posterUrl,
                canonical: `https://m.moovie.fun/tv-show/${show.value.id}`,
                type: 'video.tv_show',
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@type': 'TVSeries',
                    'name': show.value.name,
                    'description': show.value.overview,
                    'image': posterUrl,
                    'dateCreated': show.value.first_air_date || undefined,
                    'aggregateRating': show.value.vote_count ? {
                        '@type': 'AggregateRating',
                        'bestRating': '10',
                        'worstRating': '1',
                        'ratingValue': show.value.vote_average.toFixed(1),
                        'ratingCount': show.value.vote_count
                    } : undefined
                }
            });
        } else {
            document.title = 'TV Show — Moovie';
        }
    } finally {
        loading.value = false;
    }
}

watch(
    () => route.params.id,
    id => {
        if (typeof id === 'string') load(id);
    }
);

onMounted(async () => {
    primeGenres();
    await load(String(route.params.id));
});
</script>

<style lang="scss" scoped>
.m-detail {
    padding-bottom: var(--s-6);

    &__section {
        margin-top: var(--s-5);
    }

    &__loading {
        display: flex;
        justify-content: center;
        padding: var(--s-10);
    }
}
</style>
