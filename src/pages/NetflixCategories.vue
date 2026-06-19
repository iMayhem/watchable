<template>
    <div class="nf-categories">
        <SiteHeader />

        <main id="main" class="nf-categories__main container-lm" role="main">
            <header class="nf-categories__head">
                <h1 class="nf-categories__title">Categories</h1>
                <p class="nf-categories__desc">
                    Browse every {{ activeCatalogue.label }} genre — same hidden codes as
                    <a href="https://www.netflix-codes.com/" target="_blank" rel="noopener noreferrer">netflix-codes.com</a>.
                </p>
            </header>

            <section
                v-for="group in categoryGroups"
                :key="group.parentId"
                class="nf-categories__section"
            >
                <div class="nf-categories__section-head">
                    <h2 class="nf-categories__section-title">{{ group.parentTitle }}</h2>
                    <router-link
                        :to="browsePath(group.parentId)"
                        class="nf-categories__section-all"
                    >
                        Browse all
                    </router-link>
                </div>

                <div class="nf-categories__grid" role="list">
                    <router-link
                        :to="browsePath(group.parentId)"
                        class="nf-categories__tile nf-categories__tile--parent"
                        role="listitem"
                    >
                        <span class="nf-categories__tile-label">{{ group.parentTitle }}</span>
                        <span v-if="group.netflixCode" class="nf-categories__tile-code">
                            {{ group.netflixCode }}
                        </span>
                    </router-link>

                    <router-link
                        v-for="child in group.children"
                        :key="child.id"
                        :to="browsePath(child.id)"
                        class="nf-categories__tile"
                        role="listitem"
                    >
                        <span class="nf-categories__tile-label">{{ child.title }}</span>
                        <span class="nf-categories__tile-code">{{ child.netflixCode }}</span>
                    </router-link>
                </div>
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, watch } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import { getCatalogueOption, getNetflixCatalogue } from '../composables/useNetflixCatalogue';
import { getNetflixCategoryGroups } from '../composables/netflixCuratedRows';
import { netflixBrowsePath } from '../composables/useNetflixRails';
import { useSeo } from '../composables/useSeo';

export default defineComponent({
    name: 'NetflixCategories',
    components: { SiteHeader, SiteFooter },
    setup() {
        const { updateSeo } = useSeo();
        const { catalogue, activeCatalogue: resolveCatalogue } = getNetflixCatalogue();

        const activeCatalogue = computed(() => resolveCatalogue());
        const categoryGroups = computed(() => getNetflixCategoryGroups(catalogue.value));

        const browsePath = (rowId: string) => netflixBrowsePath(catalogue.value, rowId);

        const refreshSeo = () => {
            const cat = getCatalogueOption(catalogue.value);
            updateSeo({
                title: `Categories · ${cat.label} — Netflix on Moovie`,
                canonical: 'https://moovie.fun/nf/categories',
                image: 'https://moovie.fun/og-image.png'
            });
        };

        refreshSeo();
        watch(catalogue, refreshSeo);

        return {
            activeCatalogue,
            categoryGroups,
            browsePath
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
        padding-bottom: clamp(var(--s-9), 10vw, var(--s-11));
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

        a {
            color: var(--bone-100);
            text-decoration: underline;
            text-underline-offset: 0.15em;

            &:hover {
                color: var(--ember);
            }
        }
    }

    &__section {
        margin-bottom: clamp(var(--s-7), 7vw, var(--s-9));

        &:last-child {
            margin-bottom: 0;
        }
    }

    &__section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--s-4);
        margin-bottom: var(--s-4);
    }

    &__section-title {
        font-family: var(--font-display);
        font-size: clamp(1.25rem, 2.5vw, 1.5rem);
        font-weight: 500;
        margin: 0;
        letter-spacing: -0.01em;
    }

    &__section-all {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--bone-300);
        white-space: nowrap;
        transition: color var(--dur-fast) var(--ease-out);

        &:hover,
        &:focus-visible {
            color: var(--ember);
        }
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
            border-color: var(--rule-strong);
            background: linear-gradient(145deg, var(--ink-650, #2a2a2a) 0%, var(--ink-750) 100%);
        }

        &--parent {
            background: linear-gradient(145deg, var(--ink-650, #2a2a2a) 0%, var(--ink-800) 55%);
            border-color: var(--rule-strong);
            min-height: 96px;

            &:hover,
            &:focus-visible {
                border-color: var(--ember);
            }
        }
    }

    &__tile-label {
        font-size: var(--fs-sm);
        font-weight: 500;
        line-height: 1.3;
    }

    &__tile-code {
        margin-top: 0.35rem;
        font-family: var(--font-mono);
        font-size: 0.65rem;
        letter-spacing: 0.08em;
        color: var(--bone-500);
    }
}
</style>