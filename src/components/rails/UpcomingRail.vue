<template>
    <LmRail
        :title="title"
        :eyebrow="eyebrow"
        :description="description"
        :more-to="moreTo"
        density="keyart"
    >
        <KeyartTile
            v-for="item in displayItems"
            :key="item.isMock ? `mock-up-${item.id}` : `up-${item.type ?? defaultType}-${item.id}`"
            :id="item.id"
            :type="item.type ?? defaultType"
            :title="item.title"
            :backdrop-path="item.backdropPath"
            :poster-path="item.posterPath"
            :rating="item.rating ?? 0"
            :release-date="item.releaseDate ?? ''"
            :eyebrow="item.isMock ? '' : (item.tag ?? airLabel(item))"
            :loading="item.isMock"
        />
    </LmRail>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue';
import LmRail from './Rail.vue';
import KeyartTile from '../cards/KeyartTile.vue';

export interface UpcomingItem {
    id: number | string;
    title: string;
    backdropPath: string | null;
    posterPath?: string | null;
    rating?: number;
    releaseDate?: string;
    tag?: string;
    type?: 'movie' | 'tv';
    isMock?: boolean;
}

export default defineComponent({
    name: 'UpcomingRail',
    components: { LmRail, KeyartTile },
    props: {
        items: { type: Array as PropType<UpcomingItem[]>, required: true },
        title: { type: String, default: 'Airing this week' },
        eyebrow: { type: String, default: 'On the schedule' },
        description: { type: String, default: '' },
        moreTo: { type: [String, Object], default: null },
        defaultType: { type: String as PropType<'movie' | 'tv'>, default: 'tv' }
    },
    setup(props) {
        const airLabel = (item: UpcomingItem) => {
            if (!item.releaseDate) return '';
            const d = new Date(item.releaseDate);
            const now = new Date();
            const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
            if (diffDays <= 0) return 'Airing now';
            if (diffDays === 1) return 'Airs tomorrow';
            if (diffDays < 7) return `Airs in ${diffDays} days`;
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        };

        const displayItems = computed(() => {
            if (props.items.length > 0) return props.items;
            return Array.from({ length: 6 }, (_, i) => ({
                id: i,
                title: '',
                backdropPath: null,
                posterPath: null,
                rating: 0,
                releaseDate: '',
                tag: '',
                type: 'tv' as const,
                isMock: true
            })) as UpcomingItem[];
        });

        return { airLabel, displayItems };
    }
});
</script>
