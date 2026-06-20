<template>
    <MobileShell>
        <section class="m-home__hero" :class="{ 'is-loading': !hero }">
            <div v-if="!hero" class="m-home__hero-skeleton m-home__hero-skeleton-shimmer" />
            <router-link v-else :to="movie(hero.id)" class="m-home__hero-link">
                <img
                    v-if="heroBackdrop"
                    :src="heroBackdrop"
                    :alt="hero.title"
                    class="m-home__hero-img"
                    fetchpriority="high"
                />
                <div class="m-home__hero-scrim" aria-hidden="true" />
                <div class="m-home__hero-body">
                    <p class="eyebrow m-home__hero-eyebrow">Featured</p>
                    <h1 class="m-home__hero-title">{{ hero.title }}</h1>
                    <p v-if="hero.overview" class="m-home__hero-desc">{{ heroOverview }}</p>
                    <span class="m-home__hero-cta" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        Watch now
                    </span>
                </div>
            </router-link>
        </section>

        <MobileContinueShelf class="m-home__continue" />

        <MobileSection
            title="Top 10 Today"
            eyebrow="Trending"
            :more-to="movies"
        >
            <MobileMediaRail :items="topTenItems" card-size="md" />
        </MobileSection>

        <MobileSection
            title="Now Playing"
            eyebrow="New"
            :more-to="movies"
        >
            <MobileMediaRail :items="nowPlayingItems" />
        </MobileSection>

        <MobileSection
            title="Series in rotation"
            eyebrow="TV"
            :more-to="tvShows"
        >
            <MobileMediaRail :items="seriesItems" />
        </MobileSection>
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import MobileSection from '../components/MobileSection.vue';
import MobileMediaRail from '../components/MobileMediaRail.vue';
import MobileContinueShelf from '../components/MobileContinueShelf.vue';
import { useHighlights, highLightOptions } from '@/composables/useHighlights';
import { useTvShows, newShows } from '@/composables/useTvShows';
import { primeGenres } from '@/composables/useGenreLookup';
import { useAppPaths } from '@/composables/useAppPaths';
import { useWebImage } from '@/utils/useWebImage';

const { movie, movies, tvShows } = useAppPaths();
const { fetchAllHighlights } = useHighlights();
const { fetchNewShows } = useTvShows();

const hero = computed(() => highLightOptions.featured.data?.[0] ?? null);

const heroBackdrop = computed(() => {
    const path = hero.value?.backdrop_path || hero.value?.poster_path;
    return path ? useWebImage(path, 'large') : '';
});

const heroOverview = computed(() => {
    const text = hero.value?.overview ?? '';
    return text.length > 140 ? `${text.slice(0, 137).trim()}…` : text;
});

const topTenItems = computed(() =>
    (highLightOptions.popular.data ?? []).slice(0, 10).map((m: any) => ({
        id: m.id,
        title: m.title,
        posterPath: m.poster_path,
        type: 'movie' as const
    }))
);

const nowPlayingItems = computed(() =>
    (highLightOptions.new.data ?? []).slice(0, 12).map((m: any) => ({
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

const seriesItems = computed(() =>
    (newShows.value ?? []).slice(0, 12).map((s: any) => ({
        id: s.id,
        title: s.name,
        posterPath: s.poster_path,
        rating: s.vote_average,
        releaseDate: s.release_date,
        genreIds: s.genre_ids,
        adult: s.adult,
        type: 'tv' as const
    }))
);

onMounted(async () => {
    document.title = 'Moovie';
    primeGenres();
    await Promise.all([fetchAllHighlights(), fetchNewShows()]);
});
</script>

<style lang="scss" scoped>
.m-home {
    &__hero {
        margin: var(--s-3) var(--s-4) var(--s-4);
        border-radius: var(--r-md);
        overflow: hidden;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    }

    &__hero-skeleton {
        width: 100%;
        aspect-ratio: 16 / 10;
        background: var(--ink-800);
    }

    &__hero-skeleton-shimmer {
        position: relative;
        overflow: hidden;

        &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(
                90deg,
                transparent,
                rgba(255, 255, 255, 0.04),
                transparent
            );
            transform: translateX(-100%);
            animation: mobile-hero-shimmer 1.6s infinite ease-in-out;
        }
    }

    &__hero-link {
        position: relative;
        display: block;
        aspect-ratio: 16 / 10;
        color: inherit;
        text-decoration: none;
    }

    &__hero-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    &__hero-scrim {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, transparent 20%, rgba(11, 10, 8, 0.92) 100%);
    }

    &__hero-body {
        position: absolute;
        inset: auto 0 0 0;
        padding: var(--s-4);
    }

    &__hero-eyebrow {
        color: var(--ember);
        margin-bottom: var(--s-1);
    }

    &__hero-title {
        font-family: var(--font-display);
        font-size: clamp(1.4rem, 5vw, 1.75rem);
        font-weight: 500;
        line-height: 1.1;
        margin: 0 0 var(--s-2);
    }

    &__hero-desc {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--bone-300);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    &__hero-cta {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin-top: var(--s-3);
        padding: 0.45rem 0.85rem;
        border-radius: var(--r-pill);
        background: var(--ember);
        color: var(--ink-900);
        font-family: var(--font-ui);
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.02em;
    }

    &__continue {
        margin: 0 var(--s-4) var(--s-2);
    }
}

@keyframes mobile-hero-shimmer {
    100% {
        transform: translateX(100%);
    }
}
</style>
