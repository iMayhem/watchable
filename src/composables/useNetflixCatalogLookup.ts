import {
    browseMoovieCatalog,
    inferCatalogMediaType,
    parseCatalogTitle,
    searchMoovieCatalog,
    type MoovieCatalogItem
} from './useMoovieCatalog';
import {
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
    opts: {
        maxPages?: number;
        anchor?: MoovieCatalogItem | { title?: string; media_type?: string };
    } = {}
): Promise<MoovieCatalogItem[]> {
    const maxPages = opts.maxPages ?? 3;
    const needle = normalizeCatalogTitle(displayTitle);
    if (!needle) return [];

    const seen = new Set<string>();
    const matches: MoovieCatalogItem[] = [];

    for (let page = 0; page < maxPages; page++) {
        const data = await searchMoovieCatalog(displayTitle, page);
        for (const item of data.results || []) {
            const parsed = parseCatalogTitle(item.title || '');
            if (normalizeCatalogTitle(parsed.displayTitle) !== needle) continue;
            if (opts.anchor && !isSameCatalogueVariantFamily(item, opts.anchor)) continue;
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            matches.push(item);
        }

        const totalPages = data.pager?.total_pages ?? 1;
        if (page + 1 >= totalPages) break;
    }

    return matches;
}

function seasonSignature(title: string): string {
    const match = title.match(/\bS\d+(?:-S\d+)?\b/i);
    return match ? match[0].toUpperCase() : '';
}

/** Groups true dub variants — same clean title, media type, and season marker. */
export function catalogVariantFamilyKey(item: {
    title?: string;
    media_type?: string;
}): string {
    const parsed = parseCatalogTitle(item.title || '');
    const display = normalizeCatalogTitle(parsed.displayTitle || item.title || '');
    const mediaType = inferCatalogMediaType(item);
    const season = seasonSignature(item.title || '');
    return `${mediaType}:${display}:${season}`;
}

export function isSameCatalogueVariantFamily(
    a: { title?: string; media_type?: string },
    b: { title?: string; media_type?: string }
): boolean {
    return catalogVariantFamilyKey(a) === catalogVariantFamilyKey(b);
}

function normalizeLanguageTag(tag: string): string | null {
    const compact = tag.toLowerCase().replace(/[^a-z]/g, '');
    if (!compact) return null;

    for (const lang of NETFLIX_LANGUAGES) {
        for (const label of lang.matchLabels) {
            const needle = label.toLowerCase().replace(/[^a-z]/g, '');
            if (compact === needle || compact.startsWith(needle) || needle.startsWith(compact)) {
                return lang.label;
            }
        }
    }

    return null;
}

/** Only languages explicitly tagged in the catalogue title, e.g. [Hindi] [Telugu]. */
export function explicitLanguageLabels(item: MoovieCatalogItem): string[] {
    const parsed = parseCatalogTitle(item.title || '');
    const labels: string[] = [];

    for (const tag of parsed.languages) {
        const label = normalizeLanguageTag(tag);
        if (label && !labels.includes(label)) {
            labels.push(label);
        }
    }

    return labels;
}

export function languagesForCatalogueItems(
    items: MoovieCatalogItem[],
    anchor?: MoovieCatalogItem
): NetflixLanguageOption[] {
    const scoped = anchor
        ? items.filter((item) => isSameCatalogueVariantFamily(item, anchor))
        : items;

    const out: NetflixLanguageOption[] = [];
    const seen = new Set<string>();

    for (const item of scoped) {
        for (const label of explicitLanguageLabels(item)) {
            const lang = NETFLIX_LANGUAGES.find((row) => row.label === label);
            if (!lang || seen.has(lang.category)) continue;
            seen.add(lang.category);
            out.push(lang);
        }
    }

    return out;
}

export async function findCatalogueVariantForLanguage(
    displayTitle: string,
    lang: NetflixLanguageOption,
    opts: {
        excludeId?: string;
        mediaType?: 'movie' | 'tv';
        anchorTitle?: string;
    } = {}
): Promise<MoovieCatalogItem | null> {
    const anchor = opts.anchorTitle
        ? { title: opts.anchorTitle, media_type: opts.mediaType }
        : undefined;
    const variants = await findCatalogueLanguageVariants(displayTitle, { anchor });

    for (const item of variants) {
        if (opts.excludeId && item.id === opts.excludeId) continue;
        if (!explicitLanguageLabels(item).includes(lang.label)) continue;
        if (opts.mediaType && inferCatalogMediaType(item) !== opts.mediaType) continue;
        return item;
    }

    return null;
}

export function languageTagsForItem(item: MoovieCatalogItem): string[] {
    return explicitLanguageLabels(item);
}

/** Group verified dub variants and collect only explicit [Language] tags. */
export function buildCatalogLanguageMap(
    pool: MoovieCatalogItem[]
): Map<string, string[]> {
    const groups = new Map<string, MoovieCatalogItem[]>();

    for (const item of pool) {
        const key = catalogVariantFamilyKey(item);
        const bucket = groups.get(key);
        if (bucket) bucket.push(item);
        else groups.set(key, [item]);
    }

    const out = new Map<string, string[]>();
    for (const [key, items] of groups) {
        const labels = languagesForCatalogueItems(items).map((lang) => lang.label);
        if (labels.length) out.set(key, labels);
    }
    return out;
}

export function resolveLanguageTagsForItem(
    item: MoovieCatalogItem,
    map?: Map<string, string[]>
): string[] {
    const fromMap = map?.get(catalogVariantFamilyKey(item));
    if (fromMap?.length) return fromMap;
    return explicitLanguageLabels(item);
}

export function resolveVerifiedLanguageTags(
    item: MoovieCatalogItem,
    variants: MoovieCatalogItem[]
): string[] {
    const labels = languagesForCatalogueItems(variants, item).map((lang) => lang.label);
    return labels.length ? labels : explicitLanguageLabels(item);
}

const VARIANT_SNAPSHOT_TTL_MS = 10 * 60 * 1000;
let variantSnapshotCache: { fetchedAt: number; items: MoovieCatalogItem[] } | null = null;

/** One browse page per language category — cached for cross-language poster labels. */
export async function fetchCatalogVariantSnapshot(
    opts: { force?: boolean } = {}
): Promise<MoovieCatalogItem[]> {
    const now = Date.now();
    if (
        !opts.force &&
        variantSnapshotCache &&
        now - variantSnapshotCache.fetchedAt < VARIANT_SNAPSHOT_TTL_MS
    ) {
        return variantSnapshotCache.items;
    }

    const pages = await Promise.all(
        NETFLIX_LANGUAGES.map((lang) =>
            browseMoovieCatalog(lang.category, 0).catch(() => ({ results: [] }))
        )
    );

    const seen = new Set<string>();
    const items: MoovieCatalogItem[] = [];
    for (const page of pages) {
        for (const item of page.results || []) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            items.push(item);
        }
    }

    variantSnapshotCache = { fetchedAt: now, items };
    return items;
}