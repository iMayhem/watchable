import { useStorage } from '@vueuse/core';
import { readonly } from 'vue';
import { nfDebug } from './useNetflixDebug';

export type ContentMode = 'global' | 'netflix';

const UNSET = 'unset' as const;
type StoredMode = ContentMode | typeof UNSET;

const storedMode = useStorage<StoredMode>('movora_content_mode', UNSET);

export function isContentModeChosen(): boolean {
    return storedMode.value === 'global' || storedMode.value === 'netflix';
}

export function getContentMode() {
    const setContentMode = (mode: ContentMode) => {
        nfDebug('content-mode:set', { mode, previous: storedMode.value });
        storedMode.value = mode;
        window.dispatchEvent(
            new CustomEvent('movora_content_mode_change', { detail: { mode } })
        );
    };

    const clearContentMode = () => {
        nfDebug('content-mode:clear', { previous: storedMode.value });
        storedMode.value = UNSET;
        window.dispatchEvent(
            new CustomEvent('movora_content_mode_change', { detail: { mode: UNSET } })
        );
    };

    return {
        contentMode: readonly(storedMode),
        isChosen: () => isContentModeChosen(),
        isNetflix: () => storedMode.value === 'netflix',
        isGlobal: () => storedMode.value === 'global',
        setContentMode,
        clearContentMode
    };
}