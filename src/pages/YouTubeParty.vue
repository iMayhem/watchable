<template>
    <div class="yt-party-shell">
        <iframe
            class="yt-party-shell__frame"
            :class="{ 'is-loaded': frameReady }"
            :src="frameSrc"
            title="YouTube Watch Party"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            @load="frameReady = true"
        />
    </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { LocationQuery } from 'vue-router';
import { useSeo } from '../composables/useSeo';

const route = useRoute();
const router = useRouter();
const { updateSeo } = useSeo();

const frameSrc = ref(buildFrameSrc(route.query));
const frameReady = ref(false);

function buildFrameSrc(query: LocationQuery): string {
    const params = new URLSearchParams();
    params.set('embedded', '1');
    Object.entries(query).forEach(([key, value]) => {
        if (value == null || key === 'embedded') return;
        if (Array.isArray(value)) {
            value.forEach((entry) => params.append(key, String(entry)));
            return;
        }
        params.set(key, String(value));
    });
    return `/youtube-party/app.html?${params.toString()}`;
}

function onPartyMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'watchable-site-nav') {
        const next = typeof data.path === 'string' ? data.path : '/';
        if (!next.startsWith('/') || next.startsWith('//')) return;
        if (next === route.fullPath) return;
        void router.push(next);
    }
}

watch(
    () => route.query,
    (query) => {
        const nextSrc = buildFrameSrc(query);
        if (nextSrc === frameSrc.value) return;
        frameReady.value = false;
        frameSrc.value = nextSrc;
    },
    { deep: true }
);

onMounted(() => {
    updateSeo({
        title: 'YouTube Watch Party — Moovie',
        canonical: 'https://moovie.fun/youtube-party'
    });
    window.addEventListener('message', onPartyMessage);
});

onBeforeUnmount(() => {
    window.removeEventListener('message', onPartyMessage);
});
</script>

<style scoped>
.yt-party-shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: var(--ink-900);
    overflow: hidden;
}
.yt-party-shell__frame {
    flex: 1 1 auto;
    width: 100%;
    border: 0;
    height: 100dvh;
    min-height: 100dvh;
    background: #0b0a08;
    opacity: 0;
    transition: opacity 0.2s var(--ease-out, ease-out);
}
.yt-party-shell__frame.is-loaded {
    opacity: 1;
}
</style>
