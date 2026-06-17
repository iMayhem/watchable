<template>
    <div class="anime-detail">
        <SiteHeader />

        <main id="main" class="anime-detail__main" role="main">
            <section class="anime-detail__snap-slide">
                <TitleMasthead
                    :id="anime ? anime.id : ''"
                    type="anime"
                    :title="anime ? (anime.title.english || anime.title.romaji || anime.title.native) : ''"
                    :tagline="anime ? anime.title.native : ''"
                    :eyebrow="mastheadEyebrow"
                    :backdrop-path="backdropPath"
                    :poster-path="anime ? anime.coverImage.large : null"
                    :rating="anime && anime.averageScore ? anime.averageScore / 10 : 0"
                    :release-date="anime ? String(anime.seasonYear || '') : ''"
                    :genres="anime ? anime.genres : []"
                    :adult="false"
                    :play-route="playRoute"
                    play-label="Play"
                    :show-trailer="false"
                    :loading="loading"
                />
            </section>

            <section v-if="loading || (anime && episodesList.length)" class="anime-detail__section anime-detail__snap-slide container-lm">
                <div class="episode-guide">
                    <p class="eyebrow">The Schedule</p>
                    <h3 class="episode-guide__title display">Episode guide</h3>
                    <p class="episode-guide__desc">Every installment, in running order.</p>

                    <!-- Premium Custom Season Changer tabs -->
                    <div v-if="loading" class="anime-detail__seasons-rail" aria-hidden="true">
                        <div v-for="i in 3" :key="i" class="season-tab-btn-skeleton" />
                    </div>
                    <div v-else-if="seasonsList.length > 1" class="anime-detail__seasons-rail">
                        <button
                            v-for="s in seasonsList"
                            :key="s.id"
                            type="button"
                            class="season-tab-btn"
                            :class="{ 'is-active': s.id === anime.id }"
                            @click="goToSeason(s.id)"
                        >
                            {{ s.label }}
                        </button>
                    </div>

                    <div v-if="loading" class="episode-guide__grid" aria-hidden="true">
                        <div v-for="i in 12" :key="i" class="episode-card-skeleton">
                            <div class="episode-card-skeleton__still episode-card-skeleton__shimmer" />
                            <div class="episode-card-skeleton__meta">
                                <div class="episode-card-skeleton__line episode-card-skeleton__title episode-card-skeleton__shimmer" />
                                <div class="episode-card-skeleton__line episode-card-skeleton__desc episode-card-skeleton__shimmer" />
                            </div>
                        </div>
                    </div>
                    <div v-else class="episode-guide__grid">
                        <router-link
                            v-for="ep in paginatedEpisodesList"
                            :key="ep"
                            :to="`/stream/anime/${anime.id}/episode/${ep}`"
                            class="episode-card"
                        >
                            <div class="episode-card__image-container">
                                <img :src="getEpisodeStill(ep)" class="episode-card__image" alt="Episode Cover" loading="lazy" />
                                <div class="episode-card__play">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z"/>
                                    </svg>
                                </div>
                            </div>
                            <div class="episode-card__meta">
                                <h4 class="episode-card__title">Episode {{ ep }} · {{ getEpisodeTitle(ep) }}</h4>
                                <p class="episode-card__subtitle">{{ truncate(getEpisodeOverview(ep), 90) }}</p>
                            </div>
                        </router-link>
                    </div>

                    <div v-if="!loading" class="episode-guide__pagination">
                        <button 
                            @click="currentPage > 1 ? currentPage-- : null"
                            :disabled="currentPage === 1"
                            class="pagination-btn"
                            aria-label="Previous Page"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                            </svg>
                            Prev
                        </button>
                        <span class="pagination-info">
                            Showing {{ (currentPage - 1) * 20 + 1 }}–{{ Math.min(currentPage * 20, totalEpisodesCount) }} of {{ totalEpisodesCount }} episodes
                        </span>
                        <button 
                            @click="currentPage < totalPages ? currentPage++ : null"
                            :disabled="currentPage === totalPages"
                            class="pagination-btn"
                            aria-label="Next Page"
                        >
                            Next
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </section>

            <section class="anime-detail__section anime-detail__snap-slide container-lm anime-detail__opening">
                <MetaBar :items="metaItems" :loading="loading" aria-label="Anime metadata" />

                <div class="anime-detail__columns">
                    <div class="anime-detail__col--main">
                        <DropCapSynopsis
                            :body="cleanDescription"
                            eyebrow="The Synopsis"
                            :loading="loading"
                        />
                    </div>

                    <div class="anime-detail__col--side">
                        <StatsBlock
                            :stats="statsItems"
                            title="By the numbers"
                            eyebrow="Ledger"
                            :loading="loading"
                        />
                    </div>
                </div>
            </section>
        </main>

        <div v-if="!anime && !loading" class="anime-detail__loading">
            <span class="meta">Could not load anime details.</span>
        </div>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import TitleMasthead from '../components/detail/TitleMasthead.vue';
import MetaBar, { MetaEntry } from '../components/detail/MetaBar.vue';
import DropCapSynopsis from '../components/detail/DropCapSynopsis.vue';
import StatsBlock, { StatEntry } from '../components/detail/StatsBlock.vue';
import { useAniList } from '../composables/useAniList';
import { addViewedItem } from '../composables/useHistory';
import useAxios from '../composables/useAxios';
import { useSeo } from '../composables/useSeo';
import { buildProxiedImageUrl } from '../utils/useWebImage';


export default defineComponent({
    name: 'AnimeDetail',
    components: {
        SiteHeader,
        SiteFooter,
        TitleMasthead,
        MetaBar,
        DropCapSynopsis,
        StatsBlock
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { fetchAnimeById } = useAniList();
        const { updateSeo } = useSeo();


        const anime = ref<any | null>(null);
        const loading = ref(true);
        const tmdbBackdrop = ref<string | null>(null);

        const backdropPath = computed(() => {
            return tmdbBackdrop.value || anime.value?.coverImage?.large || null;
        });

        const cleanDescription = computed(() => {
            if (!anime.value?.description) return '';
            // Remove HTML tags often returned in AniList descriptions
            return anime.value.description.replace(/<[^>]*>/g, '');
        });

        const mastheadEyebrow = computed(() => {
            const format = anime.value?.format ? ` · ${anime.value.format}` : '';
            return `Anime${format}`;
        });

        const studiosLabel = computed(() => {
            const list = anime.value?.studios?.nodes ?? [];
            if (!list.length) return '';
            return list.map((s: any) => s.name).slice(0, 2).join(', ');
        });

        const metaItems = computed<MetaEntry[]>(() => {
            if (!anime.value) return [];
            
            const start = anime.value.startDate;
            const premiered = start && start.year 
                ? `${start.month || 1}/${start.day || 1}/${start.year}` 
                : String(anime.value.seasonYear || '');

            return [
                { label: 'Premiered', value: premiered },
                { label: 'Format', value: anime.value.format || 'TV' },
                { label: 'Studio', value: studiosLabel.value || 'N/A' },
                { label: 'Status', value: anime.value.status || 'FINISHED' },
                { label: 'Genres', value: anime.value.genres?.slice(0, 3).join(', ') || '' }
            ];
        });

        const statsItems = computed<StatEntry[]>(() => {
            if (!anime.value) return [];
            return [
                { label: 'Episodes', value: anime.value.episodes || '1' },
                { label: 'Score', value: anime.value.averageScore ? `${anime.value.averageScore}%` : 'N/A' },
                { label: 'Year', value: String(anime.value.seasonYear || '') }
            ];
        });

        const episodesList = computed(() => {
            const count = anime.value?.episodes || 1;
            return Array.from({ length: count }, (_, i) => i + 1);
        });

        const playRoute = computed(() => {
            return anime.value ? `/stream/anime/${anime.value.id}/episode/1` : '';
        });

        const currentPage = ref(1);
        const episodesPerPage = 20;

        const totalEpisodesCount = computed(() => {
            return anime.value?.episodes || 1;
        });

        const totalPages = computed(() => {
            return Math.ceil(totalEpisodesCount.value / episodesPerPage);
        });

        const paginatedEpisodesList = computed(() => {
            const startIndex = (currentPage.value - 1) * episodesPerPage;
            const endIndex = startIndex + episodesPerPage;
            
            const list: number[] = [];
            for (let i = startIndex + 1; i <= Math.min(endIndex, totalEpisodesCount.value); i++) {
                list.push(i);
            }
            return list;
        });

        const seasonsList = computed(() => {
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
                if (node.type === 'ANIME' && (edge.relationType === 'PREQUEL' || edge.relationType === 'SEQUEL')) {
                    list.push({
                        id: node.id,
                        title: node.title.english || node.title.romaji || node.title.native,
                        year: node.seasonYear || 0
                    });
                }
            }
            
            // Deduplicate
            const unique = list.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            
            // Sort chronologically
            unique.sort((a, b) => a.year - b.year);
            
            // Generate friendly season labels
            return unique.map((item, idx) => {
                let label = `Season ${idx + 1}`;
                
                const name = item.title;
                const lowerName = name.toLowerCase();
                if (lowerName.includes('entertainment district')) {
                    label = `Season ${idx + 1} (Entertainment District)`;
                } else if (lowerName.includes('swordsmith village')) {
                    label = `Season ${idx + 1} (Swordsmith Village)`;
                } else if (lowerName.includes('hashira training')) {
                    label = `Season ${idx + 1} (Hashira Training)`;
                } else if (lowerName.includes('mugen train')) {
                    label = `Season ${idx + 1} (Mugen Train)`;
                } else if (lowerName.includes('final season')) {
                    label = `Final Season`;
                }
                
                return {
                    id: item.id,
                    label: label
                };
            });
        });

        const goToSeason = (id: number) => {
            router.push(`/anime/${id}`);
        };

        const tmdbEpisodes = ref<any[]>([]);

        const loadTmdbEpisodes = async (anilistMedia: any) => {
            tmdbEpisodes.value = [];
            tmdbBackdrop.value = null;
            if (!anilistMedia) return;

            const englishTitle = anilistMedia.title.english;
            const romajiTitle = anilistMedia.title.romaji;
            const isMovie = anilistMedia.format === 'MOVIE';
            const searchType = isMovie ? 'movie' : 'tv';

            try {
                let show = null;
                
                // Try English Title search (clean title without Season suffixes)
                if (englishTitle) {
                    const cleanTitle = englishTitle.replace(/Season \d+|Part \d+/gi, '').trim();
                    const searchRes = await useAxios().get(
                        `https://api.themoviedb.org/3/search/${searchType}?query=${encodeURIComponent(cleanTitle)}`
                    );
                    show = searchRes?.data?.results?.[0];
                }
                
                // Fallback to Romaji Title
                if (!show && romajiTitle) {
                    const cleanTitle = romajiTitle.replace(/Season \d+|Part \d+/gi, '').trim();
                    const searchRes = await useAxios().get(
                        `https://api.themoviedb.org/3/search/${searchType}?query=${encodeURIComponent(cleanTitle)}`
                    );
                    show = searchRes?.data?.results?.[0];
                }
                
                if (show) {
                    if (show.backdrop_path) {
                        tmdbBackdrop.value = show.backdrop_path;
                    }
                    
                    if (isMovie) {
                        const movieRes = await useAxios().get(`https://api.themoviedb.org/3/movie/${show.id}`);
                        if (movieRes?.data?.backdrop_path) {
                            tmdbBackdrop.value = movieRes.data.backdrop_path;
                        }
                    } else {
                        // Fetch full TV show details to get list of all seasons
                        const showRes = await useAxios().get(`https://api.themoviedb.org/3/tv/${show.id}`);
                        if (showRes?.data?.backdrop_path) {
                            tmdbBackdrop.value = showRes.data.backdrop_path;
                        }
                    const tmdbSeasons = showRes?.data?.seasons || [];
                    
                    // Match current AniList media to correct TMDB season
                    let seasonNumber = 1;
                    const anilistYear = anilistMedia.seasonYear;
                    const anilistTitle = (englishTitle || romajiTitle || '').toLowerCase();
                    
                    // Keyword matching (Mugen, Entertainment, Swordsmith, etc.)
                    for (const s of tmdbSeasons) {
                        const sName = (s.name || '').toLowerCase();
                        const keywords = ['mugen', 'entertainment', 'swordsmith', 'hashira', 'yuukaku', 'katanakaji'];
                        for (const kw of keywords) {
                            if (sName.includes(kw) && anilistTitle.includes(kw)) {
                                seasonNumber = s.season_number;
                                break;
                            }
                        }
                    }
                    
                    // Year matching
                    if (seasonNumber === 1 && anilistYear) {
                        const exactMatch = tmdbSeasons.find((s: any) => {
                            if (!s.air_date) return false;
                            return new Date(s.air_date).getFullYear() === anilistYear;
                        });
                        if (exactMatch) {
                            seasonNumber = exactMatch.season_number;
                        } else {
                            // Find closest year
                            let closestSeason = tmdbSeasons[0];
                            let minDiff = Infinity;
                            for (const s of tmdbSeasons) {
                                if (!s.air_date) continue;
                                const sYear = new Date(s.air_date).getFullYear();
                                const diff = Math.abs(sYear - anilistYear);
                                if (diff < minDiff) {
                                    minDiff = diff;
                                    closestSeason = s;
                                }
                            }
                            if (closestSeason && minDiff <= 1) {
                                seasonNumber = closestSeason.season_number;
                            }
                        }
                    }
                    
                    // Fetch matched season's episodes
                    const seasonRes = await useAxios().get(
                        `https://api.themoviedb.org/3/tv/${show.id}/season/${seasonNumber}`
                    );
                    if (seasonRes?.data?.episodes) {
                        tmdbEpisodes.value = seasonRes.data.episodes;
                    }
                }
            }
        } catch (err) {
            console.warn('Failed to load TMDb episode metadata:', err);
        }
    };

        const getEpisodeStill = (epNum: number) => {
            const match = tmdbEpisodes.value.find(e => e.episode_number === epNum);
            if (match && match.still_path) {
                return buildProxiedImageUrl(`w780${match.still_path}`);
            }
            return anime.value?.bannerImage || anime.value?.coverImage?.large;
        };

        const getEpisodeTitle = (epNum: number) => {
            const match = tmdbEpisodes.value.find(e => e.episode_number === epNum);
            if (match && match.name) {
                return match.name;
            }
            return `Episode ${epNum}`;
        };

        const getEpisodeOverview = (epNum: number) => {
            const match = tmdbEpisodes.value.find(e => e.episode_number === epNum);
            if (match) {
                if (match.air_date) {
                    const parts = match.air_date.split('-');
                    if (parts.length === 3) {
                        const year = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1;
                        const day = parseInt(parts[2], 10);
                        const airDate = new Date(year, month, day);
                        
                        const now = new Date();
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        
                        if (airDate > today) {
                            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            return `📅 Releases: ${months[month]} ${day}, ${year}`;
                        }
                    }
                }
                if (match.overview) {
                    return match.overview;
                }
            }
            return 'Sub/Dub available';
        };

        const truncate = (text: string, max: number = 80) => {
            if (!text) return '';
            if (text.length <= max) return text;
            return text.substring(0, max) + '...';
        };

        const loadAnime = async (id: number) => {
            loading.value = true;
            anime.value = null;
            tmdbBackdrop.value = null;
            currentPage.value = 1;

            try {
                const response = await fetchAnimeById(id);
                anime.value = response?.data?.Media ?? null;

                if (anime.value) {
                    const title = anime.value.title.english || anime.value.title.romaji || anime.value.title.native;
                    const isMovie = anime.value.format === 'MOVIE';
                    updateSeo({
                        title: `${title} — Moovie`,
                        description: cleanDescription.value || `Watch ${title} online on Moovie.`,
                        image: anime.value.coverImage?.large || 'https://moovie.fun/og-image.png',
                        canonical: `https://moovie.fun/anime/${anime.value.id}`,
                        type: isMovie ? 'video.movie' : 'video.tv_show',
                        jsonLd: {
                            '@context': 'https://schema.org',
                            '@type': isMovie ? 'Movie' : 'TVSeries',
                            'name': title,
                            'description': cleanDescription.value,
                            'image': anime.value.coverImage?.large || undefined,
                            'dateCreated': anime.value.startDate?.year ? `${anime.value.startDate.year}-${String(anime.value.startDate.month || 1).padStart(2, '0')}-${String(anime.value.startDate.day || 1).padStart(2, '0')}` : undefined,
                            'aggregateRating': anime.value.averageScore ? {
                                '@type': 'AggregateRating',
                                'bestRating': '100',
                                'worstRating': '1',
                                'ratingValue': anime.value.averageScore,
                                'ratingCount': 100
                            } : undefined
                        }
                    });
                    
                    addViewedItem({
                        id: anime.value.id,
                        title: title,
                        image: anime.value.coverImage.large,
                        rating: anime.value.averageScore ? anime.value.averageScore / 10 : 0,
                        categories: [],
                        adult: false,
                        type: 'anime'
                    });
                }
                
                loading.value = false;

                if (anime.value) {
                    // Trigger TMDb mapping matching in background
                    loadTmdbEpisodes(anime.value).catch(err => {
                        console.error('Failed to load TMDB episodes mapping:', err);
                    });
                }
            } catch (err) {
                console.error('Failed to load anime:', err);
                loading.value = false;
            }
        };

        onMounted(() => {
            if (route.params.id) {
                loadAnime(Number(route.params.id));
            }
        });

        watch(
            () => route.params.id,
            newId => {
                if (newId && route.name === 'AnimeDetail') {
                    loadAnime(Number(newId));
                }
            }
        );

        watch(loading, (newVal) => {
            if (!newVal) {
                setTimeout(() => {
                    const container = document.querySelector('.anime-detail');
                    if (container && container.scrollTop < 20) {
                        container.scrollTo({ top: 120, behavior: 'smooth' });
                    }
                }, 150);
            }
        });

        return {
            anime,
            loading,
            backdropPath,
            cleanDescription,
            mastheadEyebrow,
            metaItems,
            statsItems,
            episodesList,
            playRoute,
            seasonsList,
            goToSeason,
            getEpisodeStill,
            getEpisodeTitle,
            getEpisodeOverview,
            truncate,
            currentPage,
            totalEpisodesCount,
            totalPages,
            paginatedEpisodesList
        };
    }
});
</script>

<style lang="scss" scoped>
.anime-detail {
    position: relative;
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    height: 100dvh;
    overflow-y: scroll;
    scroll-snap-type: y proximity;
    scroll-behavior: smooth;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }

    &__main {
        position: relative;
    }

    &__snap-slide {
        scroll-snap-align: start;
        scroll-snap-stop: normal;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        box-sizing: border-box;

        &.anime-detail__opening {
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
        animation: anime-spin 0.8s linear infinite;
    }
}

@keyframes anime-spin {
    to { transform: rotate(360deg); }
}

.episode-guide {
    padding-top: var(--s-6);
    padding-bottom: var(--s-10);

    &__title {
        margin-top: var(--s-1);
        margin-bottom: var(--s-2);
        color: var(--bone-50);
    }

    &__desc {
        color: var(--bone-400);
        margin-bottom: var(--s-6);
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: var(--s-4);
    }
}

.episode-card {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    border-radius: var(--r-md);
    overflow: hidden;
    background: var(--ink-800);
    border: 1px solid var(--rule);
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);

    &:hover {
        transform: translateY(-4px);
        border-color: var(--ember);
    }

    &__image-container {
        position: relative;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        background: var(--ink-950);
    }

    &__image {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    &__play {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(11, 10, 8, 0.4);
        opacity: 0;
        transition: opacity var(--dur-fast) var(--ease-out);

        svg {
            width: 32px;
            height: 32px;
            color: var(--ember);
        }
    }

    &:hover &__play {
        opacity: 1;
    }

    &__meta {
        padding: var(--s-3);
    }

    &__title {
        font-family: var(--font-ui);
        font-weight: 600;
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--bone-100);
    }

    &__subtitle {
        font-size: var(--fs-xs);
        color: var(--bone-450);
        margin-top: var(--s-1);
        margin-bottom: 0;
    }
}

.episode-guide__pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--s-4);
    margin-top: var(--s-8);
    padding-top: var(--s-6);
    border-top: 1px solid var(--rule);

    .pagination-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--s-1);
        background: var(--ink-800);
        border: 1px solid var(--rule);
        color: var(--bone-100);
        padding: var(--s-2) var(--s-4);
        border-radius: var(--r-md);
        font-family: var(--font-ui);
        font-weight: 500;
        font-size: var(--fs-sm);
        cursor: pointer;
        transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), opacity var(--dur-fast);

        &:hover:not(:disabled) {
            background: var(--surface-tint);
            border-color: var(--ember);
            color: var(--ember);
        }

        &:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        svg {
            display: inline-block;
        }
    }

    .pagination-info {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        color: var(--bone-400);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
}

.anime-detail__seasons-rail {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-3);
    margin-bottom: var(--s-6);
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
    &::-webkit-scrollbar { display: none; }
}

.season-tab-btn {
    padding: 0.5rem 1rem;
    background: var(--ink-800);
    border: 1px solid var(--rule);
    color: var(--bone-300);
    font-family: var(--font-ui);
    font-weight: 500;
    font-size: var(--fs-sm);
    border-radius: var(--r-pill);
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--dur-fast) var(--ease-out);

    &:hover {
        border-color: var(--ember);
        color: var(--bone-50);
    }

    &.is-active {
        background: var(--ember);
        border-color: var(--ember);
        color: #000;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(229, 9, 20, 0.2);
    }
}

.season-tab-btn-skeleton {
    width: 90px;
    height: 34px;
    border-radius: var(--r-pill);
    background: var(--ink-800);
    position: relative;
    overflow: hidden;
    &::after {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        transform: translateX(-100%);
        background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.05) 20%,
            rgba(255, 255, 255, 0.1) 60%,
            rgba(255, 255, 255, 0) 100%
        );
        animation: anime-shimmer 1.6s infinite ease-in-out;
        content: '';
    }
}

.episode-card-skeleton {
    display: flex;
    flex-direction: column;
    border-radius: var(--r-md);
    overflow: hidden;
    background: var(--ink-800);
    border: 1px solid var(--rule);

    &__still {
        width: 100%;
        aspect-ratio: 16 / 9;
        background: var(--ink-700);
    }

    &__meta {
        padding: var(--s-3);
        display: grid;
        gap: var(--s-2);
    }

    &__line {
        height: 12px;
        background: var(--ink-700);
        border-radius: 4px;

        &.episode-card-skeleton__title {
            width: 70%;
            height: 14px;
        }

        &.episode-card-skeleton__desc {
            width: 90%;
            height: 10px;
        }
    }

    &__shimmer {
        position: relative;
        overflow: hidden;

        &::after {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-100%);
            background-image: linear-gradient(
                90deg,
                rgba(255, 255, 255, 0) 0%,
                rgba(255, 255, 255, 0.05) 20%,
                rgba(255, 255, 255, 0.1) 60%,
                rgba(255, 255, 255, 0) 100%
            );
            animation: anime-shimmer 1.6s infinite ease-in-out;
            content: '';
        }
    }
}

@keyframes anime-shimmer {
    100% {
        transform: translateX(100%);
    }
}
</style>
