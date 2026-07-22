import { getSupabaseClient } from '../lib/supabase';

export async function logDownload(
    tmdbId: string | number,
    type: string,
    quality: string,
    title: string
) {
    try {
        const supabase = await getSupabaseClient();
        await supabase.from('download_logs').insert([{
            tmdb_id: String(tmdbId),
            type,
            quality,
            title,
            created_at: new Date().toISOString()
        }]);
    } catch (e) {
        console.error('Failed to log download to Supabase:', e);
    }
}
