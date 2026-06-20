import { getContentMode } from '@/composables/useContentMode';

const NETFLIX_PATH = /^\/(?:nf|stream\/nf|embed\/nf)(?:\/|$)/;

/** Mobile is global-only — never surface Netflix catalogue or player routes. */
export function enforceMobileGlobalMode(): void {
    const { isNetflix, setContentMode } = getContentMode();
    if (isNetflix()) setContentMode('global');
}

export function isNetflixPath(path: string): boolean {
    return NETFLIX_PATH.test(path);
}

export function mobileSafePath(path: string): string {
    return isNetflixPath(path) ? '/' : path;
}