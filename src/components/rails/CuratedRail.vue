<template>
    <LmRail
        :title="title"
        :eyebrow="eyebrow"
        :description="description"
        :more-to="moreTo"
        density="poster"
    >
        <PosterCard
            v-for="(item, index) in displayItems"
            :key="item.isMock ? `mock-curated-${item.id}` : `curated-${catalog}-${item.type ?? defaultType}-${item.id}`"
            :id="item.id"
            :type="item.type ?? defaultType"
            :title="item.title"
            :original-title="item.originalTitle"
            :poster-path="item.posterPath"
            :backdrop-path="item.backdropPath"
            :rating="item.rating"
            :release-date="item.releaseDate"
            :genre-ids="item.genreIds ?? []"
            :adult="item.adult ?? false"
            :loading="item.isMock || loading"
            :priority-load="!loading && !item.isMock && index < 8"
            :query="item.query || {}"
            :catalog="catalog"
            :language-tags="item.languageTags || []"
            :catalog-title="item.catalogTitle || ''"
            :anilist-id="item.anilistId || 0"
            :moovie-catalog-id="item.moovieCatalogId || ''"
        />
    </LmRail>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue';
import LmRail from './Rail.vue';
import PosterCard from '../cards/PosterCard.vue';

export interface CuratedItem {
    id: number | string;
    title: string;
    originalTitle?: string;
    posterPath: string | null;
    rating?: number;
    releaseDate?: string;
    genreIds?: number[];
    adult?: boolean;
    type?: 'movie' | 'tv';
    isMock?: boolean;
    query?: Record<string, any>;
    languageTags?: string[];
    backdropPath?: string | null;
    catalogTitle?: string;
    anilistId?: number;
    moovieCatalogId?: string;
    tmdbId?: number;
}

export default defineComponent({
    name: 'CuratedRail',
    components: { LmRail, PosterCard },
    props: {
        items: { type: Array as PropType<CuratedItem[]>, required: true },
        title: { type: String, required: true },
        eyebrow: { type: String, default: '' },
        description: { type: String, default: '' },
        moreTo: { type: [String, Object], default: null },
        defaultType: { type: String as PropType<'movie' | 'tv'>, default: 'movie' },
        catalog: { type: String as PropType<'tmdb' | 'netflix'>, default: 'tmdb' },
        loading: { type: Boolean, default: false }
    },
    setup(props) {
        const displayItems = computed(() => {
            if (props.items.length > 0 || props.loading) return props.items;
            return Array.from({ length: 8 }, (_, i) => ({
                id: i,
                title: '',
                posterPath: null,
                rating: 0,
                releaseDate: '',
                genreIds: [],
                adult: false,
                type: 'movie' as const,
                isMock: true
            })) as CuratedItem[];
        });
        return { displayItems };
    }
});
</script>

<style scoped>
/* no local styles — Rail + PosterCard handle presentation */
</style>
