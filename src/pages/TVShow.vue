<template>
    <div class="tv-detail">
        <SiteHeader />

        <main id="main" class="tv-detail__main" role="main">
            <section class="tv-detail__snap-slide">
                <TitleMasthead
                    ref="mastheadRef"
                    :id="show ? show.id : ''"
                    type="tv"
                    :season="activeSeason"
                    :episode="activeEpisode"
                    :seasons="show ? show.seasons : []"
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
                    :play-label="playLabel"
                    :loading="loading"
                />
            </section>

            <section v-if="show && show.seasons?.length" class="tv-detail__section tv-detail__snap-slide container-lm">
                <SeasonTabs
                    :show-id="show.id"
                    :seasons="show.seasons"
                    title="Episode guide"
                    eyebrow="The Schedule"
                    description="Every installment, in running order."
                    @download-episode="handleDownloadEpisode"
                />
            </section>

            <section class="tv-detail__section tv-detail__snap-slide container-lm tv-detail__opening">
                <MetaBar :items="metaItems" :loading="loading" aria-label="Series metadata" />

                <div class="tv-detail__columns">
                    <div class="tv-detail__col--main">
                        <DropCapSynopsis
                            :body="show ? show.overview : ''"
                            eyebrow="The Synopsis"
                            :loading="loading"
                        />
                    </div>

                    <div class="tv-detail__col--side">
                        <StatsBlock
                            :stats="statsItems"
                            title="By the numbers"
                            eyebrow="Ledger"
                            :loading="loading"
                        />
                    </div>
                </div>
            </section>

            <section class="tv-detail__section tv-detail__snap-slide container-lm">
                <CastGrid :casts="cast" title="The Ensemble" eyebrow="The Cast" :limit="12" :loading="loading" />
            </section>
        </main>

        <SiteFooter />

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
import SeasonTabs from '../components/detail/SeasonTabs.vue';
import { useTvShows, TVShowDetails } from '../composables/useTvShows';
import { Cast, Crew } from '../composables/useMovies';
import { useSeo } from '../composables/useSeo';
import { addViewedItem } from '../composables/useHistory';
import { getLastWatchedMetaData } from '../composables/useStream';
import { primeGenres } from '../composables/useGenreLookup';
import { buildProxiedImageUrl } from '../utils/useWebImage';
import { displayTvStatus, premiereMetaLabel } from '../utils/releaseStatus';

export default defineComponent({
    name: 'TVShow',
    components: {
        SiteHeader,
        SiteFooter,
        TitleMasthead,
        MetaBar,
        DropCapSynopsis,
        StatsBlock,
        CastGrid,
        SeasonTabs,
    },
    setup() {
        const route = useRoute();
        const { fetchTvShow, fetchTvShowCredit } = useTvShows();
        const { updateSeo } = useSeo();

        const show = ref<TVShowDetails | null>(null);
        const cast = ref<Cast[]>([]);
        const crew = ref<Crew[]>([]);
        const loading = ref(true);


        const genreNames = computed(() => (show.value?.genres ?? []).map(g => g.name));
        const genreIds = computed(() => (show.value?.genres ?? []).map(g => g.id));

        const creator = computed(() =>
            (show.value?.created_by ?? []).map(c => c.name).slice(0, 2).join(', ')
        );

        const network = computed(() => show.value?.networks?.[0]?.name ?? '');

        const mastheadEyebrow = computed(() => {
            const g = genreNames.value[0];
            return g ? `${g} · Series` : 'Series';
        });


        const avgRuntime = computed(() => {
            const list = show.value?.episode_run_time ?? [];
            if (!list.length) return '';
            const avg = Math.round(list.reduce((s, n) => s + n, 0) / list.length);
            return `${avg}m / episode`;
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

        const airingWindow = computed(() => {
            if (!show.value) return '';
            const start = show.value.first_air_date ? new Date(show.value.first_air_date).getFullYear() : '';
            const end = show.value.last_air_date ? new Date(show.value.last_air_date).getFullYear() : '';
            if (!start) return '';
            if (!end || show.value.in_production) return `${start} —`;
            if (start === end) return `${start}`;
            return `${start}–${end}`;
        });

        const metaItems = computed<MetaEntry[]>(() => {
            if (!show.value) return [];
            const country = show.value.production_countries?.[0]?.name ?? '';
            const language = show.value.spoken_languages?.[0]?.english_name
                ?? (show.value.original_language ? show.value.original_language.toUpperCase() : '');
            return [
                {
                    label: premiereMetaLabel(show.value.first_air_date),
                    value: formatDate(show.value.first_air_date)
                },
                { label: 'Airing', value: airingWindow.value },
                { label: 'Creator', value: creator.value },
                { label: 'Network', value: network.value },
                { label: 'Runtime', value: avgRuntime.value },
                { label: 'Country', value: country },
                { label: 'Language', value: language },
                {
                    label: 'Status',
                    value: displayTvStatus(show.value.status, show.value.first_air_date)
                }
            ];
        });

        const statsItems = computed<StatEntry[]>(() => {
            if (!show.value) return [];
            return [
                { label: 'Seasons', value: show.value.number_of_seasons || '' },
                { label: 'Episodes', value: show.value.number_of_episodes || '' },
                {
                    label: 'Type',
                    value: show.value.type || '',
                    hint: show.value.in_production ? 'In production' : 'Concluded'
                },
                { label: 'Popularity', value: show.value.popularity ? show.value.popularity.toFixed(0) : '' },
                { label: 'Votes', value: show.value.vote_count ? show.value.vote_count.toLocaleString() : '' }
            ];
        });

        const activeSeason = computed(() => {
            const id = String(route.params.id);
            const last = getLastWatchedMetaData(id);
            return last?.season && last.season > 0 ? last.season : 1;
        });

        const activeEpisode = computed(() => {
            const id = String(route.params.id);
            const last = getLastWatchedMetaData(id);
            return last?.episode && last.episode > 0 ? last.episode : 1;
        });

        const playRoute = computed(() => {
            const id = String(route.params.id);
            return {
                name: 'StreamTVShow',
                params: {
                    id,
                    season: String(activeSeason.value),
                    episode: String(activeEpisode.value)
                }
            };
        });

        const playLabel = computed(() => {
            const id = String(route.params.id);
            const last = getLastWatchedMetaData(id);
            if (last && last.season && last.episode) {
                return `Resume S${last.season} · E${last.episode}`;
            }
            return 'Play';
        });

        const loadShow = async (id: string) => {
            loading.value = true;
            show.value = null;
            cast.value = [];
            crew.value = [];

            try {
                // Fetch the core show details first to unblock the UI instantly
                const details = await fetchTvShow(id);
                show.value = details.data.value ?? null;

                if (show.value) {
                    const posterUrl = show.value.poster_path
                        ? buildProxiedImageUrl(`original${show.value.poster_path}`)
                        : 'https://moovie.fun/og-image.png';
                    updateSeo({
                        title: `${show.value.name} — Moovie`,
                        description: show.value.overview || `Watch ${show.value.name} online on Moovie.`,
                        image: posterUrl,
                        canonical: `https://moovie.fun/tv-show/${show.value.id}`,
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
                    addViewedItem({
                        id: show.value.id,
                        title: show.value.name,
                        image: show.value.poster_path,
                        rating: show.value.vote_average,
                        categories: genreIds.value,
                        adult: false,
                        type: 'tv'
                    });
                }

                // Core data is loaded, unblock the user so they can click Play immediately!
                loading.value = false;

                // Load secondary non-essential metadata in the background
                fetchTvShowCredit(id).then((credits) => {
                    cast.value = credits.data.value?.cast ?? [];
                    crew.value = credits.data.value?.crew ?? [];
                }).catch(err => {
                    console.error('Failed to load secondary TV show data in background:', err);
                });
            } catch (err) {
                console.error('Failed to load TV show details:', err);
                loading.value = false;
            }
        };

        onMounted(() => {
            primeGenres();
            loadShow(String(route.params.id));
        });

        watch(
            () => route.params.id,
            newId => {
                if (newId && route.name === 'TVShow') {
                    loadShow(String(newId));
                }
            }
        );

        watch(loading, (newVal) => {
            if (!newVal) {
                setTimeout(() => {
                    const container = document.querySelector('.tv-detail');
                    if (container && container.scrollTop < 20) {
                        container.scrollTo({ top: 120, behavior: 'smooth' });
                    }
                }, 150);
            }
        });

        const mastheadRef = ref<any>(null);

        const handleDownloadEpisode = ({ season, episode }: { season: number; episode: number }) => {
            if (mastheadRef.value) {
                mastheadRef.value.openDownloadForEpisode(season, episode);
            }
        };

        return {
            show,
            cast,
            loading,
            genreNames,
            genreIds,
            mastheadEyebrow,
            metaItems,
            statsItems,
            playRoute,
            playLabel,
            activeSeason,
            activeEpisode,
            mastheadRef,
            handleDownloadEpisode
        };
    }
});
</script>

<style lang="scss" scoped>
.tv-detail {
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
        &.tv-detail__opening {
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
        animation: tv-spin 0.8s linear infinite;
    }

}

@keyframes tv-spin {
    to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
    .tv-detail__spinner { animation: none; }
}
</style>
