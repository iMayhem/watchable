/** TMDB genre IDs — https://developer.themoviedb.org/reference/genre-movie-list */

export const TMDB_MOVIE = {
    ACTION: 28,
    ADVENTURE: 12,
    ANIMATION: 16,
    COMEDY: 35,
    CRIME: 80,
    DOCUMENTARY: 99,
    DRAMA: 18,
    FAMILY: 10751,
    FANTASY: 14,
    HISTORY: 36,
    HORROR: 27,
    MUSIC: 10402,
    MYSTERY: 9648,
    ROMANCE: 10749,
    SCIFI: 878,
    THRILLER: 53,
    WAR: 10752,
    WESTERN: 37
} as const;

export const TMDB_TV = {
    ACTION_ADVENTURE: 10759,
    ANIMATION: 16,
    COMEDY: 35,
    CRIME: 80,
    DOCUMENTARY: 99,
    DRAMA: 18,
    FAMILY: 10751,
    KIDS: 10762,
    MYSTERY: 9648,
    SCIFI_FANTASY: 10765,
    WAR_POLITICS: 10768,
    WESTERN: 37
} as const;

export interface TmdbGenreSpec {
    movie?: number[];
    tv?: number[];
    movieGroups?: number[][];
    tvGroups?: number[][];
}

const M = TMDB_MOVIE;
const T = TMDB_TV;

/** Parent category → TMDB genres (from netflix-codes.com groupings). */
export const TMDB_PARENT_MOVIE: Record<string, number[]> = {
    'Action & adventure': [M.ACTION, M.ADVENTURE],
    'Anime': [M.ANIMATION],
    'Children & family movies': [M.FAMILY, M.ANIMATION],
    'Classic Movies': [M.DRAMA, M.ACTION, M.ADVENTURE, M.COMEDY],
    'Comedies': [M.COMEDY],
    'Documentaries': [M.DOCUMENTARY],
    'Dramas': [M.DRAMA],
    'Foreign movies': [M.DRAMA, M.ACTION, M.COMEDY, M.THRILLER],
    'Horror movies': [M.HORROR],
    'Independent movies': [M.DRAMA],
    'LGBTQ+': [M.DRAMA, M.ROMANCE],
    'Music': [M.MUSIC],
    'Romantic movies': [M.ROMANCE],
    'Sci - Fi & Fantasy': [M.SCIFI, M.FANTASY],
    'Sports movies': [M.DRAMA, M.HISTORY],
    'Thrillers': [M.THRILLER, M.CRIME, M.MYSTERY],
    Christmas: [M.FAMILY, M.COMEDY, M.ROMANCE],
    Others: [M.DRAMA, M.COMEDY, M.ACTION]
};

export const TMDB_PARENT_TV: Record<string, number[]> = {
    'Action & adventure': [T.ACTION_ADVENTURE],
    'Anime': [T.ANIMATION],
    'Children & family movies': [T.FAMILY, T.KIDS, T.ANIMATION],
    'Classic Movies': [T.DRAMA],
    'Comedies': [T.COMEDY],
    'Documentaries': [T.DOCUMENTARY],
    'Dramas': [T.DRAMA],
    'Foreign movies': [T.DRAMA],
    'Horror movies': [T.DRAMA, T.MYSTERY],
    'Independent movies': [T.DRAMA],
    'LGBTQ+': [T.DRAMA],
    'Music': [T.DOCUMENTARY],
    'Romantic movies': [T.DRAMA],
    'Sci - Fi & Fantasy': [T.SCIFI_FANTASY],
    'Sports movies': [T.DOCUMENTARY],
    'Thrillers': [T.CRIME, T.MYSTERY],
    'TV Show': [T.DRAMA, T.ACTION_ADVENTURE, T.SCIFI_FANTASY],
    'Teen TV shows': [T.DRAMA],
    Christmas: [T.FAMILY],
    Others: [T.DRAMA]
};

/** Niche rows → stricter TMDB matching. */
export const TMDB_NICHE: Record<string, TmdbGenreSpec> = {
    'action-thrillers': {
        movieGroups: [[M.ACTION, M.ADVENTURE], [M.THRILLER]],
        tvGroups: [[T.ACTION_ADVENTURE], [M.THRILLER, T.CRIME]]
    },
    'action-comedies': {
        movieGroups: [[M.ACTION, M.ADVENTURE], [M.COMEDY]],
        tvGroups: [[T.ACTION_ADVENTURE], [T.COMEDY]]
    },
    'action-sf-fantasy': {
        movieGroups: [[M.ACTION, M.ADVENTURE], [M.SCIFI, M.FANTASY]],
        tvGroups: [[T.ACTION_ADVENTURE], [T.SCIFI_FANTASY]]
    },
    'romantic-comedies': {
        movieGroups: [[M.ROMANCE], [M.COMEDY]],
        tvGroups: [[T.DRAMA], [T.COMEDY]]
    },
    'dark-comedies': {
        movieGroups: [[M.COMEDY], [M.DRAMA, M.THRILLER]],
        tvGroups: [[T.COMEDY], [T.DRAMA]]
    },
    'crime-dramas': {
        movieGroups: [[M.CRIME], [M.DRAMA]],
        tvGroups: [[T.CRIME], [T.DRAMA]]
    },
    'crime-thrillers': {
        movieGroups: [[M.CRIME], [M.THRILLER]],
        tvGroups: [[T.CRIME], [T.MYSTERY]]
    },
    'crime-action-adventure': {
        movieGroups: [[M.CRIME], [M.ACTION, M.ADVENTURE]],
        tvGroups: [[T.CRIME], [T.ACTION_ADVENTURE]]
    },
    'supernatural-horror-movies': {
        movie: [M.HORROR],
        tv: [T.DRAMA, T.MYSTERY]
    },
    'zombie-horror-movies': {
        movie: [M.HORROR],
        tv: [T.DRAMA]
    },
    'vampire-horror-movies': {
        movie: [M.HORROR],
        tv: [T.DRAMA]
    },
    'anime-action': { movie: [M.ANIMATION], tv: [T.ANIMATION] },
    'anime-fantasy': { movie: [M.ANIMATION, M.FANTASY], tv: [T.ANIMATION, T.SCIFI_FANTASY] },
    'anime-sci-fi': { movie: [M.ANIMATION, M.SCIFI], tv: [T.ANIMATION, T.SCIFI_FANTASY] },
    'anime-horror': { movie: [M.ANIMATION, M.HORROR], tv: [T.ANIMATION] },
    'anime-comedies': { movie: [M.ANIMATION, M.COMEDY], tv: [T.ANIMATION, T.COMEDY] },
    'anime-dramas': { movie: [M.ANIMATION, M.DRAMA], tv: [T.ANIMATION, T.DRAMA] },
    'fantasy-movies': { movie: [M.FANTASY], tv: [T.SCIFI_FANTASY] },
    'alien-sci-fi': { movie: [M.SCIFI], tv: [T.SCIFI_FANTASY] },
    'sci-fi-adventure': {
        movieGroups: [[M.SCIFI], [M.ADVENTURE, M.ACTION]],
        tvGroups: [[T.SCIFI_FANTASY], [T.ACTION_ADVENTURE]]
    },
    'courtroom-dramas': { movie: [M.DRAMA], tv: [T.DRAMA] },
    'political-dramas': { movie: [M.DRAMA, M.HISTORY], tv: [T.DRAMA, T.WAR_POLITICS] },
    'biographical-dramas': { movie: [M.DRAMA, M.HISTORY], tv: [T.DRAMA, T.DOCUMENTARY] },
    'martial-arts-movies': {
        movieGroups: [[M.ACTION], [M.ADVENTURE]],
        tvGroups: [[T.ACTION_ADVENTURE]]
    },
    'military-action-adventure': {
        movieGroups: [[M.ACTION, M.WAR], [M.ADVENTURE]],
        tvGroups: [[T.ACTION_ADVENTURE], [T.WAR_POLITICS]]
    },
    'spy-action-adventure': {
        movieGroups: [[M.ACTION, M.ADVENTURE], [M.THRILLER]],
        tvGroups: [[T.ACTION_ADVENTURE], [T.CRIME]]
    },
    'comic-book-and-superhero-movies': {
        movieGroups: [[M.ACTION, M.SCIFI, M.FANTASY], [M.ADVENTURE]],
        tvGroups: [[T.ACTION_ADVENTURE], [T.SCIFI_FANTASY]]
    },
    'westerns': { movie: [M.WESTERN], tv: [T.WESTERN] }
};

export function parentCategoryKey(eyebrow: string, title: string) {
    if (eyebrow === 'Browse') {
        return title.replace(' 🎄', '');
    }
    return eyebrow;
}

export function resolveTmdbGenreSpec(
    rowId: string,
    eyebrow: string,
    title: string
): TmdbGenreSpec {
    const niche = TMDB_NICHE[rowId];
    if (niche) return niche;

    const parent = parentCategoryKey(eyebrow, title);
    return {
        movie: TMDB_PARENT_MOVIE[parent],
        tv: TMDB_PARENT_TV[parent]
    };
}

export function genreIdsMatchSpec(
    genreIds: number[],
    isTv: boolean,
    spec: TmdbGenreSpec
): boolean {
    const groups = isTv ? spec.tvGroups : spec.movieGroups;
    const any = isTv ? spec.tv : spec.movie;

    if (groups?.length) {
        return groups.every((group) => group.some((id) => genreIds.includes(id)));
    }
    if (any?.length) {
        return any.some((id) => genreIds.includes(id));
    }
    return false;
}