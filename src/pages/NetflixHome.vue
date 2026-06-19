<template>
    <div class="home netflix-home">
        <SiteHeader />

        <main id="main" class="home__main" role="main">
            <BillboardHero
                :id="hero ? hero.id : ''"
                :type="hero ? hero.type : 'movie'"
                :title="hero ? hero.title : ''"
                :tagline="hero ? hero.languages.join(' · ') : ''"
                :overview="hero ? hero.overview : ''"
                :backdrop-path="hero ? hero.backdropPath : null"
                :poster-path="hero ? hero.backdropPath : null"
                :rating="hero ? hero.rating : 0"
                :release-date="hero ? hero.releaseDate : ''"
                :genre-ids="[]"
                eyebrow="Featured on Netflix"
                :loading="isLoading && !hero"
                :play-to="heroPlayRoute"
                :detail-to="heroDetailRoute"
            />

            <CuratedRail
                v-if="trendingItems.length"
                class="home__section"
                :items="trendingItems"
                title="Trending now"
                eyebrow="Top picks"
                description="What everyone is watching right now."
                catalog="netflix"
            />

            <CuratedRail
                v-for="rail in rails"
                :key="rail.category"
                class="home__section"
                :items="rail.items"
                :title="rail.title"
                :eyebrow="rail.eyebrow"
                :description="rail.description"
                catalog="netflix"
                :loading="isLoading"
            />
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import BillboardHero from '../components/hero/BillboardHero.vue';
import CuratedRail, { type CuratedItem } from '../components/rails/CuratedRail.vue';
import {
    NETFLIX_RAILS,
    browseNetmirror,
    netmirrorRating,
    parseNetmirrorTitle,
    type NetmirrorBrowseItem
} from '../composables/useNetmirror';
import { useSeo } from '../composables/useSeo';

interface RailState {
    category: string;
    title: string;
    eyebrow: string;
    description: string;
    items: CuratedItem[];
}

function toCuratedItem(item: NetmirrorBrowseItem): CuratedItem {
    const parsed = parseNetmirrorTitle(item.title || '');
    return {
        id: item.id,
        title: parsed.displayTitle || item.title,
        originalTitle: parsed.languages.join(' · '),
        posterPath: item.backdrop_path,
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
        const isLoading = ref(true);
        const trendingItems = ref<CuratedItem[]>([]);
        const rails = ref<RailState[]>(
            NETFLIX_RAILS.map((rail) => ({
                ...rail,
                items: []
            }))
        );

        const hero = computed(() => {
            const first = trendingItems.value[0] || rails.value.find((r) => r.items.length)?.items[0];
            if (!first) return null;
            return {
                id: first.id,
                type: first.type || 'movie',
                title: first.title,
                languages: first.originalTitle ? first.originalTitle.split(' · ').filter(Boolean) : [],
                overview: '',
                backdropPath: first.posterPath,
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

        const loadRails = async () => {
            isLoading.value = true;
            trendingItems.value = [];
            rails.value = NETFLIX_RAILS.map((rail) => ({ ...rail, items: [] }));

            try {
                const [hindiBrowse, ...rest] = await Promise.all([
                    browseNetmirror('hindi', 0),
                    ...NETFLIX_RAILS.map((rail) => browseNetmirror(rail.category, 0))
                ]);

                trendingItems.value = (hindiBrowse.results || []).slice(0, 12).map(toCuratedItem);

                rails.value = NETFLIX_RAILS.map((rail, index) => ({
                    ...rail,
                    items: (rest[index]?.results || []).slice(0, 18).map(toCuratedItem)
                }));
            } catch (err) {
                console.error('[NetflixHome] Failed to load rails:', err);
            } finally {
                isLoading.value = false;
            }
        };

        onMounted(() => {
            updateSeo({
                title: 'Netflix — Moovie',
                canonical: 'https://moovie.fun/',
                image: 'https://moovie.fun/og-image.png'
            });
            loadRails();
        });

        return {
            isLoading,
            hero,
            heroPlayRoute,
            heroDetailRoute,
            trendingItems,
            rails
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