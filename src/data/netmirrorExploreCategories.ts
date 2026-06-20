export type NetmirrorExploreMediaType = 'all' | 'movie' | 'tv' | 'animated';

export interface NetmirrorExploreFilter {
    country?: string;
    dubbing?: string;
    type?: '1' | '2';
    /** NetMirror /explore/animated → genre_ids[]=10&genre_ids[]=6 */
    genre_ids?: string[];
    sort_by?: string;
    countryNot?: string;
    countryNot2?: string;
    /** NetMirror Hollywood category excludes Indian dub tags via title_not[]. */
    title_not?: string[];
}

/** NetMirror bottom nav + header TV Series page. */
export const NETFLIX_TV_EXPLORE_PATH = '/nf/explore/tv';

/** NetMirror Movies explore page. */
export const NETFLIX_MOVIE_EXPLORE_PATH = '/nf/explore/movie';

/** NetMirror animated catalogue explore page. */
export const NETFLIX_ANIMATED_EXPLORE_PATH = '/nf/explore/animated';

/** Upstream animation genre ids (NetMirror explore/animated). */
export const NETMIRROR_ANIMATED_GENRE_IDS = ['10', '6'] as const;

/** Upstream genre taxonomy (`/api/genre` tid) for explore chips. */
export interface NetmirrorExploreGenreOption {
    slug: string;
    label: string;
    genreId: string;
}

export const NETMIRROR_EXPLORE_GENRE_OPTIONS: ReadonlyArray<NetmirrorExploreGenreOption> = [
    { slug: 'action', label: 'Action', genreId: '200' },
    { slug: 'adventure', label: 'Adventure', genreId: '8' },
    { slug: 'comedy', label: 'Comedy', genreId: '12' },
    { slug: 'drama', label: 'Drama', genreId: '14' },
    { slug: 'horror', label: 'Horror', genreId: '34' },
    { slug: 'thriller', label: 'Thriller', genreId: '23' },
    { slug: 'romance', label: 'Romance', genreId: '20' },
    { slug: 'sci-fi', label: 'Sci-Fi', genreId: '30' },
    { slug: 'fantasy', label: 'Fantasy', genreId: '41' },
    { slug: 'animation', label: 'Animation', genreId: '10' },
    { slug: 'documentary', label: 'Documentary', genreId: '25' },
    { slug: 'crime', label: 'Crime', genreId: '13' }
];

export function getExploreGenreOption(
    slug: string
): NetmirrorExploreGenreOption | undefined {
    const key = slug.trim().toLowerCase();
    return NETMIRROR_EXPLORE_GENRE_OPTIONS.find((row) => row.slug === key);
}

export function activeExploreGenreSlug(query: ExploreRouteQuery): string {
    const genre = typeof query.genre === 'string' ? query.genre.trim().toLowerCase() : '';
    if (!genre) return '';
    return getExploreGenreOption(genre) ? genre : '';
}

export function exploreGenrePath(
    mediaType: NetmirrorExploreMediaType,
    query: ExploreRouteQuery,
    genreSlug: string
): string {
    const next: ExploreRouteQuery = { ...query };
    if (genreSlug) {
        next.genre = genreSlug;
    } else {
        delete next.genre;
    }
    return netflixExploreMediaPath(mediaType, next);
}

export interface NetmirrorExploreCountry {
    name: string;
    value: string;
}

/** Mirrors netmirror.global dC[] — country filter chips on explore. */
export const NETMIRROR_EXPLORE_COUNTRIES: NetmirrorExploreCountry[] = [
    { name: 'United States', value: 'United States' },
    { name: 'India', value: 'India' },
    { name: 'Bangladesh', value: 'Bangladesh' },
    { name: 'United Kingdom', value: 'United Kingdom' },
    { name: 'Pakistan', value: 'Pakistan' },
    { name: 'Korea', value: 'Korea' },
    { name: 'China', value: 'China' },
    { name: 'Japan', value: 'Japan' },
    { name: 'Philippines', value: 'Philippines' },
    { name: 'Germany', value: 'Germany' },
    { name: 'France', value: 'France' },
    { name: 'Australia', value: 'Australia' },
    { name: "Cote d'Ivoire", value: "Cote d'Ivoire" },
    { name: 'Indonesia', value: 'Indonesia' },
    { name: 'Canada', value: 'Canada' },
    { name: 'Turkey', value: 'Turkey' },
    { name: 'Italy', value: 'Italy' },
    { name: 'Egypt', value: 'Egypt' },
    { name: 'Syria', value: 'Syria' },
    { name: 'Lebanon', value: 'Lebanon' },
    { name: 'Saudi Arabia', value: 'Saudi Arabia' },
    { name: 'Other', value: 'Other' }
];

/** Mirrors netmirror.global ih[] primary category row on explore home. */
export interface NetmirrorExploreCategory {
    id: string;
    title: string;
    mediaType: NetmirrorExploreMediaType;
    filter: NetmirrorExploreFilter;
}

/** Header-only drama tabs — same feeds as the old Category chips, not in Category dropdown. */
export const NETFLIX_KDRAMA_EXPLORE_CATEGORY: NetmirrorExploreCategory = {
    id: 'k-drama',
    title: 'K-Drama',
    mediaType: 'tv',
    filter: { country: 'Korea', dubbing: 'Hindi' }
};

export const NETFLIX_CDRAMA_EXPLORE_CATEGORY: NetmirrorExploreCategory = {
    id: 'c-drama',
    title: 'C-Drama',
    mediaType: 'tv',
    filter: { country: 'china', dubbing: 'Hindi' }
};

/** Header Bollywood tab — same upstream India/Hindi feed as the Hindi category tile. */
export const BOLLYWOOD_EXPLORE_CATEGORY: NetmirrorExploreCategory = {
    id: 'bollywood',
    title: 'Bollywood',
    mediaType: 'all',
    filter: { country: 'India', dubbing: 'Hindi', type: '1' }
};

const HEADER_EXPLORE_CATEGORIES: NetmirrorExploreCategory[] = [
    NETFLIX_KDRAMA_EXPLORE_CATEGORY,
    NETFLIX_CDRAMA_EXPLORE_CATEGORY
];

export const NETMIRROR_EXPLORE_CATEGORIES: NetmirrorExploreCategory[] = [
    {
        id: 'hindi',
        title: 'Hindi',
        mediaType: 'all',
        filter: { country: 'India', dubbing: 'Hindi', type: '1' }
    },
    {
        id: 'hollywood',
        title: 'Hollywood',
        mediaType: 'all',
        filter: {
            country: 'United States',
            title_not: ['1', '2', '3', '4', '5', '6', '7']
        }
    },
    {
        id: 'telugu',
        title: 'Telugu',
        mediaType: 'all',
        filter: { country: 'India', dubbing: 'Telugu', type: '1' }
    },
    {
        id: 'tamil',
        title: 'Tamil',
        mediaType: 'all',
        filter: { country: 'India', dubbing: 'Tamil', type: '1' }
    },
    {
        id: 'malayalam',
        title: 'Malayalam',
        mediaType: 'all',
        filter: { country: 'India', dubbing: 'Malayalam', type: '1' }
    },
    {
        id: 'punjabi',
        title: 'Punjabi',
        mediaType: 'all',
        filter: { country: 'India', dubbing: 'Punjabi', type: '1' }
    },
    {
        id: 'kannada',
        title: 'Kannada',
        mediaType: 'all',
        filter: { country: 'India', dubbing: 'Kannada', type: '1' }
    },
    {
        id: 'marathi',
        title: 'Marathi',
        mediaType: 'all',
        filter: { country: 'India', dubbing: 'Marathi', type: '1' }
    },
    {
        id: 'bengali',
        title: 'Bengali',
        mediaType: 'all',
        filter: { country: 'India', dubbing: 'Bengali', type: '1' }
    },
    {
        id: 'arabic',
        title: 'Arabic',
        mediaType: 'movie',
        filter: { dubbing: 'Arabic', type: '1' }
    },
    {
        id: 'urdu',
        title: 'Urdu',
        mediaType: 'movie',
        filter: { dubbing: 'Urdu', type: '1' }
    }
];

export function getNetmirrorExploreCategory(id: string): NetmirrorExploreCategory | undefined {
    const header = HEADER_EXPLORE_CATEGORIES.find((cat) => cat.id === id);
    if (header) return header;
    return NETMIRROR_EXPLORE_CATEGORIES.find((cat) => cat.id === id);
}

export function netflixKDramaExplorePath(): string {
    return netflixExplorePath(NETFLIX_KDRAMA_EXPLORE_CATEGORY);
}

export function netflixCDramaExplorePath(): string {
    return netflixExplorePath(NETFLIX_CDRAMA_EXPLORE_CATEGORY);
}

function isHeaderDramaExploreRoute(
    path: string,
    query: ExploreRouteQuery,
    category: NetmirrorExploreCategory,
    countryMatch: string,
    titleMatch: string
): boolean {
    if (!path.startsWith('/nf/explore')) return false;
    const matched = categoryFromExploreQuery(query);
    if (matched?.id === category.id) return true;

    const country = typeof query.country === 'string' ? query.country.trim() : '';
    const dubbing = typeof query.dubbing === 'string' ? query.dubbing.trim() : '';
    const title = typeof query.title === 'string' ? query.title.trim() : '';
    return (
        country.toLowerCase() === countryMatch &&
        dubbing === 'Hindi' &&
        (title.toLowerCase() === titleMatch || exploreMediaTypeFromPath(path) === 'tv')
    );
}

export function isKDramaExploreRoute(
    path: string,
    query: ExploreRouteQuery
): boolean {
    return isHeaderDramaExploreRoute(
        path,
        query,
        NETFLIX_KDRAMA_EXPLORE_CATEGORY,
        'korea',
        'k-drama'
    );
}

export function isCDramaExploreRoute(
    path: string,
    query: ExploreRouteQuery
): boolean {
    return isHeaderDramaExploreRoute(
        path,
        query,
        NETFLIX_CDRAMA_EXPLORE_CATEGORY,
        'china',
        'c-drama'
    );
}

export function isHeaderDramaExploreRouteActive(
    path: string,
    query: ExploreRouteQuery
): boolean {
    return isKDramaExploreRoute(path, query) || isCDramaExploreRoute(path, query);
}

export function netflixExploreCountryPath(
    country: NetmirrorExploreCountry,
    mediaType: NetmirrorExploreMediaType = 'all'
): string {
    const query = new URLSearchParams();
    query.set('country', country.value);
    return `/nf/explore/${mediaType}?${query.toString()}`;
}

/** Categories that follow the active explore movie/tv tab (NetMirror-style). */
const ADAPTIVE_EXPLORE_CATEGORY_IDS = new Set([
    'hindi',
    'hollywood',
    'telugu',
    'tamil',
    'malayalam',
    'punjabi',
    'kannada',
    'marathi',
    'bengali'
]);

export function resolveExplorePathMediaType(
    category: NetmirrorExploreCategory,
    routeMediaType: NetmirrorExploreMediaType
): NetmirrorExploreMediaType {
    if (
        (routeMediaType === 'movie' || routeMediaType === 'tv') &&
        (category.mediaType === 'all' || ADAPTIVE_EXPLORE_CATEGORY_IDS.has(category.id))
    ) {
        return routeMediaType;
    }
    return category.mediaType;
}

export function exploreQueryString(
    query: ExploreRouteQuery,
    omit: string[] = []
): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (omit.includes(key) || typeof value !== 'string' || !value) continue;
        params.set(key, value);
    }
    const serialized = params.toString();
    return serialized ? `?${serialized}` : '';
}

export function netflixExploreMediaPath(
    mediaType: NetmirrorExploreMediaType,
    query: ExploreRouteQuery
): string {
    return `/nf/explore/${mediaType}${exploreQueryString(query)}`;
}

export function netflixExplorePath(
    category: NetmirrorExploreCategory,
    opts: { dubbing?: string; mediaType?: NetmirrorExploreMediaType } = {}
): string {
    const query = new URLSearchParams();
    if (category.filter.country) {
        query.set('country', category.filter.country);
    }
    const dubbing = opts.dubbing || category.filter.dubbing;
    if (dubbing) {
        query.set('dubbing', dubbing);
    }
    query.set('title', category.title);
    if (category.id === 'hollywood') {
        query.set('category', category.title);
    }
    if (category.filter.sort_by) {
        query.set('sort_by', category.filter.sort_by);
    }
    const mediaType = opts.mediaType ?? category.mediaType;
    return `/nf/explore/${mediaType}?${query.toString()}`;
}

export type ExploreRouteQuery = Record<
    string,
    string | string[] | null | undefined
>;

function categoryFromExploreQuery(
    query: ExploreRouteQuery
): NetmirrorExploreCategory | undefined {
    const catalogueId =
        typeof query.catalogue === 'string' ? query.catalogue.trim() : '';
    if (catalogueId) {
        if (catalogueId === 'bollywood') {
            return BOLLYWOOD_EXPLORE_CATEGORY;
        }
        const byId = NETMIRROR_EXPLORE_CATEGORIES.find(
            (cat) => cat.id === catalogueId
        );
        if (byId) return byId;
    }

    const title = typeof query.title === 'string' ? query.title.trim() : '';
    const category =
        typeof query.category === 'string' ? query.category.trim() : '';
    const key = title || category;
    if (!key) return undefined;
    const headerMatch = HEADER_EXPLORE_CATEGORIES.find(
        (cat) => cat.title.toLowerCase() === key.toLowerCase()
    );
    if (headerMatch) return headerMatch;
    return NETMIRROR_EXPLORE_CATEGORIES.find(
        (cat) => cat.title.toLowerCase() === key.toLowerCase()
    );
}

/** Active explore tab from route path (NetMirror u=tv → type=2). */
export function exploreMediaTypeFromPath(path: string): NetmirrorExploreMediaType {
    const match = path.match(/^\/nf\/explore\/(all|movie|tv|animated)\/?$/);
    if (match) return match[1] as NetmirrorExploreMediaType;
    return 'all';
}

export function getExploreIndustryCategory(
    industryId: string
): NetmirrorExploreCategory | undefined {
    if (industryId === 'bollywood') {
        return BOLLYWOOD_EXPLORE_CATEGORY;
    }
    return NETMIRROR_EXPLORE_CATEGORIES.find((cat) => cat.id === industryId);
}

/** Header Hollywood / Bollywood chips — paginate upstream country feeds, not client heuristics. */
export function mergeExploreIndustryFilter(
    base: NetmirrorExploreFilter,
    industryId: string,
    mediaType: NetmirrorExploreMediaType
): NetmirrorExploreFilter {
    if (mediaType !== 'movie' && mediaType !== 'tv') return base;

    const cat = getExploreIndustryCategory(industryId);
    if (!cat || (industryId !== 'hollywood' && industryId !== 'bollywood')) {
        return base;
    }

    const merged: NetmirrorExploreFilter = { ...base };
    const adaptiveType = mediaType === 'tv' ? '2' : '1';

    if (cat.filter.country) merged.country = cat.filter.country;
    if (industryId === 'bollywood' && cat.filter.dubbing) {
        merged.dubbing = cat.filter.dubbing;
    }
    if (industryId === 'hollywood' && cat.filter.title_not?.length) {
        merged.title_not = cat.filter.title_not;
    }
    merged.type = adaptiveType;
    delete merged.countryNot;
    delete merged.countryNot2;

    return merged;
}

export function exploreFilterUsesIndustryFeed(
    filter: NetmirrorExploreFilter,
    industryId: string
): boolean {
    const cat = getExploreIndustryCategory(industryId);
    if (!cat?.filter.country || filter.country !== cat.filter.country) {
        return false;
    }
    if (industryId === 'bollywood' && cat.filter.dubbing) {
        return filter.dubbing === cat.filter.dubbing;
    }
    if (industryId === 'hollywood' && cat.filter.title_not?.length) {
        return Boolean(filter.title_not?.length);
    }
    return true;
}

const EXPLORE_DEFAULT_PAGE_BATCH = 2;
const EXPLORE_INDUSTRY_INITIAL_BATCH = 5;
const EXPLORE_INDUSTRY_MORE_BATCH = 4;

/** Industry feeds (Hollywood/Bollywood) are smaller — fetch deeper per round trip. */
export function getExplorePageBatch(
    filter: NetmirrorExploreFilter,
    industryId: string,
    phase: 'initial' | 'more'
): number {
    if (!exploreFilterUsesIndustryFeed(filter, industryId)) {
        return EXPLORE_DEFAULT_PAGE_BATCH;
    }
    return phase === 'initial'
        ? EXPLORE_INDUSTRY_INITIAL_BATCH
        : EXPLORE_INDUSTRY_MORE_BATCH;
}

/** Cap Supabase artwork/audio upgrades per pass — never block first paint. */
export const EXPLORE_ARTWORK_UPGRADE_LIMIT = 24;

export function resolveExploreFilterFromRoute(
    mediaType: NetmirrorExploreMediaType,
    query: ExploreRouteQuery
): NetmirrorExploreFilter {
    const filter: NetmirrorExploreFilter = {};

    const genreSlug = activeExploreGenreSlug(query);
    const genreOption = genreSlug ? getExploreGenreOption(genreSlug) : undefined;

    const category = categoryFromExploreQuery(query);
    const country =
        (typeof query.country === 'string' && query.country) ||
        category?.filter.country ||
        '';
    const dubbing =
        (typeof query.dubbing === 'string' && query.dubbing) ||
        category?.filter.dubbing ||
        '';

    if (country) filter.country = country;
    if (dubbing) filter.dubbing = dubbing;
    if (category?.filter.title_not?.length) {
        filter.title_not = category.filter.title_not;
    }

    if (genreOption) {
        filter.genre_ids = [genreOption.genreId];
    } else if (mediaType === 'animated') {
        filter.genre_ids = [...NETMIRROR_ANIMATED_GENRE_IDS];
    } else if (mediaType === 'movie') {
        filter.type = '1';
    } else if (mediaType === 'tv') {
        filter.type = '2';
    } else if (typeof query.type === 'string') {
        if (query.type === '1' || query.type === '2') {
            filter.type = query.type;
        }
    } else if (category?.filter.type) {
        filter.type = category.filter.type;
    }

    // NetMirror explore/movie + explore/tv default when no country filter is set.
    if ((mediaType === 'movie' || mediaType === 'tv') && !filter.country) {
        filter.countryNot = 'Nigeria';
        filter.countryNot2 = 'Philippines';
    }

    return filter;
}

export function explorePageTitle(
    mediaType: NetmirrorExploreMediaType,
    query: ExploreRouteQuery
): string {
    const genreLabel = getExploreGenreOption(activeExploreGenreSlug(query))?.label || '';

    if (mediaType === 'animated') {
        const country = typeof query.country === 'string' ? query.country.trim() : '';
        const suffix = genreLabel
            ? `${genreLabel} Animation Movies & TV Series`
            : 'Animation Movies & TV Series';
        return country ? `${country} ${suffix}` : suffix;
    }

    if (typeof query.title === 'string' && query.title.trim()) {
        const suffix =
            mediaType === 'tv'
                ? 'TV Series'
                : mediaType === 'movie'
                  ? 'Movies'
                  : 'Movies & TV Series';
        return `${query.title.trim()} ${suffix}`;
    }

    const parts = [
        typeof query.country === 'string' ? query.country : '',
        typeof query.dubbing === 'string' ? query.dubbing : '',
        genreLabel
    ].filter(Boolean);

    const suffix =
        mediaType === 'tv' ? 'TV Series' : mediaType === 'movie' ? 'Movies' : 'Movies & TV Series';

    if (parts.length) {
        return `${parts.join(' ')} ${suffix}`;
    }

    if (genreLabel) {
        return `${genreLabel} ${suffix}`;
    }

    if (mediaType === 'tv' || mediaType === 'movie') {
        return suffix;
    }

    return `Explore ${suffix}`;
}

export function activeExploreCountryId(
    query: ExploreRouteQuery
): string {
    const country = typeof query.country === 'string' ? query.country : '';
    if (!country) return '';
    const match = NETMIRROR_EXPLORE_COUNTRIES.find(
        (row) => row.value.toLowerCase() === country.toLowerCase()
    );
    return match?.value || country;
}

export function activeExploreCategoryId(
    query: ExploreRouteQuery
): string {
    const matched = categoryFromExploreQuery(query);
    if (matched) return matched.id;

    const country = typeof query.country === 'string' ? query.country : '';
    const dubbing = typeof query.dubbing === 'string' ? query.dubbing : '';

    const match = NETMIRROR_EXPLORE_CATEGORIES.find(
        (cat) =>
            (cat.filter.country || '').toLowerCase() === country.toLowerCase() &&
            (cat.filter.dubbing || '') === dubbing
    );
    return match?.id || '';
}