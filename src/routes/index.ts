import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import Movie from '../pages/Movie.vue'
import TVShow from '../pages/TVShow.vue'
import AnimeDetail from '../pages/AnimeDetail.vue'
import Actor from '../pages/Actor.vue'
import StreamMovie from '../pages/StreamMovie.vue'
import StreamTVShow from '../pages/StreamTVShow.vue'
import StreamAnime from '../pages/StreamAnime.vue'
import { useSeo } from '../composables/useSeo'

declare module 'vue-router' {
    interface RouteMeta {
        showInHeader?: boolean,
        title?: string
    }
}


const routes: Array<RouteRecordRaw> = [
    {
        path: '/',
        name: 'Home',
        component: () => import('../pages/Home.vue'),
        meta: {
            showInHeader: true,
            title: 'Home'
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
        name: 'TestNetmirror',
        component: () => import('../pages/TestNetmirror.vue'),
        meta: {
            showInHeader: false,
            hidden: true,
            title: 'Test'
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

router.afterEach((to) => {
    const dynamicRoutes = ['Movie', 'TVShow', 'AnimeDetail', 'Actor', 'StreamMovie', 'StreamTVShow', 'StreamAnime', 'StreamAnimeEpisode'];
    if (to.name && dynamicRoutes.includes(to.name as string)) {
        return;
    }

    if (to.name === 'TestNetmirror') {
        return;
    }

    const title = to.meta.title ? `${to.meta.title} — Moovie` : 'Moovie — Stream Movies, TV Shows & Anime Free';
    const canonical = `https://moovie.fun${to.path}`;
    
    updateSeo({
        title,
        canonical,
        image: 'https://moovie.fun/og-image.png'
    });
});

export { router, routes }