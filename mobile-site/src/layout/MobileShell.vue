<template>
    <div class="m-app" :class="{ 'm-app--immersive': immersive }">
        <header class="m-app__header">
            <router-link :to="home" class="m-app__logo" aria-label="moovie home">
                <span class="m-app__mark">moovie</span>
            </router-link>

            <div class="m-app__header-actions">
                <router-link :to="livestream" class="m-app__live-blink-btn" aria-label="Livestream">
                    <span class="m-app__live-blink-dot"></span>
                    <span class="m-app__live-blink-label">LIVE</span>
                </router-link>
                <router-link :to="search" class="m-app__icon-btn" aria-label="Search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                    </svg>
                </router-link>
                <router-link :to="watchlist" class="m-app__icon-btn" aria-label="Watchlist">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                </router-link>
                <button
                    type="button"
                    class="m-app__icon-btn"
                    aria-label="Regional settings"
                    title="Regional settings"
                    @click="isSettingsOpen = true"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                </button>
                <button
                    v-if="currentUser"
                    type="button"
                    class="m-app__user-btn"
                    title="Sign out"
                    @click="handleLogout"
                >
                    <span class="m-app__user-label">{{ currentUser }}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </button>
                <button
                    v-else
                    type="button"
                    class="m-app__signin-btn"
                    @click="isAuthOpen = true"
                >
                    Sign In
                </button>
            </div>
        </header>

        <nav
            v-if="!immersive"
            class="m-app__modes"
            aria-label="Browse modes"
        >
            <div class="m-app__modes-scroll">
                <router-link
                    v-for="mode in modes"
                    :key="mode.to"
                    :to="mode.to"
                    class="m-app__mode"
                    :class="{ 'is-active': isModeActive(mode) }"
                >
                    <span class="m-app__mode-icon" aria-hidden="true">
                        <component :is="mode.icon" />
                    </span>
                    <span class="m-app__mode-label">{{ mode.label }}</span>
                </router-link>
            </div>
        </nav>

        <main id="main" class="m-app__main">
            <slot />
        </main>

        <AuthModal :is-open="isAuthOpen" @close="closeAuth" />
        <SettingsModal :is-open="isSettingsOpen" @close="isSettingsOpen = false" />
    </div>
</template>

<script lang="ts" setup>
import { computed, defineComponent, h, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAppPaths } from '@/composables/useAppPaths';
import AuthModal from '@/components/navigation/AuthModal.vue';
import SettingsModal from '@/components/navigation/SettingsModal.vue';

withDefaults(defineProps<{
    immersive?: boolean;
}>(), {
    immersive: false
});

const {
    home, movies, tvShows, animeList, liveTv, more, search, watchlist, livestream
} = useAppPaths();
const route = useRoute();

const isAuthOpen = ref(false);
const isSettingsOpen = ref(false);
const currentUser = ref('');

const iconHome = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('path', { d: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z', 'stroke-linejoin': 'round' })
    ])
});

const iconMovies = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('rect', { x: '3', y: '5', width: '18', height: '14', rx: '2' }),
        h('path', { d: 'M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4' })
    ])
});

const iconTv = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('rect', { x: '3', y: '6', width: '18', height: '13', rx: '2' }),
        h('path', { d: 'M8 3h8' })
    ])
});

const iconAnime = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('path', { d: 'M12 3 4 7v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V7z' }),
        h('circle', { cx: '9', cy: '11', r: '1', fill: 'currentColor', stroke: 'none' }),
        h('circle', { cx: '15', cy: '11', r: '1', fill: 'currentColor', stroke: 'none' })
    ])
});

const iconLive = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('circle', { cx: '12', cy: '12', r: '2', fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M16.24 7.76a6 6 0 0 1 0 8.49M7.76 7.76a6 6 0 0 0 0 8.49' }),
        h('path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14' })
    ])
});

const iconMore = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('circle', { cx: '12', cy: '5', r: '1', fill: 'currentColor', stroke: 'none' }),
        h('circle', { cx: '12', cy: '12', r: '1', fill: 'currentColor', stroke: 'none' }),
        h('circle', { cx: '12', cy: '19', r: '1', fill: 'currentColor', stroke: 'none' })
    ])
});

const modes = computed(() => [
    { to: home.value, label: 'Home', icon: iconHome, match: (p: string) => p === '/' },
    { to: movies.value, label: 'Movies', icon: iconMovies, match: (p: string) => p.startsWith('/movies') || p.startsWith('/movie/') },
    { to: tvShows.value, label: 'TV', icon: iconTv, match: (p: string) => p === '/tv-shows' || p === '/tv' || p.startsWith('/tv-show/') || (p.startsWith('/tv/') && !p.startsWith('/tv-shows')) },
    { to: animeList.value, label: 'Anime', icon: iconAnime, match: (p: string) => p.startsWith('/anime') },
    { to: liveTv.value, label: 'Live TV', icon: iconLive, match: (p: string) => p.startsWith('/livetv') },
    { to: more.value, label: 'More', icon: iconMore, match: (p: string) =>
        p.startsWith('/more')
        || p.startsWith('/actors')
        || p.startsWith('/actor/')
        || p.startsWith('/discuss')
        || p.startsWith('/upcoming')
        || p.startsWith('/help')
        || p.startsWith('/party')
    }
]);

function isModeActive(mode: { match: (p: string) => boolean }) {
    return mode.match(route.path);
}

function syncUser() {
    currentUser.value = localStorage.getItem('movora_current_user') || '';
}

function handleLogout() {
    localStorage.removeItem('movora_current_user');
    localStorage.removeItem('movora_auth_token');
    window.dispatchEvent(new Event('movora_auth_change'));
    syncUser();
}

function closeAuth() {
    isAuthOpen.value = false;
    syncUser();
}

function onAuthChange() {
    syncUser();
}

onMounted(() => {
    syncUser();
    window.addEventListener('movora_auth_change', onAuthChange);
});

onBeforeUnmount(() => {
    window.removeEventListener('movora_auth_change', onAuthChange);
});
</script>

<style lang="scss" scoped>
.m-app {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--ink-900);
    color: var(--bone-50);
    padding-bottom: env(safe-area-inset-bottom, 0px);

    &--immersive {
        padding-bottom: 0;
    }

    &__header {
        position: sticky;
        top: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
        padding: max(env(safe-area-inset-top, 0px), var(--s-2)) var(--s-3) var(--s-2);
        background: rgba(11, 10, 8, 0.94);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--rule);
    }

    &__logo {
        color: inherit;
        text-decoration: none;
        flex-shrink: 0;
    }

    &__mark {
        font-family: var(--font-display);
        font-size: 1.25rem;
        font-weight: 500;
        letter-spacing: var(--ls-tight);
        color: var(--bone-50);
    }

    &__header-actions {
        display: flex;
        align-items: center;
        gap: var(--s-1);
        flex-shrink: 0;
    }

    &__icon-btn {
        display: grid;
        place-items: center;
        width: 2.75rem;
        height: 2.75rem;
        border-radius: var(--r-pill);
        color: var(--bone-200);
        background: var(--ink-800);
        border: 1px solid var(--rule);

        svg {
            width: 1.05rem;
            height: 1.05rem;
        }
    }

    &__live-blink-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 1.7rem;
        padding: 0 0.55rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 69, 58, 0.35);
        background: rgba(255, 69, 58, 0.08);
        text-decoration: none;
        outline: none;
        margin-right: 0.25rem;
        -webkit-tap-highlight-color: transparent;
        transition: background 0.2s ease, border-color 0.2s ease;

        &:active {
            background: rgba(255, 69, 58, 0.18);
            border-color: rgba(255, 69, 58, 0.55);
        }
    }

    &__live-blink-dot {
        flex-shrink: 0;
        width: 5px;
        height: 5px;
        background-color: #ff453a;
        border-radius: 50%;
        box-shadow: 0 0 0 0 rgba(255, 69, 58, 0.4);
        animation: pulse-live 1.6s infinite;
    }

    &__live-blink-label {
        font-family: var(--font-ui);
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: #ff6b63;
        line-height: 1;
    }

    &__signin-btn {
        min-height: 2.75rem;
        padding: 0 var(--s-3);
        border-radius: var(--r-pill);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-100);
        font-family: var(--font-ui);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.03em;
        text-transform: uppercase;
    }

    &__user-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        max-width: 7.5rem;
        min-height: 2.75rem;
        padding: 0 var(--s-3);
        border-radius: var(--r-pill);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-100);
        font-family: var(--font-ui);
        font-size: 0.72rem;
        font-weight: 600;

        svg {
            width: 0.9rem;
            height: 0.9rem;
            flex-shrink: 0;
        }
    }

    &__user-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__modes {
        position: sticky;
        top: calc(max(env(safe-area-inset-top, 0px), var(--s-2)) + 2.85rem);
        z-index: 45;
        background: rgba(11, 10, 8, 0.9);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--rule);
    }

    &__modes-scroll {
        display: flex;
        gap: var(--s-2);
        overflow-x: auto;
        padding: var(--s-2) var(--s-3);
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }
    }

    &__mode {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        flex-shrink: 0;
        min-height: 2.5rem;
        padding: 0 var(--s-3);
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);
        background: var(--ink-850);
        color: var(--bone-300);
        text-decoration: none;
        font-family: var(--font-ui);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        transition:
            color var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out),
            background var(--dur-fast) var(--ease-out);

        &.is-active {
            color: var(--bone-50);
            border-color: var(--ember);
            background: rgba(232, 122, 58, 0.12);
            box-shadow: 0 0 0 1px rgba(232, 122, 58, 0.15);
        }
    }

    &__mode-icon {
        display: grid;
        place-items: center;
        width: 0.95rem;
        height: 0.95rem;

        svg {
            width: 100%;
            height: 100%;
        }
    }

    &__main {
        flex: 1;
        width: 100%;
        min-width: 0;
    }
}

@keyframes pulse-live {
    0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(255, 69, 58, 0.4);
    }
    70% {
        transform: scale(1);
        box-shadow: 0 0 0 5px rgba(255, 69, 58, 0);
    }
    100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(255, 69, 58, 0);
    }
}
</style>