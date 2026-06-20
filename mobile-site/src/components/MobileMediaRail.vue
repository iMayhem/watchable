<template>
    <div class="m-rail" :class="{ 'm-rail--compact': compact }">
        <MobilePosterCard
            v-for="item in displayItems"
            :key="item.isMock ? `mock-r-${item.id}` : `r-${item.type}-${item.id}`"
            :id="item.id"
            :type="item.type"
            :title="item.title"
            :poster-path="item.posterPath"
            :rating="item.rating ?? 0"
            :release-date="item.releaseDate ?? ''"
            :genre-ids="item.genreIds ?? []"
            :adult="item.adult ?? false"
            :size="cardSize"
            :loading="item.isMock"
        />
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import MobilePosterCard from './MobilePosterCard.vue';
import type { MobileGridItem } from './MobileMediaGrid.vue';

const props = defineProps<{
    items: MobileGridItem[];
    compact?: boolean;
    cardSize?: 'sm' | 'md' | 'lg';
}>();

const displayItems = computed(() => {
    if (props.items.length > 0) return props.items;
    return Array.from({ length: 8 }, (_, i) => ({
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
.m-rail {
    display: flex;
    gap: var(--s-3);
    overflow-x: auto;
    overflow-y: hidden;
    scroll-behavior: smooth;
    scroll-snap-type: x mandatory;
    padding-inline: var(--s-4);
    padding-bottom: var(--s-2);
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
        display: none;
    }

    :deep(.m-poster-card) {
        flex: 0 0 38%;
        max-width: 148px;
        scroll-snap-align: start;
    }

    &--compact {
        gap: var(--s-2);

        :deep(.m-poster-card) {
            flex-basis: 34%;
            max-width: 132px;
        }
    }

    @media (min-width: 480px) {
        :deep(.m-poster-card) {
            flex-basis: 28%;
            max-width: 160px;
        }
    }
}
</style>