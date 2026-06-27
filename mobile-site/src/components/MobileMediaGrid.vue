<template>
    <div class="m-grid" :class="{ 'm-grid--compact': compact, 'm-grid--dense': dense }">
        <MobilePosterCard
            v-for="item in displayItems"
            :key="item.isMock ? `mock-m-${item.id}` : `m-${item.type}-${item.id}`"
            :id="item.id"
            :type="item.type"
            :title="item.title"
            :poster-path="item.posterPath"
            :rating="item.rating ?? 0"
            :release-date="item.releaseDate ?? ''"
            :genre-ids="item.genreIds ?? []"
            :adult="item.adult ?? false"
            :loading="item.isMock"
            :size="size"
        />
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import MobilePosterCard from './MobilePosterCard.vue';

export interface MobileGridItem {
    id: number | string;
    type: 'movie' | 'tv' | 'anime';
    title: string;
    posterPath?: string | null;
    rating?: number;
    releaseDate?: string;
    genreIds?: number[];
    adult?: boolean;
    isMock?: boolean;
}

const props = defineProps<{
    items: MobileGridItem[];
    compact?: boolean;
    dense?: boolean;
    size?: 'sm' | 'md' | 'lg';
}>();

const displayItems = computed(() => {
    if (props.items.length > 0) return props.items;
    return Array.from({ length: 12 }, (_, i) => ({
        id: i,
        type: 'movie' as const,
        title: '',
        posterPath: null,
        rating: 0,
        releaseDate: '',
        genreIds: [],
        adult: false,
        isMock: true
    })) as MobileGridItem[];
});
</script>

<style lang="scss" scoped>
.m-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s-3) var(--s-3);
    padding: 0 var(--s-4);

    &--compact {
        gap: var(--s-2);
    }

    @media (min-width: 480px) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    &--dense {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--s-2);
    }
}
</style>
