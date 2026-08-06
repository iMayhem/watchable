import empty_movie_state from '../assets/img/empty-movie-state.png';
import { Movie } from '../composables/useHighlights';
import { MovieDetails } from '../composables/useMovies';
import { TVShowDetails } from '../composables/useTvShows';
import { getSettings } from '../composables/useSettings';

// TMDB posters/backdrops load via the Cloudflare tmdb-proxy worker (edge-cached,
// VPS-independent — keeps artwork working when the VPS is down).
const TMDB_BASE = 'https://tmdb-proxy.sujeetunbeatable.workers.dev/t/p/';
let vpsProxyBaseUrl = '';

export function setVpsProxyBaseUrl(url: string) {
    vpsProxyBaseUrl = url;
}

export function getVpsProxyBaseUrl(): string {
    return vpsProxyBaseUrl;
}

const ANILIST_CDN_PATTERN = /(?:^https?:\/\/)(?:[\w-]+\.)?anilist\.co\//i;

const CATALOG_CDN_PATTERN =
    /(?:^https?:\/\/)(?:[\w-]+\.)?(?:aoneroom\.com|hakunaymatata\.com|watch2[12]\.shop)\//i;

export function isCatalogCdnImage(url: string): boolean {
    return Boolean(url && CATALOG_CDN_PATTERN.test(url));
}

/** Catalogue rows use poster key art — never full-width backdrop sizes (NetMirror w_250–520). */
export function catalogDisplayImageSize(
    url: string,
    preferred: WebImageSize = 'large'
): WebImageSize {
    if (!isCatalogCdnImage(url)) return preferred;
    if (preferred === 'hero' || preferred === 'xlarge') return 'large';
    return preferred;
}

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
    
    // Dynamic size upgrades for large high-DPI monitors and 4K/8K TVs
    if (typeof window !== 'undefined' && window.innerWidth >= 2400) {
        if (size === 'hero' || size === 'xlarge') return 'original';
        if (size === 'large') return 'w780';
    }

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

/** JPEG/WebP quality for catalogue OSS resize (q_1–q_100). */
export function catalogOssQuality(quality: TmdbImageQuality = 'medium'): number {
    if (quality === 'low') return 82;
    if (quality === 'high') return 92;
    return 88;
}

/**
 * Catalogue CDN OSS widths — ~2× grid cell width for crisp retina posters.
 * NetMirror uses w_250–300; we target sharper 2-up/5-up grids without full-source hops.
 */
export function catalogOssResizeWidth(
    size: WebImageSize,
    quality: TmdbImageQuality = 'medium'
): number {
    if (quality === 'low') {
        if (size === 'small' || size === 'medium') return 300;
        if (size === 'large') return 400;
        if (size === 'xlarge') return 560;
        return 840;
    }
    if (quality === 'high') {
        if (size === 'small' || size === 'medium') return 480;
        if (size === 'large') return 640;
        if (size === 'xlarge') return 960;
        return 1280;
    }
    // medium (default)
    if (size === 'small' || size === 'medium') return 420;
    if (size === 'large') return 520;
    if (size === 'xlarge') return 720;
    return 1080;
}

/**
 * Direct catalogue CDN resize — OSS edge WebP/JPEG, no /api/catalog-img hop.
 */
export function buildCatalogOssImageUrl(
    url: string,
    width: number,
    jpegQuality = 88
): string {
    if (!url || !CATALOG_CDN_PATTERN.test(url)) return url;
    const base = url.split('?')[0];
    const clamped = Math.min(Math.max(Math.round(width), 64), 1280);
    const q = Math.min(Math.max(Math.round(jpegQuality), 60), 95);
    return `${base}?x-oss-process=image/resize,w_${clamped}/quality,q_${q}`;
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
 * TMDB image URL (direct CDN). Path must include size token, e.g. w342/abc.jpg
 * Always served via the Cloudflare tmdb-proxy worker.
 */
export function buildProxiedImageUrl(tmdbPath: string): string {
    if (!tmdbPath) return '';
    const path = normalizeTmdbPath(tmdbPath);
    const clean = path.startsWith('/') ? path.slice(1) : path;
    return `${TMDB_BASE}${clean}`;
}

/** Catalogue CDN posters — direct OSS resize (NetMirror parity). */
/** Only some catalogue CDN shards support Aliyun OSS query transforms. */
function catalogHostSupportsOss(url: string): boolean {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === 'pacdn.aoneroom.com' || host.endsWith('.pacdn.aoneroom.com');
    } catch {
        return false;
    }
}

export function buildCatalogCdnImageUrl(url: string, size: WebImageSize = 'medium'): string {
    if (!url || !CATALOG_CDN_PATTERN.test(url)) return url;
    const quality = getTmdbImageQuality();
    const width = catalogOssResizeWidth(size, quality);
    const q = catalogOssQuality(quality);

    if (catalogHostSupportsOss(url)) {
        return buildCatalogOssImageUrl(url, width, q);
    }

    // Fallback: Proxy and resize catalog CDN images that don't support OSS natively
    // to stop browser lag from loading massive 3MB+ raw backdrop files for each card.
    try {
        const cleanUrl = url.split('?')[0];
        const rawUrl = cleanUrl.replace(/^https?:\/\//i, '');
        return `https://images.weserv.nl/?url=${encodeURIComponent(rawUrl)}&w=${width}&q=${q}&output=webp`;
    } catch {
        return url.split('?')[0];
    }
}

/**
 * AniList covers are served from s4.anilist.co (public CDN).
 * AniList covers must load directly from their CDN.
 */
function buildAnilistImageUrl(url: string, _size: WebImageSize = 'medium'): string {
    if (!url || !ANILIST_CDN_PATTERN.test(url)) return url;
    return url.startsWith('//') ? `https:${url}` : url;
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