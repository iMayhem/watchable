// Supabase client is created lazily — the @supabase/supabase-js package is
// only dynamically imported the first time a Supabase-backed operation is
// actually needed (login, register, sync, etc.).  This keeps the entire
// Supabase bundle out of the initial JS payload for guest visitors.

const DEFAULT_SUPABASE_URL = 'https://idwjvciofkvspmumgzmg.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkd2p2Y2lvZmt2c3BtdW1nem1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NjkzNTAsImV4cCI6MjEwMDA0NTM1MH0.MY7UGcPNR3k1-WhdTPN5Mh7bwH_6ACD1XjKBoKb84cU';

let _clientPromise: Promise<any> | null = null;

export async function getSupabaseClient(): Promise<any> {
    if (!_clientPromise) {
        _clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
            if (typeof window === 'undefined') {
                return createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);
            }

            let url = localStorage.getItem('supabase_url');
            let key = localStorage.getItem('supabase_key');

            if (!url || url === 'undefined' || url === 'null' || url.trim() === '') url = DEFAULT_SUPABASE_URL;
            if (!key || key === 'undefined' || key === 'null' || key.trim() === '') key = DEFAULT_SUPABASE_KEY;

            return createClient(url, key);
        });
    }
    return _clientPromise;
}
