const PHONE_UA = /iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i;

const TABLET_UA = /iPad|Tablet|tablet|PlayBook|Silk/i;

const LARGE_TABLET_MIN_SHORT = 768;
const LARGE_TABLET_MIN_LONG = 1024;

export type DevicePreference = 'auto' | 'mobile' | 'desktop';

const PREF_KEY = 'movieace-device-pref';

export function getStoredDevicePreference(): DevicePreference {
    if (typeof localStorage === 'undefined') return 'auto';
    const raw = localStorage.getItem(PREF_KEY);
    if (raw === 'mobile' || raw === 'desktop') return raw;
    return 'auto';
}

export function setStoredDevicePreference(pref: DevicePreference): void {
    if (typeof localStorage === 'undefined') return;
    if (pref === 'auto') localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, pref);
}

/** Query override: ?mobile=1 or ?desktop=1 */
export function preferenceFromQuery(search: string): DevicePreference | null {
    const params = new URLSearchParams(search);
    if (params.has('mobile')) return 'mobile';
    if (params.has('desktop')) return 'desktop';
    return null;
}

export function isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error legacy IE
        (navigator.msMaxTouchPoints ?? 0) > 0
    );
}

/** Narrow viewport — phones (e.g. iPhone 12 Pro 390×844). */
export function isPhoneViewport(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window.innerWidth || document.documentElement?.clientWidth || 0;
    const h = window.innerHeight || 0;
    const sw = typeof screen !== 'undefined' ? screen.width || 0 : 0;
    const sh = typeof screen !== 'undefined' ? screen.height || 0 : 0;
    const min = Math.min(w || sw, h || sh);
    return min > 0 && min < LARGE_TABLET_MIN_SHORT;
}

/** True for phones (not tablets). */
export function isPhoneUserAgent(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
    if (PHONE_UA.test(ua)) return true;
    if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
    if (/Mobile/i.test(ua) && !TABLET_UA.test(ua)) return true;
    return false;
}

/** True for tablets (iPad, Android tablet, iPadOS-as-Macintosh). */
export function isTabletUserAgent(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
    if (isPhoneViewport()) return false;
    if (TABLET_UA.test(ua)) return true;
    if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return true;
    if (/Macintosh/i.test(ua) && isTouchDevice() && navigator.maxTouchPoints > 1) return true;
    return false;
}

/** Only 1024×768 and larger tablets qualify for the desktop site. */
export function isLargeTabletViewport(): boolean {
    if (isPhoneViewport()) return false;
    if (typeof screen === 'undefined') return false;
    const w = screen.width || 0;
    const h = screen.height || 0;
    return (
        Math.min(w, h) >= LARGE_TABLET_MIN_SHORT &&
        Math.max(w, h) >= LARGE_TABLET_MIN_LONG
    );
}

/** True when the device should use the mobile site (phones + smaller tablets). */
export function isMobileOrTabletUserAgent(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
    if (isPhoneUserAgent(ua)) return true;
    if (isPhoneViewport()) return true;
    if (isTabletUserAgent(ua) && !isLargeTabletViewport()) return true;
    return false;
}

export function shouldUseMobileSite(search = typeof location !== 'undefined' ? location.search : ''): boolean {
    const fromQuery = preferenceFromQuery(search);
    if (fromQuery === 'mobile') return true;
    if (fromQuery === 'desktop') return false;

    const stored = getStoredDevicePreference();
    if (stored === 'mobile') return true;
    if (stored === 'desktop') return false;

    return isMobileOrTabletUserAgent();
}