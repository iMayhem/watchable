export type PartyMediaType = 'movie' | 'tv' | 'anime';
export type PartySource = 'global' | 'netflix';

export interface PartyRoomInput {
    id: string | number;
    /** TMDB or AniList id for global party rooms. */
    partyId?: string | number;
    title: string;
    type?: PartyMediaType;
    season?: number;
    episode?: number;
    source?: PartySource;
}

function resolvePartyMediaId(input: PartyRoomInput): string {
    const type = input.type || 'movie';
    const partyId = input.partyId != null ? String(input.partyId).trim() : '';
    if (type === 'anime') {
        // Global anime embeds require AniList ids — never fall back to TMDB route ids.
        return partyId || String(input.id || '').trim();
    }
    if (partyId) return partyId;
    return String(input.id || '').trim();
}

export function buildPartyRoomId(input: PartyRoomInput): string {
    const source = input.source || 'global';
    const isNetflix = source === 'netflix';
    const id = isNetflix
        ? String(input.id || '').trim()
        : resolvePartyMediaId(input);
    if (!id) return '';

    const type = input.type || 'movie';
    const season = input.season ?? 1;
    const episode = input.episode ?? 1;

    if (isNetflix) {
        if (type === 'anime') {
            return `nf_anime_${id}_ep${episode}`;
        }
        if (type === 'tv') {
            return `nf_${id}_s${season}e${episode}`;
        }
        return `nf_${id}`;
    }

    if (type === 'tv') {
        return `${id}_s${season}e${episode}`;
    }
    if (type === 'anime') {
        return `anime_${id}_ep${episode}`;
    }
    return id;
}

/** Party link for detail pages, billboards, and spotlight modules. */
export function buildPartyHref(input: PartyRoomInput): string {
    const room = buildPartyRoomId(input);
    if (!room) return '/party';
    const title = encodeURIComponent(input.title || '');
    return `/party?room=${room}&title=${title}`;
}

/** Party link for active stream playback. */
export function buildStreamPartyHref(input: PartyRoomInput): string {
    return buildPartyHref(input);
}