import empty_movie_state from '../assets/img/empty-movie-state.png';
import { Movie } from '../composables/useHighlights';
import { MovieDetails } from '../composables/useMovies';
import { TVShowDetails } from '../composables/useTvShows';
import { getSettings } from '../composables/useSettings';

// In production, route all images through our own Cloudflare proxy (/api/img)
// so ISPs that block image.tmdb.org or wsrv.nl can't break the site.
// In local dev, fall back directly to image.tmdb.org.
const IS_DEV = import.meta.env.DEV;
const TMDB_BASE = 'https://image.tmdb.org/t/p/';

export type WebImageSize = 'small' | 'medium' | 'large' | 'xlarge' | 'hero';
export type TmdbImageQuality = 'low' | 'medium' | 'high';

const selectSize = (size: WebImageSize, quality: TmdbImageQuality) => {
    const sizeOptions: Record<WebImageSize, string> = {
        small: 'w342',
        medium: 'w780',
        large: 'w1280',
        xlarge: 'original',
        hero: 'original',
    };
    const lowQuality: Record<WebImageSize, string> = {
        small: 'w185',
        medium: 'w342',
        large: 'w500',
        xlarge: 'w780',
        hero: 'w780',
    };
    const highQuality: Record<WebImageSize, string> = {
        small: 'w780',
        medium: 'w1280',
        large: 'original',
        xlarge: 'original',
        hero: 'original',
    };
    if (quality === 'low') return lowQuality[size] || lowQuality.medium;
    if (quality === 'high') return highQuality[size] || highQuality.medium;
    return sizeOptions[size] || sizeOptions.medium;
};

export function getTmdbImageQuality(): TmdbImageQuality {
    if (typeof window === 'undefined') return 'medium';
    const { tmdbImageQuality } = getSettings();
    return tmdbImageQuality.value || 'medium';
}

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
    const quality = getTmdbImageQuality();
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

    const imgSize = selectSize(size, quality);
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    return proxyUrl(`${imgSize}/${cleanUrl}`);
};

export const getMovieImageUrl = (data: Movie | MovieDetails | TVShowDetails) => {
    const quality = getTmdbImageQuality();
    const cleanBackdrop = data.backdrop_path
        ? (data.backdrop_path.startsWith('/') ? data.backdrop_path.slice(1) : data.backdrop_path)
        : null;
    const cleanPoster = data.poster_path
        ? (data.poster_path.startsWith('/') ? data.poster_path.slice(1) : data.poster_path)
        : null;

    const backdrop = cleanBackdrop === null
        ? empty_movie_state
        : proxyUrl(`${selectSize('hero', quality)}/${cleanBackdrop}`);

    const poster = cleanPoster === null
        ? empty_movie_state
        : proxyUrl(`${selectSize('medium', quality)}/${cleanPoster}`);

    return { backdrop, poster } as const;
};
