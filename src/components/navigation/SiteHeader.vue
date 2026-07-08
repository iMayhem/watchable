<template>
    <header class="site-header" :class="{ 'is-scrolled': scrolled || onDetailPage }">
        <div class="container-lm site-header__inner">
            <router-link to="/" class="site-header__logo" aria-label="moovie home">
                <div class="site-header__wordmark">
                    <span class="site-header__mark-text">moovie</span>
                    <span class="site-header__kicker eyebrow">
                        <template v-if="isNetflixMode">
                            Netflix Catalogue
                            <span class="site-header__beta">(beta)</span>
                        </template>
                        <template v-else>A Cinema Periodical</template>
                    </span>
                </div>
            </router-link>

            <nav
                v-if="isNetflixMode"
                class="site-header__nav site-header__nav--catalogues"
                aria-label="Netflix"
            >
                <div class="site-header__nav-scroll">
                    <a
                        v-for="item in netflixNavLeading"
                        :key="item.label"
                        href="#"
                        class="site-header__link"
                        :class="{ 'is-active': item.isActive() }"
                        @click.prevent="navigateNetflixNav(item)"
                        @mouseenter="prefetchNetflixNav(item)"
                        @focus="prefetchNetflixNav(item)"
                    >
                        {{ item.label }}
                    </a>
                </div>

                <div class="site-header__nav-scroll site-header__nav-scroll--tail">
                    <a
                        v-for="item in netflixNavTrailing"
                        :key="item.label"
                        href="#"
                        class="site-header__link"
                        :class="{ 'is-active': item.isActive() }"
                        @click.prevent="navigateNetflixNav(item)"
                        @mouseenter="prefetchNetflixNav(item)"
                        @focus="prefetchNetflixNav(item)"
                    >
                        {{ item.label }}
                    </a>
                </div>
            </nav>

            <nav v-else class="site-header__nav" aria-label="Primary">
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
                        <span v-if="item.label === 'Discover'" class="site-header__new-badge">NEW</span>
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
                <button
                    v-if="!isNetflixMode && !supportBtnHidden"
                    type="button"
                    class="site-header__support-btn"
                    @click="isDonationModalOpen = true"
                >
                    Support us
                </button>

                <button
                    type="button"
                    class="site-header__search"
                    aria-label="Search"
                    title="Search"
                    @click="openPalette"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </button>

                <!-- Discord Link -->
                <a
                    href="https://discord.gg/BmRu5pXHC"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="site-header__discord-action-btn"
                    aria-label="Join Discord"
                    title="Join Discord"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
                    </svg>
                </a>

                <NotificationBell v-if="!isNetflixMode" />

                <ExtensionPrompt v-if="isNetflixMode" />

                <button
                    v-if="showModeSwitch && isNetflixMode"
                    type="button"
                    class="site-header__mode-btn"
                    @click="toggleContentMode"
                >
                    {{ modeLabel }}
                </button>



                <router-link
                    v-if="!isNetflixMode"
                    to="/party"
                    class="site-header__party-btn"
                    :class="{ 'is-active': isPartyRoute }"
                    aria-label="Together"
                    title="Together Lobby"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="site-header__party-icon">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span class="site-header__party-label">Together</span>
                </router-link>

                <template v-if="!isNetflixMode">
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

                    <div ref="regionContainer" class="site-header__region-container">
                        <button
                            class="site-header__region-toggle"
                            :class="{ 'is-active': isRegionDropdownOpen }"
                            type="button"
                            aria-label="Select region"
                            title="Select region"
                            @click="toggleRegionDropdown"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M2 12h20" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
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
                </template>

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



        <LmDrawer v-model="drawerOpen" side="right" :title="isNetflixMode ? 'Browse' : 'moovie'">
            <nav class="site-header__drawer-nav" :aria-label="isNetflixMode ? 'Netflix' : 'Mobile'">
                <template v-if="isNetflixMode">
                    <a
                        v-for="(item, index) in netflixNavLeading"
                        :key="item.label"
                        href="#"
                        class="site-header__drawer-link"
                        :class="{ 'is-active': item.isActive() }"
                        @click.prevent="navigateNetflixNav(item); drawerOpen = false"
                    >
                        <span class="eyebrow site-header__drawer-num">0{{ index + 1 }}</span>
                        <span class="site-header__drawer-label">{{ item.label }}</span>
                    </a>

                    <a
                        href="#"
                        class="site-header__drawer-link"
                        :class="{ 'is-active': isMovieSectionActive }"
                        @click.prevent="navigateToMovies(); drawerOpen = false"
                    >
                        <span class="eyebrow site-header__drawer-num">03</span>
                        <span class="site-header__drawer-label">Movies</span>
                    </a>

                    <a
                        v-for="(item, index) in netflixNavTrailing"
                        :key="item.label"
                        href="#"
                        class="site-header__drawer-link"
                        :class="{ 'is-active': item.isActive() }"
                        @click.prevent="navigateNetflixNav(item); drawerOpen = false"
                    >
                        <span class="eyebrow site-header__drawer-num">0{{ index + 4 }}</span>
                        <span class="site-header__drawer-label">{{ item.label }}</span>
                    </a>

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
                        @click="toggleContentMode(); drawerOpen = false"
                    >
                        <span class="site-header__drawer-label">{{ modeLabel }}</span>
                    </button>
                </template>

                <template v-else>
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
                                <span v-if="item.label === 'Discover'" class="site-header__new-badge">NEW</span>
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
                </template>
            </nav>
        </LmDrawer>

        <!-- Authentication Modal Dialog -->
        <AuthModal :is-open="isAuthModalOpen" @close="isAuthModalOpen = false" />
        
        <!-- Regional Settings Modal -->
        <SettingsModal :is-open="isSettingsModalOpen" @close="isSettingsModalOpen = false" />
        
        <DonationModal :is-open="isDonationModalOpen" @close="isDonationModalOpen = false" />

    </header>
</template>

<script lang="ts">
import {
    computed,
    defineComponent,
    onBeforeUnmount,
    onMounted,
    ref,
    watch
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LmDrawer from '../primitives/Drawer.vue';
import AuthModal from './AuthModal.vue';
import SettingsModal from './SettingsModal.vue';
import ExtensionPrompt from './ExtensionPrompt.vue';
import NotificationBell from './NotificationBell.vue';
import DonationModal from './DonationModal.vue';

import { openPalette } from '../../composables/useCommandPalette';
import { useOpeningSplash } from '../../composables/useOpeningSplash';
import { getCurrentUser, logoutUser } from '../../lib/auth';
import { getSupabaseClient } from '../../lib/supabase';
import { getSettings, REGIONS } from '../../composables/useSettings';
import { getContentMode } from '../../composables/useContentMode';
import {
    getNetflixCatalogue,
    NETFLIX_KDRAMA_CATALOGUE_ID
} from '../../composables/useNetflixCatalogue';
import { netflixBrowsePath, isNetflixGenreBrowsePage } from '../../composables/useNetflixRails';
import { getNetflixLanguage } from '../../composables/useNetflixLanguage';
import { prefetchNetflixBrowseRoute } from '../../composables/useNetflixBrowsePrefetch';
import { prefetchPopularActors } from '../../composables/useActorsPrefetch';
import { prefetchDiscussFeed } from '../../composables/useDiscussPrefetch';
import { nfDebug } from '../../composables/useNetflixDebug';
import { useNotifications } from '../../composables/useNotifications';
import {
    NETFLIX_ANIMATED_EXPLORE_PATH,
    NETFLIX_MOVIE_EXPLORE_PATH,
    NETFLIX_TV_EXPLORE_PATH,
    isCDramaExploreRoute,
    isHeaderDramaExploreRouteActive,
    isKDramaExploreRoute,
    netflixCDramaExplorePath,
    netflixKDramaExplorePath
} from '../../data/netmirrorExploreCategories';

const PRIMARY_MOVIE_ROW_IDS = new Set(['blockbuster-movies', 'top10-movies', 'korean-movies']);
const PRIMARY_TV_ROW_IDS = new Set(['exciting-tv', 'top10-tv', 'korean-series']);

function isAnimeNavActive(path: string, catalogueId: string): boolean {
    return (
        path.startsWith(NETFLIX_ANIMATED_EXPLORE_PATH) ||
        path === netflixBrowsePath(catalogueId, 'anime') ||
        /^\/nf\/browse\/[^/]+\/anime\/?$/.test(path) ||
        path.startsWith('/nf/anime/')
    );
}

interface NavItem {
    label: string;
    path: string;
    match: (p: string) => boolean;
    num: number;
}

interface NetflixNavItem {
    label: string;
    path: string;
    isActive: () => boolean;
}

function parseNavDestination(path: string) {
    const qIndex = path.indexOf('?');
    if (qIndex === -1) return { path };
    return {
        path: path.slice(0, qIndex),
        query: Object.fromEntries(new URLSearchParams(path.slice(qIndex + 1)))
    };
}

const othersNav: NavItem[] = [
    {
        label: 'Actors',
        path: '/actors',
        match: p => p === '/actors' || p.startsWith('/actor/'),
        num: 5
    },
    { label: 'Watchlist', path: '/watchlist', match: p => p === '/watchlist', num: 6 },
    { label: 'Discuss', path: '/discuss', match: p => p === '/discuss', num: 7 },
    { label: 'Upcoming', path: '/upcoming', match: p => p === '/upcoming', num: 8 },
    { label: 'Live TV', path: '/livetv', match: p => p === '/livetv', num: 9 }
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
    components: { LmDrawer, AuthModal, SettingsModal, ExtensionPrompt, NotificationBell, DonationModal },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { contentMode, setContentMode, isChosen } = getContentMode();
        const { catalogue: netflixCatalogue, setCatalogue: setNetflixCatalogue } =
            getNetflixCatalogue();
        const isNetflixMode = computed(() => contentMode.value === 'netflix');
        const isPartyRoute = computed(() => route.path === '/party' || route.path.startsWith('/party/'));
        const scrolled = ref(false);
        const { splashActive } = useOpeningSplash();

        const DETAIL_ROUTE_NAMES = new Set([
            'AnimeDetail',
            'Movie',
            'TVShow',
            'Actor',
            'NetflixDetail',
            'NetflixAnimeDetail'
        ]);

        const onDetailPage = computed(() =>
            Boolean(route.name && DETAIL_ROUTE_NAMES.has(String(route.name)))
        );
        const drawerOpen = ref(false);

        const isAuthModalOpen = ref(false);
        const isSettingsModalOpen = ref(false);
        const isDonationModalOpen = ref(false);
        const supportBtnHidden = ref(false);

        const currentUser = ref<string | null>(null);
        const { unreadCount } = useNotifications();

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
            console.log('[🎯 SiteHeader] User clicked region:', code);
            updateSettings(code, 'en-US');
            closeRegionDropdown();
            console.log('[🎯 SiteHeader] Region change request sent');
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

        const isOthersDropdownOpen = ref(false);
        const othersContainer = ref<HTMLElement | null>(null);

        const toggleOthersDropdown = () => {
            isOthersDropdownOpen.value = !isOthersDropdownOpen.value;
        };

        const closeOthersDropdown = () => {
            isOthersDropdownOpen.value = false;
        };

        const scrollNavToTop = () => {
            if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            }
        };

        const netflixBrowseContext = computed(() => {
            const path = route.path;
            const browseMatch = path.match(/^\/nf\/browse\/([^/]+)\/([^/?#]+)/);
            const browseRow = browseMatch?.[2] || '';
            const exploreQuery = route.query as Record<
                string,
                string | string[] | null | undefined
            >;
            const isDramaExploreSection = isHeaderDramaExploreRouteActive(path, exploreQuery);

            const isTvSection =
                !isDramaExploreSection &&
                (path.startsWith('/nf/explore/tv') ||
                (browseMatch && PRIMARY_TV_ROW_IDS.has(browseRow)) ||
                path.startsWith('/nf/tv/') ||
                path.includes('/stream/nf/tv/') ||
                (path === '/nf/categories' && route.query.type === 'tv') ||
                (isNetflixGenreBrowsePage(route.params.row as string) && route.query.type === 'tv'));

            const isMovieSection =
                path.startsWith('/nf/explore/movie') ||
                (browseMatch && PRIMARY_MOVIE_ROW_IDS.has(browseRow)) ||
                path.startsWith('/nf/movie/') ||
                path.includes('/stream/nf/movie/') ||
                (path === '/nf/categories' && route.query.type === 'movie') ||
                (isNetflixGenreBrowsePage(route.params.row as string) && route.query.type === 'movie');

            return { path, isTvSection, isMovieSection, isDramaExploreSection };
        });

        const isMovieSectionActive = computed(() => netflixBrowseContext.value.isMovieSection);

        const netflixNavLeading = computed(() => {
            const { path, isTvSection, isMovieSection } = netflixBrowseContext.value;

            return [
                {
                    label: 'Home',
                    path: '/',
                    isActive: () => path === '/'
                },
                {
                    label: 'Movies',
                    path: NETFLIX_MOVIE_EXPLORE_PATH,
                    isActive: () => isMovieSection
                },
                {
                    label: 'TV Shows',
                    path: NETFLIX_TV_EXPLORE_PATH,
                    isActive: () => isTvSection
                }
            ];
        });

        const netflixNavTrailing = computed(() => {
            const cat = netflixCatalogue.value;
            const { path } = netflixBrowseContext.value;
            const exploreQuery = route.query as Record<
                string,
                string | string[] | null | undefined
            >;

            return [
                {
                    label: 'K-Drama',
                    path: netflixKDramaExplorePath(),
                    isActive: () => isKDramaExploreRoute(path, exploreQuery)
                },
                {
                    label: 'C-Drama',
                    path: netflixCDramaExplorePath(),
                    isActive: () => isCDramaExploreRoute(path, exploreQuery)
                },
                {
                    label: 'Animated',
                    path: NETFLIX_ANIMATED_EXPLORE_PATH,
                    isActive: () => isAnimeNavActive(path, cat)
                }
            ];
        });

        const navigateToMovies = async () => {
            try {
                await router.push(NETFLIX_MOVIE_EXPLORE_PATH);
            } catch {
                // duplicate navigation
            }
            scrollNavToTop();
        };

        const clearKoreanIndustryCatalogue = () => {
            if (netflixCatalogue.value !== NETFLIX_KDRAMA_CATALOGUE_ID) return;
            setNetflixCatalogue('hollywood');
        };

        watch(
            () => route.fullPath,
            () => {
                const exploreQuery = route.query as Record<
                    string,
                    string | string[] | null | undefined
                >;
                if (isHeaderDramaExploreRouteActive(route.path, exploreQuery)) {
                    clearKoreanIndustryCatalogue();
                }
            },
            { immediate: true }
        );

        const navigateNetflixNav = async (item: NetflixNavItem) => {
            const destination = parseNavDestination(item.path);
            if (
                item.path === netflixKDramaExplorePath() ||
                item.path === netflixCDramaExplorePath()
            ) {
                clearKoreanIndustryCatalogue();
            }
            try {
                await router.push(destination);
            } catch {
                // duplicate navigation — still scroll so repeat clicks feel responsive
            }
            scrollNavToTop();
        };

        const { language: netflixLanguage } = getNetflixLanguage();

        const prefetchNetflixNav = (item: { path: string }) => {
            const match = item.path.match(/^\/nf\/browse\/([^/]+)\/([^/?#]+)/);
            if (!match) return;
            prefetchNetflixBrowseRoute(match[1], match[2], netflixLanguage.value);
        };

        const prefetchPrimaryNav = (item: { path: string }) => {
            if (item.path === '/actors') prefetchPopularActors();
            if (item.path === '/discuss') prefetchDiscussFeed();
        };

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            if (regionContainer.value && !regionContainer.value.contains(target)) {
                closeRegionDropdown();
            }

            if (othersContainer.value && !othersContainer.value.contains(target)) {
                closeOthersDropdown();
            }
        };

        const showModeSwitch = computed(() => isChosen());

        const modeLabel = computed(() =>
            contentMode.value === 'netflix' ? 'Switch to Global' : 'NETFLIX IN'
        );

        const toggleContentMode = () => {
            const next = contentMode.value === 'netflix' ? 'global' : 'netflix';
            nfDebug('header:mode-toggle', { next });
            setContentMode(next);
            if (route.path === '/' || route.path.startsWith('/nf/') || route.path.startsWith('/stream/nf/')) {
                router.push('/');
            }
        };

        onMounted(() => {
            onScroll();
            window.addEventListener('scroll', onScroll, { passive: true });
            updateCurrentUser();
            window.addEventListener('movora_auth_change', updateCurrentUser);
            document.addEventListener('click', handleClickOutside);
            if (!localStorage.getItem('moovie_donation_seen')) {
                getSupabaseClient().then(client => {
                    client.from('app_settings').select('value').eq('key', 'donation_popup_enabled').single().then((res: any) => {
                        if (res?.data?.value !== 'false') {
                            isDonationModalOpen.value = true;
                        }
                    }).catch(() => {
                        isDonationModalOpen.value = true;
                    });
                }).catch(() => {
                    isDonationModalOpen.value = true;
                });
                localStorage.setItem('moovie_donation_seen', '1');
            }

            getSupabaseClient().then(client => {
                client.from('app_settings').select('value').eq('key', 'support_btn_hidden').single().then((res: any) => {
                    supportBtnHidden.value = res?.data?.value === 'true';
                }).catch(() => {});
            }).catch(() => {});
        });

        watch(splashActive, (active, wasActive) => {
            if (wasActive && !active) {
                requestAnimationFrame(() => onScroll());
            }
        });

        onBeforeUnmount(() => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('movora_auth_change', updateCurrentUser);
            document.removeEventListener('click', handleClickOutside);
        });

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
            isDonationModalOpen,
            supportBtnHidden,

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

            // Others dropdown
            isOthersDropdownOpen,
            othersContainer,
            toggleOthersDropdown,
            closeOthersDropdown,

            showModeSwitch,
            modeLabel,
            toggleContentMode,

            isNetflixMode,
            isPartyRoute,
            netflixNavLeading,
            netflixNavTrailing,
            isMovieSectionActive,
            navigateToMovies,
            navigateNetflixNav,
            prefetchNetflixNav,
            prefetchPrimaryNav,

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

    &__discord-action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 0;
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
        color: var(--bone-300);
        cursor: pointer;
        transition:
            background-color var(--dur-fast),
            border-color var(--dur-fast),
            color var(--dur-fast);

        svg {
            width: 18px;
            height: 18px;
            flex: 0 0 auto;
        }

        &:hover {
            color: #5865F2;
            background: rgba(88, 101, 242, 0.08);
            border-color: rgba(88, 101, 242, 0.4);
        }
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
        gap: 0;

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

    &__new-badge {
        background: var(--ember);
        color: var(--ink-950) !important;
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
        box-shadow: 0 2px 6px rgba(255, 90, 31, 0.4);
    }

    // ── Actions ──────────────────────────────────────────────────────────
    &__actions {
        display: flex;
        align-items: center;
        gap: var(--s-1);
    }

    &__search {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 0;
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
        color: var(--bone-300);
        cursor: pointer;
        transition:
            background-color var(--dur-fast),
            border-color var(--dur-fast),
            color var(--dur-fast);

        svg {
            width: 18px;
            height: 18px;
            flex: 0 0 auto;
        }

        &:hover {
            background: var(--surface-tint-hover);
            border-color: var(--rule-strong);
            color: var(--bone-50);
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

        &.is-active {
            background: rgba(255, 90, 31, 0.2);
            border-color: rgba(255, 90, 31, 0.55);
            color: #fff;
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

.others-dropdown {
    position: absolute;
    top: calc(100% + var(--s-2));
    left: 0;
    min-width: 180px;
    background: rgba(26, 24, 21, 0.95);
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
            background: rgba(255, 90, 31, 0.08);
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

.site-header__support-btn {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 var(--s-3);
    background: rgba(255, 90, 31, 0.1);
    border: 1px solid var(--ember);
    border-radius: var(--r-md);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--ember);
    cursor: pointer;
    transition: background var(--dur-fast), border-color var(--dur-fast);
    white-space: nowrap;
}

.site-header__support-btn:hover {
    background: rgba(255, 90, 31, 0.18);
    border-color: var(--ember-600);
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
