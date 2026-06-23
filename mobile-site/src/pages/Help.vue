<template>
    <MobileShell>
        <div class="m-help-embed">
            <HelpPage />
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import HelpPage from '@/pages/Help.vue';
import { useSeo } from '../composables/useSeo';

const { updateSeo } = useSeo();

onMounted(() => {
    updateSeo({
        title: 'Help — Moovie',
        description: 'How to use Moovie on mobile and desktop.',
        canonical: 'https://m.moovie.fun/help'
    });
});
</script>

<style lang="scss" scoped>
.m-help-embed {
    :deep(.site-header),
    :deep(.site-footer) {
        display: none;
    }

    :deep(.help-page__main) {
        padding-top: 0;
    }

    :deep(.help-page__masthead) {
        padding-top: var(--s-4);
    }

    :deep(.help-page__content) {
        padding-bottom: var(--s-8);
    }

    :deep(.help-grid) {
        grid-template-columns: 1fr;
    }

    :deep(.help-card--wide) {
        grid-column: span 1;
    }

    :deep(.shortcuts-table-wrapper) {
        overflow-x: auto;
    }

    :deep(.btn) {
        min-height: 2.75rem;
        padding: 0.55rem 1rem;
        font-size: 0.875rem;
    }
}
</style>