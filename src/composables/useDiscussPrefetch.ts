import { getSyncClient } from '../lib/syncClient';

export interface DiscussFeedComment {
    id: string;
    media_id?: string;
    media_type?: string;
    username: string;
    content: string;
    created_at: string;
    is_hidden?: boolean | number;
}

let discussRoutePrefetch: Promise<unknown> | null = null;
let loungeFeedPrefetch: Promise<DiscussFeedComment[]> | null = null;
let reviewsFeedPrefetch: Promise<DiscussFeedComment[]> | null = null;

/** Prime the Discuss page chunk (hover / focus on nav). */
export function prefetchDiscussRoute() {
    if (!discussRoutePrefetch) {
        discussRoutePrefetch = import('../pages/Discuss.vue');
    }
    return discussRoutePrefetch;
}

async function loadLoungeFeed(): Promise<DiscussFeedComment[]> {
    const sync = await getSyncClient();
    const { data, error } = await sync
        .from('movora_chat')
        .select('id, username, content, created_at')
        .order('created_at', { ascending: true })
        .limit(30);

    if (error) throw error;
    return data || [];
}

async function loadReviewsFeed(): Promise<DiscussFeedComment[]> {
    const sync = await getSyncClient();
    const { data, error } = await sync
        .from('movora_comments')
        .select('id, media_id, media_type, username, content, created_at, is_hidden')
        .order('created_at', { ascending: false })
        .limit(500);

    if (error) throw error;
    // Keep filtering client-side. The self-hosted REST adapter has not always
    // implemented PostgREST's `in` operator consistently, which made the
    // Discuss reviews panel silently return an empty feed.
    return (data || []).filter((comment: DiscussFeedComment) =>
        ['movie', 'tv', 'anime'].includes(String(comment.media_type)) && comment.media_id !== 'lounge'
    );
}

function ensureLoungeFeedPrefetch() {
    if (!loungeFeedPrefetch) {
        loungeFeedPrefetch = loadLoungeFeed().catch((err) => {
            loungeFeedPrefetch = null;
            throw err;
        });
    }
    return loungeFeedPrefetch;
}

function ensureReviewsFeedPrefetch() {
    if (!reviewsFeedPrefetch) {
        reviewsFeedPrefetch = loadReviewsFeed().catch((err) => {
            reviewsFeedPrefetch = null;
            throw err;
        });
    }
    return reviewsFeedPrefetch;
}

/** Warm route chunk and Sync client without querying DB on hover. */
export function prefetchDiscussFeed() {
    prefetchDiscussRoute();
    void import('../lib/syncClient');
}

export function consumeLoungeFeed() {
    return ensureLoungeFeedPrefetch();
}

export function consumeReviewsFeed() {
    return ensureReviewsFeedPrefetch();
}

/** Drop cached feeds so the next visit refetches fresh messages. */
export function resetDiscussFeedCache() {
    loungeFeedPrefetch = null;
    reviewsFeedPrefetch = null;
}
