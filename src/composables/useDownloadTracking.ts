import { getSyncClient } from '../lib/syncClient';

export async function logDownload(
    tmdbId: string | number,
    type: string,
    quality: string,
    title: string
) {
    try {
        const sync = await getSyncClient();
        await sync.from('download_logs').insert([{
            tmdb_id: String(tmdbId),
            type,
            quality,
            title,
            created_at: new Date().toISOString()
        }]);
    } catch (e) {
        console.error('Failed to log download to Sync:', e);
    }
}
