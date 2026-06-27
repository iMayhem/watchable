import { onBeforeUnmount, ref, type Ref } from 'vue';
import { warmMooviePlayerAssets } from './useMooviePlayer';

type ArtplayerInstance = {
    destroy: (pause?: boolean) => void;
    on: (event: string, handler: () => void) => void;
};

function detectStreamType(url: string): 'm3u8' | 'mp4' {
    if (/\.mp4(\?|$)/i.test(url)) return 'mp4';
    return 'm3u8';
}

const loadHlsJs = (() => {
    let promise: Promise<void> | null = null;

    return () => {
        if ((window as Window & { Hls?: { isSupported: () => boolean } }).Hls) {
            return Promise.resolve();
        }
        if (promise) return promise;

        promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('hls.js failed to load'));
            document.head.appendChild(script);
        });

        return promise;
    };
})();

export function useLiveTvPlayer(containerRef: Ref<HTMLElement | null>) {
    let artInstance: ArtplayerInstance | null = null;
    const isPlaying = ref(false);
    const playerError = ref('');

    const destroy = () => {
        if (artInstance) {
            try {
                artInstance.destroy(false);
            } catch {
                /* ignore */
            }
            artInstance = null;
        }
        isPlaying.value = false;
    };

    const mount = async (src: string, title: string) => {
        playerError.value = '';
        await warmMooviePlayerAssets();
        await loadHlsJs();

        const container = containerRef.value;
        if (!container) return;

        destroy();

        const ArtplayerCtor = (window as Window & { Artplayer?: new (options: Record<string, unknown>) => ArtplayerInstance }).Artplayer;
        const HlsCtor = (window as Window & {
            Hls?: {
                isSupported: () => boolean;
                new (config?: Record<string, unknown>): {
                    loadSource: (url: string) => void;
                    attachMedia: (video: HTMLVideoElement) => void;
                    on: (event: string, handler: (_: unknown, data: { fatal?: boolean }) => void) => void;
                    destroy: () => void;
                };
                Events: { ERROR: string };
            };
        }).Hls;

        if (!ArtplayerCtor) {
            playerError.value = 'Player failed to load.';
            return;
        }

        const streamType = detectStreamType(src);

        artInstance = new ArtplayerCtor({
            container,
            url: src,
            title,
            autoplay: true,
            playsInline: true,
            autoSize: false,
            aspectRatio: false,
            fullscreen: true,
            fullscreenWeb: true,
            miniProgressBar: true,
            theme: '#ff5a1f',
            type: streamType === 'mp4' ? 'mp4' : 'm3u8',
            customType: {
                m3u8(video: HTMLVideoElement, url: string) {
                    if (HlsCtor?.isSupported()) {
                        const hls = new HlsCtor({ enableWorker: true });
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        hls.on(HlsCtor.Events.ERROR, (_event, data) => {
                            if (data.fatal) {
                                playerError.value = 'Stream unavailable — try another channel.';
                            }
                        });
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = url;
                    } else {
                        playerError.value = 'HLS playback is not supported in this browser.';
                    }
                }
            }
        });

        artInstance.on('video:playing', () => {
            isPlaying.value = true;
            playerError.value = '';
        });
        artInstance.on('error', () => {
            playerError.value = 'Playback failed — try another channel.';
        });
    };

    onBeforeUnmount(() => destroy());

    return { mount, destroy, isPlaying, playerError };
}