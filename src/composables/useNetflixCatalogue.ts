import { useStorage } from '@vueuse/core';
import { readonly } from 'vue';
import { nfDebug } from './useNetflixDebug';

export interface NetflixCatalogueOption {
    id: string;
    label: string;
    eyebrow: string;
}

/** Header tabs — languages live in the video player. */
export const NETFLIX_CATALOGUES: NetflixCatalogueOption[] = [
    { id: 'hollywood', label: 'Hollywood', eyebrow: 'Blockbusters' },
    { id: 'bollywood', label: 'Bollywood', eyebrow: 'Indian cinema' },
    { id: 'korean', label: 'Korean', eyebrow: 'K-Cinema' },
    { id: 'japanese', label: 'Japanese', eyebrow: 'Anime' },
    { id: 'telugu', label: 'Telugu', eyebrow: 'Tollywood' },
    { id: 'tamil', label: 'Tamil', eyebrow: 'Kollywood' },
    { id: 'malayalam', label: 'Malayalam', eyebrow: 'Mollywood' },
    { id: 'bengali', label: 'Bengali', eyebrow: 'Regional' },
    { id: 'kannada', label: 'Kannada', eyebrow: 'Sandalwood' },
    { id: 'marathi', label: 'Marathi', eyebrow: 'Regional' },
    { id: 'punjabi', label: 'Punjabi', eyebrow: 'Regional' }
];

const selectedCatalogue = useStorage<string>('movora_netflix_catalogue', 'hollywood');

export function getCatalogueOption(id: string): NetflixCatalogueOption {
    return NETFLIX_CATALOGUES.find((c) => c.id === id) || NETFLIX_CATALOGUES[0];
}

export function getNetflixCatalogue() {
    const setCatalogue = (id: string) => {
        const catalogue = getCatalogueOption(id);
        nfDebug('catalogue:set', {
            id: catalogue.id,
            label: catalogue.label,
            previous: selectedCatalogue.value
        });
        selectedCatalogue.value = catalogue.id;
        window.dispatchEvent(
            new CustomEvent('movora_netflix_catalogue_change', {
                detail: { id: catalogue.id }
            })
        );
    };

    return {
        catalogue: readonly(selectedCatalogue),
        activeCatalogue: () => getCatalogueOption(selectedCatalogue.value),
        setCatalogue
    };
}