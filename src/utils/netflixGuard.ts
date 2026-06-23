import type { ContentMode } from '../composables/useContentMode';

/** Known crawler / automation user-agent fragments. */
export const BOT_UA_PATTERN =
    /bot|googlebot|crawler|spider|robot|crawling|lighthouse|headless|phantom|selenium|puppeteer|playwright|bytespider|petalbot|gptbot|claudebot|anthropic|semrush|ahrefs|mj12bot|dotbot|yandexbot|bingbot|slurp|duckduckbot|baiduspider/i;

export function isNetflixRoutePath(path: string): boolean {
    return (
        path.startsWith('/nf/') ||
        path.startsWith('/stream/nf/') ||
        path.startsWith('/embed/nf/')
    );
}

export function readStoredContentMode(): ContentMode | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem('movora_content_mode');
        if (raw === 'netflix' || raw === 'global') return raw;
    } catch {
        /* ignore */
    }
    return null;
}

/** True when Netflix catalogue guard should be active for this path + mode. */
export function isNetflixGuardActive(path: string, mode?: ContentMode | null): boolean {
    if (isNetflixRoutePath(path)) return true;
    const resolved = mode ?? readStoredContentMode();
    return path === '/' && resolved === 'netflix';
}

export function isBotUserAgent(ua: string): boolean {
    const trimmed = (ua || '').trim();
    if (!trimmed) return true;
    return BOT_UA_PATTERN.test(trimmed);
}

export function hasAutomationMarkers(): boolean {
    if (typeof window === 'undefined') return false;

    const nav = navigator as Navigator & { webdriver?: boolean };
    if (nav.webdriver) return true;

    const w = window as unknown as Record<string, unknown>;
    if (w._phantom || w.__nightmare || w.callPhantom) return true;
    if (document.documentElement.getAttribute('webdriver')) return true;

    // Chromedriver / Selenium legacy markers
    for (const key of Object.keys(w)) {
        if (/^\$cdc_|^__webdriver|^__selenium|^__driver_/i.test(key)) return true;
    }

    return false;
}

export function detectClientBot(): boolean {
    if (typeof navigator === 'undefined') return false;
    if (isBotUserAgent(navigator.userAgent)) return true;
    return hasAutomationMarkers();
}