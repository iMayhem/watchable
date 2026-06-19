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
    { id: 'korean', label: 'Korean', eyebrow: 'K-Cinema' }
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