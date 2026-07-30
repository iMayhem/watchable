import { getSupabaseClient } from './supabase';

const cache = new Map<string, { value: string | null; timestamp: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minute cache TTL

/**
 * Cached getter for app_settings table in Supabase to eliminate repeated DB round-trips.
 */
export async function getCachedAppSetting(key: string): Promise<string | null> {
    const cached = cache.get(key);
    const now = Date.now();
    if (cached && now - cached.timestamp < TTL_MS) {
        return cached.value;
    }

    try {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .single();

        if (error) {
            return cached ? cached.value : null;
        }

        const value = data?.value ?? null;
        cache.set(key, { value, timestamp: now });
        return value;
    } catch {
        return cached ? cached.value : null;
    }
}

/**
 * Invalidate cache key when updated in admin panel.
 */
export function invalidateAppSettingCache(key?: string) {
    if (key) {
        cache.delete(key);
    } else {
        cache.clear();
    }
}
