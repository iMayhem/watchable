import { getSupabaseClient } from '../lib/supabase';

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

export async function consumeLoungeFeed(): Promise<DiscussFeedComment[]> {
    try {
        const supabase = await getSupabaseClient();
        const { data } = await supabase
            .from('movora_chat')
            .select('id, username, content, created_at')
            .order('created_at', { ascending: true })
            .limit(200);
        return (data || []) as DiscussFeedComment[];
    } catch (e) {
        console.error('Error fetching lounge feed:', e);
        return [];
    }
}

export async function consumeReviewsFeed(): Promise<DiscussFeedComment[]> {
    try {
        const supabase = await getSupabaseClient();
        const { data } = await supabase
            .from('movora_comments')
            .select('id, media_id, media_type, username, content, created_at')
            .order('created_at', { ascending: false })
            .limit(300);
        return (data || []) as DiscussFeedComment[];
    } catch (e) {
        console.error('Error fetching reviews feed:', e);
        return [];
    }
}

export function resetDiscussFeedCache() {
    // No-op
}