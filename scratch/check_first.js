import axios from 'axios';

const API_KEY = 'dfa4c2c7c1de1005adee824dc5593672';
const BASE_URL = 'https://api.themoviedb.org/3/';
const MIN_RELEASE_DATE = '2015-01-01';

const regions = [
    { code: 'US', name: 'United States (English)' },
    { code: 'GB', name: 'United Kingdom (English)' },
    { code: 'IN', name: 'India (Hindi)' },
    { code: 'ES', name: 'Spain (Español)' },
    { code: 'MX', name: 'Mexico (Español)' },
    { code: 'IT', name: 'Italy (Italiano)' },
    { code: 'FR', name: 'France (Français)' },
    { code: 'DE', name: 'Germany (Deutsch)' },
    { code: 'BR', name: 'Brazil (Português)' },
    { code: 'JP', name: 'Japan (日本語)' },
    { code: 'KR', name: 'South Korea (한국어)' },
    { code: 'CN', name: 'China (中文)' },
    { code: 'TH', name: 'Thailand (ภาษาไทย)' },
    { code: 'TW', name: 'Taiwan (中文)' },
    { code: 'PH', name: 'Philippines (Tagalog)' },
    { code: 'ID', name: 'Indonesia (Bahasa)' },
    { code: 'TR', name: 'Turkey (Türkçe)' },
    { code: 'RU', name: 'Russia (Русский)' },
    { code: 'EG', name: 'Egypt (العربية)' },
    { code: 'CA', name: 'Canada (English)' },
    { code: 'AU', name: 'Australia (English)' },
    { code: 'AR', name: 'Argentina (Español)' },
    { code: 'MY', name: 'Malaysia (Melayu)' },
    { code: 'SA', name: 'Saudi Arabia (Arabic)' },
    { code: 'ZA', name: 'South Africa (English)' },
    { code: 'NL', name: 'Netherlands (Nederlands)' },
    { code: 'PL', name: 'Poland (Polski)' },
    { code: 'SE', name: 'Sweden (Svenska)' },
    { code: 'CO', name: 'Colombia (Español)' },
    { code: 'CL', name: 'Chile (Español)' }
];

async function checkTVRegions() {
    console.log('Checking TV regions...');
    for (const region of regions) {
        try {
            const res = await axios.get(`${BASE_URL}discover/tv`, {
                params: {
                    api_key: API_KEY,
                    sort_by: 'first_air_date.desc',
                    with_origin_country: region.code,
                    watch_region: region.code,
                    region: region.code,
                    'first_air_date.gte': MIN_RELEASE_DATE,
                    'vote_count.gte': 7,
                    without_genres: '10767,10763,10766'
                }
            });
            console.log(`${region.code} (${region.name}): ${res.data.total_results} results`);
        } catch (e) {
            console.error(`Error checking ${region.code}:`, e.message);
        }
    }
}

checkTVRegions();
