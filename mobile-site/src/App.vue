<template>
    <div class="app-stage">
        <a class="app-skip" href="#main">Skip to content</a>

        <span class="grain" aria-hidden="true" />

        <router-view v-slot="{ Component, route }">
            <component :is="Component" :key="getRouteKey(route)" />
        </router-view>

        <CommandPalette />
        <Toast />
    </div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

const getRouteKey = (route: RouteLocationNormalizedLoaded) => {
    if (route.name === 'AnimeDetail') {
        return 'anime-detail';
    }
    if (route.name === 'Party') {
        return route.fullPath;
    }
    return route.path;
};

const Toast = defineAsyncComponent(() => import('@/components/feedback/Toast.vue'));
const CommandPalette = defineAsyncComponent(() => import('@/components/navigation/CommandPalette.vue'));

// Lazy refs to cleanup functions — populated after dynamic import resolves
let _stopReveal: (() => void) | null = null;
let _uninstallAntiInspect: (() => void) | null = null;

const initIdle = async () => {
    const [{ bindCommandPaletteHotkey }, { startReveal, stopReveal }, { installAntiInspect, uninstallAntiInspect }] =
        await Promise.all([
            import('@/composables/useCommandPalette'),
            import('@/composables/useReveal'),
            import('@/composables/useAntiInspect')
        ]);

    bindCommandPaletteHotkey();
    startReveal();
    installAntiInspect();

    _stopReveal = stopReveal;
    _uninstallAntiInspect = uninstallAntiInspect;

    // Prefetch main mobile pages in the background
    import('./pages/Movies.vue');
    import('./pages/TVShows.vue');
    import('./pages/Anime.vue');
    import('./pages/Search.vue');
    import('./pages/Watchlist.vue');
};

onMounted(() => {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => initIdle());
    } else {
        setTimeout(() => initIdle(), 100);
    }
});

onBeforeUnmount(() => {
    _stopReveal?.();
    _uninstallAntiInspect?.();
});
</script>

<style lang="scss">
.app-stage {
    position: relative;
    min-height: 100vh;
    min-height: 100dvh;
    isolation: isolate;
}

.app-skip {
    position: fixed;
    top: 0.5rem;
    left: 0.5rem;
    z-index: 10000;
    padding: 0.6rem 1rem;
    background: var(--ember);
    color: var(--ink-900);
    font-family: var(--font-ui);
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: var(--r-pill);
    text-decoration: none;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    transform: translateY(-200%);
    transition: transform var(--dur-base) var(--ease-out);

    &:focus,
    &:focus-visible {
        transform: translateY(0);
        outline: 2px solid var(--bone-50);
        outline-offset: 2px;
    }
}

.page-enter-active,
.page-leave-active {
    transition:
        opacity var(--dur-base) var(--ease-out),
        transform var(--dur-base) var(--ease-out);
}

.page-enter-from {
    opacity: 0;
    transform: translateY(8px);
}

.page-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
    .page-enter-active,
    .page-leave-active {
        transition: opacity var(--dur-fast) linear;
    }
    .page-enter-from,
    .page-leave-to {
        transform: none;
    }
}

:focus-visible {
    outline: 2px solid var(--ember);
    outline-offset: 2px;
    border-radius: 2px;
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible {
    outline: none;
}

img {
    -webkit-user-drag: none;
    user-drag: none;
}


</style>
