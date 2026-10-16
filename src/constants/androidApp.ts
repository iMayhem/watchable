/**
 * Configuration for the Streamly Android App download & release info.
 * You can paste the direct download URL in `apkDownloadUrl` whenever ready.
 */
export interface AndroidAppConfig {
    appName: string;
    version: string;
    releaseDate: string;
    fileSize: string;
    minAndroid: string;
    packageName: string;
    apkDownloadUrl: string; // <-- Paste the direct APK link here when ready
    releaseNotes: string;
    features: {
        title: string;
        desc: string;
        icon: string;
    }[];
}

export const ANDROID_APP_CONFIG: AndroidAppConfig = {
    appName: 'Streamly',
    version: '1.0.1',
    releaseDate: 'October 2026',
    fileSize: '40 MB',
    minAndroid: 'Android 7.0 (Nougat) or newer',
    packageName: 'com.streamly.app',
    apkDownloadUrl: '/download',
    releaseNotes: 'Streamly v1.0.1: Optimized ~40 MB lightweight APK, faster performance, smart auto-updates, zero ads, instant native ExoPlayer playback, 4K streaming, and full Android TV D-pad remote support.',
    features: [
        {
            title: '100% Ad-Free Experience',
            desc: 'Zero video prerolls, zero banner ads, and zero popups. Just pure, uninterrupted entertainment.',
            icon: '🛡️'
        },
        {
            title: 'Instant 4K & 1080p HLS',
            desc: 'Powered by native ExoPlayer hardware acceleration for instant start times and zero buffer delay.',
            icon: '⚡'
        },
        {
            title: 'Dual Audio & Subtitles',
            desc: 'English Dub and original voice tracks for Anime, multi-language dubs, and synchronized CC subtitles.',
            icon: '🎙️'
        },
        {
            title: 'Android TV & Phone Ready',
            desc: 'Flawlessly optimized for both TV remotes (D-pad focus) and mobile touchscreens with smooth scrubbing.',
            icon: '📺'
        }
    ]
};

