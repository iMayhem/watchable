import type { LocationQuery } from 'vue-router';

/** Build the static mobile party URL, preserving launch query params. */
export function buildMobilePartyUrl(query: LocationQuery = {}): string {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
        if (value == null || key === 'embedded') return;
        if (Array.isArray(value)) {
            value.forEach((entry) => params.append(key, String(entry)));
            return;
        }
        params.set(key, String(value));
    });

    const qs = params.toString();
    return qs ? `/party/index.html?${qs}` : '/party/index.html';
}

/** True when the Vue SPA is serving /party instead of the static party app. */
export function isMobilePartySpaEntry(pathname: string): boolean {
    const normalized = pathname.replace(/\/+$/, '') || '/';
    return normalized === '/party';
}

export function redirectToMobileParty(query: LocationQuery = {}): void {
    const target = buildMobilePartyUrl(query);
    if (`${window.location.pathname}${window.location.search}` === target) return;
    window.location.replace(target);
}