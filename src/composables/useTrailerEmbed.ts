import { computed, ref, type Ref } from 'vue';
import { useStorage } from '@vueuse/core';

interface UseTrailerEmbedOptions {
    id: Ref<number | string>;
    type: Ref<'movie' | 'tv'>;
    rootEl?: Ref<HTMLElement | null>;
    dwellMs?: number;
    blockTimeoutMs?: number;
}

export function useTrailerEmbed(opts: UseTrailerEmbedOptions) {
    void opts;

    const iframeRef = ref<HTMLIFrameElement | null>(null);
    const trailerVisible = computed(() => false);
    const trailerLive = ref(false);
    const trailerSrc = computed(() => '');
    const userPaused = ref(false);
    const userMuted = useStorage<boolean>('lm:trailer:muted', true);

    const onIframeLoad = () => {};
    const togglePause = () => {};
    const toggleMute = () => {};

    return {
        iframeRef,
        trailerVisible,
        trailerLive,
        trailerSrc,
        userPaused,
        userMuted,
        onIframeLoad,
        togglePause,
        toggleMute
    };
}
