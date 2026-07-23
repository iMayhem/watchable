<template>
    <div class="movie-detail">
        <SiteHeader />

        <main id="main" class="movie-detail__main" role="main">
            <section class="movie-detail__snap-slide">
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
                    @trailer="openTrailer"
                />
            </section>

            <section class="movie-detail__section movie-detail__snap-slide container-lm movie-detail__opening">
                <MetaBar :items="metaItems" :loading="loading" aria-label="Film metadata" />

                <div class="movie-detail__columns">
                    <div class="movie-detail__col--main">
                        <DropCapSynopsis
                            :body="movie ? movie.overview : ''"
                            eyebrow="The Synopsis"
                            :loading="loading"
                        />
                    </div>

                    <div class="movie-detail__col--side">
                        <StatsBlock
                            :stats="statsItems"
                            title="By the numbers"
                            eyebrow="Ledger"
                            :loading="loading"
                        />
                    </div>
                </div>
            </section>

            <section class="movie-detail__section movie-detail__snap-slide container-lm">
                <CastGrid :casts="cast" title="The Players" eyebrow="The Cast" :limit="12" :loading="loading" />
            </section>
        </main>

        <SiteFooter />

        <TrailerDialog
            v-model="trailerOpen"
            :videos="trailers"
            :title="movie ? movie.title : 'Trailers'"
            @close="closeTrailer"
        />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import TitleMasthead from '../components/detail/TitleMasthead.vue';
import MetaBar, { MetaEntry } from '../components/detail/MetaBar.vue';
import DropCapSynopsis from '../components/detail/DropCapSynopsis.vue';
import StatsBlock, { StatEntry } from '../components/detail/StatsBlock.vue';
import CastGrid from '../components/detail/CastGrid.vue';
import TrailerDialog from '../components/detail/TrailerDialog.vue';
import { useMovies, MovieDetails, Cast, Crew } from '../composables/useMovies';
import { fetchTrailerVideos, type TrailerVideo } from '../composables/useTrailer';
import { useSeo } from '../composables/useSeo';
import { addViewedItem } from '../composables/useHistory';
import { getLastWatchedMetaData } from '../composables/useStream';
import { primeGenres } from '../composables/useGenreLookup';
import { buildProxiedImageUrl } from '../utils/useWebImage';
import { displayMovieStatus, releaseDateMetaLabel } from '../utils/releaseStatus';

export default defineComponent({
    name: 'Movie',
    components: {
        SiteHeader,
        SiteFooter,
        TitleMasthead,
        MetaBar,
        DropCapSynopsis,
        StatsBlock,
        CastGrid,
        TrailerDialog
    },
    setup() {
        const route = useRoute();
        const { fetchMovie, fetchMovieCredits } = useMovies();
        const { updateSeo } = useSeo();

        const movie = ref<MovieDetails | null>(null);
        const cast = ref<Cast[]>([]);
        const crew = ref<Crew[]>([]);
        const loading = ref(true);

        const trailerOpen = ref(false);
        const trailers = ref<TrailerVideo[]>([]);

        const genreNames = computed(() => (movie.value?.genres ?? []).map(g => g.name));
        const genreIds = computed(() => (movie.value?.genres ?? []).map(g => g.id));

        const director = computed(() => {
            const d = crew.value.find(c => c.job === 'Director');
            return d?.name ?? '';
        });

        const writer = computed(() => {
            const w = crew.value.find(c => ['Screenplay', 'Writer', 'Author'].includes(c.job));
            return w?.name ?? '';
        });

        const mastheadEyebrow = computed(() => {
            const g = genreNames.value[0];
            return g ? `${g} · Feature` : 'Feature';
        });

        const hasTrailer = computed(() => trailers.value.length > 0);

        const runtimeLabel = computed(() => {
            const m = movie.value?.runtime ?? 0;
            if (!m) return '';
            const h = Math.floor(m / 60);
            const mm = m % 60;
            return h ? `${h}h ${mm}m` : `${mm}m`;
        });

        const formatDate = (iso: string) => {
            if (!iso) return '';
            try {
                return new Date(iso).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });
            } catch { return iso; }
        };

        const metaItems = computed<MetaEntry[]>(() => {
            if (!movie.value) return [];
            const country = movie.value.production_countries?.[0]?.name ?? '';
            const language = movie.value.spoken_languages?.[0]?.english_name
                ?? (movie.value.original_language ? movie.value.original_language.toUpperCase() : '');
            const items: MetaEntry[] = [
                {
                    label: releaseDateMetaLabel(movie.value.release_date),
                    value: formatDate(movie.value.release_date)
                },
                { label: 'Runtime', value: runtimeLabel.value },
                { label: 'Director', value: director.value },
                { label: 'Writer', value: writer.value },
                { label: 'Country', value: country },
                { label: 'Language', value: language },
                {
                    label: 'Status',
                    value: displayMovieStatus(movie.value.status, movie.value.release_date)
                }
            ];
            if (movie.value.imdb_id) {
                items.push({
                    label: 'On IMDb',
                    value: movie.value.imdb_id,
                    href: `https://www.imdb.com/title/${movie.value.imdb_id}`
                });
            }
            items.push({
                label: 'On Letterboxd',
                value: 'Rate film',
                href: `https://letterboxd.com/tmdb/${movie.value.id}/`
            });
            return items;
        });

        const formatMoney = (n: number) => {
            if (!n) return '';
            if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
            if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
            if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
            return `$${n}`;
        };

        const statsItems = computed<StatEntry[]>(() => {
            if (!movie.value) return [];
            const profit = (movie.value.revenue ?? 0) - (movie.value.budget ?? 0);
            return [
                { label: 'Budget', value: formatMoney(movie.value.budget) },
                { label: 'Revenue', value: formatMoney(movie.value.revenue), accent: movie.value.revenue > 0 },
                {
                    label: 'Net',
                    value: profit !== 0 ? formatMoney(Math.abs(profit)) : '',
                    suffix: profit > 0 ? 'profit' : 'loss',
                    accent: profit > 0,
                    hint: profit > 0 ? 'Revenue minus budget' : (profit < 0 ? 'Revenue under budget' : '')
                },
                { label: 'Popularity', value: movie.value.popularity ? movie.value.popularity.toFixed(0) : '' },
                { label: 'Votes', value: movie.value.vote_count ? movie.value.vote_count.toLocaleString() : '' }
            ];
        });

        const playRoute = computed(() => ({
            name: 'StreamMovie',
            params: { id: String(route.params.id) },
            query: route.query
        }));

        const playLabel = computed(() => {
            const id = String(route.params.id);
            return getLastWatchedMetaData(id) ? 'Resume' : 'Play';
        });

        const openTrailer = () => {
            if (trailers.value.length) trailerOpen.value = true;
        };
        const closeTrailer = () => {
            trailerOpen.value = false;
        };

        const loadMovie = async (id: string) => {
            loading.value = true;
            movie.value = null;
            cast.value = [];
            crew.value = [];
            trailers.value = [];

            try {
                // Fetch the core movie details first to unblock the UI instantly
                const details = await fetchMovie(id);
                movie.value = details.data.value ?? null;

                if (movie.value) {
                    const posterUrl = movie.value.poster_path
                        ? buildProxiedImageUrl(`original${movie.value.poster_path}`)
                        : 'https://moovie.fun/og-image.png';
                    updateSeo({
                        title: `${movie.value.title} — Moovie`,
                        description: movie.value.overview || `Watch ${movie.value.title} online on Moovie.`,
                        image: posterUrl,
                        canonical: `https://moovie.fun/movie/${movie.value.id}`,
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
                    addViewedItem({
                        id: movie.value.id,
                        title: movie.value.title,
                        image: movie.value.poster_path,
                        rating: movie.value.vote_average,
                        categories: genreIds.value,
                        adult: movie.value.adult,
                        type: 'movie'
                    });
                }

                // Core data is loaded, unblock the user so they can click Play immediately!
                loading.value = false;

                // Load secondary non-essential metadata in the background
                Promise.all([
                    fetchMovieCredits(id),
                    fetchTrailerVideos(id, 'movie')
                ]).then(([credits, videos]) => {
                    cast.value = credits.data.value?.cast ?? [];
                    crew.value = credits.data.value?.crew ?? [];
                    trailers.value = videos ?? [];
                }).catch(err => {
                    console.error('Failed to load secondary movie data in background:', err);
                });
            } catch (err) {
                console.error('Failed to load movie details:', err);
                loading.value = false;
            }
        };

        onMounted(() => {
            primeGenres();
            loadMovie(String(route.params.id));
        });

        watch(
            () => route.params.id,
            newId => {
                if (newId && route.name === 'Movie') {
                    loadMovie(String(newId));
                }
            }
        );

        watch(loading, (newVal) => {
            if (!newVal) {
                setTimeout(() => {
                    const container = document.querySelector('.movie-detail');
                    if (container && container.scrollTop < 20) {
                        container.scrollTo({ top: 120, behavior: 'smooth' });
                    }
                }, 150);
            }
        });

        return {
            movie,
            cast,
            loading,
            genreNames,
            genreIds,
            mastheadEyebrow,
            hasTrailer,
            trailerOpen,
            trailers,
            metaItems,
            statsItems,
            playRoute,
            playLabel,
            openTrailer,
            closeTrailer
        };
    }
});
</script>

<style lang="scss" scoped>
.movie-detail {
    position: relative;
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    // Scroll snap container
    height: 100dvh;
    overflow-y: scroll;
    scroll-snap-type: y proximity;
    scroll-behavior: smooth;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }

    &__main {
        position: relative;
    }

    // Each snap slide
    &__snap-slide {
        scroll-snap-align: start;
        scroll-snap-stop: normal;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        box-sizing: border-box;

        // Metadata + synopsis slide: top-align with breathing room
        &.movie-detail__opening {
            justify-content: flex-start;
            padding-top: clamp(var(--s-8), 8vh, var(--s-10));
            padding-bottom: clamp(var(--s-8), 8vh, var(--s-10));
        }
    }

    &__section {
        &:last-of-type {
            margin-bottom: 0;
        }
    }

    &__opening {
        display: grid;
        gap: clamp(var(--s-6), 6vw, var(--s-8));
    }

    &__columns {
        display: grid;
        gap: clamp(var(--s-6), 5vw, var(--s-8));
        grid-template-columns: minmax(0, 1fr);

        @media (min-width: 960px) {
            grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
            align-items: start;
        }
    }

    &__col--main,
    &__col--side {
        min-width: 0;
    }

    &__loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--s-3);
        min-height: 60vh;
        color: var(--bone-300);
    }

    &__spinner {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid var(--rule-strong);
        border-top-color: var(--ember);
        animation: movie-spin 0.8s linear infinite;
    }

}

@keyframes movie-spin {
    to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
    .movie-detail__spinner { animation: none; }
}
</style>
