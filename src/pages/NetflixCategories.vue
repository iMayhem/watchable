<template>
    <div class="nf-categories">
        <SiteHeader />

        <main id="main" class="nf-categories__main container-lm" role="main">
            <header class="nf-categories__head">
                <h1 class="nf-categories__title">
                    {{ typeFilter === 'tv' ? 'TV Show ' : typeFilter === 'movie' ? 'Movie ' : '' }}Categories
                </h1>
                <p class="nf-categories__desc">
                    Browse by dub language and genre.
                </p>
            </header>

            <section class="nf-categories__section">
                <h2 class="nf-categories__section-title">Category</h2>
                <div class="nf-categories__grid" role="list">
                    <router-link
                        v-for="cat in exploreCategories"
                        :key="cat.id"
                        :to="explorePath(cat)"
                        class="nf-categories__tile"
                        role="listitem"
                    >
                        <span class="nf-categories__tile-label">{{ cat.title }}</span>
                    </router-link>
                </div>
            </section>

            <section
                v-for="section in categorySections"
                :key="section.id"
                class="nf-categories__section"
            >
                <h2 class="nf-categories__section-title">{{ section.title }}</h2>

                <div class="nf-categories__grid" role="list">
                    <router-link
                        v-for="genre in section.genres"
                        :key="genre.id"
                        :to="browsePath(genre.id)"
                        class="nf-categories__tile"
                        role="listitem"
                    >
                        <span class="nf-categories__tile-label">{{ genre.title }}</span>
                    </router-link>
                </div>
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, watch } from 'vue';
import { useRoute } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import { getCatalogueOption, getNetflixCatalogue } from '../composables/useNetflixCatalogue';
import { getNetflixCategorySections } from '../composables/netflixCuratedRows';
import { netflixBrowsePath } from '../composables/useNetflixRails';
import {
    NETMIRROR_EXPLORE_CATEGORIES,
    netflixExplorePath,
    resolveExplorePathMediaType,
    type NetmirrorExploreMediaType
} from '../data/netmirrorExploreCategories';
import { useSeo } from '../composables/useSeo';

export default defineComponent({
    name: 'NetflixCategories',
    components: { SiteHeader, SiteFooter },
    setup() {
        const route = useRoute();
        const { updateSeo } = useSeo();
        const { catalogue, activeCatalogue: resolveCatalogue } = getNetflixCatalogue();

        const typeFilter = computed(() => {
            const t = route.query.type;
            if (t === 'tv' || t === 'movie') return t;
            return undefined;
        });

        const activeCatalogue = computed(() => resolveCatalogue());
        const categorySections = computed(() => getNetflixCategorySections(catalogue.value));
        const exploreCategories = NETMIRROR_EXPLORE_CATEGORIES;
        const explorePath = (cat: (typeof exploreCategories)[number]) => {
            const routeMediaType: NetmirrorExploreMediaType =
                typeFilter.value === 'movie' || typeFilter.value === 'tv'
                    ? typeFilter.value
                    : cat.mediaType;
            return netflixExplorePath(cat, {
                mediaType: resolveExplorePathMediaType(cat, routeMediaType)
            });
        };
        const browsePath = (rowId: string) => {
            const query = typeFilter.value ? `?type=${typeFilter.value}` : '';
            if (catalogue.value === 'korean' && rowId === 'anime') {
                return netflixBrowsePath('hollywood', 'anime') + query;
            }
            return netflixBrowsePath(catalogue.value, rowId) + query;
        };

        const refreshSeo = () => {
            const cat = getCatalogueOption(catalogue.value);
            const prefix = typeFilter.value === 'tv' ? 'TV Show ' : typeFilter.value === 'movie' ? 'Movie ' : '';
            updateSeo({
                title: `${prefix}Categories · ${cat.label} — Netflix on Moovie`,
                canonical: 'https://moovie.fun/nf/categories',
                image: 'https://moovie.fun/og-image.png'
            });
        };

        refreshSeo();
        watch([catalogue, typeFilter], refreshSeo);

        return {
            activeCatalogue,
            categorySections,
            exploreCategories,
            explorePath,
            browsePath,
            typeFilter
        };
    }
});
</script>

<style lang="scss" scoped>
.nf-categories {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        padding-top: clamp(var(--s-6), 6vw, var(--s-8));
        padding-bottom: clamp(var(--s-9), 10vw, var(--s-10));
    }

    &__head {
        margin-bottom: clamp(var(--s-7), 7vw, var(--s-9));
    }

    &__title {
        font-family: var(--font-display);
        font-size: clamp(2rem, 4vw, 2.75rem);
        font-weight: 500;
        letter-spacing: -0.02em;
        margin: 0 0 var(--s-3);
    }

    &__desc {
        margin: 0;
        max-width: 58ch;
        color: var(--bone-300);
        line-height: 1.55;
    }

    &__section {
        margin-bottom: clamp(var(--s-7), 7vw, var(--s-9));

        &:last-child {
            margin-bottom: clamp(var(--s-8), 8vw, var(--s-10));
        }
    }

    &__section-title {
        font-family: var(--font-display);
        font-size: clamp(1.25rem, 2.5vw, 1.5rem);
        font-weight: 500;
        margin: 0 0 var(--s-4);
        letter-spacing: -0.01em;
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: var(--s-3);

        @media (min-width: 720px) {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: var(--s-4);
        }
    }

    &__tile {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        min-height: 88px;
        padding: var(--s-3) var(--s-4);
        border-radius: var(--r-sm);
        background: linear-gradient(145deg, var(--ink-700) 0%, var(--ink-800) 100%);
        border: 1px solid var(--rule);
        text-decoration: none;
        color: var(--bone-50);
        transition:
            transform var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out),
            background-color var(--dur-fast) var(--ease-out);

        &:hover,
        &:focus-visible {
            transform: translateY(-2px);
            border-color: var(--ember);
            background: linear-gradient(145deg, var(--ink-650, #2a2a2a) 0%, var(--ink-750) 100%);
        }
    }

    &__tile-label {
        font-size: var(--fs-sm);
        font-weight: 500;
        line-height: 1.3;
    }
}
</style>