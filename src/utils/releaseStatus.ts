/** True when the calendar release/air date is still in the future. */
export function isFutureReleaseDate(dateStr?: string | null, now = new Date()): boolean {
    if (!dateStr) return false;
    const release = new Date(`${dateStr}T23:59:59`);
    if (Number.isNaN(release.getTime())) return false;
    return release.getTime() > now.getTime();
}

export function releaseDateMetaLabel(dateStr?: string | null): 'Released' | 'Opens' {
    return isFutureReleaseDate(dateStr) ? 'Opens' : 'Released';
}

export function premiereMetaLabel(dateStr?: string | null): 'Premiered' | 'Premieres' {
    return isFutureReleaseDate(dateStr) ? 'Premieres' : 'Premiered';
}

const MOVIE_RELEASED_LIKE = new Set(['released']);

/** TMDB often marks future movies as Released — correct that using the release date. */
export function displayMovieStatus(status?: string | null, releaseDate?: string | null): string {
    if (isFutureReleaseDate(releaseDate)) {
        const normalized = (status || '').trim().toLowerCase();
        if (!normalized || MOVIE_RELEASED_LIKE.has(normalized)) {
            return 'Upcoming';
        }
    }
    return status?.trim() || '';
}

const TV_PREMIERED_LIKE = new Set(['returning series', 'released']);

/** Same TMDB quirk for series that have not premiered yet. */
export function displayTvStatus(status?: string | null, firstAirDate?: string | null): string {
    if (isFutureReleaseDate(firstAirDate)) {
        const normalized = (status || '').trim().toLowerCase();
        if (!normalized || TV_PREMIERED_LIKE.has(normalized)) {
            return 'Upcoming';
        }
    }
    return status?.trim() || '';
}