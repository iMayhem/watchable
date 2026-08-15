<template>
    <div class="party-shell">
        <iframe
            class="party-shell__frame is-loaded"
            :src="frameSrc"
            title="Watch Together"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
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
let syncingFromIframe = false;

function buildFrameSrc(query: LocationQuery): string {
    const params = new URLSearchParams();
    params.set('embedded', '1');
    params.set('_v', '12');

    Object.entries(query).forEach(([key, value]) => {
        if (value == null || key === 'embedded' || key === 'native') return;
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
        syncingFromIframe = false;
    });
}

watch(
    () => route.query,
    (query) => {
        if (syncingFromIframe) return;
        const nextSrc = buildFrameSrc(query);
        if (nextSrc === frameSrc.value) return;
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
    position: relative;
    display: block;
    width: 100%;
    height: 100dvh;
    min-height: 100dvh;
    background: #000;
    overflow: hidden;
}

.party-shell__frame {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    border: 0;
    background: #000;
    opacity: 1;
}
</style>
