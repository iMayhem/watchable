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
                    :loading="loading"
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
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import TitleMasthead from '../components/detail/TitleMasthead.vue';
import CuratedRail, { type CuratedItem } from '../components/rails/CuratedRail.vue';
import {
    browseNetmirror,
    fetchNetmirrorMeta,
    netmirrorRating,
    parseNetmirrorTitle,
    type NetmirrorBrowseItem
} from '../composables/useNetmirror';
import {
    getNetflixLanguage,
    getLanguageOption,
    itemMatchesLanguage
} from '../composables/useNetflixLanguage';
import { useSeo } from '../composables/useSeo';
import {
    mapWithConcurrency,
    resolveArtworkForNetmirrorItem,
    resolveTmdbArtwork
} from '../composables/useTmdbArtwork';

export default defineComponent({
    name: 'NetflixDetail',
    components: { SiteHeader, SiteFooter, TitleMasthead, CuratedRail },
    setup() {
        const route = useRoute();
        const { updateSeo } = useSeo();
        const loading = ref(true);
        const meta = ref<any>(null);
        const similarItems = ref<CuratedItem[]>([]);
        const artwork = ref<{ posterPath: string | null; backdropPath: string | null }>({
            posterPath: null,
            backdropPath: null
        });

        const mediaType = computed(() =>
            route.params.type === 'tv' ? 'tv' : 'movie'
        );

        const parsed = computed(() =>
            parseNetmirrorTitle(meta.value?.title || '')
        );

        const displayTitle = computed(() => parsed.value.displayTitle || meta.value?.title || '');
        const languageTags = computed(() => parsed.value.languages);
        const languageLine = computed(() => languageTags.value.join(' · '));
        const rating = computed(() => netmirrorRating(meta.value?.vote_average));

        const playRoute = computed(() => {
            const id = route.params.id;
            if (mediaType.value === 'tv') {
                const season = parsed.value.season || 1;
                return `/stream/nf/tv/${id}/season/${season}/episode/1`;
            }
            return `/stream/nf/movie/${id}`;
        });

        const toCurated = async (item: NetmirrorBrowseItem): Promise<CuratedItem> => {
            const p = parseNetmirrorTitle(item.title || '');
            const art = await resolveArtworkForNetmirrorItem(item);
            return {
                id: item.id,
                title: p.displayTitle || item.title,
                originalTitle: p.languages.join(' · '),
                posterPath: art.posterPath || art.fallbackPath,
                backdropPath: art.backdropPath || art.fallbackPath,
                rating: netmirrorRating(item.vote_average),
                releaseDate: item.release_date || '',
                type: item.media_type === 'tv' ? 'tv' : 'movie',
                languageTags: p.languages
            };
        };

        const loadDetail = async () => {
            loading.value = true;
            similarItems.value = [];
            artwork.value = { posterPath: null, backdropPath: null };
            try {
                const id = String(route.params.id || '');
                meta.value = await fetchNetmirrorMeta(mediaType.value, id);

                const parsedTitle = parseNetmirrorTitle(meta.value?.title || '');
                const tmdbArt = await resolveTmdbArtwork({
                    title: parsedTitle.displayTitle || meta.value?.title || '',
                    year: meta.value?.release_date,
                    type: mediaType.value,
                    cacheKey: `nm-detail-${mediaType.value}-${id}`
                });
                artwork.value = {
                    posterPath: tmdbArt.posterPath || meta.value?.backdrop_path || null,
                    backdropPath: tmdbArt.backdropPath || meta.value?.backdrop_path || null
                };

                const { language } = getNetflixLanguage();
                const lang = getLanguageOption(language.value);
                const browse = await browseNetmirror(lang.category, 0);
                const similarPool = (browse.results || [])
                    .filter((item) => item.id !== id && itemMatchesLanguage(item, lang))
                    .slice(0, 14);
                similarItems.value = await mapWithConcurrency(similarPool, toCurated, 6);

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
            } catch (err) {
                console.error('[NetflixDetail] load failed:', err);
            } finally {
                loading.value = false;
            }
        };

        onMounted(loadDetail);
        watch(() => route.params.id, loadDetail);

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