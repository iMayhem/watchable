export const MOOVIE_EXTENSION_VERSION = '1.5.2';
export const MOOVIE_EXTENSION_RELEASE_TAG = `v${MOOVIE_EXTENSION_VERSION}`;
export const MOOVIE_FIREFOX_ADDON_URL =
    'https://addons.mozilla.org/en-GB/firefox/addon/moovie-extension/';
export const MOOVIE_EDGE_ADDON_URL =
    'https://microsoftedge.microsoft.com/addons/detail/ofnhnacpnimhklfbpfcednjlgfojgfbe';
const RELEASE_BASE = `https://github.com/iMayhem/Moovie-Extension/releases/download/${MOOVIE_EXTENSION_RELEASE_TAG}`;

export const RECOMMENDED_EXTENSION_BROWSER_IDS: ExtensionBrowserId[] = ['firefox', 'edge'];

export type ExtensionBrowserId =
    | 'chrome'
    | 'edge'
    | 'firefox'
    | 'opera'
    | 'brave'
    | 'vivaldi';

export interface ExtensionBrowserDownload {
    id: ExtensionBrowserId;
    name: string;
    fileName: string;
    url: string;
    icon: string;
    extensionsPage: string;
    family: 'chromium' | 'firefox';
    installType: 'download' | 'store';
}

export const EXTENSION_BROWSER_DOWNLOADS: ExtensionBrowserDownload[] = [
    {
        id: 'firefox',
        name: 'Firefox',
        fileName: 'Firefox Add-ons',
        url: MOOVIE_FIREFOX_ADDON_URL,
        icon: '/icons/browsers/firefox.svg',
        extensionsPage: MOOVIE_FIREFOX_ADDON_URL,
        family: 'firefox',
        installType: 'store'
    },
    {
        id: 'chrome',
        name: 'Chrome',
        fileName: 'extension.crx',
        url: `${RELEASE_BASE}/extension.crx`,
        icon: '/icons/browsers/chrome.svg',
        extensionsPage: 'chrome://extensions',
        family: 'chromium',
        installType: 'download'
    },
    {
        id: 'edge',
        name: 'Edge',
        fileName: 'Edge Add-ons',
        url: MOOVIE_EDGE_ADDON_URL,
        icon: '/icons/browsers/edge.svg',
        extensionsPage: MOOVIE_EDGE_ADDON_URL,
        family: 'chromium',
        installType: 'store'
    },
    {
        id: 'opera',
        name: 'Opera',
        fileName: 'extension.crx',
        url: `${RELEASE_BASE}/extension.crx`,
        icon: '/icons/browsers/opera.svg',
        extensionsPage: 'opera://extensions',
        family: 'chromium',
        installType: 'download'
    },
    {
        id: 'brave',
        name: 'Brave',
        fileName: 'extension.crx',
        url: `${RELEASE_BASE}/extension.crx`,
        icon: '/icons/browsers/brave.svg',
        extensionsPage: 'brave://extensions',
        family: 'chromium',
        installType: 'download'
    },
    {
        id: 'vivaldi',
        name: 'Vivaldi',
        fileName: 'extension.crx',
        url: `${RELEASE_BASE}/extension.crx`,
        icon: '/icons/browsers/vivaldi.svg',
        extensionsPage: 'vivaldi://extensions',
        family: 'chromium',
        installType: 'download'
    }
];

export function detectExtensionBrowser(): ExtensionBrowserId {
    const ua = navigator.userAgent;

    if (/firefox|fxios/i.test(ua)) return 'firefox';
    if (/edg\//i.test(ua)) return 'edge';
    if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'opera';
    if (/vivaldi/i.test(ua)) return 'vivaldi';
    if (/brave/i.test(ua)) return 'brave';
    if (/chrome|chromium|crios/i.test(ua)) return 'chrome';

    return 'firefox';
}

export function getExtensionBrowser(id: ExtensionBrowserId) {
    return EXTENSION_BROWSER_DOWNLOADS.find((row) => row.id === id) ?? EXTENSION_BROWSER_DOWNLOADS[0];
}

export function getRecommendedExtensionBrowsers(): ExtensionBrowserDownload[] {
    return RECOMMENDED_EXTENSION_BROWSER_IDS.map((id) => getExtensionBrowser(id));
}

export function getOtherExtensionBrowsers(): ExtensionBrowserDownload[] {
    const recommended = new Set<ExtensionBrowserId>(RECOMMENDED_EXTENSION_BROWSER_IDS);
    return EXTENSION_BROWSER_DOWNLOADS.filter((row) => !recommended.has(row.id));
}

export function getExtensionInstallGuide(detected: ExtensionBrowserId): ExtensionBrowserDownload {
    if (detected === 'firefox' || detected === 'edge') {
        return getExtensionBrowser(detected);
    }
    return getExtensionBrowser('firefox');
}