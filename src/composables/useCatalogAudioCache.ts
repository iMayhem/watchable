// Unused catalog audio cache stub

export async function fetchCatalogAudioCacheByIds(
    _ids: Array<string | number>
): Promise<Map<string, string[]>> {
    return new Map<string, string[]>();
}

export function peekCatalogAudioCache(_catalogId: string | number): string[] | undefined {
    return undefined;
}