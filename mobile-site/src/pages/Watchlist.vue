<template>
    <MobileShell>
        <div class="m-watchlist">
            <header class="m-watchlist__head">
                <h1 class="m-watchlist__title">Watchlist</h1>
            </header>

            <div v-if="!currentItems.length" class="m-watchlist__empty">
                <p class="meta">This list is empty.</p>
                <router-link :to="movies" class="m-watchlist__cta">Browse movies</router-link>
            </div>

            <MobileMediaGrid v-else :items="gridItems" />
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import MobileMediaGrid from '../components/MobileMediaGrid.vue';
import { useWatchlist } from '@/composables/useWatchlist';
import { useAppPaths } from '@/composables/useAppPaths';
import {
    getCachedAnimeTmdbArtwork,
    resolveAnimeTmdbPosterBatch
} from '@/composables/useAnimeTmdbArtwork';
import { fetchCatalogArtworkUrlsByIds } from '@/composables/usePosterCache';
import { resolveTmdbArtwork } from '@/composables/useTmdbArtwork';

const { movies } = useAppPaths();
const { watchlist } = useWatchlist();
const animeTmdbPosters = ref<Record<string, string>>({});
const movieShowTmdbPosters = ref<Record<string, string>>({});

const currentItems = computed(() => watchlist.value);

const gridItems = computed(() =>
    currentItems.value.map((item: any) => {
        const key = `${item.type}-${item.id}`;
        let poster = item.image;
        if (movieShowTmdbPosters.value[key]) {
            poster = movieShowTmdbPosters.value[key];
        } else if (item.type === 'anime') {
            poster = item.image || animeTmdbPosters.value[String(item.id)] || '';
        }
        return {
            id: item.id,
            title: item.title,
            posterPath: poster,
            rating: item.rating ?? 0,
            type: (item.type === 'anime' ? 'anime' : item.type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv' | 'anime'
        };
    })
);

async function hydrateAnimePosters() {
    const animeItems = currentItems.value.filter((item: any) => item.type === 'anime' && !item.image);
    if (!animeItems.length) return;

    const updates: Record<string, string> = {};
    for (const item of animeItems) {
        const key = String(item.id);
        const cached = getCachedAnimeTmdbArtwork(Number(item.id));
        if (cached?.posterPath) {
            updates[key] = cached.posterPath;
        }
    }

    const pending = animeItems.filter((item: any) => !updates[String(item.id)]);
    if (pending.length) {
        const resolved = await resolveAnimeTmdbPosterBatch(
            pending.map((item: any) => ({
                id: Number(item.id),
                title: { english: item.title, romaji: item.title },
                format: 'TV'
            }))
        ).catch(() => ({} as Record<number, string>));
        for (const [id, posterPath] of Object.entries(resolved)) {
            if (posterPath) updates[id] = posterPath;
        }
    }

    if (Object.keys(updates).length) {
        animeTmdbPosters.value = { ...animeTmdbPosters.value, ...updates };
    }
}

async function hydrateMovieShowPosters() {
    const movieShowItems = currentItems.value.filter(
        (item: any) => item.type === 'movie' || item.type === 'tv'
    );
    if (!movieShowItems.length) return;

    const updates: Record<string, string> = {};
    const catalogIds: string[] = [];
    const tmdbItems: any[] = [];

    for (const item of movieShowItems) {
        if (typeof item.id === 'string' && /\D/.test(item.id)) {
            catalogIds.push(item.id);
        } else {
            tmdbItems.push(item);
        }
    }

    if (catalogIds.length) {
        try {
            const artworkMaps = await fetchCatalogArtworkUrlsByIds(catalogIds);
            for (const [id, url] of artworkMaps.posters.entries()) {
                if (url) {
                    updates[`movie-${id}`] = url;
                    updates[`tv-${id}`] = url;
                }
            }
        } catch (e) {
            console.error('Failed to fetch catalog posters:', e);
        }
    }

    if (tmdbItems.length) {
        await Promise.all(
            tmdbItems.map(async (item) => {
                try {
                    const art = await resolveTmdbArtwork({
                        title: item.title,
                        type: item.type === 'tv' ? 'tv' : 'movie',
                        tmdbId: Number(item.id)
                    });
                    if (art.posterPath) {
                        updates[`${item.type}-${item.id}`] = art.posterPath;
                    }
                } catch (e) {
                    // ignore
                }
            })
        );
    }

    if (Object.keys(updates).length) {
        movieShowTmdbPosters.value = { ...movieShowTmdbPosters.value, ...updates };
    }
}

function hydrateAllPosters() {
    void hydrateAnimePosters();
    void hydrateMovieShowPosters();
}

watch(currentItems, () => {
    hydrateAllPosters();
}, { immediate: true });

onMounted(() => {
    document.title = 'Watchlist — Moovie';
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
