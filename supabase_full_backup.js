import fs from 'fs';

const urlBase = 'https://idwjvciofkvspmumgzmg.supabase.co/rest/v1/';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkd2p2Y2lvZmt2c3BtdW1nem1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NjkzNTAsImV4cCI6MjEwMDA0NTM1MH0.MY7UGcPNR3k1-WhdTPN5Mh7bwH_6ACD1XjKBoKb84cU';

const tables = [
    'app_settings',
    'anime_catalog_cache',
    'catalog_audio_cache',
    'catalog_enrichment_cache',
    'movora_comments',
    'notifications',
    'notification_reads',
    'banners',
    'polls',
    'poll_votes',
    'party_chat_messages',
    'youtube_rooms',
    'yt_chat_messages',
    'rooms',
    'movora_users'
];

console.log('Starting full paginated backup of Supabase data with auto-ordering key detection...');

const backup = {};

for (const table of tables) {
    backup[table] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    let orderKey = null;

    console.log(`Fetching table "${table}"...`);

    while (hasMore) {
        try {
            // Build the URL. On first page we don't know the order key yet, so fetch without ordering
            let url = `${urlBase}${table}?select=*&limit=${limit}&offset=${offset}`;
            if (orderKey) {
                url += `&order=${orderKey}.asc`;
            }

            const res = await fetch(url, {
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`
                }
            });

            if (res.status === 200) {
                const data = await res.json();
                
                // If it is the first page, detect the ordering key dynamically from the keys present in data
                if (offset === 0 && data.length > 0) {
                    const firstRow = data[0];
                    if ('id' in firstRow) {
                        orderKey = 'id';
                    } else if ('catalog_id' in firstRow) {
                        orderKey = 'catalog_id';
                    } else if ('anilist_id' in firstRow) {
                        orderKey = 'anilist_id';
                    } else if ('username' in firstRow) {
                        orderKey = 'username';
                    } else {
                        // Fallback to the first key in the row object
                        orderKey = Object.keys(firstRow)[0];
                    }
                    console.log(`  [Info] Detected ordering key: "${orderKey}"`);
                }

                backup[table].push(...data);
                console.log(`  Fetched ${data.length} rows (total: ${backup[table].length})`);

                if (data.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            } else {
                const text = await res.text();
                console.log(`  ❌ Failed to fetch page for "${table}": status ${res.status} - ${text}`);
                hasMore = false;
            }
        } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
            hasMore = false;
        }
    }
}

fs.writeFileSync('supabase_full_data_backup.json', JSON.stringify(backup, null, 2));
console.log('Complete backup finished and saved to supabase_full_data_backup.json');
