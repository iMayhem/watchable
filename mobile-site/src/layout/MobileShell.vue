<template>
    <div class="m-app" :class="{ 'm-app--immersive': immersive }">
        <header class="m-app__header">
            <router-link :to="home" class="m-app__logo" aria-label="moovie home">
                <span class="m-app__mark">moovie</span>
            </router-link>

            <div
                class="m-app__header-actions"
                :class="{ 'is-compact': isCompact }"
                @touchstart="onTouchStart"
                @touchmove="onTouchMove"
                @touchend="onTouchEnd"
                @click="expandActions"
            >
                <button
                    v-if="!supportBtnHidden"
                    type="button"
                    class="m-app__support-btn"
                    @click="isDonationOpen = true"
                >
                    Support
                </button>
                <!-- Discord Link -->
                <a
                    href="https://discord.gg/BmRu5pXHC"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="m-app__icon-btn m-app__discord-btn"
                    aria-label="Join Discord"
                    title="Join Discord"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
                    </svg>
                </a>
                <NotificationBell :compact="isCompact" />
                <router-link :to="search" class="m-app__icon-btn" aria-label="Search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                    </svg>
                </router-link>
                <div ref="moreMenuRef" class="m-app__more-wrap">
                    <button
                        type="button"
                        class="m-app__icon-btn m-app__more-btn"
                        aria-label="More options"
                        @click="moreOpen = !moreOpen"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
                            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                            <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
                        </svg>
                    </button>
                    <div v-if="moreOpen" class="m-app__more-dropdown">
                        <router-link :to="watchlist" class="m-app__more-item" @click="moreOpen = false">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                                <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                            </svg>
                            Watchlist
                        </router-link>
                        <button type="button" class="m-app__more-item" @click="isSettingsOpen = true; moreOpen = false">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M2 12h20" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            Region
                        </button>
                        <button
                            v-if="currentUser"
                            type="button"
                            class="m-app__more-item"
                            @click="handleLogout; moreOpen = false"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            {{ currentUser }} (Sign out)
                        </button>
                        <button
                            v-else
                            type="button"
                            class="m-app__more-item"
                            @click="isAuthOpen = true; moreOpen = false"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            Sign In
                        </button>
                    </div>
                </div>
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
                    <span class="m-app__mode-label">
                        {{ mode.label }}
                        <span v-if="mode.label === 'Discover'" class="m-app__new-badge">NEW</span>
                    </span>
                </router-link>
            </div>
        </nav>

        <main id="main" class="m-app__main">
            <slot />
        </main>

        <AuthModal :is-open="isAuthOpen" @close="closeAuth" />
        <SettingsModal :is-open="isSettingsOpen" @close="isSettingsOpen = false" />
        <DonationModal :is-open="isDonationOpen" @close="isDonationOpen = false" />
    </div>
</template>

<script lang="ts" setup>
import { computed, defineComponent, h, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAppPaths } from '@/composables/useAppPaths';
import AuthModal from '@/components/navigation/AuthModal.vue';
import SettingsModal from '@/components/navigation/SettingsModal.vue';
import DonationModal from '@/components/navigation/DonationModal.vue';
import NotificationBell from '../components/navigation/NotificationBell.vue';
import { getSupabaseClient } from '@/lib/supabase';

withDefaults(defineProps<{
    immersive?: boolean;
}>(), {
    immersive: false
});

const {
    home, movies, tvShows, animeList, more, search, watchlist
} = useAppPaths();
const route = useRoute();

const isAuthOpen = ref(false);
const isSettingsOpen = ref(false);
const isDonationOpen = ref(false);
const supportBtnHidden = ref(localStorage.getItem('moovie_support_btn_hidden') === 'true');
const currentUser = ref('');

const moreOpen = ref(false);
const moreMenuRef = ref<HTMLElement | null>(null);

function onDocumentClick(e: MouseEvent) {
    if (moreMenuRef.value && !moreMenuRef.value.contains(e.target as Node)) {
        moreOpen.value = false;
    }
}

// ── Swipe-to-compact header actions ─────────────────────────────────────────
const isCompact = ref(false);
let touchStartX = 0;
let compactTimer: ReturnType<typeof setTimeout> | null = null;

function onTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
}

function onTouchMove(e: TouchEvent) {
    if (isCompact.value) return;
    const deltaX = e.touches[0].clientX - touchStartX;
    if (deltaX > 30) {
        isCompact.value = true;
    }
}

function onTouchEnd() {
    if (isCompact.value) {
        compactTimer = setTimeout(() => {
            isCompact.value = false;
        }, 2500);
    }
}

function expandActions() {
    if (compactTimer) clearTimeout(compactTimer);
    isCompact.value = false;
}

const iconHome = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('path', { d: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z', 'stroke-linejoin': 'round' })
    ])
});

const iconDiscover = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('circle', { cx: '12', cy: '12', r: '9' }),
        h('path', { d: 'M16 8l-3 5-5 3 3-5z' })
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

const iconMore = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('circle', { cx: '12', cy: '5', r: '1', fill: 'currentColor', stroke: 'none' }),
        h('circle', { cx: '12', cy: '12', r: '1', fill: 'currentColor', stroke: 'none' }),
        h('circle', { cx: '12', cy: '19', r: '1', fill: 'currentColor', stroke: 'none' })
    ])
});

const modes = computed(() => [
    { to: home.value, label: 'Home', icon: iconHome, match: (p: string) => p === '/' },
    { to: '/discover', label: 'Discover', icon: iconDiscover, match: (p: string) => p.startsWith('/discover') },
    { to: movies.value, label: 'Movies', icon: iconMovies, match: (p: string) => p.startsWith('/movies') || p.startsWith('/movie/') },
    { to: tvShows.value, label: 'TV', icon: iconTv, match: (p: string) => p === '/tv-shows' || p === '/tv' || p.startsWith('/tv-show/') || (p.startsWith('/tv/') && !p.startsWith('/tv-shows')) },
    { to: animeList.value, label: 'Anime', icon: iconAnime, match: (p: string) => p.startsWith('/anime') },
    { to: more.value, label: 'More', icon: iconMore, match: (p: string) =>
        p.startsWith('/more')
        || p.startsWith('/actors')
        || p.startsWith('/actor/')
        || p.startsWith('/discuss')
        || p.startsWith('/upcoming')
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
    document.addEventListener('click', onDocumentClick);
    if (!localStorage.getItem('moovie_donation_seen')) {
        getSupabaseClient().then(client => {
            client.from('app_settings').select('value').eq('key', 'donation_popup_enabled').single().then((res: any) => {
                if (res?.data?.value !== 'false') {
                    isDonationOpen.value = true;
                }
            }).catch(() => {
                isDonationOpen.value = true;
            });
        }).catch(() => {
            isDonationOpen.value = true;
        });
        localStorage.setItem('moovie_donation_seen', '1');
    }

    getSupabaseClient().then(client => {
        client.from('app_settings').select('value').eq('key', 'support_btn_hidden').single().then((res: any) => {
            supportBtnHidden.value = res?.data?.value === 'true';
            localStorage.setItem('moovie_support_btn_hidden', String(supportBtnHidden.value));
        }).catch(() => {});
    }).catch(() => {});
});

onBeforeUnmount(() => {
    window.removeEventListener('movora_auth_change', onAuthChange);
    document.removeEventListener('click', onDocumentClick);
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
        transition: gap 0.25s ease;
    }

    &__header-actions.is-compact {
        gap: 2px;
    }

    &__header-actions.is-compact &__icon-btn {
        width: 2.25rem;
        height: 2.25rem;
    }

    &__header-actions.is-compact &__more-dropdown {
        right: -1rem;
    }

    &__header-actions.is-compact &__user-btn,
    &__header-actions.is-compact &__signin-btn,
    &__header-actions.is-compact &__support-btn {
        padding: 0 var(--s-2);
        min-height: 2.25rem;
        font-size: 0.65rem;
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

    &__discord-btn {
        color: var(--bone-200);

        svg {
            fill: currentColor;
        }

        &:active {
            color: #5865F2;
            background: rgba(88, 101, 242, 0.1);
            border-color: rgba(88, 101, 242, 0.3);
        }
    }

    &__support-btn {
        min-height: 2.75rem;
        padding: 0 var(--s-3);
        border-radius: var(--r-pill);
        border: 1px solid var(--ember);
        background: rgba(255, 90, 31, 0.1);
        color: var(--ember);
        font-family: var(--font-ui);
        font-size: 0.7rem;
        font-weight: 700;
        cursor: pointer;
        transition: background var(--dur-fast), border-color var(--dur-fast);
    }

    &__support-btn:hover {
        background: rgba(255, 90, 31, 0.18);
        border-color: var(--ember-600);
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

    &__new-badge {
        background: var(--ember);
        color: var(--ink-950);
        font-size: 0.5rem;
        font-weight: 900;
        padding: 0.05rem 0.2rem;
        border-radius: 2px;
        margin-left: 0.15rem;
        letter-spacing: 0;
        display: inline-block;
        line-height: 1;
        vertical-align: top;
        transform: translateY(-1px);
        text-transform: none;
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

    &__more-wrap {
        position: relative;
    }

    &__more-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 60;
        min-width: 160px;
        background: var(--ink-800);
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-lg);
        box-shadow: var(--shadow-lg);
        padding: var(--s-1);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    &__more-item {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        padding: var(--s-2) var(--s-3);
        background: none;
        border: none;
        border-radius: var(--r-md);
        color: var(--bone-200);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
        transition: background var(--dur-fast), color var(--dur-fast);

        svg {
            width: 16px;
            height: 16px;
            flex-shrink: 0;
        }
    }

    &__more-item:hover {
        background: var(--surface-tint);
        color: var(--bone-50);
    }
}
</style>