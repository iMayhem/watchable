<template>
    <div class="party-shell">
        <iframe
            class="party-shell__frame"
            :class="{ 'is-loaded': frameReady }"
            :src="frameSrc"
            title="Watch Together"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            @load="frameReady = true"
        />
    </div>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { LocationQuery } from 'vue-router';
import { useSeo } from '../composables/useSeo';

const route = useRoute();
const router = useRouter();
const { updateSeo } = useSeo();

const frameSrc = ref(buildFrameSrc(route.query));
const frameReady = ref(false);
let syncingFromIframe = false;

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

    return `/party/app.html?${params.toString()}`;
}

function partyPathsEqual(a: string, b: string): boolean {
    const normalize = (path: string) => {
        const url = new URL(path, 'https://moovie.fun');
        let pathname = url.pathname.replace(/\/+$/, '');
        if (!pathname) pathname = '/';
        return `${pathname}${url.search}`;
    };

    return normalize(a) === normalize(b);
}

function onPartyMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'watchable-site-nav') {
        const next = typeof data.path === 'string' ? data.path : '/';
        if (!next.startsWith('/') || next.startsWith('//')) return;
        if (partyPathsEqual(next, route.fullPath)) return;
        void router.push(next);
        return;
    }

    if (data.type !== 'watchable-party-nav') return;

    const next = typeof data.path === 'string' ? data.path : '';
    if (!next.startsWith('/party')) return;

    if (partyPathsEqual(next, route.fullPath)) return;

    syncingFromIframe = true;
    void router.replace(next).finally(() => {
        void nextTick(() => {
            syncingFromIframe = false;
        });
    });
}

watch(
    () => route.query,
    (query) => {
        if (syncingFromIframe) return;
        const nextSrc = buildFrameSrc(query);
        if (nextSrc === frameSrc.value) return;
        frameReady.value = false;
        frameSrc.value = nextSrc;
    },
    { deep: true }
);

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
    height: 100dvh;
    min-height: 100dvh;
    background: #0b0a08;
    opacity: 0;
    transition: opacity 0.2s var(--ease-out, ease-out);
}

.party-shell__frame.is-loaded {
    opacity: 1;
}
</style>