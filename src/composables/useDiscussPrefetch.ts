export interface DiscussFeedComment {
    id: string;
    media_id?: string;
    media_type?: string;
    username: string;
    content: string;
    created_at: string;
}

export function prefetchDiscussRoute() {
    return Promise.resolve(null);
}

export function prefetchDiscussFeed() {
    // Disabled background prefetching to eliminate database load on hover
}

export function consumeLoungeFeed(): Promise<DiscussFeedComment[]> {
    return Promise.resolve([]);
}

export function consumeReviewsFeed(): Promise<DiscussFeedComment[]> {
    return Promise.resolve([]);
}

export function resetDiscussFeedCache() {
    // No-op
}