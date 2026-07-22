import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Movie from './pages/Movie.vue';
import TVShow from './pages/TVShow.vue';
import AnimeDetail from './pages/AnimeDetail.vue';
import Actor from './pages/Actor.vue';
import { useSeo } from './composables/useSeo';
import { enforceMobileGlobalMode, isNetflixPath, mobileSafePath } from './utils/mobileGlobalOnly';
import { recordDetailReturnPath } from '@/composables/useDetailBackNavigation';

declare module 'vue-router' {
    interface RouteMeta {
        title?: string;
        bareLayout?: boolean;
    }
}

const routes: Array<RouteRecordRaw> = [
    {
        path: '/nf/:pathMatch(.*)*',
        redirect: '/'
    },
    {
        path: '/stream/nf/:pathMatch(.*)*',
        redirect: '/'
    },
    {
        path: '/embed/nf/:pathMatch(.*)*',
        redirect: '/'
    },
    {
        path: '/',
        name: 'Home',
        component: () => import('./pages/Home.vue'),
        meta: { title: 'Home' }
    },
    {
        path: '/movies',
        name: 'Movies',
        component: () => import('./pages/Movies.vue'),
        meta: { title: 'Movies' }
    },
    {
        path: '/tv-shows',
        alias: '/tv',
        name: 'TVShows',
        component: () => import('./pages/TVShows.vue'),
        meta: { title: 'TV Shows' }
    },
    {
        path: '/anime',
        name: 'Anime',
        component: () => import('./pages/Anime.vue'),
        meta: { title: 'Anime' }
    },
    {
        path: '/search',
        name: 'Search',
        component: () => import('./pages/Search.vue'),
        meta: { title: 'Search' }
    },
    {
        path: '/watchlist',
        name: 'Watchlist',
        component: () => import('./pages/Watchlist.vue'),
        meta: { title: 'Watchlist' }
    },
    {
        path: '/actors',
        name: 'Actors',
        component: () => import('./pages/Actors.vue'),
        meta: { title: 'Actors' }
    },
    {
        path: '/more',
        name: 'More',
        component: () => import('./pages/More.vue'),
        meta: { title: 'More' }
    },
    {
        path: '/discuss',
        name: 'Discuss',
        component: () => import('./pages/Discuss.vue'),
        meta: { title: 'Discuss' }
    },
    {
        path: '/upcoming',
        name: 'Upcoming',
        component: () => import('./pages/Upcoming.vue'),
        meta: { title: 'Upcoming' }
    },
    {
        path: '/livetv',
        name: 'LiveTV',
        component: () => import('./pages/LiveTV.vue'),
        meta: { title: 'Live TV' }
    },

    {
        path: '/status',
        name: 'Status',
        component: () => import('./pages/Status.vue'),
        meta: { title: 'Status' }
    },
    {
        path: '/discover',
        name: 'Discover',
        component: () => import('./pages/Discover.vue'),
        meta: { title: 'Discover' }
    },
    {
        path: '/movie/:id',
        name: 'Movie',
        component: Movie,
        meta: { title: 'Movie' }
    },
    {
        path: '/tv-show/:id',
        alias: '/tv/:id',
        name: 'TVShow',
        component: TVShow,
        meta: { title: 'TV Show' }
    },
    {
        path: '/actor/:id',
        name: 'Actor',
        component: Actor,
        meta: { title: 'Actor' }
    },
    {
        path: '/anime/:id',
        name: 'AnimeDetail',
        component: AnimeDetail,
        meta: { title: 'Anime' }
    },
    {
        path: '/stream/movie/:id',
        alias: '/watch/movie/:id',
        name: 'StreamMovie',
        component: () => import('./pages/StreamMovie.vue'),
        meta: { title: 'Watch' }
    },
    {
        path: '/stream/tv-show/:id/season/:season/episode/:episode',
        alias: '/watch/tv/:id/:season/:episode',
        name: 'StreamTVShow',
        component: () => import('./pages/StreamTVShow.vue'),
        meta: { title: 'Watch' }
    },
    {
        path: '/embed/movie/:id',
        alias: '/embed/watch/movie/:id',
        name: 'EmbedMovie',
        component: () => import('./pages/StreamMovie.vue'),
        meta: {
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
        component: () => import('./pages/StreamTVShow.vue'),
        meta: {
            title: 'Embed TV Show',
            bareLayout: true
        }
    },
    {
        path: '/stream/anime/:id',
        alias: '/watch/anime/:id',
        name: 'StreamAnime',
        component: () => import('./pages/StreamAnime.vue'),
        meta: { title: 'Watch Anime' }
    },
    {
        path: '/stream/anime/:id/episode/:episode',
        alias: '/watch/anime/:id/:episode',
        name: 'StreamAnimeEpisode',
        component: () => import('./pages/StreamAnime.vue'),
        meta: { title: 'Watch Anime' }
    },
    {
        path: '/party',
        name: 'Party',
        component: () => import('./pages/Party.vue'),
        meta: { title: 'Watch Together', bareLayout: true }
    },
    {
        path: '/admin',
        name: 'Admin',
        component: () => import('./pages/Admin.vue'),
        meta: { title: 'Admin', bareLayout: true }
    },
    {
        path: '/settings',
        name: 'Settings',
        component: () => import('./pages/Settings.vue'),
        meta: { title: 'Settings' }
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('./pages/NotFound.vue'),
        meta: { title: 'Not Found' }
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(_to, _from, savedPosition) {
        if (savedPosition) return savedPosition;
        return { top: 0, left: 0 };
    }
});

router.beforeEach((to, from) => {
    recordDetailReturnPath(from, to);
    enforceMobileGlobalMode();
    if (isNetflixPath(to.path)) {
        return mobileSafePath(to.path);
    }
});

const { updateSeo } = useSeo();

router.afterEach((to) => {
    const dynamicRoutes = ['Movie', 'TVShow', 'AnimeDetail', 'Actor', 'StreamMovie', 'StreamTVShow', 'StreamAnime', 'StreamAnimeEpisode'];
    if (to.name && dynamicRoutes.includes(to.name as string)) {
        return;
    }

    const title = to.meta.title ? `${to.meta.title} — Moovie` : 'Moovie — Stream Movies, TV Shows & Anime Free';
    const canonical = `https://m.moovie.fun${to.path}`;
    
    updateSeo({
        title,
        canonical,
        image: 'https://m.moovie.fun/og-image.png'
    });
});

export { router, routes };
