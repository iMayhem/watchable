import { useStorage } from '@vueuse/core';
import { readonly } from 'vue';

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
        updateSettings
    };
};
