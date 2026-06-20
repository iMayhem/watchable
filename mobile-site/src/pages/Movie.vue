<template>
    <MobileShell>
        <div class="m-detail">
            <TitleMasthead
                :id="movie ? movie.id : ''"
                type="movie"
                :title="movie ? movie.title : ''"
                :tagline="movie ? movie.tagline : ''"
                :eyebrow="mastheadEyebrow"
                :backdrop-path="movie ? movie.backdrop_path : null"
                :poster-path="movie ? movie.poster_path : null"
                :rating="movie ? movie.vote_average : 0"
                :release-date="movie ? movie.release_date : ''"
                :genres="genreNames"
                :genre-ids="genreIds"
                :adult="movie ? movie.adult : false"
                :play-route="playRoute"
                :play-label="playLabel"
                :show-trailer="hasTrailer"
                :loading="loading"
                @trailer="trailerOpen = true"
            />

            <section class="m-detail__section container-lm">
                <DropCapSynopsis :body="movie ? movie.overview : ''" eyebrow="Synopsis" :loading="loading" />
            </section>

            <section class="m-detail__section container-lm">
                <CastGrid :casts="cast" title="Cast" :limit="8" :loading="loading" />
            </section>

            <section v-if="similarItems.length" class="m-detail__section">
                <MobileSection title="Similar" eyebrow="You may also like">
                    <MobileMediaRail :items="similarItems" />
                </MobileSection>
            </section>
        </div>

        <TrailerDialog
            v-model="trailerOpen"
            :videos="trailers"
            :title="movie?.title || 'Trailers'"
        />
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import MobileShell from '../layout/MobileShell.vue';
import MobileSection from '../components/MobileSection.vue';
import MobileMediaRail from '../components/MobileMediaRail.vue';
import TitleMasthead from '@/components/detail/TitleMasthead.vue';
import DropCapSynopsis from '@/components/detail/DropCapSynopsis.vue';
import CastGrid from '@/components/detail/CastGrid.vue';
import TrailerDialog from '@/components/detail/TrailerDialog.vue';
import { useMovies, MovieDetails, Cast } from '@/composables/useMovies';
import { fetchTrailerVideos, type TrailerVideo } from '@/composables/useTrailer';
import { getLastWatchedMetaData } from '@/composables/useStream';
import { primeGenres } from '@/composables/useGenreLookup';
import { useAppPaths } from '@/composables/useAppPaths';
import { useSeo } from '../composables/useSeo';
import { buildProxiedImageUrl } from '@/utils/useWebImage';

const route = useRoute();
const paths = useAppPaths();
const { fetchMovie, fetchMovieCredits, fetchSimilarMovies } = useMovies();
const { updateSeo } = useSeo();

const movie = ref<MovieDetails | null>(null);
const cast = ref<Cast[]>([]);
const similar = ref<Array<{ id: number; title: string; poster_path: string | null; vote_average: number; release_date: string; genre_ids: number[]; adult: boolean }>>([]);
const trailerOpen = ref(false);
const trailers = ref<TrailerVideo[]>([]);
const loading = ref(true);

const genreNames = computed(() => (movie.value?.genres ?? []).map(g => g.name));
const genreIds = computed(() => (movie.value?.genres ?? []).map(g => g.id));
const mastheadEyebrow = computed(() => genreNames.value[0] ? `${genreNames.value[0]} · Feature` : 'Feature');
const hasTrailer = computed(() => trailers.value.length > 0);

const playRoute = computed(() => paths.streamMovie(String(route.params.id)));
const playLabel = computed(() =>
    getLastWatchedMetaData(String(route.params.id)) ? 'Resume' : 'Play'
);

const similarItems = computed(() =>
    similar.value.slice(0, 12).map(m => ({
        id: m.id,
        title: m.title,
        posterPath: m.poster_path,
        rating: m.vote_average,
        releaseDate: m.release_date,
        genreIds: m.genre_ids,
        adult: m.adult,
        type: 'movie' as const
    }))
);

async function load(id: string) {
    loading.value = true;
    movie.value = null;
    cast.value = [];
    similar.value = [];
    trailers.value = [];
    try {
        const [{ data: movieData }, { data: creditsData }, { data: similarData }] = await Promise.all([
            fetchMovie(id),
            fetchMovieCredits(id),
            fetchSimilarMovies(id)
        ]);
        movie.value = movieData.value ?? null;
        cast.value = creditsData.value?.cast ?? [];
        similar.value = (similarData.value?.results ?? []) as typeof similar.value;
        trailers.value = await fetchTrailerVideos(id, 'movie');
        if (movie.value) {
            const rawPosterUrl = movie.value.poster_path 
                ? buildProxiedImageUrl(`w500${movie.value.poster_path}`) 
                : '/og-image.png';
            const posterUrl = rawPosterUrl.startsWith('/')
                ? `https://m.moovie.fun${rawPosterUrl}`
                : rawPosterUrl;
            updateSeo({
                title: `${movie.value.title} — Moovie`,
                description: movie.value.overview || `Watch ${movie.value.title} online on Moovie.`,
                image: posterUrl,
                canonical: `https://m.moovie.fun/movie/${movie.value.id}`,
                type: 'video.movie',
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@type': 'Movie',
                    'name': movie.value.title,
                    'description': movie.value.overview,
                    'image': posterUrl,
                    'dateCreated': movie.value.release_date || undefined,
                    'aggregateRating': movie.value.vote_count ? {
                        '@type': 'AggregateRating',
                        'bestRating': '10',
                        'worstRating': '1',
                        'ratingValue': movie.value.vote_average.toFixed(1),
                        'ratingCount': movie.value.vote_count
                    } : undefined
                }
            });
        } else {
            document.title = 'Movie — Moovie';
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
    const id = String(route.params.id);
    await load(id);
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
