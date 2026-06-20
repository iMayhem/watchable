<template>
    <MobileShell>
        <div class="m-watchlist">
            <header class="m-watchlist__head">
                <h1 class="m-watchlist__title">Watchlist</h1>
            </header>

            <div v-if="!watchlist.length" class="m-watchlist__empty">
                <p class="meta">Your watchlist is empty.</p>
                <router-link :to="movies" class="m-watchlist__cta">Browse movies</router-link>
            </div>

            <MobileMediaGrid v-else :items="gridItems" />
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import MobileMediaGrid from '../components/MobileMediaGrid.vue';
import { useWatchlist } from '@/composables/useWatchlist';
import { useAppPaths } from '@/composables/useAppPaths';
import {
    getCachedAnimeTmdbArtwork,
    resolveAnimeTmdbPosterOnly
} from '@/composables/useAnimeTmdbArtwork';

const { movies } = useAppPaths();
const { watchlist } = useWatchlist();
const animeTmdbPosters = ref<Record<string, string>>({});

const gridItems = computed(() =>
    watchlist.value.map((item: any) => ({
        id: item.id,
        title: item.title,
        posterPath: item.type === 'anime'
            ? (animeTmdbPosters.value[String(item.id)] || item.image)
            : item.image,
        rating: item.rating ?? 0,
        type: (item.type === 'anime' ? 'anime' : item.type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv' | 'anime'
    }))
);

async function hydrateAnimePosters() {
    const animeItems = watchlist.value.filter((item: any) => item.type === 'anime');
    if (!animeItems.length) return;

    const updates: Record<string, string> = {};
    await Promise.all(
        animeItems.map(async (item: any) => {
            const key = String(item.id);
            const cached = getCachedAnimeTmdbArtwork(Number(item.id));
            if (cached?.posterPath) {
                updates[key] = cached.posterPath;
                return;
            }
            const artwork = await resolveAnimeTmdbPosterOnly(Number(item.id), {
                title: { english: item.title, romaji: item.title }
            }).catch(() => null);
            if (artwork?.posterPath) updates[key] = artwork.posterPath;
        })
    );

    if (Object.keys(updates).length) {
        animeTmdbPosters.value = { ...animeTmdbPosters.value, ...updates };
    }
}

onMounted(() => {
    document.title = 'Watchlist — Moovie';
    void hydrateAnimePosters();
});
</script>

<style lang="scss" scoped>
.m-watchlist {
    padding-bottom: var(--s-6);

    &__head {
        padding: var(--s-4);
    }

    &__title {
        font-family: var(--font-display);
        font-size: 1.5rem;
        margin: 0;
    }

    &__empty {
        padding: var(--s-8) var(--s-4);
        text-align: center;
    }

    &__cta {
        display: inline-block;
        margin-top: var(--s-4);
        color: var(--ember);
        font-weight: 600;
    }
}
</style>
