import { browseMoovieCatalog } from './useMoovieCatalog';
import { getLanguageOption } from './useNetflixLanguage';
import {
    browseCacheKey,
    markBrowseWarmInflight,
    clearBrowseWarmInflight
} from './useNetflixBrowseCache';
import { nfDebug } from './useNetflixDebug';

const warmedPages = new Set<string>();

/** Prime the catalogue API for a browse destination (hover / focus). */
export function prefetchNetflixBrowseRoute(
    catalogueId: string,
    rowId: string,
    languageCategory: string
) {
    const loadKey = browseCacheKey(catalogueId, rowId, languageCategory);
    if (!markBrowseWarmInflight(loadKey)) return;

    void (async () => {
        try {
            const lang = getLanguageOption(languageCategory);
            const pageKey = `${loadKey}:p0`;
            if (warmedPages.has(pageKey)) return;
            warmedPages.add(pageKey);
            await browseMoovieCatalog(lang.category, 0);
            nfDebug('browse:prefetch:ok', { catalogueId, rowId, language: languageCategory });
        } catch {
            // ignore — prefetch is best-effort
        } finally {
            clearBrowseWarmInflight(loadKey);
        }
    })();
}