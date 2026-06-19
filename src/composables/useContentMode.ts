import { useStorage } from '@vueuse/core';
import { readonly } from 'vue';

export type ContentMode = 'global' | 'netflix';

const UNSET = 'unset' as const;
type StoredMode = ContentMode | typeof UNSET;

const storedMode = useStorage<StoredMode>('movora_content_mode', UNSET);

export function isContentModeChosen(): boolean {
    return storedMode.value === 'global' || storedMode.value === 'netflix';
}

export function getContentMode() {
    const setContentMode = (mode: ContentMode) => {
        storedMode.value = mode;
        window.dispatchEvent(
            new CustomEvent('movora_content_mode_change', { detail: { mode } })
        );
    };

    const clearContentMode = () => {
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