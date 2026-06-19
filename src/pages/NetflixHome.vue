<template>
    <div class="home netflix-home">
        <SiteHeader />

        <main id="main" class="home__main" role="main">
            <BillboardHero
                :id="hero ? hero.id : ''"
                :type="hero ? hero.type : 'movie'"
                :title="hero ? hero.title : ''"
                :tagline="activeLang.nativeLabel"
                :overview="hero ? hero.overview : ''"
                :backdrop-path="hero ? hero.backdropPath : null"
                :poster-path="hero ? hero.posterPath : null"
                :rating="hero ? hero.rating : 0"
                :release-date="hero ? hero.releaseDate : ''"
                :genre-ids="[]"
                :eyebrow="`Featured · ${activeLang.label}`"
                :loading="isLoading && !hero"
                :play-to="heroPlayRoute"
                :detail-to="heroDetailRoute"
            />

            <div v-if="!isLoading || trendingItems.length" class="home__lang-banner container-lm">
                <span class="home__lang-chip">{{ activeLang.nativeLabel }}</span>
                <span class="home__lang-copy">
                    Browsing <strong>{{ activeLang.label }}</strong> catalogue — Hollywood, Bollywood, Korean and more.
                </span>
            </div>

            <CuratedRail
                v-if="trendingItems.length || isLoading"
                class="home__section"
                :items="trendingItems"
                title="Trending now"
                :eyebrow="activeLang.nativeLabel"
                :description="`Top ${activeLang.label} picks right now.`"
                catalog="netflix"
                :loading="isLoading"
            />

            <CuratedRail
                v-for="rail in catalogueRails"
                :key="rail.id"
                class="home__section"
                :items="rail.items"
                :title="rail.title"
                :eyebrow="rail.eyebrow"
                :description="rail.description"
                :default-type="rail.defaultType"
                catalog="netflix"
            />

            <CuratedRail
                v-if="isLoading && !catalogueRails.length"
                class="home__section"
                :items="[]"
                title="Loading catalogues"
                :eyebrow="activeLang.label"
                catalog="netflix"
                :loading="true"
            />
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onActivated, onBeforeUnmount, onMounted, ref } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import BillboardHero from '../components/hero/BillboardHero.vue';
import CuratedRail, { type CuratedItem } from '../components/rails/CuratedRail.vue';
import {
    browseMoovieCatalog,
    catalogRating,
    inferCatalogMediaType,
    parseCatalogTitle,
    type MoovieCatalogItem
} from '../composables/useMoovieCatalog';
import {
    getNetflixLanguage,
    getLanguageOption,
    itemMatchesLanguage,
    type NetflixLanguageOption
} from '../composables/useNetflixLanguage';
import {
    buildNetflixRailSections,
    buildTrendingItems,
    collectArtworkIds,
    type NetflixRailSection
} from '../composables/useNetflixRails';
import { useSeo } from '../composables/useSeo';
import {
    mapWithConcurrency,
    resolveArtworkForCatalogItem
} from '../composables/useTmdbArtwork';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';

async function toCuratedItem(item: MoovieCatalogItem): Promise<CuratedItem> {
    const parsed = parseCatalogTitle(item.title || '');
    const artwork = await resolveArtworkForCatalogItem(item);

    return {
        id: item.id,
        title: parsed.displayTitle || item.title,
        originalTitle: parsed.languages.join(' · '),
        posterPath: artwork.posterPath || artwork.fallbackPath,
        backdropPath: artwork.backdropPath || artwork.fallbackPath,
        rating: catalogRating(item.vote_average),
        releaseDate: item.release_date || '',
        type: inferCatalogMediaType(item),
        languageTags: parsed.languages
    };
}

export default defineComponent({
    name: 'NetflixHome',
    // Cached via parent HomeShell KeepAlive — skip reload when returning from player.
    components: { SiteHeader, SiteFooter, BillboardHero, CuratedRail },
    setup() {
        const { updateSeo } = useSeo();
        const { language, activeLanguage } = getNetflixLanguage();
        const isLoading = ref(true);
        const trendingItems = ref<CuratedItem[]>([]);
        const catalogueRails = ref<NetflixRailSection[]>([]);

        const activeLang = computed<NetflixLanguageOption>(() => activeLanguage());

        const hero = computed(() => {
            const first =
                trendingItems.value[0] ||
                catalogueRails.value[0]?.items[0] ||
                null;
            if (!first) return null;
            return {
                id: first.id,
                type: first.type || 'movie',
                title: first.title,
                overview: '',
                backdropPath: first.backdropPath || first.posterPath,
                posterPath: first.posterPath,
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

        const loadLanguageCatalogue = async () => {
            const lang = getLanguageOption(language.value);
            nfDebug('home:load:start', { language: lang.category, label: lang.label });
            isLoading.value = true;
            trendingItems.value = [];
            catalogueRails.value = [];

            try {
                const [page0, page1, page2] = await Promise.all([
                    browseMoovieCatalog(lang.category, 0),
                    browseMoovieCatalog(lang.category, 1),
                    browseMoovieCatalog(lang.category, 2)
                ]);

                const pool = [
                    ...(page0.results || []),
                    ...(page1.results || []),
                    ...(page2.results || [])
                ].filter((item) => itemMatchesLanguage(item, lang));

                const artworkTargets = collectArtworkIds(pool, lang);
                const curated = await mapWithConcurrency(artworkTargets, toCuratedItem, 5);
                const byId = new Map(curated.map((item) => [String(item.id), item]));

                trendingItems.value = buildTrendingItems(pool, byId);
                catalogueRails.value = buildNetflixRailSections(pool, lang, byId);

                nfDebug('home:load:ok', {
                    language: lang.category,
                    pool: pool.length,
                    trending: trendingItems.value.length,
                    rails: catalogueRails.value.length
                });

                updateSeo({
                    title: `${lang.label} — Netflix on Moovie`,
                    canonical: 'https://moovie.fun/',
                    image: 'https://moovie.fun/og-image.png'
                });
            } catch (err) {
                nfDebugError('home:load:fail', { language: lang.category, err });
            } finally {
                isLoading.value = false;
            }
        };

        const onLanguageChange = () => {
            nfDebug('home:language-change');
            loadLanguageCatalogue();
        };

        const hasCatalogue = () =>
            trendingItems.value.length > 0 || catalogueRails.value.length > 0;

        onMounted(() => {
            nfDebug('home:mount');
            loadLanguageCatalogue();
            window.addEventListener('movora_netflix_language_change', onLanguageChange);
        });

        onActivated(() => {
            if (hasCatalogue()) {
                nfDebug('home:reactivate');
                isLoading.value = false;
                return;
            }
            loadLanguageCatalogue();
        });

        onBeforeUnmount(() => {
            window.removeEventListener('movora_netflix_language_change', onLanguageChange);
        });

        return {
            isLoading,
            activeLang,
            hero,
            heroPlayRoute,
            heroDetailRoute,
            trendingItems,
            catalogueRails
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

    &__lang-banner {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-top: clamp(var(--s-5), 4vw, var(--s-6));
        padding: 0.65rem 0;
    }

    &__lang-chip {
        flex-shrink: 0;
        padding: 0.35rem 0.75rem;
        border-radius: var(--r-pill);
        background: rgba(229, 9, 20, 0.15);
        border: 1px solid rgba(229, 9, 20, 0.35);
        color: #ff6b6b;
        font-family: var(--font-ui);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.02em;
    }

    &__lang-copy {
        color: var(--bone-300);
        font-size: var(--fs-sm);
        line-height: var(--lh-base);

        strong {
            color: var(--bone-50);
            font-weight: 600;
        }
    }

    &__section {
        margin-top: clamp(var(--s-8), 8vw, var(--s-10));

        &:last-of-type {
            margin-bottom: clamp(var(--s-8), 8vw, var(--s-10));
        }
    }
}
</style>