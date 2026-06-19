import empty_movie_state from '../assets/img/empty-movie-state.png';
import { Movie } from '../composables/useHighlights';
import { MovieDetails } from '../composables/useMovies';
import { TVShowDetails } from '../composables/useTvShows';
import { getSettings } from '../composables/useSettings';

// Dev: direct TMDB/CDN URLs for fast local iteration.
// Prod: same-origin proxies with 7-day edge cache (no third-party wsrv hop).
const IS_DEV = import.meta.env.DEV;
const TMDB_BASE = 'https://image.tmdb.org/t/p/';

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

/** Pixel width for catalog CDN resize — matches TMDB token, no upscaling. */
export function posterPixelWidth(size: WebImageSize, quality: TmdbImageQuality): number {
    const token = selectSize(size, quality);
    const match = token.match(/^w(\d+)$/);
    if (match) return parseInt(match[1], 10);
    return size === 'hero' || size === 'xlarge' ? 1280 : 500;
}

export interface WsrvImageOptions {
    width?: number;
    quality?: number;
    blur?: number;
}

/** @deprecated Use buildProxiedImageUrl / buildCatalogCdnImageUrl */
export function buildWsrvImageUrl(sourceUrl: string, _options: WsrvImageOptions = {}): string {
    if (!sourceUrl) return '';
    return sourceUrl;
}

function normalizeTmdbPath(path: string): string {
    const trimmed = path.startsWith('/') ? path : `/${path}`;
    return trimmed.replace(/^\/+/, '/');
}

/**
 * TMDB image via same-origin proxy (7-day edge cache).
 * Path must include size token, e.g. w342/abc.jpg
 */
export function buildProxiedImageUrl(tmdbPath: string): string {
    if (!tmdbPath) return '';
    const path = normalizeTmdbPath(tmdbPath);
    if (IS_DEV) {
        const clean = path.startsWith('/') ? path.slice(1) : path;
        return `${TMDB_BASE}${clean}`;
    }
    return `/api/img?path=${encodeURIComponent(path)}`;
}

/** Catalogue CDN posters via same-origin proxy with WebP resize. */
export function buildCatalogCdnImageUrl(url: string, size: WebImageSize = 'medium'): string {
    if (!url || !CATALOG_CDN_PATTERN.test(url)) return url;
    if (IS_DEV) return url;
    const quality = getTmdbImageQuality();
    const width = posterPixelWidth(size, quality);
    return `/api/catalog-img?url=${encodeURIComponent(url)}&w=${width}`;
}

/** AniList covers via catalog-img proxy when in production. */
function buildAnilistImageUrl(url: string, size: WebImageSize = 'medium'): string {
    if (!url || !ANILIST_CDN_PATTERN.test(url)) return url;
    if (IS_DEV) return url;
    const quality = getTmdbImageQuality();
    const width = posterPixelWidth(size, quality);
    return `/api/catalog-img?url=${encodeURIComponent(url)}&w=${width}`;
}

const proxyUrl = (tmdbPath: string) => buildProxiedImageUrl(tmdbPath);

export const useWebImage = (url: string, size: WebImageSize = 'medium') => {
    if (!url) return '';

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
                return buildProxiedImageUrl(tmdbPath);
            }
        }
        if (ANILIST_CDN_PATTERN.test(resolvedUrl)) {
            return buildAnilistImageUrl(resolvedUrl, size);
        }
        if (CATALOG_CDN_PATTERN.test(resolvedUrl)) {
            return buildCatalogCdnImageUrl(resolvedUrl, size);
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

/** Warm browser cache for image paths (fire-and-forget). */
export function prefetchArtworkImages(
    paths: Array<string | null | undefined>,
    size: WebImageSize = 'medium',
    limit = 32
) {
    if (typeof window === 'undefined') return;
    const seen = new Set<string>();
    for (const path of paths) {
        if (!path || seen.has(path) || seen.size >= limit) continue;
        seen.add(path);
        const url = useWebImage(path, size);
        if (!url) continue;
        const img = new Image();
        img.decoding = 'async';
        if (size === 'hero') {
            img.setAttribute('fetchpriority', 'high');
        }
        img.src = url;
    }
}

/** @deprecated Use prefetchArtworkImages */
export const prefetchPosterImages = prefetchArtworkImages;