<template>
    <MobileShell>
        <div class="m-status-embed">
            <StatusPage />
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import StatusPage from '@/pages/Status.vue';
import { useSeo } from '../composables/useSeo';

const { updateSeo } = useSeo();

onMounted(() => {
    updateSeo({
        title: 'Status — Moovie',
        description: 'Realtime node failover stats, response rates and quota status for Groq API keys.',
        canonical: 'https://m.moovie.fun/status'
    });
});
</script>

<style lang="scss" scoped>
.m-status-embed {
    :deep(.site-header),
    :deep(.site-footer) {
        display: none;
    }

    :deep(.status-page__main) {
        padding-top: 0;
    }

    :deep(.status-page__masthead) {
        padding-top: var(--s-4);
    }

    :deep(.status-page__content) {
        padding-bottom: var(--s-8);
    }

    :deep(.keys-grid) {
        grid-template-columns: 1fr;
    }
}
</style>
