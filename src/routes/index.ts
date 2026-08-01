import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import Movies from '../pages/Movies.vue'
import TVShows from '../pages/TVShows.vue'
import Anime from '../pages/Anime.vue'
import Discover from '../pages/Discover.vue'
import Search from '../pages/Search.vue'
import Movie from '../pages/Movie.vue'
import TVShow from '../pages/TVShow.vue'
import AnimeDetail from '../pages/AnimeDetail.vue'
import Actor from '../pages/Actor.vue'
import StreamMovie from '../pages/StreamMovie.vue'
import StreamTVShow from '../pages/StreamTVShow.vue'
import StreamAnime from '../pages/StreamAnime.vue'
import { useSeo } from '../composables/useSeo'
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
        component: Discover,
        meta: {
            showInHeader: true,
            title: 'Discover'
        }
    },
    {
        path: '/settings',
        name: 'Settings',
        component: () => import('../pages/Settings.vue'),
        meta: {
            showInHeader: true,
            title: 'Settings'
        }
    },

    {
        path: '/movies',
        name: 'Movies',
        component: Movies,
        meta: {
            showInHeader: true,
            title: 'Movies'
        }
    },
    {
        path: '/tv-shows',
        alias: '/tv',
        name: 'TVShows',
        component: TVShows,
        meta: {
            showInHeader: true,
            title: 'TV Shows'
        }
    },
    {
        path: '/anime',
        name: 'Anime',
        component: Anime,
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
        'component': Search,
        meta: {
            showInHeader: true,
            title: 'Search'
        }
    },
    {
        path: '/hub',
        name: 'PlayerHub',
        component: () => import('../pages/PlayerHub.vue'),
        meta: {
            showInHeader: true,
            title: 'Hub Player'
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
        path: '/embed/movie/:id',
        alias: '/embed/watch/movie/:id',
        name: 'EmbedMovie',
        component: StreamMovie,
        meta: {
            showInHeader: false,
            title: 'Embed Movie',
            bareLayout: true
        }
    },
    {
        path: '/embed/tv-show/:id/season/:season/episode/:episode',
        alias: [
            '/embed/tv/:id/:season/:episode',
            '/embed/watch/tv/:id/:season/:episode'
        ],
        name: 'EmbedTVShow',
        component: StreamTVShow,
        meta: {
            showInHeader: false,
            title: 'Embed TV Show',
            bareLayout: true
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
            (to.name === 'Home' ||
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
    next();
});

router.afterEach((to) => {
    if (typeof window !== 'undefined' && (window as any).op) {
        try {
            const isMob = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
            (window as any).op('track', 'page_view', {
                path: to.fullPath,
                route_name: String(to.name || ''),
                device: isMob ? 'mobile' : 'desktop',
                platform: isMob ? 'Mobile Web' : 'Desktop Web',
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                screen_width: window.innerWidth,
                screen_height: window.innerHeight
            });
        } catch (e) {}
    }

    import('../composables/useBotProtection').then(({ reevaluateBotProtection }) => {
        reevaluateBotProtection();
    });

    const dynamicRoutes = ['Movie', 'TVShow', 'AnimeDetail', 'Actor', 'StreamMovie', 'StreamTVShow', 'StreamAnime', 'StreamAnimeEpisode'];
    if (to.name && dynamicRoutes.includes(to.name as string)) {
        return;
    }

    const title = to.meta.title ? `${to.meta.title} — Moovie` : 'Moovie — Stream Movies, TV Shows & Anime Free';
    const canonical = `https://moovie.fun${to.path}`;

    updateSeo({
        title,
        canonical,
        image: 'https://moovie.fun/og-image.png',
        robots: 'index, follow'
    });
});

router.onError((error, to) => {
    const isChunkLoadFailed =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.message?.includes('MIME type');

    if (isChunkLoadFailed) {
        if (to?.fullPath) {
            window.location.href = to.fullPath;
        } else {
            window.location.reload();
        }
    }
});

export { router, routes }