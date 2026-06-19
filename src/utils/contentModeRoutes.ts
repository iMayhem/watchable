import type { ContentMode } from '../composables/useContentMode';

export function isNetflixContentPath(path: string): boolean {
    return path.startsWith('/nf/') || path.startsWith('/stream/nf/');
}

export function isGlobalContentPath(path: string): boolean {
    if (path === '/search') return true;
    if (path.startsWith('/movies')) return true;
    if (path.startsWith('/tv-shows') || path === '/tv') return true;
    if (path.startsWith('/anime')) return true;
    if (path.startsWith('/actors')) return true;
    if (path.startsWith('/movie/')) return true;
    if (path.startsWith('/tv-show/')) return true;
    if (/^\/tv\/\d+/.test(path)) return true;
    if (path.startsWith('/actor/')) return true;
    if (path.startsWith('/stream/movie/')) return true;
    if (path.startsWith('/stream/tv-show/')) return true;
    if (path.startsWith('/stream/anime/')) return true;
    if (path.startsWith('/watch/movie/')) return true;
    if (path.startsWith('/watch/tv/')) return true;
    if (path.startsWith('/watch/anime/')) return true;
    return false;
}

export function searchPathForMode(mode: ContentMode): string {
    return mode === 'netflix' ? '/nf/search' : '/search';
}

export function pathAllowedInMode(path: string, mode: ContentMode): boolean {
    if (path === '/search' && mode === 'netflix') return false;
    if (path.startsWith('/nf/search') && mode === 'global') return false;
    if (mode === 'netflix' && isGlobalContentPath(path)) return false;
    if (mode === 'global' && isNetflixContentPath(path)) return false;
    return true;
}

export function redirectPathForMode(path: string, mode: ContentMode): string | null {
    if (path === '/search' && mode === 'netflix') return '/nf/search';
    if (path.startsWith('/nf/search') && mode === 'global') return '/search';
    if (!pathAllowedInMode(path, mode)) return '/';
    return null;
}