import { useStorage } from '@vueuse/core';
import { readonly } from 'vue';
import { nfDebug } from './useNetflixDebug';

export interface NetflixCatalogueOption {
    id: string;
    label: string;
    eyebrow: string;
}

/** Header industry tabs — K-Drama is a dedicated nav link, not an industry tab. */
export const NETFLIX_CATALOGUES: NetflixCatalogueOption[] = [
    { id: 'hollywood', label: 'Hollywood', eyebrow: 'Blockbusters' },
    { id: 'bollywood', label: 'Bollywood', eyebrow: 'Indian cinema' }
];

export const NETFLIX_KDRAMA_CATALOGUE_ID = 'korean';

const VALID_CATALOGUE_IDS = new Set([
    ...NETFLIX_CATALOGUES.map((c) => c.id),
    NETFLIX_KDRAMA_CATALOGUE_ID
]);

export function isNetflixCatalogueId(id: string): boolean {
    return VALID_CATALOGUE_IDS.has(id);
}

export function normalizeCatalogueId(id: string): string {
    return isNetflixCatalogueId(id) ? id : 'hollywood';
}

const selectedCatalogue = useStorage<string>('movora_netflix_catalogue', 'hollywood');

if (selectedCatalogue.value !== normalizeCatalogueId(selectedCatalogue.value)) {
    selectedCatalogue.value = normalizeCatalogueId(selectedCatalogue.value);
}

export function getCatalogueOption(id: string): NetflixCatalogueOption {
    const normalized = normalizeCatalogueId(id);
    if (normalized === NETFLIX_KDRAMA_CATALOGUE_ID) {
        return {
            id: NETFLIX_KDRAMA_CATALOGUE_ID,
            label: 'K-Drama',
            eyebrow: 'Korean series'
        };
    }
    return (
        NETFLIX_CATALOGUES.find((c) => c.id === normalized) ||
        NETFLIX_CATALOGUES[0]
    );
}

/** Movies industry tab — Hollywood / Bollywood only (K-Drama is a header link). */
export function normalizeIndustryCatalogueId(id: string): string {
    const industryId = netflixAnimeCatalogueId(normalizeCatalogueId(id));
    return (
        NETFLIX_CATALOGUES.find((c) => c.id === industryId)?.id ||
        NETFLIX_CATALOGUES[0].id
    );
}

export function getIndustryCatalogueOption(id: string): NetflixCatalogueOption {
    const industryId = normalizeIndustryCatalogueId(id);
    return (
        NETFLIX_CATALOGUES.find((c) => c.id === industryId) ||
        NETFLIX_CATALOGUES[0]
    );
}

/** Primary movie browse row for Hollywood / Bollywood / K-Drama. */
export function netflixMovieBrowseRow(catalogueId: string): string {
    return catalogueId === 'korean' ? 'korean-movies' : 'blockbuster-movies';
}

/** Primary TV browse row for Hollywood / Bollywood / K-Drama. */
export function netflixTvBrowseRow(catalogueId: string): string {
    return catalogueId === 'korean' ? 'korean-series' : 'exciting-tv';
}

/** Anime lives on the language catalogues — not the Korean feed index. */
export function netflixAnimeCatalogueId(catalogueId: string): string {
    return catalogueId === 'korean' ? 'hollywood' : catalogueId;
}

export function getNetflixCatalogue() {
    const setCatalogue = (id: string) => {
        const catalogue = getCatalogueOption(id);
        nfDebug('catalogue:set', {
            id: catalogue.id,
            label: catalogue.label,
            previous: selectedCatalogue.value
        });
        selectedCatalogue.value = normalizeCatalogueId(catalogue.id);
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