import {
    inferCatalogMediaType,
    parseCatalogTitle,
    searchMoovieCatalog,
    type MoovieCatalogItem
} from './useMoovieCatalog';
import {
    itemMatchesLanguage,
    NETFLIX_LANGUAGES,
    type NetflixLanguageOption
} from './useNetflixLanguage';

function normalizeCatalogTitle(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export interface CatalogStreamTarget {
    mediaType: 'movie' | 'tv';
    season: number;
    episode: number;
    path: string;
}

export function catalogStreamTarget(item: {
    id: string;
    title?: string;
    media_type?: string;
}): CatalogStreamTarget {
    const mediaType = inferCatalogMediaType(item);
    const parsed = parseCatalogTitle(item.title || '');

    if (mediaType === 'movie') {
        return {
            mediaType,
            season: 0,
            episode: 0,
            path: `/stream/nf/movie/${item.id}`
        };
    }

    const season = parsed.season || 1;
    return {
        mediaType,
        season,
        episode: 1,
        path: `/stream/nf/tv/${item.id}/season/${season}/episode/1`
    };
}

export async function findCatalogueLanguageVariants(
    displayTitle: string,
    maxPages = 3
): Promise<MoovieCatalogItem[]> {
    const needle = normalizeCatalogTitle(displayTitle);
    if (!needle) return [];

    const seen = new Set<string>();
    const matches: MoovieCatalogItem[] = [];

    for (let page = 0; page < maxPages; page++) {
        const data = await searchMoovieCatalog(displayTitle, page);
        for (const item of data.results || []) {
            const parsed = parseCatalogTitle(item.title || '');
            if (normalizeCatalogTitle(parsed.displayTitle) !== needle) continue;
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            matches.push(item);
        }

        const totalPages = data.pager?.total_pages ?? 1;
        if (page + 1 >= totalPages) break;
    }

    return matches;
}

export function languagesForCatalogueItems(
    items: MoovieCatalogItem[]
): NetflixLanguageOption[] {
    const out: NetflixLanguageOption[] = [];
    const seen = new Set<string>();

    for (const item of items) {
        for (const lang of NETFLIX_LANGUAGES) {
            if (seen.has(lang.category)) continue;
            if (itemMatchesLanguage(item, lang)) {
                seen.add(lang.category);
                out.push(lang);
            }
        }
    }

    return out;
}

export async function findCatalogueVariantForLanguage(
    displayTitle: string,
    lang: NetflixLanguageOption,
    opts: { excludeId?: string; mediaType?: 'movie' | 'tv' } = {}
): Promise<MoovieCatalogItem | null> {
    const variants = await findCatalogueLanguageVariants(displayTitle);
    const needle = normalizeCatalogTitle(displayTitle);

    for (const item of variants) {
        if (opts.excludeId && item.id === opts.excludeId) continue;
        const parsed = parseCatalogTitle(item.title || '');
        if (normalizeCatalogTitle(parsed.displayTitle) !== needle) continue;
        if (!itemMatchesLanguage(item, lang)) continue;
        if (opts.mediaType && inferCatalogMediaType(item) !== opts.mediaType) continue;
        return item;
    }

    return null;
}

export function languageTagsForItem(item: MoovieCatalogItem): string[] {
    const parsed = parseCatalogTitle(item.title || '');
    if (parsed.languages.length) return parsed.languages;

    return languagesForCatalogueItems([item]).map((lang) => lang.label);
}