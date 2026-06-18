import empty_movie_state from '../assets/img/empty-movie-state.png';
import { Movie } from '../composables/useHighlights';
import { MovieDetails } from '../composables/useMovies';
import { TVShowDetails } from '../composables/useTvShows';

// In production, route all images through our own Cloudflare proxy (/api/img)
// so ISPs that block image.tmdb.org or wsrv.nl can't break the site.
// In local dev, fall back directly to image.tmdb.org.
const IS_DEV = import.meta.env.DEV;
const TMDB_BASE = 'https://image.tmdb.org/t/p/';

export type WebImageSize = 'small' | 'medium' | 'large' | 'xlarge' | 'hero';

const selectSize = (size: WebImageSize) => {
    const sizeOptions: Record<WebImageSize, string> = {
        small: 'w780',
        medium: 'w1280',
        large: 'w1280',
        xlarge: 'original',
        hero: 'original',
    };
    return sizeOptions[size] || sizeOptions.medium;
};

/**
 * m.moovie.fun has its own /api/img function (mobile-site/functions/api/img.ts)
 * so it can always use a relative path, same as the main domain.
 * This function is kept for any edge case where VITE_IMAGE_PROXY_ORIGIN is set.
 */
export function getImageProxyOrigin(): string {
    if (IS_DEV || typeof location === 'undefined') return '';
    const envOrigin = import.meta.env.VITE_IMAGE_PROXY_ORIGIN;
    if (envOrigin) return String(envOrigin).replace(/\/$/, '');
    return '';
}

/**
 * Builds a proxied image URL that goes through moovie.fun/api/img
 * so ISPs blocking image.tmdb.org see only moovie.fun traffic.
 */
export function buildProxiedImageUrl(tmdbPath: string): string {
    if (IS_DEV) {
        return `${TMDB_BASE}${tmdbPath}`;
    }
    const path = tmdbPath.startsWith('/') ? tmdbPath : `/${tmdbPath}`;
    const origin = getImageProxyOrigin();
    return `${origin}/api/img?path=${encodeURIComponent(path)}`;
}

const proxyUrl = buildProxiedImageUrl;

export const useWebImage = (url: string, size: WebImageSize = 'medium') => {
    let resolvedUrl = url;
    if (url.startsWith('//')) {
        resolvedUrl = `https:${url}`;
    }

    // Full TMDB URLs still need proxying; other CDNs (e.g. AniList) pass through.
    if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
        if (resolvedUrl.includes('image.tmdb.org')) {
            const match = resolvedUrl.match(/\/t\/p\/(.+)/);
            if (match) return buildProxiedImageUrl(match[1]);
        }
        return resolvedUrl;
    }

    const imgSize = selectSize(size);
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    return proxyUrl(`${imgSize}/${cleanUrl}`);
};

export const getMovieImageUrl = (data: Movie | MovieDetails | TVShowDetails) => {
    const cleanBackdrop = data.backdrop_path
        ? (data.backdrop_path.startsWith('/') ? data.backdrop_path.slice(1) : data.backdrop_path)
        : null;
    const cleanPoster = data.poster_path
        ? (data.poster_path.startsWith('/') ? data.poster_path.slice(1) : data.poster_path)
        : null;

    const backdrop = cleanBackdrop === null
        ? empty_movie_state
        : proxyUrl(`original/${cleanBackdrop}`);

    const poster = cleanPoster === null
        ? empty_movie_state
        : proxyUrl(`original/${cleanPoster}`);

    return { backdrop, poster } as const;
}
