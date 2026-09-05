/** AnimePlay embed API — AniList route only. */
export const ANIMEPLAY_EMBED_ORIGIN = 'https://animeplay.cfd';
export const MEGAPLAY_EMBED_ORIGIN = 'https://megaplay.buzz';

export type AnimeplayLanguage = 'sub' | 'dub';

/** https://animeplay.cfd/stream/ani/{anilist-id}/{ep-num}/{language} */
export function buildAnimeplayAnilistEmbedUrl(
    anilistId: number,
    episode: number,
    lang: AnimeplayLanguage = 'sub'
): string {
    if (!anilistId || !episode) return '';
    return `${ANIMEPLAY_EMBED_ORIGIN}/stream/ani/${anilistId}/${episode}/${lang}`;
}

/** https://megaplay.buzz/stream/ani/{anilist-id}/{ep-num}/{language} */
export function buildMegaplayAnilistEmbedUrl(
    anilistId: number,
    episode: number,
    lang: AnimeplayLanguage = 'sub'
): string {
    if (!anilistId || !episode) return '';
    return `${MEGAPLAY_EMBED_ORIGIN}/stream/ani/${anilistId}/${episode}/${lang}`;
}

export function isAnimeplayEmbedUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('animeplay.cfd') || lower.includes('megaplay.buzz');
}

/** MegaPlay /ani route only indexes aired eps; unreleased ones return 404. */
export function resolveAnimeplayStreamEpisode(
    episode: number,
    media: {
        status?: string | null;
        nextAiringEpisode?: { episode?: number | null } | null;
    } | null | undefined,
    catalogMax = 0
): number {
    const ep = Math.max(1, Math.floor(episode) || 1);
    const nextEp = media?.nextAiringEpisode?.episode;
    if (
        media?.status === 'RELEASING' &&
        typeof nextEp === 'number' &&
        nextEp > 1
    ) {
        return Math.min(ep, nextEp - 1);
    }
    if (catalogMax > 0) {
        return Math.min(ep, catalogMax);
    }
    return ep;
}

export const ANIMEPLAY_MESSAGE_ORIGINS = [
    ANIMEPLAY_EMBED_ORIGIN,
    'https://megaplay.buzz'
] as const;

export function isAnimeplayPlayerMessage(event: MessageEvent): boolean {
    return ANIMEPLAY_MESSAGE_ORIGINS.includes(
        event.origin as (typeof ANIMEPLAY_MESSAGE_ORIGINS)[number]
    );
}