import empty_movie_state from '../assets/img/empty-movie-state.png';
import { Movie } from '../composables/useHighlights';
import { MovieDetails } from '../composables/useMovies';
import { TVShowDetails } from '../composables/useTvShows';
import { getSettings } from '../composables/useSettings';

// Production: wsrv.nl resizes + webp-encodes TMDB and catalogue CDN images.
// Dev: load sources directly for faster local iteration.
const IS_DEV = import.meta.env.DEV;
const TMDB_BASE = 'https://image.tmdb.org/t/p/';
const WSRV_BASE = 'https://wsrv.nl/';

const ANILIST_CDN_PATTERN = /(?:^https?:\/\/)(?:[\w-]+\.)?anilist\.co\//i;

const CATALOG_CDN_PATTERN =
    /(?:^https?:\/\/)(?:[\w-]+\.)?(?:aoneroom\.com|hakunaymatata\.com|watch2[12]\.shop)\//i;

export type WebImageSize = 'small' | 'medium' | 'large' | 'xlarge' | 'hero';
export type TmdbImageQuality = 'low' | 'medium' | 'high';

const selectSize = (size: WebImageSize, quality: TmdbImageQuality) => {
    const sizeOptions: Record<WebImageSize, string> = {
        small: 'w185',
        medium: 'w342',
        large: 'w500',
        xlarge: 'w780',
        hero: 'w1280',
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

function posterPixelWidth(size: WebImageSize, quality: TmdbImageQuality): number {
    if (quality === 'low') {
        return { small: 185, medium: 342, large: 500, xlarge: 780, hero: 780 }[size] || 342;
    }
    if (quality === 'high') {
        return { small: 500, medium: 780, large: 1280, xlarge: 1920, hero: 1920 }[size] || 780;
    }
    return { small: 342, medium: 500, large: 780, xlarge: 1280, hero: 1280 }[size] || 500;
}

export interface WsrvImageOptions {
    width?: number;
    quality?: number;
    blur?: number;
}

/** wsrv.nl image proxy — resize, webp, cache at their CDN. */
export function buildWsrvImageUrl(sourceUrl: string, options: WsrvImageOptions = {}): string {
    if (!sourceUrl) return '';
    if (IS_DEV) return sourceUrl;

    const params = new URLSearchParams();
    params.set('url', sourceUrl);
    if (options.width) params.set('w', String(options.width));
    if (options.blur) params.set('blur', String(options.blur));
    params.set('output', 'webp');
    params.set('q', String(options.quality ?? 80));
    params.set('fit', 'cover');
    return `${WSRV_BASE}?${params.toString()}`;
}

function tmdbSourceUrl(tmdbPath: string): string {
    const path = tmdbPath.startsWith('/') ? tmdbPath.slice(1) : tmdbPath;
    return `${TMDB_BASE}${path}`;
}

/**
 * TMDB path (e.g. w500/foo.jpg) via wsrv.nl in production.
 */
export function buildProxiedImageUrl(tmdbPath: string, width?: number): string {
    const source = tmdbSourceUrl(tmdbPath);
    if (IS_DEV) return source;
    return buildWsrvImageUrl(source, { width });
}

/** Catalogue CDN posters via wsrv.nl — downscale heavy Moovie CDN assets. */
export function buildCatalogCdnImageUrl(url: string, size: WebImageSize = 'medium'): string {
    if (!url || !CATALOG_CDN_PATTERN.test(url)) return url;
    if (IS_DEV) return url;
    const quality = getTmdbImageQuality();
    const width = posterPixelWidth(size, quality);
    return buildWsrvImageUrl(url, { width, quality: 80 });
}

const proxyUrl = (tmdbPath: string, width?: number) => buildProxiedImageUrl(tmdbPath, width);

export const useWebImage = (url: string, size: WebImageSize = 'medium') => {
    const quality = getTmdbImageQuality();
    let resolvedUrl = url;
    if (url.startsWith('//')) {
        resolvedUrl = `https:${url}`;
    }

    if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
        if (resolvedUrl.includes('image.tmdb.org')) {
            const match = resolvedUrl.match(/\/t\/p\/(.+)/);
            if (match) {
                const cleanPath = match[1].replace(/^(?:w\d+|original)\//, '');
                const tmdbPath = `${selectSize(size, quality)}/${cleanPath}`;
                return buildProxiedImageUrl(tmdbPath, posterPixelWidth(size, quality));
            }
        }
        if (ANILIST_CDN_PATTERN.test(resolvedUrl)) {
            return resolvedUrl;
        }
        if (CATALOG_CDN_PATTERN.test(resolvedUrl)) {
            return buildCatalogCdnImageUrl(resolvedUrl, size);
        }
        if (!IS_DEV && !resolvedUrl.includes('wsrv.nl')) {
            return buildWsrvImageUrl(resolvedUrl, {
                width: posterPixelWidth(size, quality),
                quality: 80
            });
        }
        return resolvedUrl;
    }

    const imgSize = selectSize(size, quality);
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    return proxyUrl(`${imgSize}/${cleanUrl}`, posterPixelWidth(size, quality));
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
        : proxyUrl(`${selectSize('hero', quality)}/${cleanBackdrop}`, posterPixelWidth('hero', quality));

    const poster = cleanPoster === null
        ? empty_movie_state
        : proxyUrl(`${selectSize('medium', quality)}/${cleanPoster}`, posterPixelWidth('medium', quality));

    return { backdrop, poster } as const;
};