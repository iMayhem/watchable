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
                    :backdrop-path="meta ? meta.backdrop_path : null"
                    :poster-path="meta ? meta.backdrop_path : null"
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

export default defineComponent({
    name: 'NetflixDetail',
    components: { SiteHeader, SiteFooter, TitleMasthead, CuratedRail },
    setup() {
        const route = useRoute();
        const { updateSeo } = useSeo();
        const loading = ref(true);
        const meta = ref<any>(null);
        const similarItems = ref<CuratedItem[]>([]);

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

        const toCurated = (item: NetmirrorBrowseItem): CuratedItem => {
            const p = parseNetmirrorTitle(item.title || '');
            return {
                id: item.id,
                title: p.displayTitle || item.title,
                originalTitle: p.languages.join(' · '),
                posterPath: item.backdrop_path,
                rating: netmirrorRating(item.vote_average),
                releaseDate: item.release_date || '',
                type: item.media_type === 'tv' ? 'tv' : 'movie',
                languageTags: p.languages
            };
        };

        const loadDetail = async () => {
            loading.value = true;
            similarItems.value = [];
            try {
                const id = String(route.params.id || '');
                meta.value = await fetchNetmirrorMeta(mediaType.value, id);

                const { language } = getNetflixLanguage();
                const lang = getLanguageOption(language.value);
                const browse = await browseNetmirror(lang.category, 0);
                similarItems.value = (browse.results || [])
                    .filter((item) => item.id !== id && itemMatchesLanguage(item, lang))
                    .slice(0, 14)
                    .map(toCurated);

                updateSeo({
                    title: `${displayTitle.value} — Netflix on Moovie`,
                    canonical: `https://moovie.fun/nf/${mediaType.value}/${id}`,
                    image: meta.value?.backdrop_path || 'https://moovie.fun/og-image.png'
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
            similarItems
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