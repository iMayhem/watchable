<template>
    <header class="site-header" :class="{ 'is-scrolled': scrolled }">
        <div class="container-lm site-header__inner">
            <router-link to="/" class="site-header__logo" aria-label="moovie home">
                <div class="site-header__wordmark">
                    <span class="site-header__mark-text">moovie</span>
                    <span class="site-header__kicker eyebrow">
                        {{ isNetflixMode ? 'Netflix Catalogue' : 'A Cinema Periodical' }}
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

                    <div
                        class="site-header__nav-group"
                        :class="{ 'is-active': isMovieSectionActive }"
                    >
                        <a
                            href="#"
                            class="site-header__link site-header__nav-group-main"
                            :class="{ 'is-active': isMovieSectionActive }"
                            @click.prevent="navigateToMovies"
                        >
                            Movies
                        </a>
                        <div ref="industryContainer" class="site-header__browse">
                            <button
                                ref="industryTrigger"
                                type="button"
                                class="site-header__link site-header__browse-trigger"
                                :class="{ 'is-active': isIndustryOpen }"
                                :aria-expanded="isIndustryOpen"
                                aria-haspopup="listbox"
                                @click.stop="toggleIndustryDropdown"
                            >
                                {{ activeIndustryLabel }}
                                <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
                                    <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div ref="countryContainer" class="site-header__browse site-header__country">
                    <button
                        ref="countryTrigger"
                        type="button"
                        class="site-header__link site-header__browse-trigger site-header__country-trigger"
                        :class="{ 'is-active': isCountryOpen || isCountryNavActive }"
                        :aria-expanded="isCountryOpen"
                        aria-haspopup="listbox"
                        @click.stop="toggleCountryDropdown"
                    >
                        {{ activeCountryLabel }}
                        <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
                            <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                        </svg>
                    </button>
                </div>

                <div ref="categoryContainer" class="site-header__browse site-header__category">
                    <button
                        ref="categoryTrigger"
                        type="button"
                        class="site-header__link site-header__browse-trigger site-header__category-trigger"
                        :class="{ 'is-active': isCategoryOpen || isCategoryNavActive }"
                        :aria-expanded="isCategoryOpen"
                        aria-haspopup="listbox"
                        @click.stop="toggleCategoryDropdown"
                    >
                        {{ activeCategoryLabel }}
                        <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
                            <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                        </svg>
                    </button>
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
                <ExtensionPrompt v-if="isNetflixMode" />

                <button
                    v-if="showModeSwitch && isNetflixMode"
                    type="button"
                    class="site-header__mode-btn"
                    @click="toggleContentMode"
                >
                    {{ modeLabel }}
                </button>

                <button
                    class="site-header__search site-header__search--compact"
                    type="button"
                    :aria-label="isNetflixMode ? 'Open search' : `Open search (${modKey}K)`"
                    :title="isNetflixMode ? 'Search' : `Search (${modKey}K)`"
                    @click="openPalette"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                </button>

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

                    <button
                        v-if="showModeSwitch"
                        type="button"
                        class="site-header__mode-btn"
                        @click="toggleContentMode"
                    >
                        {{ modeLabel }}
                    </button>

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

        <Teleport to="body">
            <div
                v-if="isIndustryOpen"
                ref="industryMenuRef"
                class="site-header__browse-menu region-dropdown site-header__floating-menu"
                :style="industryMenuStyle"
                @click.stop
            >
                <div class="region-dropdown__header eyebrow">Industry</div>
                <div class="region-dropdown__list" role="listbox">
                    <button
                        v-for="cat in netflixCatalogues"
                        :key="cat.id"
                        type="button"
                        class="region-dropdown__item"
                        :class="{ 'is-active': netflixCatalogue === cat.id }"
                        role="option"
                        @click="selectMovieIndustry(cat.id)"
                    >
                        <span class="region-dropdown__name">{{ cat.label }}</span>
                        <svg
                            v-if="netflixCatalogue === cat.id"
                            class="region-dropdown__check"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </button>
                </div>
            </div>
            <div
                v-if="isCountryOpen"
                ref="countryMenuRef"
                class="site-header__browse-menu site-header__country-menu region-dropdown site-header__floating-menu"
                :style="countryMenuStyle"
                @click.stop
            >
                <div class="region-dropdown__header eyebrow">Country</div>
                <div class="region-dropdown__list" role="listbox">
                    <button
                        type="button"
                        class="region-dropdown__item"
                        :class="{ 'is-active': !activeExploreCountry }"
                        role="option"
                        @click.stop="clearExploreCountry"
                    >
                        <span class="region-dropdown__name">All Countries</span>
                        <svg
                            v-if="!activeExploreCountry"
                            class="region-dropdown__check"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </button>
                    <button
                        v-for="country in exploreCountries"
                        :key="country.value"
                        type="button"
                        class="region-dropdown__item"
                        :class="{ 'is-active': activeExploreCountry === country.value }"
                        role="option"
                        @click.stop="selectExploreCountry(country)"
                    >
                        <span class="region-dropdown__name">{{ country.name }}</span>
                        <svg
                            v-if="activeExploreCountry === country.value"
                            class="region-dropdown__check"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </button>
                </div>
            </div>
            <div
                v-if="isCategoryOpen"
                ref="categoryMenuRef"
                class="site-header__browse-menu site-header__category-menu region-dropdown site-header__floating-menu"
                :style="categoryMenuStyle"
                @click.stop
            >
                <div class="region-dropdown__header eyebrow">Category</div>
                <div class="region-dropdown__list" role="listbox">
                    <button
                        v-for="cat in exploreCategories"
                        :key="cat.id"
                        type="button"
                        class="region-dropdown__item"
                        :class="{ 'is-active': activeExploreCategory === cat.id }"
                        role="option"
                        @click="selectExploreCategory(cat)"
                    >
                        <span class="region-dropdown__name">{{ cat.title }}</span>
                        <svg
                            v-if="activeExploreCategory === cat.id"
                            class="region-dropdown__check"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </Teleport>

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
                    <p class="site-header__drawer-section eyebrow">Industry</p>
                    <button
                        v-for="cat in netflixCatalogues"
                        :key="cat.id"
                        type="button"
                        class="site-header__drawer-link"
                        :class="{ 'is-active': netflixCatalogue === cat.id }"
                        @click="selectMovieIndustry(cat.id); drawerOpen = false"
                    >
                        <span class="site-header__drawer-label">{{ cat.label }}</span>
                    </button>

                    <p class="site-header__drawer-section eyebrow">Country</p>
                    <button
                        type="button"
                        class="site-header__drawer-link"
                        :class="{ 'is-active': !activeExploreCountry }"
                        @click="clearExploreCountry(); drawerOpen = false"
                    >
                        <span class="site-header__drawer-label">All Countries</span>
                    </button>
                    <button
                        v-for="country in exploreCountries"
                        :key="country.value"
                        type="button"
                        class="site-header__drawer-link"
                        :class="{ 'is-active': activeExploreCountry === country.value }"
                        @click="selectExploreCountry(country); drawerOpen = false"
                    >
                        <span class="site-header__drawer-label">{{ country.name }}</span>
                    </button>

                    <p class="site-header__drawer-section eyebrow">Category</p>
                    <button
                        v-for="cat in exploreCategories"
                        :key="cat.id"
                        type="button"
                        class="site-header__drawer-link"
                        :class="{ 'is-active': activeExploreCategory === cat.id }"
                        @click="selectExploreCategory(cat); drawerOpen = false"
                    >
                        <span class="site-header__drawer-label">{{ cat.title }}</span>
                    </button>

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
                        class="site-header__drawer-link"
                        @click="toggleContentMode(); drawerOpen = false"
                    >
                        <span class="site-header__drawer-label">{{ modeLabel }}</span>
                    </button>

                    <a href="/party/" class="site-header__drawer-link" @click="drawerOpen = false">
                        <span class="eyebrow site-header__drawer-num">✦</span>
                        <span class="site-header__drawer-label">Watch Together</span>
                    </a>
                </template>

                <template v-else>
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
                </template>
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
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LmDrawer from '../primitives/Drawer.vue';
import AuthModal from './AuthModal.vue';
import SettingsModal from './SettingsModal.vue';
import ExtensionPrompt from './ExtensionPrompt.vue';

import { openPalette } from '../../composables/useCommandPalette';
import { getCurrentUser, logoutUser } from '../../lib/auth';
import { getSettings, REGIONS } from '../../composables/useSettings';
import { getContentMode } from '../../composables/useContentMode';
import {
    getCatalogueOption,
    getNetflixCatalogue,
    NETFLIX_CATALOGUES,
    netflixMovieBrowseRow
} from '../../composables/useNetflixCatalogue';
import { netflixBrowsePath, isNetflixGenreBrowsePage } from '../../composables/useNetflixRails';
import { getNetflixLanguage } from '../../composables/useNetflixLanguage';
import { prefetchNetflixBrowseRoute } from '../../composables/useNetflixBrowsePrefetch';
import { nfDebug } from '../../composables/useNetflixDebug';
import {
    activeExploreCategoryId,
    activeExploreCountryId,
    exploreMediaTypeFromPath,
    NETMIRROR_EXPLORE_CATEGORIES,
    NETMIRROR_EXPLORE_COUNTRIES,
    netflixExploreCountryPath,
    NETFLIX_ANIMATED_EXPLORE_PATH,
    NETFLIX_MOVIE_EXPLORE_PATH,
    NETFLIX_TV_EXPLORE_PATH,
    netflixExplorePath,
    resolveExplorePathMediaType,
    type NetmirrorExploreCategory,
    type NetmirrorExploreCountry,
    type NetmirrorExploreMediaType
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

type FloatingMenuStyle = Record<string, string>;

function positionFloatingMenu(trigger: HTMLElement | null, minWidth = 220): FloatingMenuStyle {
    if (!trigger || typeof window === 'undefined') return {};
    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 8;
    const menuWidth = minWidth;

    // Align menu under trigger; clamp so it stays on-screen.
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - viewportPadding) {
        left = Math.max(viewportPadding, rect.right - menuWidth);
    }
    left = Math.max(viewportPadding, left);

    const top = rect.bottom + gap;

    return {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        right: 'unset',
        bottom: 'unset',
        minWidth: `${minWidth}px`,
        zIndex: '62'
    };
}

function containsNode(root: HTMLElement | null | undefined, target: Node) {
    return Boolean(root && root.contains(target));
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
    components: { LmDrawer, AuthModal, SettingsModal, ExtensionPrompt },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { contentMode, setContentMode, isChosen } = getContentMode();
        const { catalogue: netflixCatalogue, setCatalogue: setNetflixCatalogue } =
            getNetflixCatalogue();
        const isNetflixMode = computed(() => contentMode.value === 'netflix');
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

        const industryContainer = ref<HTMLElement | null>(null);
        const industryTrigger = ref<HTMLElement | null>(null);
        const industryMenuRef = ref<HTMLElement | null>(null);
        const industryMenuStyle = ref<FloatingMenuStyle>({});
        const isIndustryOpen = ref(false);
        const countryContainer = ref<HTMLElement | null>(null);
        const countryTrigger = ref<HTMLElement | null>(null);
        const countryMenuRef = ref<HTMLElement | null>(null);
        const countryMenuStyle = ref<FloatingMenuStyle>({});
        const isCountryOpen = ref(false);
        const categoryContainer = ref<HTMLElement | null>(null);
        const categoryTrigger = ref<HTMLElement | null>(null);
        const categoryMenuRef = ref<HTMLElement | null>(null);
        const categoryMenuStyle = ref<FloatingMenuStyle>({});
        const isCategoryOpen = ref(false);
        const exploreCountries = NETMIRROR_EXPLORE_COUNTRIES;
        const exploreCategories = NETMIRROR_EXPLORE_CATEGORIES;

        const closeAllBrowseMenus = () => {
            isIndustryOpen.value = false;
            isCountryOpen.value = false;
            isCategoryOpen.value = false;
        };

        const syncFloatingMenuPosition = async (
            open: boolean,
            trigger: HTMLElement | null,
            styleRef: { value: FloatingMenuStyle },
            minWidth = 220
        ) => {
            if (!open || !trigger) return;
            await nextTick();
            styleRef.value = positionFloatingMenu(trigger, minWidth);
            requestAnimationFrame(() => {
                styleRef.value = positionFloatingMenu(trigger, minWidth);
            });
        };

        const syncOpenFloatingMenus = () => {
            if (isIndustryOpen.value) {
                industryMenuStyle.value = positionFloatingMenu(industryTrigger.value, 200);
            }
            if (isCountryOpen.value) {
                countryMenuStyle.value = positionFloatingMenu(countryTrigger.value);
            }
            if (isCategoryOpen.value) {
                categoryMenuStyle.value = positionFloatingMenu(categoryTrigger.value);
            }
        };

        const resolveExploreMediaTypeForNav = (): NetmirrorExploreMediaType => {
            if (route.path.startsWith('/nf/explore')) {
                return exploreMediaTypeFromPath(route.path);
            }
            const { isTvSection, isMovieSection } = netflixBrowseContext.value;
            if (isTvSection) return 'tv';
            if (isMovieSection) return 'movie';
            return 'all';
        };

        const activeIndustryLabel = computed(
            () => getCatalogueOption(netflixCatalogue.value).label
        );

        const activeExploreCountry = computed(() => {
            if (!route.path.startsWith('/nf/explore')) return '';
            return activeExploreCountryId(
                route.query as Record<string, string | string[] | null | undefined>
            );
        });

        const activeCountryLabel = computed(() => {
            if (activeExploreCountry.value) {
                const match = exploreCountries.find(
                    (row) => row.value === activeExploreCountry.value
                );
                return match?.name || activeExploreCountry.value;
            }
            return 'Country';
        });

        const isCountryNavActive = computed(
            () => route.path.startsWith('/nf/explore') && Boolean(activeExploreCountry.value)
        );

        const activeExploreCategory = computed(() => {
            if (!route.path.startsWith('/nf/explore')) return '';
            return activeExploreCategoryId(
                route.query as Record<string, string | string[] | null | undefined>
            );
        });

        const activeCategoryLabel = computed(() => {
            if (activeExploreCategory.value) {
                const match = exploreCategories.find(
                    (cat) => cat.id === activeExploreCategory.value
                );
                return match?.title || 'Category';
            }
            return 'Category';
        });

        const isCategoryNavActive = computed(
            () => route.path.startsWith('/nf/explore') && Boolean(activeExploreCategory.value)
        );

        const toggleIndustryDropdown = async (e: Event) => {
            e.stopPropagation();
            const opening = !isIndustryOpen.value;
            const trigger = (e.currentTarget as HTMLElement | null) ?? industryTrigger.value;
            closeAllBrowseMenus();
            if (opening) {
                isIndustryOpen.value = true;
                await syncFloatingMenuPosition(true, trigger, industryMenuStyle, 200);
            }
        };

        const closeIndustryDropdown = () => {
            isIndustryOpen.value = false;
        };

        const toggleCountryDropdown = async (e: Event) => {
            e.stopPropagation();
            const opening = !isCountryOpen.value;
            const trigger = (e.currentTarget as HTMLElement | null) ?? countryTrigger.value;
            closeAllBrowseMenus();
            if (opening) {
                isCountryOpen.value = true;
                await syncFloatingMenuPosition(true, trigger, countryMenuStyle);
            }
        };

        const closeCountryDropdown = () => {
            isCountryOpen.value = false;
        };

        const toggleCategoryDropdown = async (e: Event) => {
            e.stopPropagation();
            const opening = !isCategoryOpen.value;
            const trigger = (e.currentTarget as HTMLElement | null) ?? categoryTrigger.value;
            closeAllBrowseMenus();
            if (opening) {
                isCategoryOpen.value = true;
                await syncFloatingMenuPosition(true, trigger, categoryMenuStyle);
            }
        };

        const closeCategoryDropdown = () => {
            isCategoryOpen.value = false;
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

            const isTvSection =
                path.startsWith('/nf/explore/tv') ||
                (browseMatch && PRIMARY_TV_ROW_IDS.has(browseRow)) ||
                path.startsWith('/nf/tv/') ||
                path.includes('/stream/nf/tv/') ||
                (path === '/nf/categories' && route.query.type === 'tv') ||
                (isNetflixGenreBrowsePage(route.params.row as string) && route.query.type === 'tv');

            const isMovieSection =
                path.startsWith('/nf/explore/movie') ||
                (browseMatch && PRIMARY_MOVIE_ROW_IDS.has(browseRow)) ||
                path.startsWith('/nf/movie/') ||
                path.includes('/stream/nf/movie/') ||
                (path === '/nf/categories' && route.query.type === 'movie') ||
                (isNetflixGenreBrowsePage(route.params.row as string) && route.query.type === 'movie');

            return { path, isTvSection, isMovieSection };
        });

        const isMovieSectionActive = computed(() => netflixBrowseContext.value.isMovieSection);

        const netflixNavLeading = computed(() => {
            const { path, isTvSection } = netflixBrowseContext.value;

            return [
                {
                    label: 'Home',
                    path: '/',
                    isActive: () => path === '/'
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

            return [
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

        const selectMovieIndustry = async (id: string) => {
            closeIndustryDropdown();
            setNetflixCatalogue(id);
            const destination = netflixBrowsePath(id, netflixMovieBrowseRow(id));
            try {
                await router.push(destination);
            } catch {
                // duplicate navigation
            }
            scrollNavToTop();
        };

        const clearExploreCountry = async () => {
            closeCountryDropdown();
            const mediaType = resolveExploreMediaTypeForNav();
            const destination = `/nf/explore/${mediaType}`;
            try {
                await router.push(destination);
            } catch {
                // duplicate navigation
            }
            scrollNavToTop();
        };

        const selectExploreCountry = async (country: NetmirrorExploreCountry) => {
            closeCountryDropdown();
            const destination = netflixExploreCountryPath(
                country,
                resolveExploreMediaTypeForNav()
            );
            try {
                await router.push(destination);
            } catch {
                // duplicate navigation
            }
            scrollNavToTop();
        };

        const selectExploreCategory = async (category: NetmirrorExploreCategory) => {
            closeCategoryDropdown();
            const routeMediaType = resolveExploreMediaTypeForNav();
            const mediaType =
                routeMediaType === 'movie' || routeMediaType === 'tv'
                    ? resolveExplorePathMediaType(category, routeMediaType)
                    : undefined;
            const destination = netflixExplorePath(
                category,
                mediaType ? { mediaType } : {}
            );
            try {
                await router.push(destination);
            } catch {
                // duplicate navigation
            }
            scrollNavToTop();
        };

        const navigateNetflixNav = async (item: NetflixNavItem) => {
            const destination = parseNavDestination(item.path);
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

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            if (regionContainer.value && !regionContainer.value.contains(target)) {
                closeRegionDropdown();
            }

            if (
                isIndustryOpen.value &&
                !containsNode(industryContainer.value, target) &&
                !containsNode(industryMenuRef.value, target)
            ) {
                closeIndustryDropdown();
            }

            if (
                isCountryOpen.value &&
                !containsNode(countryContainer.value, target) &&
                !containsNode(countryMenuRef.value, target)
            ) {
                closeCountryDropdown();
            }

            if (
                isCategoryOpen.value &&
                !containsNode(categoryContainer.value, target) &&
                !containsNode(categoryMenuRef.value, target)
            ) {
                closeCategoryDropdown();
            }
        };

        const handleViewportResize = () => {
            syncOpenFloatingMenus();
        };

        const showModeSwitch = computed(() => isChosen());

        const modeLabel = computed(() =>
            contentMode.value === 'netflix' ? 'Switch to Global' : 'Switch to Netflix'
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
            window.addEventListener('scroll', syncOpenFloatingMenus, { passive: true, capture: true });
            window.addEventListener('resize', handleViewportResize, { passive: true });
            updateCurrentUser();
            window.addEventListener('movora_auth_change', updateCurrentUser);
            document.addEventListener('click', handleClickOutside);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('scroll', syncOpenFloatingMenus, true);
            window.removeEventListener('resize', handleViewportResize);
            window.removeEventListener('movora_auth_change', updateCurrentUser);
            document.removeEventListener('click', handleClickOutside);
            closeAllBrowseMenus();
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
            getFlagEmoji,

            showModeSwitch,
            modeLabel,
            toggleContentMode,

            isNetflixMode,
            netflixCatalogues: NETFLIX_CATALOGUES,
            netflixCatalogue,
            activeIndustryLabel,
            netflixNavLeading,
            netflixNavTrailing,
            isMovieSectionActive,
            industryContainer,
            industryTrigger,
            industryMenuRef,
            isIndustryOpen,
            industryMenuStyle,
            toggleIndustryDropdown,
            countryContainer,
            countryTrigger,
            countryMenuRef,
            isCountryOpen,
            countryMenuStyle,
            exploreCountries,
            activeExploreCountry,
            activeCountryLabel,
            isCountryNavActive,
            toggleCountryDropdown,
            clearExploreCountry,
            selectExploreCountry,
            categoryContainer,
            categoryTrigger,
            categoryMenuRef,
            isCategoryOpen,
            categoryMenuStyle,
            exploreCategories,
            activeExploreCategory,
            activeCategoryLabel,
            isCategoryNavActive,
            toggleCategoryDropdown,
            selectExploreCategory,
            navigateToMovies,
            selectMovieIndustry,
            navigateNetflixNav,
            prefetchNetflixNav
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

        &--catalogues {
            flex: 1;
            min-width: 0;
            display: flex;
            align-items: center;
            gap: var(--s-1);
            overflow: visible;

            .site-header__link {
                flex-shrink: 0;
                padding: var(--s-2) var(--s-3);
                font-size: 0.82rem;
            }
        }
    }

    &__nav-scroll {
        display: inline-flex;
        align-items: center;
        gap: var(--s-1);
        min-width: 0;
        overflow-x: auto;
        flex-wrap: nowrap;
        scrollbar-width: none;
        padding-bottom: 2px;

        &::-webkit-scrollbar {
            display: none;
        }

        &--tail {
            margin-left: auto;
        }
    }

    &__link {
        position: relative;
        padding: var(--s-2) var(--s-4);
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

    &__search--compact {
        justify-content: center;
        min-width: 0;
        width: 36px;
        height: 36px;
        padding: 0;

        svg {
            width: 17px;
            height: 17px;
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
