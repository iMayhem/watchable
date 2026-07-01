import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import Movie from '../pages/Movie.vue'
import TVShow from '../pages/TVShow.vue'
import AnimeDetail from '../pages/AnimeDetail.vue'
import Actor from '../pages/Actor.vue'
import StreamMovie from '../pages/StreamMovie.vue'
import StreamTVShow from '../pages/StreamTVShow.vue'
import StreamAnime from '../pages/StreamAnime.vue'
import { useSeo } from '../composables/useSeo'
import { getContentMode, isContentModeChosen } from '../composables/useContentMode'
import { redirectPathForMode } from '../utils/contentModeRoutes'
import { isNetflixGuardActive } from '../utils/netflixGuard'
import { recordDetailReturnPath } from '../composables/useDetailBackNavigation'

declare module 'vue-router' {
    interface RouteMeta {
        showInHeader?: boolean,
        title?: string,
        netflixGuard?: boolean
    }
}


const routes: Array<RouteRecordRaw> = [
    {
        path: '/',
        name: 'Home',
        component: () => import('../pages/HomeShell.vue'),
        meta: {
            showInHeader: true,
            title: 'Home'
        }
    },
    {
        path: '/discover',
        name: 'Discover',
        component: () => import('../pages/Discover.vue'),
        meta: {
            showInHeader: true,
            title: 'Discover'
        }
    },
    {
        path: '/nf/search',
        name: 'NetflixSearch',
        component: () => import('../pages/NetflixSearch.vue'),
        meta: {
            showInHeader: false,
            title: 'Netflix Search',
            netflixGuard: true
        }
    },
    {
        path: '/nf/categories',
        name: 'NetflixCategories',
        component: () => import('../pages/NetflixCategories.vue'),
        meta: {
            showInHeader: false,
            title: 'Netflix Categories',
            netflixGuard: true
        }
    },
    {
        path: '/nf/explore/:mediaType(all|movie|tv|animated)?',
        name: 'NetflixExplore',
        component: () => import('../pages/NetflixExplore.vue'),
        meta: {
            showInHeader: false,
            title: 'Netflix Explore',
            netflixGuard: true
        }
    },
    {
        path: '/nf/browse/:catalogue/:row(exciting-tv|korean-series|top10-tv)',
        redirect: '/nf/explore/tv'
    },
    {
        path: '/nf/browse/:catalogue/:row(blockbuster-movies|top10-movies|korean-movies)',
        redirect: '/nf/explore/movie'
    },
    {
        path: '/nf/browse/:catalogue/:row',
        name: 'NetflixBrowse',
        component: () => import('../pages/NetflixBrowse.vue'),
        meta: {
            showInHeader: false,
            title: 'Netflix Browse',
            netflixGuard: true
        }
    },
    {
        path: '/nf/anime/:id',
        name: 'NetflixAnimeDetail',
        component: () => import('../pages/NetflixPlayRedirect.vue'),
        meta: {
            showInHeader: false,
            title: 'Stream',
            netflixGuard: true
        }
    },
    {
        path: '/nf/:type(movie|tv)/:id',
        name: 'NetflixDetail',
        component: () => import('../pages/NetflixPlayRedirect.vue'),
        meta: {
            showInHeader: false,
            title: 'Stream',
            netflixGuard: true
        }
    },
    {
        path: '/stream/nf/movie/:id',
        name: 'StreamNetflixMovie',
        component: () => import('../pages/StreamNetflix.vue'),
        meta: {
            showInHeader: false,
            title: 'Stream',
            netflixGuard: true
        }
    },
    {
        path: '/stream/nf/tv/:id/season/:season/episode/:episode',
        name: 'StreamNetflixTV',
        component: () => import('../pages/StreamNetflix.vue'),
        meta: {
            showInHeader: false,
            title: 'Stream',
            netflixGuard: true
        }
    },
    {
        path: '/embed/nf/movie/:id',
        name: 'EmbedNetflixMovie',
        component: () => import('../pages/StreamNetflix.vue'),
        meta: {
            showInHeader: false,
            title: 'Stream',
            partyEmbed: true,
            bareLayout: true,
            netflixGuard: true
        }
    },
    {
        path: '/embed/nf/tv/:id/season/:season/episode/:episode',
        name: 'EmbedNetflixTV',
        component: () => import('../pages/StreamNetflix.vue'),
        meta: {
            showInHeader: false,
            title: 'Stream',
            partyEmbed: true,
            bareLayout: true,
            netflixGuard: true
        }
    },
    {
        path: '/movies',
        name: 'Movies',
        component: () => import('../pages/Movies.vue'),
        meta: {
            showInHeader: true,
            title: 'Movies'
        }
    },
    {
        path: '/tv-shows',
        alias: '/tv',
        name: 'TVShows',
        component: () => import('../pages/TVShows.vue'),
        meta: {
            showInHeader: true,
            title: 'TV Shows'
        }
    },
    {
        path: '/anime',
        name: 'Anime',
        component: () => import('../pages/Anime.vue'),
        meta: {
            showInHeader: true,
            title: 'Anime'
        }
    },
    {
        'path': '/actors',
        'name': 'Actors',
        'component': () => import('../pages/Actors.vue'),
        meta: {
            showInHeader: true,
            title: 'Actors'
        }
    },
    {
        'path': '/movie/:id',
        'name': 'Movie',
        'component': Movie,
        meta: {
            showInHeader: false,
            title: 'Movie'
        }
    },
    {
        'path': '/tv-show/:id',
        alias: '/tv/:id',
        'name': 'TVShow',
        'component': TVShow,
        meta: {
            showInHeader: false,
            title: 'TV Show'
        }
    },
    {
        'path': '/actor/:id',
        'name': 'Actor',
        'component': Actor,
        meta: {
            showInHeader: false,
            title: 'Actor'
        }
    },
    {
        'path': '/search',
        'name': 'Search',
        'component': () => import('../pages/Search.vue'),
        meta: {
            showInHeader: true,
            title: 'Search'
        }
    },
    {
        path: '/watchlist',
        name: 'Watchlist',
        component: () => import('../pages/Watchlist.vue'),
        meta: {
            showInHeader: true,
            title: 'Watchlist'
        }
    },
    {
        path: '/discuss',
        name: 'Discuss',
        component: () => import('../pages/Discuss.vue'),
        meta: {
            showInHeader: true,
            title: 'Discuss'
        }
    },
    {
        path: '/upcoming',
        name: 'Upcoming',
        component: () => import('../pages/Upcoming.vue'),
        meta: {
            showInHeader: true,
            title: 'Upcoming'
        }
    },
    {
        path: '/livetv',
        name: 'LiveTV',
        component: () => import('../pages/LiveTV.vue'),
        meta: {
            showInHeader: true,
            title: 'Live TV'
        }
    },
    {
        path: '/help',
        name: 'Help',
        component: () => import('../pages/Help.vue'),
        meta: {
            showInHeader: true,
            title: 'Help'
        }
    },
    {
        path: '/status',
        name: 'Status',
        component: () => import('../pages/Status.vue'),
        meta: {
            showInHeader: false,
            title: 'Status'
        }
    },
    {
        'path': '/stream/movie/:id',
        alias: '/watch/movie/:id',
        'name': 'StreamMovie',
        'component': StreamMovie,
        meta: {
            showInHeader: false,
            title: 'Stream Movie'
        }
    },
    {
        'path': '/stream/tv-show/:id/season/:season/episode/:episode',
        alias: '/watch/tv/:id/:season/:episode',
        'name': 'StreamTVShow',
        'component': StreamTVShow,
        meta: {
            showInHeader: false,
            title: 'Stream TV Show'
        }
    },
    {
        'path': '/anime/:id',
        'name': 'AnimeDetail',
        'component': AnimeDetail,
        meta: {
            showInHeader: false,
            title: 'Anime Detail'
        }
    },
    {
        'path': '/stream/anime/:id',
        alias: '/watch/anime/:id',
        'name': 'StreamAnime',
        'component': StreamAnime,
        meta: {
            showInHeader: false,
            title: 'Stream Anime'
        }
    },
    {
        'path': '/stream/anime/:id/episode/:episode',
        alias: '/watch/anime/:id/:episode',
        'name': 'StreamAnimeEpisode',
        'component': StreamAnime,
        meta: {
            showInHeader: false,
            title: 'Stream Anime Episode'
        }
    },
    {
        path: '/test',
        name: 'TestMoovieStream',
        component: () => import('../pages/TestMoovieStream.vue'),
        meta: {
            showInHeader: false,
            hidden: true,
            title: 'Test'
        }
    },
    {
        path: '/testing',
        name: 'ScraperTesting',
        component: () => import('../pages/ScraperTesting.vue'),
        meta: {
            showInHeader: false,
            hidden: true,
            title: 'Scraper Testing'
        }
    },
    {
        path: '/scrape',
        name: 'Scrape',
        component: () => import('../pages/Scrape.vue'),
        meta: {
            showInHeader: false,
            hidden: true,
            title: 'Scraper Lab',
            bareLayout: true
        }
    },
    {
        path: '/moovie',
        name: 'MooviePlayer',
        component: () => import('../pages/MooviePlayer.vue'),
        meta: {
            showInHeader: false,
            hidden: true,
            title: 'moovie Player',
            bareLayout: true
        }
    },
    {
        path: '/party',
        name: 'Party',
        component: () => import('../pages/Party.vue'),
        meta: {
            showInHeader: false,
            title: 'Watch Together'
        }
    },
    {
        path: '/admin',
        name: 'Admin',
        component: () => import('../pages/Admin.vue'),
        meta: {
            showInHeader: false,
            title: 'Admin',
            bareLayout: true
        }
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('../pages/NotFound.vue'),
        meta: {
            showInHeader: false,
            title: 'Not Found'
        }
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) return savedPosition;
        // Back from title detail → restore catalogue browse / home scroll.
        if (
            (from.name === 'Movie' ||
                from.name === 'TVShow' ||
                from.name === 'AnimeDetail') &&
            (to.name === 'NetflixBrowse' ||
                to.name === 'Home' ||
                to.name === 'NetflixSearch' ||
                to.name === 'Movies' ||
                to.name === 'TVShows' ||
                to.name === 'Anime')
        ) {
            return false;
        }
        if (
            to.params.id &&
            from.params.id &&
            to.params.id === from.params.id &&
            (
                (to.name === 'StreamTVShow' && from.name === 'StreamTVShow') ||
                ((to.name === 'StreamAnime' || to.name === 'StreamAnimeEpisode') &&
                 (from.name === 'StreamAnime' || from.name === 'StreamAnimeEpisode'))
            )
        ) {
            return false;
        }
        return { top: 0, left: 0 };
    }
});

const { updateSeo } = useSeo();

router.beforeEach((to, from, next) => {
    recordDetailReturnPath(from, to);

    if (!isContentModeChosen()) {
        next();
        return;
    }

    const mode = getContentMode().isNetflix() ? 'netflix' : 'global';
    const redirect = redirectPathForMode(to.path, mode);
    if (redirect && redirect !== to.path) {
        next({ path: redirect, query: to.query, hash: to.hash, replace: true });
        return;
    }

    next();
});

if (typeof window !== 'undefined') {
    window.addEventListener('movora_content_mode_change', () => {
        if (!isContentModeChosen()) return;
        const mode = getContentMode().isNetflix() ? 'netflix' : 'global';
        const current = router.currentRoute.value;
        const redirect = redirectPathForMode(current.path, mode);
        if (redirect && redirect !== current.path) {
            router.replace({ path: redirect, query: current.query, hash: current.hash });
        }
    });
}

router.afterEach((to) => {
    import('../composables/useBotProtection').then(({ reevaluateBotProtection }) => {
        reevaluateBotProtection();
    });

    const dynamicRoutes = ['Movie', 'TVShow', 'AnimeDetail', 'Actor', 'StreamMovie', 'StreamTVShow', 'StreamAnime', 'StreamAnimeEpisode', 'NetflixDetail', 'NetflixAnimeDetail', 'StreamNetflixMovie', 'StreamNetflixTV'];
    if (to.name && dynamicRoutes.includes(to.name as string)) {
        return;
    }

    if (to.name === 'TestMoovieStream') {
        return;
    }

    const netflixGuarded =
        Boolean(to.meta.netflixGuard) || isNetflixGuardActive(to.path);
    const title = to.meta.title ? `${to.meta.title} — Moovie` : 'Moovie — Stream Movies, TV Shows & Anime Free';
    const canonical = `https://moovie.fun${to.path}`;

    updateSeo({
        title,
        canonical,
        image: 'https://moovie.fun/og-image.png',
        robots: netflixGuarded ? 'noindex, nofollow' : 'index, follow'
    });
});

export { router, routes }