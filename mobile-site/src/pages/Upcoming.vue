<template>
    <MobileShell>
        <div class="m-upcoming-embed">
            <UpcomingPage />
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import UpcomingPage from '@/pages/Upcoming.vue';
import { useSeo } from '../composables/useSeo';

const { updateSeo } = useSeo();

onMounted(() => {
    updateSeo({
        title: 'Upcoming — Moovie',
        description: 'Upcoming movies and anime releases.',
        canonical: 'https://m.moovie.fun/upcoming'
    });
});
</script>

<style lang="scss" scoped>
.m-upcoming-embed {
    :deep(.site-header),
    :deep(.site-footer) {
        display: none;
    }

    :deep(.upcoming-page__main) {
        padding-top: 0;
    }

    :deep(.upcoming-page__content) {
        padding-inline: var(--s-3);
        padding-bottom: var(--s-8);
    }

    :deep(.upcoming-page__tabs-wrap) {
        padding-top: var(--s-3);
    }

    :deep(.upcoming-spotlight) {
        grid-template-columns: 1fr;
    }

    :deep(.upcoming-page__grid) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--s-3);
    }

    :deep(.upcoming-card__title) {
        font-size: 0.9rem;
    }

    :deep(.btn) {
        min-height: 2.75rem;
        padding: 0.55rem 1rem;
        font-size: 0.875rem;
        border-radius: var(--r-md);
    }

    :deep(.upcoming-card__trailer),
    :deep(.upcoming-spotlight__actions .btn) {
        width: 100%;
    }

    :deep(.lm-tabs__tab) {
        min-height: 2.5rem;
    }
}
</style>