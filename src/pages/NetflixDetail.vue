<template>
    <div class="nf-detail">
        <SiteHeader />

        <main id="main" class="nf-detail__main" role="main">
            <section class="nf-detail__snap-slide">
                <TitleMasthead
                    :id="meta ? meta.id : ''"
                    :type="mediaType"
                    :title="displayTitle"
                    :tagline="languageLine"
                    :eyebrow="mediaType === 'tv' ? 'Series' : 'Film'"
                    :backdrop-path="artwork.backdropPath"
                    :poster-path="artwork.posterPath"
                    :rating="rating"
                    :release-date="meta ? meta.release_date : ''"
                    :genres="languageTags"
                    :genre-ids="[]"
                    :play-route="playRoute"
                    :show-trailer="false"
                    :loading="loading && !meta"
                />
            </section>

            <section v-if="similarItems.length" class="nf-detail__section container-lm">
                <CuratedRail
                    :items="similarItems"
                    title="More like this"
                    eyebrow="Keep watching"
                    catalog="netflix"
                />
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onActivated, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import TitleMasthead from '../components/detail/TitleMasthead.vue';
import CuratedRail, { type CuratedItem } from '../components/rails/CuratedRail.vue';
import {
    browseMoovieCatalog,
    fetchMoovieCatalogMeta,
    catalogRating,
    inferCatalogMediaType,
    parseCatalogTitle,
    type MoovieCatalogItem
} from '../composables/useMoovieCatalog';
import {
    getNetflixLanguage,
    getLanguageOption,
    itemMatchesLanguage
} from '../composables/useNetflixLanguage';
import { useSeo } from '../composables/useSeo';
import {
    mapWithConcurrency,
    resolveArtworkForCatalogItem
} from '../composables/useTmdbArtwork';
import { nfDebug, nfDebugError } from '../composables/useNetflixDebug';

export default defineComponent({
    name: 'NetflixDetail',
    components: { SiteHeader, SiteFooter, TitleMasthead, CuratedRail },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const loading = ref(true);
        const meta = ref<any>(null);
        const similarItems = ref<CuratedItem[]>([]);
        const artwork = ref<{ posterPath: string | null; backdropPath: string | null }>({
            posterPath: null,
            backdropPath: null
        });

        const mediaType = computed((): 'movie' | 'tv' => {
            const fromMeta = meta.value?.media_type;
            if (fromMeta === 'tv' || fromMeta === 'movie') return fromMeta;
            return route.params.type === 'tv' ? 'tv' : 'movie';
        });

        const parsed = computed(() =>
            parseCatalogTitle(meta.value?.title || '')
        );

        const displayTitle = computed(() => parsed.value.displayTitle || meta.value?.title || '');
        const languageTags = computed(() => parsed.value.languages);
        const languageLine = computed(() => languageTags.value.join(' · '));
        const rating = computed(() => catalogRating(meta.value?.vote_average));

        const playRoute = computed(() => {
            const id = route.params.id;
            if (mediaType.value === 'tv') {
                const season = parsed.value.season || 1;
                return `/stream/nf/tv/${id}/season/${season}/episode/1`;
            }
            return `/stream/nf/movie/${id}`;
        });

        const syncRouteMediaType = () => {
            const id = routeId();
            if (!meta.value || String(meta.value.id) !== id) return;
            const canonical = mediaType.value;
            if (route.params.type === canonical) return;
            nfDebug('detail:canonical-type', {
                id,
                routeType: route.params.type,
                canonical
            });
            router.replace(`/nf/${canonical}/${id}`);
        };

        const routeId = () => String(route.params.id || '');

        const isHydratedForRoute = () => {
            const id = routeId();
            return Boolean(meta.value && String(meta.value.id) === id);
        };

        const toCurated = async (item: MoovieCatalogItem): Promise<CuratedItem> => {
            const p = parseCatalogTitle(item.title || '');
            const art = await resolveArtworkForCatalogItem(item);
            return {
                id: item.id,
                title: p.displayTitle || item.title,
                originalTitle: p.languages.join(' · '),
                posterPath: art.posterPath || art.fallbackPath,
                backdropPath: art.backdropPath || art.fallbackPath,
                rating: catalogRating(item.vote_average),
                releaseDate: item.release_date || '',
                type: inferCatalogMediaType(item),
                languageTags: p.languages
            };
        };

        const applySeo = (id: string) => {
            const seoImage = artwork.value.backdropPath || artwork.value.posterPath;
            updateSeo({
                title: `${displayTitle.value} — Netflix on Moovie`,
                canonical: `https://moovie.fun/nf/${mediaType.value}/${id}`,
                image: seoImage?.startsWith('http')
                    ? seoImage
                    : seoImage
                      ? `https://moovie.fun/api/img?path=${encodeURIComponent(seoImage)}`
                      : 'https://moovie.fun/og-image.png'
            });
        };

        const loadSimilar = async (id: string) => {
            const { language } = getNetflixLanguage();
            const lang = getLanguageOption(language.value);
            const browse = await browseMoovieCatalog(lang.category, 0);
            const similarPool = (browse.results || [])
                .filter((item) => item.id !== id && itemMatchesLanguage(item, lang))
                .slice(0, 10);
            similarItems.value = await mapWithConcurrency(similarPool, toCurated, 4);
        };

        const loadDetail = async (opts: { background?: boolean } = {}) => {
            const id = routeId();
            const background = opts.background ?? isHydratedForRoute();
            nfDebug('detail:load:start', { id, type: mediaType.value, background });

            if (!background) {
                loading.value = true;
                similarItems.value = [];
                artwork.value = { posterPath: null, backdropPath: null };
            }

            try {
                const metaPromise = background && meta.value
                    ? Promise.resolve(meta.value)
                    : fetchMoovieCatalogMeta(mediaType.value, id);

                meta.value = await metaPromise;

                const art = await resolveArtworkForCatalogItem({
                    id: String(meta.value.id),
                    title: meta.value?.title || '',
                    release_date: meta.value?.release_date,
                    media_type: mediaType.value,
                    backdrop_path: meta.value?.backdrop_path || null
                });
                artwork.value = {
                    posterPath: art.posterPath || art.fallbackPath || null,
                    backdropPath: art.backdropPath || art.fallbackPath || null
                };

                applySeo(id);
                syncRouteMediaType();

                if (!background || !similarItems.value.length) {
                    void loadSimilar(id);
                }

                nfDebug('detail:load:ok', {
                    id,
                    title: displayTitle.value,
                    background
                });
            } catch (err) {
                nfDebugError('detail:load:fail', { id, type: mediaType.value, err });
            } finally {
                loading.value = false;
            }
        };

        onMounted(() => {
            nfDebug('detail:mount', { id: route.params.id, type: mediaType.value });
            loadDetail();
        });

        onActivated(() => {
            if (isHydratedForRoute()) {
                nfDebug('detail:reactivate', { id: routeId() });
                loading.value = false;
                applySeo(routeId());
                return;
            }
            loadDetail();
        });

        watch(() => route.params.id, (newId, oldId) => {
            if (!newId || newId === oldId) return;
            nfDebug('detail:route-change', { id: newId });
            loadDetail();
        });

        return {
            loading,
            meta,
            mediaType,
            displayTitle,
            languageLine,
            languageTags,
            rating,
            playRoute,
            similarItems,
            artwork
        };
    }
});
</script>

<style lang="scss" scoped>
.nf-detail {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__section {
        margin: var(--s-8) auto var(--s-10);
    }
}
</style>