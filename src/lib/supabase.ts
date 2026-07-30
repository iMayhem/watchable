// Supabase client is created lazily — the @supabase/supabase-js package is
// only dynamically imported the first time a Supabase-backed operation is
// actually needed (login, register, sync, etc.).  This keeps the entire
// Supabase bundle out of the initial JS payload for guest visitors.

const DEFAULT_SUPABASE_URL = 'https://eeyiragtylotiwozbgqp.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVleWlyYWd0eWxvdGl3b3piZ3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzAyNzYsImV4cCI6MjA5NDk0NjI3Nn0.YB_alc7kt5l09eTfNH0x5q-ayBx-dHS1qE-yzHbRTFg';

let _clientPromise: Promise<any> | null = null;

export async function getSupabaseClient(): Promise<any> {
    if (!_clientPromise) {
        _clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
            if (typeof window === 'undefined') {
                return createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);
            }

            let url = localStorage.getItem('supabase_url');
            let key = localStorage.getItem('supabase_key');

            if (!url || url.includes('idwjvciofkvspmumgzmg') || url === 'undefined' || url === 'null' || url.trim() === '') {
                url = DEFAULT_SUPABASE_URL;
                localStorage.removeItem('supabase_url');
            }
            if (!key || url === DEFAULT_SUPABASE_URL || key === 'undefined' || key === 'null' || key.trim() === '') {
                key = DEFAULT_SUPABASE_KEY;
                localStorage.removeItem('supabase_key');
            }

            return createClient(url, key);
        });
    }
    return _clientPromise;
}
