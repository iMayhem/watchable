import empty_movie_state from '../assets/img/empty-movie-state.png';
import { Movie } from '../composables/useHighlights';
import { MovieDetails } from '../composables/useMovies';
import { TVShowDetails } from '../composables/useTvShows';

// In production, route all images through our own Cloudflare proxy (/api/img)
// so ISPs that block image.tmdb.org or wsrv.nl can't break the site.
// In local dev, fall back directly to image.tmdb.org.
const IS_DEV = import.meta.env.DEV;
const TMDB_BASE = 'https://image.tmdb.org/t/p/';

const selectSize = (size: "medium" | "large" | "small" | "xlarge") => {
    const sizeOptions = {
        small: "w500",
        medium: "w780",
        large: "original",
        xlarge: "original"
    }
    return sizeOptions[size] || sizeOptions.medium;
}

/**
 * Builds a proxied image URL that goes through moovie.fun/api/img
 * so ISPs blocking image.tmdb.org see only moovie.fun traffic.
 */
const proxyUrl = (tmdbPath: string): string => {
    if (IS_DEV) {
        // Local dev: hit TMDB directly (no proxy needed)
        return `${TMDB_BASE}${tmdbPath}`;
    }
    // Production: route through our Cloudflare Pages Function
    const path = `/${tmdbPath}`;
    return `/api/img?path=${encodeURIComponent(path)}`;
};

export const useWebImage = (url: string, size: "medium" | "large" | "small" | "xlarge" = "medium") => {
    let resolvedUrl = url;
    if (url.startsWith('//')) {
        resolvedUrl = `https:${url}`;
    }

    // Already a full external URL (e.g. AniList CDN) — return as-is
    if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
        return resolvedUrl;
    }

    const imgSize = selectSize(size);
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    return proxyUrl(`${imgSize}/${cleanUrl}`);
}

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
