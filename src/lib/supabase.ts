// Supabase client is created lazily — the @supabase/supabase-js package is
// only dynamically imported the first time a Supabase-backed operation is
// actually needed (login, register, sync, etc.).  This keeps the entire
// Supabase bundle out of the initial JS payload for guest visitors.

const DEFAULT_SUPABASE_URL = 'https://jagmmmnxgbinlugxeinc.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZ21tbW54Z2Jpbmx1Z3hlaW5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDExOTcsImV4cCI6MjA5OTAxNzE5N30.9oLJOU-HTk-YnhSckPxe_UnBG2yFIT9quAt_mYnMZH4';

let _clientPromise: Promise<any> | null = null;

export async function getSupabaseClient(): Promise<any> {
    if (!_clientPromise) {
        _clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
            if (typeof window === 'undefined') {
                return createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);
            }

            let url = localStorage.getItem('supabase_url');
            let key = localStorage.getItem('supabase_key');

            if (!url || url.includes('idwjvciofkvspmumgzmg') || url.includes('eeyiragtylotiwozbgqp') || url === 'undefined' || url === 'null' || url.trim() === '') {
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
