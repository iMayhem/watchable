// Netflix catalogue bot guard — blocks crawlers and headless automation on
// /nf/*, /stream/nf/*, /embed/nf/*, and home when content mode is netflix.

import {
    detectClientBot,
    isNetflixGuardActive,
    readStoredContentMode
} from '../utils/netflixGuard';

let installed = false;
let blocked = false;
let pathListener: (() => void) | null = null;
let modeListener: (() => void) | null = null;

const shouldGuard = () => {
    if (import.meta.env.PROD) return true;
    return import.meta.env.VITE_BOT_GUARD === '1';
};

const currentPath = () =>
    typeof window !== 'undefined' ? window.location.pathname : '/';

const injectStyles = () => {
    if (document.getElementById('nf-bot-guard-styles')) return;
    const style = document.createElement('style');
    style.id = 'nf-bot-guard-styles';
    style.textContent = `
        html.nf-bot-blocked,
        html.nf-bot-blocked body {
            overflow: hidden !important;
            background: #0b0a08 !important;
        }
        .nf-bot-overlay {
            position: fixed;
            inset: 0;
            z-index: 2147483646;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            background: rgba(11, 10, 8, 0.94);
            color: #f5efe4;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .nf-bot-overlay__panel {
            max-width: 28rem;
            text-align: center;
        }
        .nf-bot-overlay__eyebrow {
            margin: 0 0 0.5rem;
            font-size: 0.75rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #c9a227;
        }
        .nf-bot-overlay__title {
            margin: 0 0 0.75rem;
            font-size: 1.5rem;
            font-weight: 600;
        }
        .nf-bot-overlay__copy {
            margin: 0;
            font-size: 0.95rem;
            line-height: 1.5;
            color: rgba(245, 239, 228, 0.78);
        }
    `;
    document.head.appendChild(style);
};

const showBlockOverlay = () => {
    if (typeof document === 'undefined') return;
    if (blocked) return;
    blocked = true;

    document.documentElement.classList.add('nf-bot-blocked');
    injectStyles();

    const existing = document.querySelector('.nf-bot-overlay');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.className = 'nf-bot-overlay';
    overlay.setAttribute('role', 'alert');
    overlay.innerHTML = `
        <div class="nf-bot-overlay__panel">
            <p class="nf-bot-overlay__eyebrow">Catalogue access</p>
            <h1 class="nf-bot-overlay__title">Automated access blocked</h1>
            <p class="nf-bot-overlay__copy">
                This catalogue section is not available to crawlers or automated browsers.
                Open Moovie in a regular browser to continue.
            </p>
        </div>
    `;
    document.body.appendChild(overlay);
};

const hideBlockOverlay = () => {
    if (typeof document === 'undefined') return;
    blocked = false;
    document.documentElement.classList.remove('nf-bot-blocked');
    document.querySelectorAll('.nf-bot-overlay').forEach((n) => n.remove());
};

const evaluate = () => {
    if (!shouldGuard()) return;

    const path = currentPath();
    const mode = readStoredContentMode();
    const active = isNetflixGuardActive(path, mode);

    if (!active) {
        hideBlockOverlay();
        return;
    }

    if (detectClientBot()) {
        showBlockOverlay();
    } else {
        hideBlockOverlay();
    }
};

export function reevaluateBotProtection() {
    evaluate();
}

export function installBotProtection() {
    if (installed) return;
    if (typeof window === 'undefined') return;
    if (!shouldGuard()) return;
    installed = true;

    evaluate();

    pathListener = () => evaluate();
    window.addEventListener('popstate', pathListener);

    modeListener = () => evaluate();
    window.addEventListener('movora_content_mode_change', modeListener);

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.pushState = (...args) => {
        origPush(...args);
        evaluate();
    };
    history.replaceState = (...args) => {
        origReplace(...args);
        evaluate();
    };

    (window as Window & { __nfBotGuardRestore?: () => void }).__nfBotGuardRestore = () => {
        history.pushState = origPush;
        history.replaceState = origReplace;
    };
}

export function uninstallBotProtection() {
    if (!installed) return;
    installed = false;

    if (pathListener) {
        window.removeEventListener('popstate', pathListener);
        pathListener = null;
    }
    if (modeListener) {
        window.removeEventListener('movora_content_mode_change', modeListener);
        modeListener = null;
    }

    const w = window as Window & { __nfBotGuardRestore?: () => void };
    w.__nfBotGuardRestore?.();
    delete w.__nfBotGuardRestore;

    hideBlockOverlay();
}