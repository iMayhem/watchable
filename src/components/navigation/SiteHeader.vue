<template>
    <header class="site-header" :class="{ 'is-scrolled': scrolled || onDetailPage }">
        <div class="container-lm site-header__inner">
            <router-link to="/" class="site-header__logo" aria-label="moovie home">
                <div class="site-header__wordmark">
                    <span class="site-header__mark-text">moovie</span>
                </div>
            </router-link>

            <nav class="site-header__nav" aria-label="Primary">
                <template v-for="item in primaryNav" :key="item.path">
                    <router-link
                        v-if="item.label !== 'Others'"
                        :to="item.path"
                        class="site-header__link"
                        :class="{ 'is-active': isActive(item) }"
                        @mouseenter="prefetchPrimaryNav(item)"
                        @focus="prefetchPrimaryNav(item)"
                    >
                        {{ item.label }}
                    </router-link>
                    <div
                        v-else
                        :ref="(el) => { if (el) othersContainer = el as HTMLElement }"
                        class="site-header__others"
                    >
                        <button
                            type="button"
                            class="site-header__link site-header__others-btn"
                            :class="{ 'is-active': isActive(item) }"
                            @click="toggleOthersDropdown"
                        >
                            {{ item.label }}
                            <svg class="site-header__others-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" :class="{ 'is-open': isOthersDropdownOpen }">
                                <path d="M6 9l6 6 6-6"/>
                            </svg>
                        </button>
                        <div v-if="isOthersDropdownOpen" class="others-dropdown">
                            <router-link
                                v-for="sub in othersNav"
                                :key="sub.path"
                                :to="sub.path"
                                class="others-dropdown__item"
                                :class="{ 'is-active': isActive(sub) }"
                                @click="closeOthersDropdown"
                            >
                                {{ sub.label }}
                            </router-link>
                        </div>
                    </div>
                </template>
            </nav>

            <div class="site-header__actions">

                <NotificationBell />

                <button
                    type="button"
                    class="site-header__search"
                    :aria-label="`Open search (${modKey}K)`"
                    :title="`Open search (${modKey}K)`"
                    @click="openPalette"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                    <span class="site-header__search-label">Search</span>
                    <kbd class="site-header__search-kbd">{{ modKey }}K</kbd>
                </button>

                <router-link
                    to="/party"
                    class="site-header__party-btn"
                    :class="{ 'is-active': isPartyRoute }"
                    aria-label="Together"
                    title="Together Lobby"
                    @mouseenter="preloadPartyApp"
                    @focus="preloadPartyApp"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="site-header__party-icon">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span class="site-header__party-label">Together</span>
                </router-link>

                <button v-if="currentUser" class="site-header__user-badge" @click="handleLogout" title="Sign Out">
                    <span class="site-header__username">{{ currentUser }}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="site-header__logout-icon">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </button>
                <button
                    v-else
                    @click="isAuthModalOpen = true"
                    class="site-header__login-btn"
                >
                    Sign In
                </button>

                <router-link
                    to="/settings"
                    class="site-header__icon-btn site-header__settings-btn"
                    aria-label="Settings"
                    title="Settings & Preferences"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06-.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </router-link>

                <button
                    class="site-header__icon-btn site-header__menu"
                    type="button"
                    aria-label="Open menu"
                    @click="drawerOpen = true"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                        <path d="M4 7h16M4 12h16M4 17h16" />
                    </svg>
                </button>
            </div>
        </div>

        <LmDrawer v-model="drawerOpen" side="right" title="moovie">
            <nav class="site-header__drawer-nav" aria-label="Mobile">
                <template v-for="item in primaryNav" :key="item.path">
                    <router-link
                        v-if="item.label !== 'Others'"
                        :to="item.path"
                        class="site-header__drawer-link"
                        :class="{ 'is-active': isActive(item) }"
                        @mouseenter="prefetchPrimaryNav(item)"
                        @focus="prefetchPrimaryNav(item)"
                        @click="drawerOpen = false"
                    >
                        <span class="eyebrow site-header__drawer-num">0{{ item.num }}</span>
                        <span class="site-header__drawer-label">
                            {{ item.label }}
                        </span>
                    </router-link>
                    <template v-else>
                        <router-link
                            v-for="sub in othersNav"
                            :key="sub.path"
                            :to="sub.path"
                            class="site-header__drawer-link"
                            :class="{ 'is-active': isActive(sub) }"
                            @mouseenter="prefetchPrimaryNav(sub)"
                            @focus="prefetchPrimaryNav(sub)"
                            @click="drawerOpen = false"
                        >
                            <span class="eyebrow site-header__drawer-num">0{{ sub.num }}</span>
                            <span class="site-header__drawer-label">{{ sub.label }}</span>
                        </router-link>
                    </template>
                </template>

                <button
                    type="button"
                    class="site-header__drawer-link site-header__drawer-search"
                    @click="openFromDrawer"
                >
                    <span class="eyebrow site-header__drawer-num">✦</span>
                    <span class="site-header__drawer-label">Search</span>
                </button>

                <button
                    type="button"
                    class="site-header__drawer-link"
                    @click="openPalette"
                >
                    <span class="eyebrow site-header__drawer-num">🔔</span>
                    <span class="site-header__drawer-label">
                        Notifications
                        <span v-if="unreadCount > 0" class="site-header__drawer-badge">{{ unreadCount }}</span>
                    </span>
                </button>

                <router-link to="/party" class="site-header__drawer-link" :class="{ 'is-active': isPartyRoute }" @click="drawerOpen = false">
                    <span class="eyebrow site-header__drawer-num">✦</span>
                    <span class="site-header__drawer-label">Together</span>
                </router-link>

                <button class="site-header__drawer-link" @click="isSettingsModalOpen = true; drawerOpen = false">
                    <span class="eyebrow site-header__drawer-num">🌐</span>
                    <span class="site-header__drawer-label">Regional Settings</span>
                </button>

                <div v-if="currentUser" class="site-header__drawer-link" style="justify-content: space-between;">
                    <span class="site-header__drawer-label" style="color: var(--ember); font-weight: 600;">
                        👤 {{ currentUser }}
                    </span>
                    <button @click="handleLogout(); drawerOpen = false" class="site-header__logout-btn" style="margin-left: auto;">
                        Sign Out
                    </button>
                </div>
                <button
                    v-else
                    @click="isAuthModalOpen = true; drawerOpen = false"
                    class="site-header__drawer-link"
                >
                    <span class="eyebrow site-header__drawer-num">👤</span>
                    <span class="site-header__drawer-label">Sign In / Up</span>
                </button>
            </nav>
        </LmDrawer>

        <!-- Authentication Modal Dialog -->
        <AuthModal :is-open="isAuthModalOpen" @close="isAuthModalOpen = false" />
        
        <!-- Regional Settings Modal -->
        <SettingsModal :is-open="isSettingsModalOpen" @close="isSettingsModalOpen = false" />

    </header>
</template>

<script lang="ts">
import {
    computed,
    defineComponent,
    onBeforeUnmount,
    onMounted,
    ref
} from 'vue';
import { useRoute } from 'vue-router';
import LmDrawer from '../primitives/Drawer.vue';
import AuthModal from './AuthModal.vue';
import SettingsModal from './SettingsModal.vue';
import NotificationBell from './NotificationBell.vue';

import { openPalette } from '../../composables/useCommandPalette';
import { getCurrentUser, logoutUser } from '../../lib/auth';
import { getSettings, REGIONS } from '../../composables/useSettings';
import { prefetchPopularActors } from '../../composables/useActorsPrefetch';
import { useNotifications } from '../../composables/useNotifications';

interface NavItem {
    label: string;
    path: string;
    match: (p: string) => boolean;
    num: number;
}

const othersNav: NavItem[] = [
    {
        label: 'Actors',
        path: '/actors',
        match: p => p === '/actors' || p.startsWith('/actor/'),
        num: 6
    },
    { label: 'Watchlist', path: '/watchlist', match: p => p === '/watchlist', num: 7 },
    { label: 'Discuss', path: '/discuss', match: p => p === '/discuss', num: 7.5 },
    { label: 'Upcoming', path: '/upcoming', match: p => p === '/upcoming', num: 8 },
    { label: 'Live TV', path: '/livetv', match: p => p === '/livetv', num: 9 },
    { label: 'Settings', path: '/settings', match: p => p === '/settings', num: 10 }
];

const primaryNav: NavItem[] = [
    { label: 'Home', path: '/', match: p => p === '/', num: 1 },
    { label: 'Discover', path: '/discover', match: p => p === '/discover', num: 1.5 },
    {
        label: 'Movies',
        path: '/movies',
        match: p => p === '/movies' || p.startsWith('/movie/'),
        num: 2
    },
    {
        label: 'Shows',
        path: '/tv-shows',
        match: p => p === '/tv-shows' || p === '/tv' || p.startsWith('/tv-show/') || p.startsWith('/tv/'),
        num: 3
    },
    {
        label: 'Anime',
        path: '/anime',
        match: p => p === '/anime' || p.startsWith('/anime/'),
        num: 4
    },
    {
        label: 'Others',
        path: '',
        match: p => othersNav.some(n => n.match(p)),
        num: 5
    }
];

export default defineComponent({
    name: 'SiteHeader',
    components: { LmDrawer, AuthModal, SettingsModal, NotificationBell },
    setup() {
        const route = useRoute();
        const isPartyRoute = computed(() => route.path === '/party' || route.path.startsWith('/party/'));
        const scrolled = ref(false);

        const DETAIL_ROUTE_NAMES = new Set([
            'AnimeDetail',
            'Movie',
            'TVShow',
            'Actor'
        ]);

        const onDetailPage = computed(() =>
            Boolean(route.name && DETAIL_ROUTE_NAMES.has(String(route.name)))
        );
        const drawerOpen = ref(false);

        const isAuthModalOpen = ref(false);
        const isSettingsModalOpen = ref(false);

        const currentUser = ref<string | null>(null);
        const { unreadCount } = useNotifications();

        const updateCurrentUser = () => {
            currentUser.value = getCurrentUser();
        };

        const handleLogout = () => {
            logoutUser();
            updateCurrentUser();
        };

        const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);
        const modKey = isMac ? '⌘' : 'Ctrl+';

        const isActive = (item: NavItem) => item.match(route.path);

        const onScroll = () => {
            scrolled.value = window.scrollY > 24;
        };

        const openFromDrawer = () => {
            drawerOpen.value = false;
            openPalette();
        };

        // Region dropdown settings
        const { region: currentRegion, updateSettings } = getSettings();
        const regionContainer = ref<HTMLElement | null>(null);
        const isRegionDropdownOpen = ref(false);

        const toggleRegionDropdown = (e: Event) => {
            e.stopPropagation();
            isRegionDropdownOpen.value = !isRegionDropdownOpen.value;
        };

        const closeRegionDropdown = () => {
            isRegionDropdownOpen.value = false;
        };

        const selectRegion = (code: string) => {
            updateSettings(code, 'en-US');
            closeRegionDropdown();
        };

        // Settings dropdown
        const settingsContainer = ref<HTMLElement | null>(null);
        const isSettingsDropdownOpen = ref(false);
        const adsHidden = ref(localStorage.getItem('ads_hidden') === 'true');

        const toggleSettingsDropdown = (e: Event) => {
            e.stopPropagation();
            isSettingsDropdownOpen.value = !isSettingsDropdownOpen.value;
        };

        const closeSettingsDropdown = () => {
            isSettingsDropdownOpen.value = false;
        };

        const toggleAdsHidden = () => {
            adsHidden.value = !adsHidden.value;
            localStorage.setItem('ads_hidden', String(adsHidden.value));
            window.location.reload();
        };

        const getFlagEmoji = (code: string) => {
            switch (code) {
                case 'global': return '🌐';
                case 'US': return '🇺🇸';
                case 'GB': return '🇬🇧';
                case 'IN': return '🇮🇳';
                case 'ES': return '🇪🇸';
                case 'MX': return '🇲🇽';
                case 'IT': return '🇮🇹';
                case 'FR': return '🇫🇷';
                case 'DE': return '🇩🇪';
                case 'BR': return '🇧🇷';
                case 'JP': return '🇯🇵';
                case 'KR': return '🇰🇷';
                case 'CN': return '🇨🇳';
                case 'TH': return '🇹🇭';
                case 'TW': return '🇹🇼';
                case 'PH': return '🇵🇭';
                case 'ID': return '🇮🇩';
                case 'MY': return '🇲🇾';
                case 'SG': return '🇸🇬';
                case 'CA': return '🇨🇦';
                case 'AU': return '🇦🇺';
                case 'ZA': return '🇿🇦';
                case 'NL': return '🇳🇱';
                case 'PL': return '🇵🇱';
                case 'SE': return '🇸🇪';
                case 'CO': return '🇨🇴';
                case 'CL': return '🇨🇱';
                default: return '🌐';
            }
        };

        // Others dropdown
        const othersContainer = ref<HTMLElement | null>(null);
        const isOthersDropdownOpen = ref(false);

        const toggleOthersDropdown = () => {
            isOthersDropdownOpen.value = !isOthersDropdownOpen.value;
        };

        const closeOthersDropdown = () => {
            isOthersDropdownOpen.value = false;
        };

        const prefetchPrimaryNav = (item: { path: string }) => {
            if (item.path === '/actors') void prefetchPopularActors();
        };

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            if (regionContainer.value && !regionContainer.value.contains(target)) {
                closeRegionDropdown();
            }

            if (settingsContainer.value && !settingsContainer.value.contains(target)) {
                closeSettingsDropdown();
            }

            if (othersContainer.value && !othersContainer.value.contains(target)) {
                closeOthersDropdown();
            }
        };

        onMounted(() => {
            onScroll();
            window.addEventListener('scroll', onScroll, { passive: true });
            updateCurrentUser();
            window.addEventListener('movora_auth_change', updateCurrentUser);
            document.addEventListener('click', handleClickOutside);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('movora_auth_change', updateCurrentUser);
            document.removeEventListener('click', handleClickOutside);
        });

        let partyPreloaded = false;
        const preloadPartyApp = () => {
            if (partyPreloaded) return;
            partyPreloaded = true;
            const links = ['/party/app.html', '/party/party.js', '/party/party.css'];
            links.forEach(href => {
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = href;
                document.head.appendChild(link);
            });
        };

        return {
            primaryNav,
            othersNav,
            scrolled,
            onDetailPage,
            drawerOpen,
            modKey,
            isActive,
            openPalette,
            openFromDrawer,
            isAuthModalOpen,
            isSettingsModalOpen,

            currentUser,
            handleLogout,

            // Region selectors
            regions: REGIONS,
            currentRegion,
            isRegionDropdownOpen,
            regionContainer,
            toggleRegionDropdown,
            selectRegion,
            getFlagEmoji,

            // Settings dropdown
            settingsContainer,
            isSettingsDropdownOpen,
            adsHidden,
            toggleSettingsDropdown,
            closeSettingsDropdown,
            toggleAdsHidden,

            // Others dropdown
            isOthersDropdownOpen,
            othersContainer,
            toggleOthersDropdown,
            closeOthersDropdown,

            isNetflixMode: computed(() => false),
            isPartyRoute,
            prefetchPrimaryNav,
            preloadPartyApp,

            unreadCount
        };
    }
});
</script>

<style lang="scss" scoped>
.site-header {
    position: sticky;
    top: 0;
    z-index: var(--z-header);
    background: linear-gradient(180deg, rgba(28, 18, 13, 0.98), rgba(17, 12, 9, 0.86));
    transition:
        background-color var(--dur-base) var(--ease-out),
        border-color var(--dur-base) var(--ease-out),
        backdrop-filter var(--dur-base) var(--ease-out);

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
            180deg,
            rgba(28, 18, 13, 0.88) 0%,
            rgba(17, 12, 9, 0) 100%
        );
        pointer-events: none;
        opacity: 1;
        transition: opacity var(--dur-base) var(--ease-out);
    }

    &.is-scrolled {
        background: rgba(20, 14, 10, 0.97);
        backdrop-filter: var(--blur-strong);
        -webkit-backdrop-filter: var(--blur-strong);
        border-bottom: 1px solid var(--glass-border-strong);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);

        &::before { opacity: 0; }
    }

    &__inner {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
        padding-block: var(--s-3);
        min-height: var(--site-header-height);
    }

    // ── Logo ─────────────────────────────────────────────────────────────
    &__logo {
        display: inline-flex;
        align-items: center;
        gap: var(--s-3);
        color: var(--bone-50);
    }

    &__fight-chat-control {
        display: inline-flex;
        align-items: center;
        padding: 5px 12px;
        font-size: 0.76rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        color: #ff4d4d;
        background: rgba(255, 77, 77, 0.1);
        border: 1px solid rgba(255, 77, 77, 0.3);
        border-radius: var(--r-pill);
        text-decoration: none;
        transition: all var(--dur-fast) var(--ease-out);
        white-space: nowrap;
        margin-right: var(--s-2);

        &:hover {
            color: #ffffff;
            background: rgba(255, 77, 77, 0.25);
            border-color: rgba(255, 77, 77, 0.6);
            box-shadow: 0 0 12px rgba(255, 77, 77, 0.3);
        }

        @media (max-width: 860px) {
            display: none;
        }
    }

    &__mark-text {
        font-family: var(--font-display);
        font-weight: 800;
        font-size: 1.85rem;
        letter-spacing: -0.06em;
        line-height: 1;
        color: var(--bone-50);
        background: linear-gradient(135deg, #ff5a1f 0%, #ff8a00 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-transform: lowercase;
        position: relative;
        display: inline-flex;
        align-items: center;
        padding-right: 2px;
        transition: transform var(--dur-fast) var(--ease-out);

        &:hover {
            transform: scale(1.05);
        }
    }

    &__wordmark {
        display: flex;
        flex-direction: column;
        line-height: 1;
    }

    &__kicker {
        margin-top: 3px;
        color: var(--bone-400);
        font-size: 0.625rem;
    }

    &__beta {
        margin-left: 0.2em;
        font-size: 0.68em;
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: lowercase;
        color: var(--bone-500);
        font-style: italic;
    }

    // ── Nav links ────────────────────────────────────────────────────────
    &__nav {
        display: flex;
        gap: 0.25rem;

        @media (max-width: 860px) {
            display: none;
        }

        &--catalogues {
            flex: 1;
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 0;
            overflow: visible;
            max-width: calc(100% - 320px);

            .site-header__link {
                flex-shrink: 0;
                padding: var(--s-2) var(--s-2);
                font-size: 0.82rem;
            }
        }
    }

    &__nav-scroll {
        display: inline-flex;
        align-items: center;
        gap: 0;
        min-width: 0;
        overflow-x: auto;
        flex-wrap: nowrap;
        scrollbar-width: none;
        padding-bottom: 2px;

        &::-webkit-scrollbar {
            display: none;
        }

        &--tail {
            flex-shrink: 0;
        }
    }

    &__link {
        position: relative;
        padding: var(--s-2) var(--s-2);
        border: none;
        background: transparent;
        cursor: pointer;
        text-decoration: none;
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        color: var(--bone-300);
        letter-spacing: var(--ls-snug);
        border-radius: var(--r-pill);
        transition:
            color var(--dur-fast) var(--ease-out),
            background-color var(--dur-fast) var(--ease-out);

        &:hover {
            color: var(--bone-50);
            background: var(--surface-tint);
        }

        &.is-active {
            color: var(--bone-50);

            &::after {
                content: '';
                position: absolute;
                left: 50%;
                bottom: -2px;
                width: 6px;
                height: 6px;
                background: var(--ember);
                border-radius: 50%;
                transform: translateX(-50%);
                box-shadow: 0 0 12px var(--ember-glow);
            }
        }
    }

    &__others-btn {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        color: var(--bone-300) !important;

        &:hover,
        &:focus-visible,
        &.is-active {
            background: transparent !important;
            color: var(--bone-50) !important;
        }
    }

    &__new-badge {
        background: var(--ember);
        color: var(--ink-900) !important;
        font-size: 0.55rem;
        font-weight: 850;
        padding: 0.1rem 0.3rem;
        border-radius: 3px;
        margin-left: 0.25rem;
        vertical-align: middle;
        letter-spacing: 0.05em;
        display: inline-block;
        line-height: 1;
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(255, 255, 255, 0.4);
    }

    // ── Actions ──────────────────────────────────────────────────────────
    &__actions {
        display: flex;
        align-items: center;
        gap: 0.15rem;
    }

    &__search {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        min-width: 40px;
        min-height: 40px;
        padding: 0.5rem 0.75rem 0.5rem 0.65rem;
        background: transparent;
        border: 0;
        border-radius: 0;
        color: var(--bone-300);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        min-width: 0;
        cursor: pointer;
        transition:
            background-color var(--dur-fast),
            border-color var(--dur-fast),
            color var(--dur-fast);

        svg {
            width: 16px;
            height: 16px;
            flex: 0 0 auto;
        }

        &:hover {
            color: var(--bone-50);
        }

        @media (max-width: 1024px) {
            min-width: 0;
            width: 40px;
            height: 40px;
            padding: 0;
            justify-content: center;
        }
    }

    &__search-label {
        flex: 1;
        text-align: left;

        @media (max-width: 1024px) {
            display: none;
        }
    }

    &__search-kbd {
        font-family: var(--font-mono);
        font-size: 0.6875rem;
        padding: 0.1rem 0.4rem;
        background: transparent;
        border: 0;
        border-radius: 0;
        color: var(--bone-300);

        @media (max-width: 1024px) {
            display: none;
        }
    }

    &__icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border-radius: 0;
        color: var(--bone-200);
        background: transparent;
        border: 0;
        transition:
            color var(--dur-fast),
            background-color var(--dur-fast),
            border-color var(--dur-fast);

        svg { width: 18px; height: 18px; }

        &:hover {
            color: var(--bone-50);
        }
    }

    &__menu {
        display: none;

        @media (max-width: 860px) {
            display: inline-flex;
        }
    }

    // ── Drawer nav ───────────────────────────────────────────────────────
    &__drawer-nav {
        display: flex;
        flex-direction: column;
    }

    &__drawer-link {
        display: flex;
        align-items: center;
        gap: var(--s-4);
        padding: var(--s-4) var(--s-2);
        border-bottom: 1px solid var(--rule);
        color: var(--bone-200);
        font-family: var(--font-display);
        font-size: var(--fs-2xl);
        font-weight: 400;
        font-variation-settings: 'opsz' 72, 'SOFT' 40;
        text-align: left;
        width: 100%;
        transition: color var(--dur-fast), background-color var(--dur-fast);

        &:hover {
            color: var(--bone-50);
            background: var(--surface-tint);
        }

        &.is-active {
            color: var(--ember);
        }
    }

    &__drawer-num {
        color: var(--bone-500);
        font-family: var(--font-mono);
        font-size: 0.6875rem;
        min-width: 28px;
    }

    &__drawer-label {
        flex: 1;
    }

    &__drawer-search {
        color: var(--bone-50);
    }

    &__drawer-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        background: var(--ember);
        color: var(--ink-950);
        font-size: 0.65rem;
        font-weight: 800;
        border-radius: 10px;
        line-height: 1;
    }

    &__party-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        min-height: 40px;
        padding: 0.5rem 0.75rem;
        background: transparent;
        border: 0;
        border-radius: 0;
        color: var(--bone-300);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        letter-spacing: var(--ls-snug);
        transition: color var(--dur-fast);
        text-decoration: none;

        &:hover {
            color: var(--bone-50);
        }

        &.is-active {
            color: var(--bone-50);
        }
    }

    &__mode-btn {
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        background: var(--ink-800);
        border: 1px solid var(--rule);
        border-radius: var(--r-sm);
        color: var(--bone-200);
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        font-weight: 600;
        letter-spacing: var(--ls-wide);
        cursor: pointer;
        transition:
            border-color var(--dur-fast),
            color var(--dur-fast),
            transform var(--dur-fast);

        &:hover {
            border-color: var(--rule-strong);
            color: var(--bone-50);
            transform: translateY(-1px);
        }
    }

    &__party-icon {
        width: 14px;
        height: 14px;
    }

    &__login-btn {
        background: transparent;
        color: var(--bone-300);
        font-weight: 500;
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        min-height: 40px;
        padding: 0.5rem 0.75rem;
        border: 0;
        border-radius: 0;
        cursor: pointer;
        transition: transform var(--dur-fast), border-color var(--dur-fast);

        &:hover {
            color: var(--bone-50);
        }
    }

    &__region-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 0;
        background: var(--surface-tint);
        color: var(--bone-200);
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
        cursor: pointer;
        transition:
            background-color var(--dur-fast),
            border-color var(--dur-fast),
            color var(--dur-fast);

        svg {
            width: 18px;
            height: 18px;
        }

        &:hover,
        &.is-active {
            background: var(--surface-tint-hover);
            border-color: var(--rule-strong);
            color: var(--bone-50);
        }
    }

    &__user-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        min-height: 40px;
        padding: 0.5rem 0.75rem;
        background: transparent;
        border: 0;
        border-radius: 0;
        cursor: pointer;
        transition: all var(--dur-fast) var(--ease-out);

        &:hover {
            transform: none;
        }
    }

    // Header actions share the same quiet text-link treatment as catalogue
    // navigation; they are not pill buttons.
    &__search,
    &__party-btn,
    &__icon-btn,
    &__login-btn,
    &__user-badge {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        color: var(--bone-300) !important;

        &:hover,
        &:focus-visible,
        &.is-active {
            color: var(--bone-50) !important;
        }
    }

    &__username {
        color: var(--bone-100);
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        font-weight: 600;
    }

    &__logout-icon {
        width: 14px;
        height: 14px;
        color: var(--bone-400);
        transition: color var(--dur-fast);

        .site-header__user-badge:hover & {
            color: var(--bone-50);
        }
    }

    &__logout-btn {
        background: transparent;
        border: none;
        color: var(--bone-400);
        cursor: pointer;
        padding: var(--s-1);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--r-xs);
        transition: color var(--dur-fast), background-color var(--dur-fast);

        svg {
            width: 14px;
            height: 14px;
        }

        &:hover {
            color: var(--ember);
            background: rgba(255, 255, 255, 0.08);
        }
    }

    &__nav-group {
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        border-radius: var(--r-pill);
        background: transparent;
        transition: background-color var(--dur-fast) var(--ease-out);

        &:hover {
            background: var(--surface-tint);
        }

        &.is-active .site-header__nav-group-main.is-active::after {
            content: '';
            position: absolute;
            left: 50%;
            bottom: -2px;
            width: 6px;
            height: 6px;
            background: var(--ember);
            border-radius: 50%;
            transform: translateX(-50%);
            box-shadow: 0 0 12px var(--ember-glow);
        }
    }

    &__nav-group-main {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
        padding-right: var(--s-2);
    }

    &__browse {
        position: relative;
        flex-shrink: 0;
    }

    &__browse-trigger {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        padding-left: var(--s-2);
        font-size: 0.78rem;
        color: var(--bone-400);

        &:hover,
        &.is-active {
            color: var(--bone-50);
        }

        &.is-active::after {
            display: none;
        }
    }

    &__nav-group-main.is-active::after {
        display: none;
    }

    &__browse-menu:not(&__floating-menu) {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        min-width: 200px;
        z-index: calc(var(--z-header) + 2);
    }

    &__floating-menu {
        position: fixed;
        top: 0;
        left: 0;
        right: unset;
        bottom: unset;
        width: auto;
        margin: 0;
        z-index: calc(var(--z-header) + 12);
    }

    &__country {
        margin-left: 0;
    }

    &__country-trigger {
        border-radius: var(--r-sm);
        padding-left: var(--s-3);
        padding-right: var(--s-2);
        font-size: 0.82rem;
        color: var(--bone-300);

        &:hover,
        &.is-active {
            color: var(--bone-50);
        }
    }

    &__country-menu,
    &__category-menu {
        min-width: 220px;
    }

    &__category {
        margin-left: 0;
    }

    &__category-trigger {
        border-radius: var(--r-sm);
        padding-left: var(--s-3);
        padding-right: var(--s-2);
        font-size: 0.82rem;
        color: var(--bone-300);

        &:hover,
        &.is-active {
            color: var(--bone-50);
        }
    }

    &__drawer-section {
        margin: var(--s-4) var(--s-4) var(--s-2);
        color: var(--bone-500);
    }
}

.vehicle-selector {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--r-pill);
    padding: 3px 5px;
    margin-left: var(--s-3);
    z-index: 5;

    @media (max-width: 768px) {
        display: none; /* hide on smaller mobile header blocks to preserve space */
    }
}

.vehicle-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.95rem;
    padding: 3px 6px;
    border-radius: var(--r-pill);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color var(--dur-fast), transform var(--dur-fast);
    
    &:hover {
        background: rgba(255, 255, 255, 0.08);
        transform: scale(1.15);
    }
    
    &.is-active {
        background: rgba(255, 255, 255, 0.16);
        border: 1px solid rgba(255, 255, 255, 0.35);
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.25);
        transform: scale(1.05);
    }
}

.site-header__region-container {
    position: relative;
    display: inline-flex;
}

.region-dropdown {
    position: absolute;
    top: calc(100% + var(--s-2));
    right: 0;
    width: 240px;
    background: rgba(8, 8, 8, 0.97);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(16px);
    overflow: hidden;
    z-index: 100;
    animation: dropdown-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    &.site-header__floating-menu {
        position: fixed;
        top: 0;
        left: 0;
        right: unset;
        bottom: unset;
        width: auto;
        min-width: 220px;
        z-index: calc(var(--z-header) + 12);
    }

    &__header {
        padding: var(--s-3) var(--s-4) var(--s-2);
        color: var(--bone-400);
        font-size: 0.625rem;
        border-bottom: 1px solid var(--rule);
        text-align: left;
    }

    &__list {
        display: flex;
        flex-direction: column;
        padding: var(--s-1);
        max-height: 320px;
        overflow-y: auto;

        &::-webkit-scrollbar {
            width: 4px;
        }
        &::-webkit-scrollbar-track {
            background: transparent;
        }
        &::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: var(--r-pill);
        }
        &::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
        }
    }

    &__item {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        width: 100%;
        padding: 10px var(--s-3);
        background: transparent;
        border: none;
        border-radius: var(--r-sm);
        color: var(--bone-200);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition: background-color var(--dur-fast), color var(--dur-fast);

        &:hover {
            background: var(--surface-tint);
            color: var(--bone-50);
        }

        &.is-active {
            background: rgba(255, 255, 255, 0.08);
            color: var(--ember);
        }
    }

    &__flag {
        font-size: 1.1rem;
        line-height: 1;
    }

    &__name {
        flex: 1;
    }

    &__check {
        width: 14px;
        height: 14px;
        color: var(--ember);
    }
}

.settings-dropdown {
    position: absolute;
    top: calc(100% + var(--s-2));
    right: 0;
    width: 200px;
    background: rgba(8, 8, 8, 0.97);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(16px);
    overflow: hidden;
    z-index: 100;
    animation: dropdown-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    &__header {
        padding: var(--s-3) var(--s-4) var(--s-2);
        color: var(--bone-400);
        font-size: 0.625rem;
        border-bottom: 1px solid var(--rule);
        text-align: left;
    }

    &__list {
        display: flex;
        flex-direction: column;
        padding: var(--s-2);
        max-height: 300px;
        overflow-y: auto;
    }

    &__item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--s-3) var(--s-3);
        border-radius: var(--r-sm);
        cursor: pointer;
        transition: background-color var(--dur-fast);
        &:hover { background: var(--surface-tint); }
    }

    &__label {
        font-size: var(--fs-sm);
        color: var(--bone-200);
        font-weight: 500;
    }

    &__checkbox-label {
        user-select: none;
    }

    &__checkbox {
        width: 16px;
        height: 16px;
        accent-color: var(--ember);
        cursor: pointer;
    }
}

.site-header__settings-container {
    position: relative;
    @media (max-width: 860px) { display: none; }
}

.others-dropdown {
    position: absolute;
    top: calc(100% + var(--s-2));
    left: 0;
    min-width: 180px;
    background: rgba(8, 8, 8, 0.97);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(16px);
    overflow: hidden;
    z-index: 100;
    animation: dropdown-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    &__item {
        display: block;
        padding: 10px var(--s-4);
        color: var(--bone-200);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        text-decoration: none;
        transition: background-color var(--dur-fast), color var(--dur-fast);

        &:hover {
            background: var(--surface-tint);
            color: var(--bone-50);
        }

        &.is-active {
            background: rgba(255, 255, 255, 0.08);
            color: var(--ember);
        }
    }
}

.site-header__others {
    position: relative;

    &-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
    }

    &-chevron {
        transition: transform 0.2s;

        &.is-open {
            transform: rotate(180deg);
        }
    }
}

@keyframes dropdown-fade-in {
    from {
        opacity: 0;
        transform: translateY(-8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
