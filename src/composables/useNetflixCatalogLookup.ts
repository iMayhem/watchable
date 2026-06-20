import {
    catalogIdCollidesWithAnilist,
    isKnownAnilistCatalogId,
    netflixAnimeDetailPath,
    peekAnilistIdForMoovieCatalogId
} from './useAnimeCatalogCache';
import { isAnimeCatalogueItem } from './useNetflixRails';
import { peekCatalogAudioCache } from './useCatalogAudioCache';
import {
    browseMoovieCatalog,
    catalogHasEpisodeGuide,
    catalogSearchTitle,
    inferCatalogMediaType,
    parseCatalogTitle,
    searchMoovieCatalog,
    type MoovieCatalogItem
} from './useMoovieCatalog';
import {
    NETFLIX_LANGUAGES,
    type NetflixLanguageOption
} from './useNetflixLanguage';
import {
    catalogBrowseRankScore,
    compareCatalogBrowseRank,
    sortCatalogByBrowseRank,
    type CatalogBrowseRankContext
} from './useNetflixBrowseRank';
import type { CatalogTmdbMeta } from './useTmdbArtwork';

function normalizeCatalogTitle(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholeCatalogPhrase(name: string, phrase: string): boolean {
    if (!phrase || phrase.length < 4) return false;
    const pattern = new RegExp(
        `\\b${escapeRegExp(phrase).replace(/\s+/g, '\\s+')}\\b`
    );
    return pattern.test(name);
}

export const ANIME_CATALOG_MIN_MATCH_SCORE = 92;

export function titleMatchScore(query: string, candidate: string): number {
    const q = normalizeCatalogTitle(query);
    const c = normalizeCatalogTitle(candidate);
    if (!q || !c) return 0;
    if (q === c) return 100;
    if (c.startsWith(`${q} `) || c.startsWith(`${q}:`)) return 92;
    if (q.startsWith(`${c} `) || q.startsWith(`${c}:`)) return 88;
    // Whole-word only — NetMirror never fuzzy-merges titles like Obsess ↔ Obsession.
    if (hasWholeCatalogPhrase(c, q) || hasWholeCatalogPhrase(q, c)) return 72;
    return 0;
}

export function bestTitleMatchScore(queries: string[], candidateTitle: string): number {
    let best = 0;
    for (const query of queries) {
        best = Math.max(best, titleMatchScore(query, candidateTitle));
    }
    return best;
}

export function catalogSearchMatchScore(
    query: string,
    item: Pick<MoovieCatalogItem, 'title'>
): number {
    const q = query.trim();
    if (!q) return 0;

    const displayTitle = catalogSearchTitle(item.title || '');
    const displayScore = titleMatchScore(q, displayTitle);
    if (displayScore) return displayScore;

    return titleMatchScore(q, item.title || '');
}

/** Search grids — exact title matches first, then editorial browse rank. */
export function sortCatalogBySearchRelevance(
    pool: MoovieCatalogItem[],
    query: string,
    ctx: CatalogBrowseRankContext = {}
): MoovieCatalogItem[] {
    const q = query.trim();
    if (!q || pool.length < 2) {
        return sortCatalogByBrowseRank(pool, ctx);
    }

    return [...pool].sort((a, b) => {
        const matchDiff =
            catalogSearchMatchScore(q, b) - catalogSearchMatchScore(q, a);
        if (matchDiff !== 0) return matchDiff;
        return compareCatalogBrowseRank(a, b, ctx);
    });
}

export function scoreCatalogTitleCandidates(
    queries: string[],
    candidates: MoovieCatalogItem[],
    opts: {
        tvOnly?: boolean;
        movieOnly?: boolean;
        minScore?: number;
        /** When set, reject catalogue rows whose id equals this AniList id unless title score is high. */
        anilistId?: number;
    } = {}
): MoovieCatalogItem[] {
    const minScore =
        opts.minScore ?? (opts.anilistId ? ANIME_CATALOG_MIN_MATCH_SCORE : 80);
    const scored: Array<{ item: MoovieCatalogItem; score: number }> = [];

    for (const item of candidates) {
        if (opts.tvOnly && inferCatalogMediaType(item) !== 'tv') continue;
        if (opts.movieOnly && inferCatalogMediaType(item) !== 'movie') continue;

        const parsed = parseCatalogTitle(item.title || '');
        const display = parsed.displayTitle || item.title || '';
        const best = bestTitleMatchScore(queries, display);

        // AniList and Moovie catalogue ids share one number space — never trust a numeric match.
        if (
            opts.anilistId &&
            (String(item.id) === String(opts.anilistId) ||
                catalogIdCollidesWithAnilist(opts.anilistId, item.id))
        ) {
            continue;
        }

        if (best >= minScore) {
            scored.push({ item, score: best });
        }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((row) => row.item);
}

/** Prefer active audio tab, then English, then any other tagged variant. */
export function pickCatalogPlayVariant(
    variants: MoovieCatalogItem[],
    preferredLang?: NetflixLanguageOption
): MoovieCatalogItem | null {
    if (!variants.length) return null;

    const labeled = variants.map((item) => ({
        item,
        labels: languageTagsForItem(item)
    }));

    if (preferredLang) {
        const preferred = labeled.find((row) => row.labels.includes(preferredLang.label));
        if (preferred) return preferred.item;
    }

    const english = labeled.find((row) => row.labels.includes('English'));
    if (english) return english.item;

    const tagged = labeled.find((row) => row.labels.length);
    if (tagged) return tagged.item;

    const withArtwork = variants.find((item) => Boolean(item.backdrop_path));
    if (withArtwork) return withArtwork;

    return variants[0];
}

export function sortLanguageTagsForDisplay(tags: string[]): string[] {
    const unique = [...new Set(tags.filter(Boolean))];
    return unique.sort((a, b) => {
        if (a === 'English') return -1;
        if (b === 'English') return 1;
        return a.localeCompare(b);
    });
}

export async function resolveCatalogPlayVariantForTitles(
    queries: string[],
    opts: {
        preferredLang?: NetflixLanguageOption;
        tvOnly?: boolean;
        movieOnly?: boolean;
        searchPages?: number;
        minScore?: number;
        anilistId?: number;
        candidatePool?: MoovieCatalogItem[];
    } = {}
): Promise<{ item: MoovieCatalogItem | null; languageTags: string[] }> {
    const searchPages = opts.searchPages ?? 3;
    const seen = new Set<string>();
    const candidates: MoovieCatalogItem[] = [];

    for (const item of opts.candidatePool || []) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        candidates.push(item);
    }

    for (const query of queries) {
        const trimmed = query.trim();
        if (!trimmed) continue;
        for (let page = 0; page < searchPages; page += 1) {
            const data = await searchMoovieCatalog(trimmed, page);
            for (const item of data.results || []) {
                if (seen.has(item.id)) continue;
                seen.add(item.id);
                candidates.push(item);
            }
            const totalPages = data.pager?.total_pages ?? 1;
            if (page + 1 >= totalPages) break;
        }
    }

    const matched = scoreCatalogTitleCandidates(queries, candidates, {
        tvOnly: opts.tvOnly,
        movieOnly: opts.movieOnly,
        minScore: opts.minScore,
        anilistId: opts.anilistId
    });
    if (!matched.length) {
        return { item: null, languageTags: [] };
    }

    const anchor = matched[0];
    const parsed = parseCatalogTitle(anchor.title || '');
    const variants = await findCatalogueLanguageVariants(parsed.displayTitle || '', {
        anchor
    });

    const familySeen = new Set<string>();
    const family: MoovieCatalogItem[] = [];
    for (const item of [...matched, ...variants]) {
        if (familySeen.has(item.id)) continue;
        familySeen.add(item.id);
        family.push(item);
    }

    const languageTags = sortLanguageTagsForDisplay(
        resolveVerifiedLanguageTags(anchor, family)
    );
    const item = pickCatalogPlayVariant(family, opts.preferredLang);

    return { item, languageTags };
}

export interface CatalogStreamTarget {
    mediaType: 'movie' | 'tv';
    season: number;
    episode: number;
    path: string;
}

export type CatalogDetailRouteInput = {
    id: string | number;
    title?: string;
    media_type?: string;
    type?: 'movie' | 'tv' | 'anime';
    channel?: string;
    anilistId?: number;
    duration?: unknown;
    embed?: string | null;
    subjectid?: string | null;
    embed_en?: string | null;
    season?: unknown;
};

export function resolveCatalogAnimeAnilistId(
    item: CatalogDetailRouteInput
): number | undefined {
    if (item.type === 'anime' && item.anilistId && Number(item.anilistId) > 0) {
        return Number(item.anilistId);
    }
    if (item.anilistId && Number(item.anilistId) > 0) {
        return Number(item.anilistId);
    }

    const moovieId = String(item.id);
    const mappedAnilist = peekAnilistIdForMoovieCatalogId(moovieId);
    if (mappedAnilist) {
        return mappedAnilist;
    }

    const numericId = Number(item.id);
    if (Number.isFinite(numericId) && isKnownAnilistCatalogId(numericId)) {
        return numericId;
    }

    if (item.type === 'anime' && Number.isFinite(numericId) && numericId > 0) {
        return numericId;
    }

    return undefined;
}

export function netflixCatalogDetailPath(item: CatalogDetailRouteInput): string {
    const anilistId = resolveCatalogAnimeAnilistId(item);
    if (anilistId) {
        return netflixAnimeDetailPath(anilistId);
    }

    const catalogItem: MoovieCatalogItem = {
        id: String(item.id),
        title: item.title || '',
        backdrop_path: null,
        release_date: '',
        vote_average: 0,
        media_type:
            item.media_type === 'tv' || item.type === 'tv'
                ? 'tv'
                : item.media_type === 'movie' || item.type === 'movie'
                  ? 'movie'
                  : 'movie',
        channel: item.channel,
        duration: item.duration as MoovieCatalogItem['duration'],
        embed: item.embed,
        subjectid: item.subjectid,
        embed_en: item.embed_en,
        season: item.season as MoovieCatalogItem['season']
    };

    if (isAnimeCatalogueItem(catalogItem)) {
        const numericId = Number(item.id);
        if (Number.isFinite(numericId) && numericId > 0) {
            return netflixAnimeDetailPath(numericId);
        }
    }

    const mediaType = inferCatalogMediaType({
        title: item.title || '',
        media_type: item.media_type || item.type,
        duration: item.duration,
        embed: item.embed,
        subjectid: item.subjectid,
        embed_en: item.embed_en,
        season: item.season
    });
    return `/nf/${mediaType}/${item.id}`;
}

export type CatalogPlayRouteInput = CatalogDetailRouteInput & {
    moovieCatalogId?: string;
    catalogTitle?: string;
};

/** Netflix catalogue cards and heroes open the player — not info pages. */
export function netflixCatalogPlayPath(item: CatalogPlayRouteInput): string {
    const title = item.catalogTitle || item.title || '';
    const catalogId = item.moovieCatalogId || String(item.id);
    const streamItem = {
        id: catalogId,
        title,
        media_type:
            item.media_type ||
            (item.type === 'anime' ? 'tv' : item.type === 'tv' ? 'tv' : undefined),
        duration: item.duration,
        embed: item.embed,
        subjectid: item.subjectid,
        embed_en: item.embed_en,
        season: item.season
    };

    if (item.type === 'anime' || resolveCatalogAnimeAnilistId(item)) {
        if (item.moovieCatalogId) {
            return catalogStreamTarget(streamItem, { supportsEpisodes: true }).path;
        }
    }

    const inferred = inferCatalogMediaType({
        title,
        media_type: streamItem.media_type,
        duration: item.duration,
        embed: item.embed,
        subjectid: item.subjectid,
        embed_en: item.embed_en,
        season: item.season
    });

    return catalogStreamTarget(
        { ...streamItem, media_type: inferred },
        { supportsEpisodes: inferred === 'tv' }
    ).path;
}

export function catalogStreamPath(
    id: string | number,
    season: number,
    episode: number
): string {
    return `/stream/nf/tv/${id}/season/${season}/episode/${episode}`;
}

export function catalogStreamTarget(
    item: {
        id: string;
        title?: string;
        media_type?: string;
        duration?: unknown;
        embed?: string | null;
        subjectid?: string | null;
        embed_en?: string | null;
        season?: unknown;
    },
    opts: {
        supportsEpisodes?: boolean;
        season?: number;
        episode?: number;
        routeType?: 'movie' | 'tv';
    } = {}
): CatalogStreamTarget {
    const parsed = parseCatalogTitle(item.title || '');
    const season = opts.season ?? parsed.season ?? 1;
    const episode = opts.episode ?? 1;

    const hasEpisodeGuide = catalogHasEpisodeGuide(item, opts.routeType);

    if (opts.supportsEpisodes && hasEpisodeGuide) {
        return {
            mediaType: 'tv',
            season,
            episode,
            path: catalogStreamPath(item.id, season, episode)
        };
    }

    if (!hasEpisodeGuide) {
        return {
            mediaType: 'movie',
            season: 0,
            episode: 0,
            path: `/stream/nf/movie/${item.id}`
        };
    }

    const mediaType = inferCatalogMediaType(item);

    if (mediaType === 'movie') {
        return {
            mediaType,
            season: 0,
            episode: 0,
            path: `/stream/nf/movie/${item.id}`
        };
    }

    return {
        mediaType,
        season,
        episode: 1,
        path: catalogStreamPath(item.id, season, 1)
    };
}

const VARIANT_SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const variantSearchCache = new Map<
    string,
    { at: number; items: MoovieCatalogItem[] }
>();

function variantSearchCacheKey(
    displayTitle: string,
    anchor?: MoovieCatalogItem | { title?: string; media_type?: string }
): string {
    const needle = normalizeCatalogTitle(displayTitle);
    const family = anchor ? catalogVariantFamilyKey(anchor) : '*';
    return `${needle}:${family}`;
}

export async function findCatalogueLanguageVariants(
    displayTitle: string,
    opts: {
        maxPages?: number;
        anchor?: MoovieCatalogItem | { title?: string; media_type?: string };
    } = {}
): Promise<MoovieCatalogItem[]> {
    const maxPages = opts.maxPages ?? 4;
    const needle = normalizeCatalogTitle(
        catalogSearchTitle(displayTitle) || displayTitle
    );
    if (!needle) return [];

    const cacheKey = variantSearchCacheKey(displayTitle, opts.anchor);
    const cached = variantSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.at < VARIANT_SEARCH_CACHE_TTL_MS) {
        return cached.items;
    }

    const seen = new Set<string>();
    const matches: MoovieCatalogItem[] = [];

    for (let page = 0; page < maxPages; page++) {
        const data = await searchMoovieCatalog(displayTitle, page);
        for (const item of data.results || []) {
            if (
                normalizeCatalogTitle(catalogSearchTitle(item.title || '')) !==
                needle
            ) {
                continue;
            }
            if (opts.anchor && !isSameCatalogueVariantFamily(item, opts.anchor)) continue;
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            matches.push(item);
        }

        const totalPages = data.pager?.total_pages ?? 1;
        if (page + 1 >= totalPages) break;
    }

    variantSearchCache.set(cacheKey, { at: Date.now(), items: matches });
    return matches;
}

/** Map Netflix language category (e.g. hindi) → catalogue row for that dub. */
export function catalogVariantsByLanguage(
    items: MoovieCatalogItem[],
    anchor?: MoovieCatalogItem | { title?: string; media_type?: string }
): Map<string, MoovieCatalogItem> {
    const scoped = anchor
        ? items.filter((item) => isSameCatalogueVariantFamily(item, anchor))
        : items;
    const out = new Map<string, MoovieCatalogItem>();

    for (const item of scoped) {
        for (const label of explicitLanguageLabels(item)) {
            const lang = NETFLIX_LANGUAGES.find((row) => row.label === label);
            if (!lang || out.has(lang.category)) continue;
            out.set(lang.category, item);
        }
    }

    return out;
}

function cleanRawCatalogTitle(raw: string): string {
    return raw.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function variantDisplayTitle(item: { title?: string; media_type?: string }): string {
    const raw = cleanRawCatalogTitle(item.title || '');
    return normalizeCatalogTitle(catalogSearchTitle(raw) || raw);
}

/** Groups dub variants — same clean title + media type (season markers ignored for TV). */
export function catalogVariantFamilyKey(item: {
    title?: string;
    media_type?: string;
}): string {
    const raw = cleanRawCatalogTitle(item.title || '');
    const display = variantDisplayTitle({ ...item, title: raw });
    const mediaType = inferCatalogMediaType({ ...item, title: raw });
    return `${mediaType}:${display}`;
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

/** Languages tagged on this catalogue row's channel field (e.g. HindiDub, Hindi). */
function channelLanguageLabels(item: MoovieCatalogItem): string[] {
    const labels: string[] = [];
    for (const part of (item.channel || '').split(',')) {
        const label = normalizeLanguageTag(part.trim());
        if (label && !labels.includes(label)) {
            labels.push(label);
        }
    }
    return labels;
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
        maxPages?: number;
        knownVariants?: MoovieCatalogItem[];
    } = {}
): Promise<MoovieCatalogItem | null> {
    const anchor = opts.anchorTitle
        ? { title: opts.anchorTitle, media_type: opts.mediaType }
        : undefined;

    const variants =
        opts.knownVariants?.length
            ? opts.knownVariants
            : await findCatalogueLanguageVariants(displayTitle, {
                  anchor,
                  maxPages: opts.maxPages ?? 4
              });

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

/** Audio language of this catalogue row — explicit [Tag] first, then channel dub hints. */
export function playbackLanguageCategoryForItem(
    item: Pick<MoovieCatalogItem, 'title' | 'media_type' | 'channel'>
): string | null {
    const explicit = explicitLanguageLabels(item as MoovieCatalogItem);
    const labels = sortLanguageTagsForDisplay(
        explicit.length ? explicit : channelLanguageLabels(item as MoovieCatalogItem)
    );
    if (!labels.length) return null;

    const lang = NETFLIX_LANGUAGES.find((row) => row.label === labels[0]);
    return lang?.category ?? null;
}

/**
 * Collapse dub variants (e.g. Title [Hindi] S1 + Title [Telugu] S1) into one row.
 * Picks a play target (English first) while language tags come from the full pool.
 */
export function dedupeCatalogItemsByVariantFamily(
    items: MoovieCatalogItem[],
    opts: {
        preferredLang?: NetflixLanguageOption;
        tmdbById?: Map<string, CatalogTmdbMeta>;
    } = {}
): MoovieCatalogItem[] {
    if (!items.length) return [];

    const groups = new Map<string, MoovieCatalogItem[]>();

    for (const item of items) {
        const key = catalogVariantFamilyKey(item);
        const bucket = groups.get(key);
        if (bucket) {
            bucket.push(item);
        } else {
            groups.set(key, [item]);
        }
    }

    const rankCtx = { tmdbById: opts.tmdbById };
    const families = [...groups.entries()]
        .map(([key, variants]) => ({
            key,
            variants,
            score: Math.max(
                ...variants.map((item) => catalogBrowseRankScore(item, rankCtx))
            )
        }))
        .sort((a, b) => b.score - a.score);

    return families
        .map((row) => pickCatalogPlayVariant(row.variants, opts.preferredLang))
        .filter((item): item is MoovieCatalogItem => item != null);
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
        const labels = collectMergedLanguageLabels(items);
        if (labels.length) out.set(key, labels);
    }
    return out;
}

/** Merge explicit [Tag] + channel dub hints from every row in a variant family. */
function collectMergedLanguageLabels(items: MoovieCatalogItem[]): string[] {
    const seen = new Set<string>();
    const labels: string[] = [];

    const push = (label: string | null) => {
        if (!label || seen.has(label)) return;
        seen.add(label);
        labels.push(label);
    };

    for (const item of items) {
        for (const label of explicitLanguageLabels(item)) {
            push(label);
        }
        for (const label of channelLanguageLabels(item)) {
            push(label);
        }
    }

    return sortLanguageTagsForDisplay(labels);
}

export function resolveLanguageTagsForItem(
    item: MoovieCatalogItem,
    map?: Map<string, string[]>,
    audioCacheById?: Map<string, string[]>
): string[] {
    const fromAudio =
        audioCacheById?.get(String(item.id)) ??
        peekCatalogAudioCache(item.id);
    if (fromAudio?.length) return sortLanguageTagsForDisplay(fromAudio);

    const fromMap = map?.get(catalogVariantFamilyKey(item));
    if (fromMap?.length) return sortLanguageTagsForDisplay(fromMap);

    const explicit = explicitLanguageLabels(item);
    if (explicit.length) return sortLanguageTagsForDisplay(explicit);

    return sortLanguageTagsForDisplay(channelLanguageLabels(item));
}

export function resolveVerifiedLanguageTags(
    item: MoovieCatalogItem,
    variants: MoovieCatalogItem[]
): string[] {
    const labels = languagesForCatalogueItems(variants, item).map((lang) => lang.label);
    return sortLanguageTagsForDisplay(
        labels.length ? labels : explicitLanguageLabels(item)
    );
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

    const VARIANT_PAGES_PER_LANG = 4;
    const pages = await Promise.all(
        NETFLIX_LANGUAGES.flatMap((lang) =>
            Array.from({ length: VARIANT_PAGES_PER_LANG }, (_, page) =>
                browseMoovieCatalog(lang.category, page).catch(() => ({ results: [] }))
            )
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