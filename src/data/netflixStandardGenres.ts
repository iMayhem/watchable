import {
    TMDB_MOVIE as M,
    TMDB_TV as T,
    type TmdbGenreSpec
} from '../composables/netflixTmdbGenres';

export interface GenreBrowseRailDef {
    id: string;
    title: string;
    /** Slice of genre-matched pool */
    kind: 'tv' | 'movie' | 'top-rated' | 'newest';
    limit: number;
}

export interface NetflixStandardGenre {
    id: string;
    title: string;
    /** Netflix-style genre page copy */
    tagline: string;
    section: 'browse';
    browseAllMediaTypes?: boolean;
    catalogues?: string[];
    tmdbGenres: TmdbGenreSpec;
    /** Catalogue / TMDB overview needles — required when TMDB genres alone are too broad */
    keywords?: string[];
    priority: number;
    browseRails?: GenreBrowseRailDef[];
}

/**
 * Top-level Netflix browse genres (like netflix.com/in/browse/genre/7424).
 * Populated via TMDB metadata — not netflix-codes sub-categories.
 */
export const NETFLIX_STANDARD_GENRES: NetflixStandardGenre[] = [
    {
        id: 'action-adventure',
        title: 'Action & Adventure',
        tagline:
            'Explosive fights, epic quests, and heroes who never quit — movies and series that keep your heart racing.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 120,
        tmdbGenres: { movie: [M.ACTION, M.ADVENTURE], tv: [T.ACTION_ADVENTURE] },
        browseRails: [
            { id: 'tv', title: 'Exciting TV Shows', kind: 'tv', limit: 20 },
            { id: 'movies', title: 'Action Movies', kind: 'movie', limit: 20 },
            { id: 'top', title: 'Top Picks', kind: 'top-rated', limit: 20 }
        ]
    },
    {
        id: 'anime',
        title: 'Anime',
        tagline:
            'Action-packed adventures, offbeat comedies, inspirational stories — binge-worthy anime series with a style and spirit unlike anything else.',
        section: 'browse',
        priority: 119,
        tmdbGenres: { tv: [T.ANIMATION] },
        browseRails: [
            { id: 'tv', title: 'Exciting TV Shows', kind: 'tv', limit: 20 },
            { id: 'top', title: 'Anime for Beginners', kind: 'top-rated', limit: 20 },
            { id: 'new', title: 'New on Netflix', kind: 'newest', limit: 20 }
        ]
    },
    {
        id: 'children-family-movies',
        title: 'Children & Family',
        tagline:
            'Fun for the whole family — animated favorites, gentle adventures, and feel-good stories for every age.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 118,
        tmdbGenres: { movie: [M.FAMILY, M.ANIMATION], tv: [T.FAMILY, T.KIDS, T.ANIMATION] },
        browseRails: [
            { id: 'movies', title: 'Family Movies', kind: 'movie', limit: 20 },
            { id: 'tv', title: 'Kids\' TV', kind: 'tv', limit: 20 }
        ]
    },
    {
        id: 'comedies',
        title: 'Comedies',
        tagline:
            'Laugh-out-loud films and series — witty banter, awkward moments, and comedy that hits every mood.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 117,
        tmdbGenres: { movie: [M.COMEDY], tv: [T.COMEDY] },
        browseRails: [
            { id: 'tv', title: 'TV Comedies', kind: 'tv', limit: 20 },
            { id: 'movies', title: 'Comedy Movies', kind: 'movie', limit: 20 }
        ]
    },
    {
        id: 'documentaries',
        title: 'Documentaries',
        tagline:
            'True stories, real people, and worlds you have never seen — documentaries that inform and inspire.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 116,
        tmdbGenres: { movie: [M.DOCUMENTARY], tv: [T.DOCUMENTARY] }
    },
    {
        id: 'dramas',
        title: 'Dramas',
        tagline:
            'Emotional journeys, complex characters, and stories that stay with you long after the credits roll.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 115,
        tmdbGenres: { movie: [M.DRAMA], tv: [T.DRAMA] },
        browseRails: [
            { id: 'tv', title: 'Bingeworthy TV Shows', kind: 'tv', limit: 20 },
            { id: 'movies', title: 'Drama Movies', kind: 'movie', limit: 20 }
        ]
    },
    {
        id: 'horror-movies',
        title: 'Horror',
        tagline:
            'Chills, thrills, and things that go bump in the night — horror that ranges from creepy to terrifying.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 114,
        tmdbGenres: { movie: [M.HORROR], tv: [T.DRAMA, T.MYSTERY] }
    },
    {
        id: 'romantic-movies',
        title: 'Romance',
        tagline:
            'Love stories sweet and sweeping — romance that makes you believe in happy endings again.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 113,
        tmdbGenres: { movie: [M.ROMANCE], tv: [T.DRAMA] },
        browseRails: [
            { id: 'tv', title: 'Romantic TV Shows', kind: 'tv', limit: 20 },
            { id: 'movies', title: 'Romantic Movies', kind: 'movie', limit: 20 }
        ]
    },
    {
        id: 'sci-fi-fantasy',
        title: 'Sci-Fi & Fantasy',
        tagline:
            'Other worlds, future tech, magic, and myth — sci-fi and fantasy that stretches imagination.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 112,
        tmdbGenres: { movie: [M.SCIFI, M.FANTASY], tv: [T.SCIFI_FANTASY] },
        browseRails: [
            { id: 'tv', title: 'Sci-Fi TV', kind: 'tv', limit: 20 },
            { id: 'movies', title: 'Sci-Fi Movies', kind: 'movie', limit: 20 }
        ]
    },
    {
        id: 'thrillers',
        title: 'Thrillers',
        tagline:
            'Edge-of-your-seat suspense, twisty mysteries, and tension that never lets up.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 111,
        tmdbGenres: { movie: [M.THRILLER, M.CRIME, M.MYSTERY], tv: [T.CRIME, T.MYSTERY] }
    },
    {
        id: 'tv-show',
        title: 'TV Shows',
        tagline:
            'Binge-worthy series across every genre — from addictive dramas to laugh-out-loud comedies.',
        section: 'browse',
        priority: 100,
        tmdbGenres: { tv: [T.DRAMA, T.ACTION_ADVENTURE, T.SCIFI_FANTASY, T.COMEDY] },
        browseRails: [
            { id: 'top', title: 'Popular Series', kind: 'top-rated', limit: 20 },
            { id: 'new', title: 'New on Netflix', kind: 'newest', limit: 20 }
        ]
    },
    {
        id: 'classic-movies',
        title: 'Classics',
        tagline: 'Timeless films and beloved favorites that never go out of style.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 90,
        tmdbGenres: {
            movie: [M.DRAMA, M.ACTION, M.ADVENTURE, M.COMEDY],
            tv: [T.DRAMA]
        }
    },
    {
        id: 'independent-movies',
        title: 'Independent',
        tagline: 'Bold voices and fresh perspectives from filmmakers off the beaten path.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 89,
        tmdbGenres: { movie: [M.DRAMA], tv: [T.DRAMA] }
    },
    {
        id: 'music',
        title: 'Music & Musicals',
        tagline: 'Concerts, musicals, and music-driven stories that make you feel the beat.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 88,
        tmdbGenres: { movie: [M.MUSIC], tv: [T.DOCUMENTARY] }
    },
    {
        id: 'sports-movies',
        title: 'Sports',
        tagline: 'Underdog victories, fierce competition, and the drama behind the game.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 87,
        tmdbGenres: { movie: [M.DRAMA, M.HISTORY], tv: [T.DOCUMENTARY] }
    },
    {
        id: 'lgbtq',
        title: 'LGBTQ+',
        tagline: 'Stories of love, identity, and community across movies and series.',
        section: 'browse',
        browseAllMediaTypes: true,
        priority: 86,
        tmdbGenres: { movie: [M.ROMANCE, M.DRAMA], tv: [T.DRAMA] },
        keywords: [
            'lgbtq',
            'lgbt',
            'queer',
            'lesbian',
            'bisexual',
            'transgender',
            'homosexual',
            'pride',
            'heartstopper',
            'call me by your name'
        ],
        browseRails: [
            { id: 'tv', title: 'LGBTQ+ TV Shows', kind: 'tv', limit: 20 },
            { id: 'movies', title: 'LGBTQ+ Movies', kind: 'movie', limit: 20 },
            { id: 'top', title: 'Top Picks', kind: 'top-rated', limit: 20 }
        ]
    }
];

const BY_ID = new Map(NETFLIX_STANDARD_GENRES.map((row) => [row.id, row]));

export function getNetflixStandardGenre(id: string): NetflixStandardGenre | undefined {
    return BY_ID.get(id);
}

export function standardGenresForCatalogue(catalogueId: string): NetflixStandardGenre[] {
    return NETFLIX_STANDARD_GENRES.filter((row) => {
        if (catalogueId === 'korean' && row.id === 'anime') return false;
        return !row.catalogues?.length || row.catalogues.includes(catalogueId);
    });
}

export function isStandardNetflixGenre(rowId: string): boolean {
    return BY_ID.has(rowId);
}