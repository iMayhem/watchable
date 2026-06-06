import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: Array<RouteRecordRaw> = [
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
        path: '/movie/:id',
        name: 'Movie',
        component: () => import('./pages/Movie.vue'),
        meta: { title: 'Movie' }
    },
    {
        path: '/tv-show/:id',
        alias: '/tv/:id',
        name: 'TVShow',
        component: () => import('./pages/TVShow.vue'),
        meta: { title: 'TV Show' }
    },
    {
        path: '/actor/:id',
        name: 'Actor',
        component: () => import('./pages/Actor.vue'),
        meta: { title: 'Actor' }
    },
    {
        path: '/anime/:id',
        name: 'AnimeDetail',
        component: () => import('./pages/AnimeDetail.vue'),
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

router.beforeEach((to, _from, next) => {
    if (to.meta.title) {
        document.title = `${to.meta.title} — Moovie`;
    }
    next();
});

export { router, routes };
