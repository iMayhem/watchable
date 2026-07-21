/** Mobile is global-only — netflix mode is deprecated. */
export function enforceMobileGlobalMode(): void {
    // No-op
}

export function isNetflixPath(_path: string): boolean {
    return false;
}

export function mobileSafePath(path: string): string {
    return path;
}