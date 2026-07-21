import { getSupabaseClient } from '../lib/supabase';

const TABLE = 'catalog_audio_cache';
const CHUNK_SIZE = 200;

const memoryByCatalogId = new Map<string, string[]>();

function normalizeTags(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(String).filter(Boolean);
}

/** Batch-fetch audio chips for Moovie catalogue ids (one query per chunk). */
export async function fetchCatalogAudioCacheByIds(
    ids: Array<string | number>
): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    const unique = [...new Set(ids.map((id) => String(id)).filter(Boolean))];
    const missing = unique.filter((id) => !memoryByCatalogId.has(id));

    if (missing.length) {
        try {
            const supabase = await getSupabaseClient();

            for (let start = 0; start < missing.length; start += CHUNK_SIZE) {
                const chunk = missing.slice(start, start + CHUNK_SIZE);
                const { data, error } = await supabase
                    .from(TABLE)
                    .select('catalog_id, language_tags')
                    .in('catalog_id', chunk);

                if (error) {
                    console.error('catalog-audio-cache:fetch:fail', {
                        error: error.message,
                        chunk: chunk.length
                    });
                    continue;
                }

                for (const raw of data || []) {
                    const id = String((raw as { catalog_id: string }).catalog_id);
                    const tags = normalizeTags(
                        (raw as { language_tags: unknown }).language_tags
                    );
                    memoryByCatalogId.set(id, tags);
                }
            }

            console.log('catalog-audio-cache:fetch:ok', {
                requested: missing.length,
                found: missing.filter((id) => memoryByCatalogId.has(id)).length
            });
        } catch (err) {
            console.error('catalog-audio-cache:fetch:fail', { err });
        }
    }

    for (const id of unique) {
        const tags = memoryByCatalogId.get(id);
        if (tags) out.set(id, tags);
    }

    return out;
}

export function peekCatalogAudioCache(catalogId: string | number): string[] | undefined {
    return memoryByCatalogId.get(String(catalogId));
}