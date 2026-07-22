import { useStorage } from '@vueuse/core';
import { readonly, ref } from 'vue';
import { getSupabaseClient } from '../lib/supabase';

export interface RegionOption {
    code: string;
    name: string;
}

export interface LanguageOption {
    code: string;
    name: string;
}

export const REGIONS: RegionOption[] = [
    { code: 'global', name: 'Global (Neutral)' },
    { code: 'AR', name: 'Argentina (Español)' },
    { code: 'AU', name: 'Australia (English)' },
    { code: 'BR', name: 'Brazil (Português)' },
    { code: 'CA', name: 'Canada (English)' },
    { code: 'CL', name: 'Chile (Español)' },
    { code: 'CN', name: 'China (中文)' },
    { code: 'CO', name: 'Colombia (Español)' },
    { code: 'EG', name: 'Egypt (العربية)' },
    { code: 'FR', name: 'France (Français)' },
    { code: 'DE', name: 'Germany (Deutsch)' },
    { code: 'IN', name: 'India (Hindi)' },
    { code: 'ID', name: 'Indonesia (Bahasa)' },
    { code: 'IT', name: 'Italy (Italiano)' },
    { code: 'JP', name: 'Japan (日本語)' },
    { code: 'MY', name: 'Malaysia (Melayu)' },
    { code: 'MX', name: 'Mexico (Español)' },
    { code: 'NL', name: 'Netherlands (Nederlands)' },
    { code: 'PH', name: 'Philippines (Tagalog)' },
    { code: 'PL', name: 'Poland (Polski)' },
    { code: 'RU', name: 'Russia (Русский)' },
    { code: 'SA', name: 'Saudi Arabia (Arabic)' },
    { code: 'ZA', name: 'South Africa (English)' },
    { code: 'KR', name: 'South Korea (한국어)' },
    { code: 'ES', name: 'Spain (Español)' },
    { code: 'SE', name: 'Sweden (Svenska)' },
    { code: 'TW', name: 'Taiwan (中文)' },
    { code: 'TH', name: 'Thailand (ภาษาไทย)' },
    { code: 'TR', name: 'Turkey (Türkçe)' },
    { code: 'GB', name: 'United Kingdom (English)' },
    { code: 'US', name: 'United States (English)' }
];

export const LANGUAGES: LanguageOption[] = [
    { code: 'en-US', name: 'English' },
    { code: 'es-ES', name: 'Español' },
    { code: 'it-IT', name: 'Italiano' },
    { code: 'fr-FR', name: 'Français' },
    { code: 'de-DE', name: 'Deutsch' },
    { code: 'pt-BR', name: 'Português' },
    { code: 'ja-JP', name: '日本語' },
    { code: 'ko-KR', name: '한국어' },
    { code: 'zh-CN', name: '中文' },
    { code: 'th-TH', name: 'ภาษาไทย' },
    { code: 'tl-PH', name: 'Tagalog' },
    { code: 'id-ID', name: 'Bahasa Indonesia' },
    { code: 'tr-TR', name: 'Türkçe' },
    { code: 'ru-RU', name: 'Русский' },
    { code: 'ar-SA', name: 'العربية' }
];

const selectedRegion = useStorage<string>('movora_user_region', 'global');
const selectedLanguage = useStorage<string>('movora_user_language', 'en-US');
const selectedTmdbImageQuality = ref<'low' | 'medium' | 'high'>('medium');
let _globalSettingsLoaded = false;
let _globalSettingsInterval: number | null = null;

export async function refreshGlobalSettings() {
    try {
        const supabase = await getSupabaseClient();
        const { data } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', ['tmdb_image_quality', 'cache_bust_timestamp']);

        const rows = Array.isArray(data) ? data : [];
        const quality = rows.find((row: any) => row.key === 'tmdb_image_quality')?.value;
        if (quality === 'low' || quality === 'medium' || quality === 'high') {
            selectedTmdbImageQuality.value = quality;
        }

        const cacheBust = rows.find((row: any) => row.key === 'cache_bust_timestamp')?.value;
        if (cacheBust && localStorage.getItem('last_cache_bust') !== cacheBust) {
            if (typeof window !== 'undefined' && window.caches) {
                await window.caches.delete('tmdb-api-cache-v1');
                await window.caches.delete('tmdb-api-cache-v2');
            }
            localStorage.removeItem('moovie_poster_cache_v1');
            localStorage.setItem('last_cache_bust', cacheBust);
            console.log('[🧹 CACHE] Global cache bust triggered by admin settings');
        }
    } catch (err) {
        console.warn('[settings] Failed to load global settings:', err);
    }
}

export async function loadGlobalSettings() {
    if (_globalSettingsLoaded) return;
    _globalSettingsLoaded = true;
    await refreshGlobalSettings();

    if (typeof window !== 'undefined' && !_globalSettingsInterval) {
        window.addEventListener('focus', refreshGlobalSettings);
    }
}

export const getSettings = () => {
    const updateSettings = (region: string, language: string) => {
        selectedRegion.value = region;
        selectedLanguage.value = language;
        window.dispatchEvent(new CustomEvent('movora_settings_change', {
            detail: { region, language }
        }));
    };

    return {
        region: readonly(selectedRegion),
        language: readonly(selectedLanguage),
        tmdbImageQuality: readonly(selectedTmdbImageQuality),
        updateSettings
    };
};
