import type { LocationQuery } from 'vue-router';

/** Iframe src for the static mobile party app (mirrors desktop Party.vue → app.html). */
export function buildPartyFrameSrc(query: LocationQuery = {}): string {
    const params = new URLSearchParams();
    params.set('embedded', '1');

    Object.entries(query).forEach(([key, value]) => {
        if (value == null || key === 'embedded') return;
        if (Array.isArray(value)) {
            value.forEach((entry) => params.append(key, String(entry)));
            return;
        }
        params.set(key, String(value));
    });

    return `/party/app.html?${params.toString()}`;
}