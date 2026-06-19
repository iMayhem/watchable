export const MOOVIE_EXTENSION_VERSION = '1.5.2';
export const MOOVIE_EXTENSION_RELEASE_TAG = `v${MOOVIE_EXTENSION_VERSION}`;
const RELEASE_BASE = `https://github.com/iMayhem/Moovie-Extension/releases/download/${MOOVIE_EXTENSION_RELEASE_TAG}`;

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
}

export const EXTENSION_BROWSER_DOWNLOADS: ExtensionBrowserDownload[] = [
    {
        id: 'chrome',
        name: 'Chrome',
        fileName: 'moovie-chrome.zip',
        url: `${RELEASE_BASE}/moovie-chrome.zip`,
        icon: '/icons/browsers/chrome.svg',
        extensionsPage: 'chrome://extensions',
        family: 'chromium'
    },
    {
        id: 'edge',
        name: 'Edge',
        fileName: 'moovie-edge.zip',
        url: `${RELEASE_BASE}/moovie-edge.zip`,
        icon: '/icons/browsers/edge.svg',
        extensionsPage: 'edge://extensions',
        family: 'chromium'
    },
    {
        id: 'firefox',
        name: 'Firefox',
        fileName: 'moovie-firefox.zip',
        url: `${RELEASE_BASE}/moovie-firefox.zip`,
        icon: '/icons/browsers/firefox.svg',
        extensionsPage: 'about:debugging#/runtime/this-firefox',
        family: 'firefox'
    },
    {
        id: 'opera',
        name: 'Opera',
        fileName: 'moovie-opera.zip',
        url: `${RELEASE_BASE}/moovie-opera.zip`,
        icon: '/icons/browsers/opera.svg',
        extensionsPage: 'opera://extensions',
        family: 'chromium'
    },
    {
        id: 'brave',
        name: 'Brave',
        fileName: 'moovie-brave.zip',
        url: `${RELEASE_BASE}/moovie-brave.zip`,
        icon: '/icons/browsers/brave.svg',
        extensionsPage: 'brave://extensions',
        family: 'chromium'
    },
    {
        id: 'vivaldi',
        name: 'Vivaldi',
        fileName: 'moovie-vivaldi.zip',
        url: `${RELEASE_BASE}/moovie-vivaldi.zip`,
        icon: '/icons/browsers/vivaldi.svg',
        extensionsPage: 'vivaldi://extensions',
        family: 'chromium'
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

    return 'chrome';
}

export function getExtensionBrowser(id: ExtensionBrowserId) {
    return EXTENSION_BROWSER_DOWNLOADS.find((row) => row.id === id) ?? EXTENSION_BROWSER_DOWNLOADS[0];
}