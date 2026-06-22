<template>
    <div class="party-shell">
        <SiteHeader />

        <iframe
            :key="frameSrc"
            class="party-shell__frame"
            :src="frameSrc"
            title="Watch Together"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        />
    </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import { useSeo } from '../composables/useSeo';

const route = useRoute();
const router = useRouter();
const { updateSeo } = useSeo();

const frameSrc = computed(() => {
    const params = new URLSearchParams();
    params.set('embedded', '1');

    Object.entries(route.query).forEach(([key, value]) => {
        if (value == null || key === 'embedded') return;
        if (Array.isArray(value)) {
            value.forEach((entry) => params.append(key, String(entry)));
            return;
        }
        params.set(key, String(value));
    });

    return `/party/app.html?${params.toString()}`;
});

function onPartyMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.type !== 'watchable-party-nav') return;

    const next = typeof data.path === 'string' ? data.path : '';
    if (!next.startsWith('/party')) return;

    if (next === route.fullPath) return;

    router.replace(next);
}

onMounted(() => {
    updateSeo({
        title: 'Watch Together — Moovie',
        canonical: `https://moovie.fun/party`
    });
    window.addEventListener('message', onPartyMessage);
});

onBeforeUnmount(() => {
    window.removeEventListener('message', onPartyMessage);
});
</script>

<style lang="scss" scoped>
.party-shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: var(--ink-900);
    overflow: hidden;
}

.party-shell__frame {
    flex: 1 1 auto;
    width: 100%;
    border: 0;
    height: calc(100dvh - var(--site-header-height));
    min-height: calc(100dvh - var(--site-header-height));
    background: #0b0a08;
}
</style>