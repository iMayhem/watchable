import { onBeforeUnmount, ref, type Ref } from 'vue';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

function detectStreamType(url: string): 'm3u8' | 'mp4' {
    if (/\.mp4(\?|$)/i.test(url)) return 'mp4';
    return 'm3u8';
}

const loadHlsJs = (() => {
    let promise: Promise<void> | null = null;
    return () => {
        if ((window as any).Hls) {
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
    let plyrInstance: Plyr | null = null;
    let hlsInstance: any = null;
    const isPlaying = ref(false);
    const playerError = ref('');

    const destroy = () => {
        if (plyrInstance) {
            try {
                plyrInstance.destroy();
            } catch {
                /* ignore */
            }
            plyrInstance = null;
        }
        if (hlsInstance) {
            try {
                hlsInstance.destroy();
            } catch {
                /* ignore */
            }
            hlsInstance = null;
        }
        if (containerRef.value) {
            containerRef.value.innerHTML = '';
        }
        isPlaying.value = false;
    };

    const mount = async (src: string, _title: string) => {
        playerError.value = '';
        await loadHlsJs();

        const container = containerRef.value;
        if (!container) return;

        destroy();

        const HlsCtor = (window as any).Hls;
        const streamType = detectStreamType(src);

        const video = document.createElement('video');
        video.controls = false;
        video.playsInline = true;
        video.autoplay = true;
        container.appendChild(video);

        if (streamType === 'm3u8' && HlsCtor) {
            if (HlsCtor.isSupported()) {
                hlsInstance = new HlsCtor({ enableWorker: true });
                hlsInstance.loadSource(src);
                hlsInstance.attachMedia(video);
                hlsInstance.on(HlsCtor.Events.ERROR, (_event: any, data: any) => {
                    if (data.fatal) {
                        playerError.value = 'Stream unavailable — try another channel.';
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = src;
            } else {
                playerError.value = 'HLS playback is not supported in this browser.';
            }
        } else {
            video.src = src;
        }

        plyrInstance = new Plyr(video, {
            autoplay: true,
            controls: [
                'play-large',
                'play',
                'progress',
                'current-time',
                'mute',
                'volume',
                'fullscreen'
            ]
        });

        plyrInstance.on('playing', () => {
            isPlaying.value = true;
            playerError.value = '';
        });
        plyrInstance.on('error', () => {
            playerError.value = 'Playback failed — try another channel.';
        });
    };

    onBeforeUnmount(() => destroy());

    return { mount, destroy, isPlaying, playerError };
}