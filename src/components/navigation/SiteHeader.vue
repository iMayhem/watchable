<template>
    <header class="site-header" :class="{ 'is-scrolled': scrolled }">
        <div class="container-lm site-header__inner">
            <router-link to="/" class="site-header__logo" aria-label="moovie home">
                <div class="site-header__wordmark">
                    <span class="site-header__mark-text">moovie</span>
                    <span class="site-header__kicker eyebrow">A Cinema Periodical</span>
                </div>
            </router-link>
            



            <nav class="site-header__nav" aria-label="Primary">
                <router-link
                    v-for="item in primaryNav"
                    :key="item.path"
                    :to="item.path"
                    class="site-header__link"
                    :class="{ 'is-active': isActive(item) }"
                >
                    {{ item.label }}
                </router-link>
            </nav>

            <div class="site-header__actions">
                <button
                    class="site-header__search"
                    type="button"
                    aria-label="Open search (⌘K)"
                    @click="openPalette"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                    <span class="site-header__search-label">Search</span>
                    <kbd class="site-header__search-kbd">{{ modKey }}K</kbd>
                </button>



                <!-- Watch Together Party Lobby Link -->
                <a
                    href="/party/"
                    class="site-header__party-btn"
                    aria-label="Watch Together"
                    title="Watch Together Party Lobby"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="site-header__party-icon">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span class="site-header__party-label">Party</span>
                </a>

                <!-- User Session Controls -->
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

                <!-- Regional Settings Dropdown Trigger -->
                <div ref="regionContainer" class="site-header__region-container">
                    <button
                        class="site-header__region-toggle"
                        :class="{ 'is-active': isRegionDropdownOpen }"
                        type="button"
                        @click="toggleRegionDropdown"
                    >
                        <span class="site-header__region-flag">{{ getFlagEmoji(currentRegion) }}</span>
                        Change Region
                    </button>
                    
                    <div v-if="isRegionDropdownOpen" class="region-dropdown">
                        <div class="region-dropdown__header eyebrow">
                            Select Region
                        </div>
                        <div class="region-dropdown__list">
                            <button
                                v-for="r in regions"
                                :key="r.code"
                                class="region-dropdown__item"
                                :class="{ 'is-active': currentRegion === r.code }"
                                @click="selectRegion(r.code)"
                            >
                                <span class="region-dropdown__flag">{{ getFlagEmoji(r.code) }}</span>
                                <span class="region-dropdown__name">{{ r.name }}</span>
                                <svg v-if="currentRegion === r.code" class="region-dropdown__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

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
                <router-link
                    v-for="item in primaryNav"
                    :key="item.path"
                    :to="item.path"
                    class="site-header__drawer-link"
                    :class="{ 'is-active': isActive(item) }"
                    @click="drawerOpen = false"
                >
                    <span class="eyebrow site-header__drawer-num">0{{ item.num }}</span>
                    <span class="site-header__drawer-label">{{ item.label }}</span>
                </router-link>

                <button class="site-header__drawer-link site-header__drawer-search" @click="openFromDrawer">
                    <span class="eyebrow site-header__drawer-num">✦</span>
                    <span class="site-header__drawer-label">Search &amp; Jump</span>
                </button>

                <a href="/party/" class="site-header__drawer-link" @click="drawerOpen = false">
                    <span class="eyebrow site-header__drawer-num">✦</span>
                    <span class="site-header__drawer-label">Watch Together</span>
                </a>

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
import { defineComponent, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
import LmDrawer from '../primitives/Drawer.vue';
import AuthModal from './AuthModal.vue';
import SettingsModal from './SettingsModal.vue';

import { openPalette } from '../../composables/useCommandPalette';
import { getCurrentUser, logoutUser } from '../../lib/auth';
import { getSettings, REGIONS } from '../../composables/useSettings';

interface NavItem {
    label: string;
    path: string;
    match: (p: string) => boolean;
    num: number;
}

const primaryNav: NavItem[] = [
    { label: 'Home', path: '/', match: p => p === '/', num: 1 },
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
        label: 'Actors',
        path: '/actors',
        match: p => p === '/actors' || p.startsWith('/actor/'),
        num: 5
    },
    { label: 'Watchlist', path: '/watchlist', match: p => p === '/watchlist', num: 6 }
];

export default defineComponent({
    name: 'SiteHeader',
    components: { LmDrawer, AuthModal, SettingsModal },
    setup() {
        const route = useRoute();
        const scrolled = ref(false);
        const drawerOpen = ref(false);

        const isAuthModalOpen = ref(false);
        const isSettingsModalOpen = ref(false);

        const currentUser = ref<string | null>(null);

        const updateCurrentUser = () => {
            currentUser.value = getCurrentUser();
        };

        const handleLogout = () => {
            logoutUser();
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
            console.log('[SiteHeader] selectRegion called with code:', code);
            updateSettings(code, 'en-US');
            closeRegionDropdown();
            console.log('[SiteHeader] updateSettings completed');
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
                case 'TR': return '🇹🇷';
                case 'RU': return '🇷🇺';
                case 'EG': return '🇪🇬';
                case 'CA': return '🇨🇦';
                case 'AU': return '🇦🇺';
                case 'AR': return '🇦🇷';
                case 'MY': return '🇲🇾';
                case 'SA': return '🇸🇦';
                case 'ZA': return '🇿🇦';
                case 'NL': return '🇳🇱';
                case 'PL': return '🇵🇱';
                case 'SE': return '🇸🇪';
                case 'CO': return '🇨🇴';
                case 'CL': return '🇨🇱';
                default: return '🌐';
            }
        };

        const handleClickOutside = (event: MouseEvent) => {
            if (regionContainer.value && !regionContainer.value.contains(event.target as Node)) {
                closeRegionDropdown();
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

        return {
            primaryNav,
            scrolled,
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
            getFlagEmoji
        };
    }
});
</script>

<style lang="scss" scoped>
.site-header {
    position: sticky;
    top: 0;
    z-index: var(--z-header);
    background: transparent;
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
            rgba(11, 10, 8, 0.9) 0%,
            rgba(11, 10, 8, 0) 100%
        );
        pointer-events: none;
        opacity: 1;
        transition: opacity var(--dur-base) var(--ease-out);
    }

    &.is-scrolled {
        background: rgba(11, 10, 8, 0.72);
        backdrop-filter: blur(14px) saturate(1.15);
        border-bottom: 1px solid var(--rule);

        &::before { opacity: 0; }
    }

    &__inner {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-5);
        padding-block: var(--s-3);
        min-height: 68px;
    }

    // ── Logo ─────────────────────────────────────────────────────────────
    &__logo {
        display: inline-flex;
        align-items: center;
        gap: var(--s-3);
        color: var(--bone-50);
    }

    &__mark-text {
        font-family: var(--font-display);
        font-weight: 800;
        font-size: 2.15rem;
        letter-spacing: -0.07em;
        line-height: 0.85;
        color: var(--bone-50);
        background: linear-gradient(135deg, var(--ember) 0%, #ff8a00 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-transform: lowercase;
        position: relative;
        display: inline-flex;
        align-items: center;
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

    // ── Nav links ────────────────────────────────────────────────────────
    &__nav {
        display: flex;
        gap: var(--s-1);

        @media (max-width: 860px) {
            display: none;
        }
    }

    &__link {
        position: relative;
        padding: var(--s-2) var(--s-4);
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

    // ── Actions ──────────────────────────────────────────────────────────
    &__actions {
        display: flex;
        align-items: center;
        gap: var(--s-2);
    }

    &__search {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        padding: 0.5rem 0.75rem 0.5rem 0.65rem;
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
        color: var(--bone-300);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        min-width: 220px;
        transition:
            background-color var(--dur-fast),
            border-color var(--dur-fast),
            color var(--dur-fast);

        svg { width: 16px; height: 16px; flex: 0 0 auto; }

        &:hover {
            background: var(--surface-tint-hover);
            border-color: var(--rule-strong);
            color: var(--bone-50);
        }

        @media (max-width: 1024px) {
            min-width: 0;
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
        background: var(--ink-700);
        border: 1px solid var(--rule);
        border-radius: var(--r-sm);
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
        border-radius: var(--r-pill);
        color: var(--bone-200);
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        transition:
            color var(--dur-fast),
            background-color var(--dur-fast),
            border-color var(--dur-fast);

        svg { width: 18px; height: 18px; }

        &:hover {
            color: var(--bone-50);
            background: var(--surface-tint-hover);
            border-color: var(--rule-strong);
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

    &__party-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        background: rgba(255, 90, 31, 0.08);
        border: 1px solid rgba(255, 90, 31, 0.25);
        border-radius: var(--r-sm);
        color: var(--ember);
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: var(--ls-wide);
        transition: background-color var(--dur-fast), border-color var(--dur-fast), transform var(--dur-fast);
        text-decoration: none;

        &:hover {
            background: rgba(255, 90, 31, 0.16);
            border-color: rgba(255, 90, 31, 0.45);
            transform: translateY(-1px);
        }
    }

    &__party-icon {
        width: 14px;
        height: 14px;
    }

    &__login-btn {
        background: linear-gradient(135deg, var(--ember) 0%, #ff8a00 100%);
        color: var(--ink-900);
        font-weight: 700;
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        padding: 6px var(--s-4);
        border: none;
        border-radius: var(--r-sm);
        cursor: pointer;
        transition: transform var(--dur-fast), box-shadow var(--dur-fast);

        &:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(255, 90, 31, 0.25);
        }
    }

    &__region-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.03);
        color: var(--bone-200);
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        font-weight: 600;
        padding: 6px 14px;
        border: 1px solid var(--rule);
        border-radius: var(--r-sm);
        cursor: pointer;
        transition: background-color var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);

        &:hover, &.is-active {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.2);
            color: var(--bone-50);
        }
    }

    &__region-flag {
        font-size: 1.1rem;
        line-height: 1;
    }

    &__user-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        padding: 5px var(--s-2) 5px var(--s-3);
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        border-radius: var(--r-sm);
        cursor: pointer;
        transition: all var(--dur-fast) var(--ease-out);

        &:hover {
            background: var(--surface-tint-hover);
            border-color: var(--rule-strong);
            transform: translateY(-1px);
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
            color: var(--ember);
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
            background: rgba(255, 90, 31, 0.08);
        }
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
        background: rgba(255, 90, 31, 0.16);
        border: 1px solid rgba(255, 90, 31, 0.35);
        box-shadow: 0 0 10px rgba(255, 90, 31, 0.25);
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
    background: rgba(26, 24, 21, 0.95);
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
            background: rgba(255, 90, 31, 0.08);
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
