const LOG_PREFIX = '[Netflix]';

/** console.warn survives production terser (log/info/debug are often stripped). */
export function nfDebug(step: string, detail?: unknown) {
    if (detail !== undefined) {
        console.warn(`${LOG_PREFIX} ${step}`, detail);
    } else {
        console.warn(`${LOG_PREFIX} ${step}`);
    }
}

export function nfDebugError(step: string, detail?: unknown) {
    if (detail !== undefined) {
        console.error(`${LOG_PREFIX} ${step}`, detail);
    } else {
        console.error(`${LOG_PREFIX} ${step}`);
    }
}