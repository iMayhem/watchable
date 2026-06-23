<template>
    <router-view v-if="isBareLayout" />

    <div v-else class="app-stage" :class="{ 'app-stage--party-embed': isPartyEmbed }">
        <a v-if="!isPartyEmbed" class="app-skip" href="#main">Skip to content</a>

        <span v-if="!isPartyEmbed" class="grain" aria-hidden="true" />

        <router-view v-if="isContentModeReady || isPartyEmbed" v-slot="{ Component, route }">
            <KeepAlive
                :include="[
                    'HomeShell',
                    'NetflixBrowse',
                    'NetflixSearch',
                    'NetflixCategories',
                    'NetflixExplore',
                    'StreamNetflix'
                ]"
            >
                <component :is="Component" :key="getRouteKey(route)" />
            </KeepAlive>
        </router-view>

        <ContentModeGate v-if="!isPartyEmbed" />

        <CommandPalette v-if="!isPartyEmbed" />

        <Toast v-if="!isPartyEmbed" />

        <OpeningSplash v-if="!isPartyEmbed && !isBareLayout" />
    </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { getSettings, loadGlobalSettings } from './composables/useSettings';
import { getContentMode } from './composables/useContentMode';
import ContentModeGate from './components/navigation/ContentModeGate.vue';
import OpeningSplash from './components/navigation/OpeningSplash.vue';

const route = useRoute();
const isBareLayout = computed(() => Boolean(route.meta.bareLayout));
const isPartyEmbed = computed(
    () => Boolean(route.meta.partyEmbed) || route.query.embed === 'party'
);
const { region } = getSettings();
const { contentMode } = getContentMode();

const isContentModeReady = computed(() => {
    return contentMode.value === 'global' || contentMode.value === 'netflix';
});

// Removed: watch(region) redirect that was causing Home.vue component unmount/remount
// This breaks event listeners during region change. Let each page handle it via movora_settings_change event instead.

const getRouteKey = (route: any) => {
    if (route.name === 'StreamTVShow' && route.params.id) {
        return `tv-stream-${route.params.id}-${region.value}`;
    }
    if ((route.name === 'StreamAnime' || route.name === 'StreamAnimeEpisode') && route.params.id) {
        return `anime-stream-${route.params.id}-${region.value}`;
    }
    // Keep one player instance when switching Netflix audio (catalogue id in path changes).
    if (
        route.name === 'StreamNetflixMovie' ||
        route.name === 'StreamNetflixTV' ||
        route.name === 'EmbedNetflixMovie' ||
        route.name === 'EmbedNetflixTV'
    ) {
        return 'stream-netflix';
    }
    if (route.name === 'NetflixBrowse') {
        const type = route.query.type;
        const typeSuffix =
            type === 'tv' || type === 'movie' ? `-${type}` : '';
        return `nf-browse-${route.params.catalogue}-${route.params.row}${typeSuffix}`;
    }
    if (route.name === 'NetflixCategories') {
        const type = route.query.type;
        const typeSuffix =
            type === 'tv' || type === 'movie' ? `-${type}` : '';
        return `nf-categories${typeSuffix}`;
    }
    if (route.name === 'NetflixExplore') {
        return `nf-explore-${route.params.mediaType || 'all'}-${route.fullPath}`;
    }
    // Stable key: AniList browse links normalize to TMDB ids via router.replace.
    // Path-based keys remount the page and replay the full loading skeleton.
    if (route.name === 'AnimeDetail') {
        return 'anime-detail';
    }
    // Do NOT include region in the key for Home/listing pages.
    // Those pages handle region changes themselves via the movora_settings_change
    // event + their own watch(region) watcher. Including region here would
    // cause Vue to destroy+remount the component, which (a) loses scroll
    // position, and (b) triggers loadData() twice (once from watcher, once
    // from onMounted) creating a race that leaves all carousels in skeleton state.
    return route.path;
};

const Toast = defineAsyncComponent(() => import('./components/feedback/Toast.vue'));
const CommandPalette = defineAsyncComponent(() => import('./components/navigation/CommandPalette.vue'));


// Lazy refs to cleanup functions — populated after dynamic import resolves
let _stopReveal: (() => void) | null = null;
let _uninstallAntiInspect: (() => void) | null = null;
let _uninstallBotProtection: (() => void) | null = null;

const initIdle = async () => {
    const [
        { bindCommandPaletteHotkey },
        { startReveal, stopReveal },
        { installAntiInspect, uninstallAntiInspect },
        { installBotProtection, uninstallBotProtection }
    ] = await Promise.all([
        import('./composables/useCommandPalette'),
        import('./composables/useReveal'),
        import('./composables/useAntiInspect'),
        import('./composables/useBotProtection')
    ]);

    bindCommandPaletteHotkey();
    startReveal();
    installBotProtection();
    installAntiInspect();

    _stopReveal = stopReveal;
    _uninstallAntiInspect = uninstallAntiInspect;
    _uninstallBotProtection = uninstallBotProtection;

    // Prefetch main pages in the background
    import('./pages/Movies.vue');
    import('./pages/TVShows.vue');
    import('./pages/Anime.vue');
    import('./pages/Search.vue');
    import('./pages/Watchlist.vue');
    import('./pages/Upcoming.vue');
    import('./pages/NetflixBrowse.vue');
};

onMounted(() => {
    loadGlobalSettings();
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => initIdle());
    } else {
        setTimeout(() => initIdle(), 100);
    }
});

onBeforeUnmount(() => {
    _stopReveal?.();
    _uninstallBotProtection?.();
    _uninstallAntiInspect?.();
});
</script>

<style lang="scss">
.app-stage {
    position: relative;
    min-height: 100vh;
    min-height: 100dvh;
    isolation: isolate;

    &--party-embed {
        min-height: 0;
        height: 100%;
        overflow: hidden;
        background: #000;
    }
}

html.nf-party-embed,
html.nf-party-embed body,
html.nf-party-embed #app {
    height: 100%;
    min-height: 0;
    margin: 0;
    overflow: hidden;
    background: #000;
}

// ── Skip-to-content link ─────────────────────────────────────────────────────
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

// ── Global page transition ───────────────────────────────────────────────────
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

// ── Global focus-visible ring ────────────────────────────────────────────────
:focus-visible {
    outline: 2px solid var(--ember);
    outline-offset: 2px;
    border-radius: 2px;
}

// Inputs/selects in our pill controls already have focus borders — strip the
// double ring there to keep the editorial look clean.
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
