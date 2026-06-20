export function dedupeById<T extends { id?: number | string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        const uid = String(item.id ?? '');
        if (!uid || seen.has(uid)) return false;
        seen.add(uid);
        return true;
    });
}