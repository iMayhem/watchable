import { useStorage } from '@vueuse/core';
import { readonly } from 'vue';
import { parseNetmirrorTitle, type NetmirrorBrowseItem } from './useNetmirror';
import { nfDebug } from './useNetflixDebug';

export interface NetflixLanguageOption {
    category: string;
    label: string;
    nativeLabel: string;
    matchLabels: string[];
}

export const NETFLIX_LANGUAGES: NetflixLanguageOption[] = [
    { category: 'hindi', label: 'Hindi', nativeLabel: 'हिंदी', matchLabels: ['Hindi', 'HindiDub'] },
    { category: 'english', label: 'English', nativeLabel: 'English', matchLabels: ['English'] },
    { category: 'telugu', label: 'Telugu', nativeLabel: 'తెలుగు', matchLabels: ['Telugu'] },
    { category: 'tamil', label: 'Tamil', nativeLabel: 'தமிழ்', matchLabels: ['Tamil'] },
    { category: 'malayalam', label: 'Malayalam', nativeLabel: 'മലയാളം', matchLabels: ['Malayalam'] },
    { category: 'bengali', label: 'Bengali', nativeLabel: 'বাংলা', matchLabels: ['Bengali'] },
    { category: 'korean', label: 'Korean', nativeLabel: '한국어', matchLabels: ['Korean'] },
    { category: 'punjabi', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', matchLabels: ['Punjabi'] },
    { category: 'marathi', label: 'Marathi', nativeLabel: 'मराठी', matchLabels: ['Marathi'] }
];

const selectedLanguage = useStorage<string>('movora_netflix_language', 'hindi');

export function getLanguageOption(category: string): NetflixLanguageOption {
    return (
        NETFLIX_LANGUAGES.find((lang) => lang.category === category) ||
        NETFLIX_LANGUAGES[0]
    );
}

export function itemMatchesLanguage(
    item: NetmirrorBrowseItem,
    lang: NetflixLanguageOption
): boolean {
    const parsed = parseNetmirrorTitle(item.title || '');
    const titleLower = (item.title || '').toLowerCase();
    const channelLower = (item.channel || '').toLowerCase();

    for (const label of lang.matchLabels) {
        const needle = label.toLowerCase();
        if (parsed.languages.some((tag) => tag.toLowerCase().includes(needle))) {
            return true;
        }
        if (titleLower.includes(`[${needle}]`)) return true;
        if (channelLower.includes(needle)) return true;
    }

    return false;
}

export function getNetflixLanguage() {
    const setLanguage = (category: string) => {
        const lang = getLanguageOption(category);
        nfDebug('language:set', {
            category: lang.category,
            label: lang.label,
            previous: selectedLanguage.value
        });
        selectedLanguage.value = lang.category;
        window.dispatchEvent(
            new CustomEvent('movora_netflix_language_change', {
                detail: { category: lang.category }
            })
        );
    };

    return {
        language: readonly(selectedLanguage),
        activeLanguage: () => getLanguageOption(selectedLanguage.value),
        setLanguage
    };
}