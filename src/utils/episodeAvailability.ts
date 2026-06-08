export interface EpisodeLike {
    episode_number: number;
    air_date?: string | null;
    name?: string | null;
}

export function sortEpisodes(episodes: EpisodeLike[]): EpisodeLike[] {
    return [...episodes].sort((a, b) => a.episode_number - b.episode_number);
}

/** Episodes that have already aired (past air_date, or before the next scheduled one). */
export function getReleasedEpisodes(episodes: EpisodeLike[], now = new Date()): EpisodeLike[] {
    const sorted = sortEpisodes(episodes);
    const nextUpcoming = sorted.find(
        (ep) => ep.air_date && new Date(ep.air_date) > now
    );

    return sorted.filter((ep) => {
        if (ep.air_date) return new Date(ep.air_date) <= now;
        if (nextUpcoming) return ep.episode_number < nextUpcoming.episode_number;
        return false;
    });
}

/** First episode with a future air_date. */
export function getNextUpcomingEpisode(
    episodes: EpisodeLike[],
    now = new Date()
): EpisodeLike | null {
    return (
        sortEpisodes(episodes).find(
            (ep) => ep.air_date && new Date(ep.air_date) > now
        ) ?? null
        );
}

export function getLastReleasedEpisodeNumber(
    episodes: EpisodeLike[],
    now = new Date()
): number {
    const released = getReleasedEpisodes(episodes, now);
    if (!released.length) return 0;
    return Math.max(...released.map((ep) => ep.episode_number));
}

/**
 * Episodes to show in reel order / browser: released, next scheduled, and
 * announced-but-unscheduled (TBA) entries up to announcedTotal.
 */
export function buildBrowsableEpisodes(
    episodes: EpisodeLike[],
    announcedTotal?: number | null,
    now = new Date()
): EpisodeLike[] {
    const sorted = sortEpisodes(episodes);
    const released = getReleasedEpisodes(sorted, now);
    const nextUpcoming = getNextUpcomingEpisode(sorted, now);

    const byNumber = new Map<number, EpisodeLike>();
    for (const ep of released) byNumber.set(ep.episode_number, ep);
    if (nextUpcoming) byNumber.set(nextUpcoming.episode_number, nextUpcoming);

    const lastScheduled = Math.max(
        0,
        ...Array.from(byNumber.keys()),
        nextUpcoming?.episode_number ?? 0
    );
    const maxEp = Math.max(
        announcedTotal ?? 0,
        sorted[sorted.length - 1]?.episode_number ?? 0,
        lastScheduled
    );

    if (maxEp > lastScheduled) {
        for (let n = lastScheduled + 1; n <= maxEp; n++) {
            if (byNumber.has(n)) continue;
            const fromTmdb = sorted.find((ep) => ep.episode_number === n);
            byNumber.set(n, fromTmdb ?? {
                episode_number: n,
                name: `Episode ${n}`,
                air_date: null,
            });
        }
    }

    return sortEpisodes(Array.from(byNumber.values()));
}

export function findEpisodeByNumber(
    episodes: EpisodeLike[],
    episodeNumber: number
): EpisodeLike | undefined {
    return episodes.find((ep) => ep.episode_number === episodeNumber);
}

export function isEpisodeNotYetAired(
    episodeNumber: number,
    episodes: EpisodeLike[],
    now = new Date()
): boolean {
    const ep = findEpisodeByNumber(episodes, episodeNumber);
    if (!ep) return false;
    if (ep.air_date) return new Date(ep.air_date) > now;
    return episodeNumber > getLastReleasedEpisodeNumber(episodes, now);
}

export function formatEpisodeAirDate(
    airDate: string | null | undefined,
    now = new Date()
): string {
    if (!airDate) return 'Date TBA';
    const date = new Date(airDate);
    if (Number.isNaN(date.getTime())) return 'Date TBA';
    if (date <= now) return '';
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
