<template>
    <div class="app-stage">
        <a class="app-skip" href="#main">Skip to content</a>

        <span class="grain" aria-hidden="true" />

        <router-view v-slot="{ Component, route }">
            <Transition name="page" mode="out-in">
                <component :is="Component" :key="route.path" />
            </Transition>
        </router-view>

        <CommandPalette />
        <MiniPlayer />
        <Toast />
    </div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount } from 'vue';
import Toast from '@/components/feedback/Toast.vue';
import CommandPalette from '@/components/navigation/CommandPalette.vue';
import MiniPlayer from '@/components/player/MiniPlayer.vue';
import { bindCommandPaletteHotkey } from '@/composables/useCommandPalette';
import { startReveal, stopReveal } from '@/composables/useReveal';
import { installAntiInspect, uninstallAntiInspect } from '@/composables/useAntiInspect';

onMounted(() => {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            bindCommandPaletteHotkey();
            startReveal();
            installAntiInspect();
            
            // Prefetch main mobile pages asynchronously in the background
            import('./pages/Movies.vue');
            import('./pages/TVShows.vue');
            import('./pages/Anime.vue');
            import('./pages/Search.vue');
            import('./pages/Watchlist.vue');
        });
    } else {
        setTimeout(() => {
            bindCommandPaletteHotkey();
            startReveal();
            installAntiInspect();
            
            import('./pages/Movies.vue');
            import('./pages/TVShows.vue');
            import('./pages/Anime.vue');
            import('./pages/Search.vue');
            import('./pages/Watchlist.vue');
        }, 100);
    }
});

onBeforeUnmount(() => {
    stopReveal();
    uninstallAntiInspect();
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

html, body {
    -webkit-user-select: text;
    -moz-user-select: text;
    -ms-user-select: text;
    user-select: text;
}

input, textarea, [contenteditable="true"] {
    -webkit-user-select: text;
    -moz-user-select: text;
    -ms-user-select: text;
    user-select: text;
}

img {
    -webkit-user-drag: none;
    user-drag: none;
    -webkit-touch-callout: none;
}

body.lm-locked {
    overflow: hidden;

    .app-stage {
        filter: blur(14px) saturate(0.6);
        pointer-events: none;
        user-select: none;
    }
}
</style>
