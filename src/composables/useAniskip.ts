
const ANISKIP_API = 'https://api.aniskip.com';

export type AniskipType = 'op' | 'ed' | 'recap' | 'mixed-op' | 'mixed-ed';

export interface AniskipInterval {
    startTime: number;
    endTime: number;
}

export interface AniskipSkipResult {
    interval: AniskipInterval;
    skipType: AniskipType;
    skipId: string;
    episodeLength: number;
}

export interface AniskipRelationRule {
    from: { start: number; end: number };
    to: { malId: number; start: number; end: number };
}

const skipTypeLabels: Record<AniskipType, string> = {
    op: 'Skip Intro',
    ed: 'Skip Credits',
    recap: 'Skip Recap',
    'mixed-op': 'Skip Intro',
    'mixed-ed': 'Skip Credits'
};

const skipPriority: AniskipType[] = ['recap', 'op', 'mixed-op', 'ed', 'mixed-ed'];

const memoryRules = new Map<number, AniskipRelationRule[]>();
const memorySkips = new Map<string, AniskipSkipResult[]>();

function cacheKey(malId: number, episode: number, episodeLength: number) {
    return `${malId}:${episode}:${Math.round(episodeLength)}`;
}



export function resolveAniskipTarget(
    malId: number,
    absoluteEpisode: number,
    rules: AniskipRelationRule[]
): { malId: number; episode: number } {
    for (const rule of rules) {
        if (
            absoluteEpisode >= rule.from.start &&
            absoluteEpisode <= rule.from.end
        ) {
            const localEpisode =
                absoluteEpisode - rule.from.start + rule.to.start;
            return { malId: rule.to.malId, episode: localEpisode };
        }
    }
    return { malId, episode: absoluteEpisode };
}

export async function fetchAniskipRelationRules(
    malId: number
): Promise<AniskipRelationRule[]> {
    if (memoryRules.has(malId)) {
        return memoryRules.get(malId)!;
    }

    try {
        const resp = await fetch(`${ANISKIP_API}/v2/relation-rules/${malId}`);
        const data = await resp.json();
        const rules = data?.found && Array.isArray(data.rules) ? data.rules : [];
        memoryRules.set(malId, rules);
        return rules;
    } catch {
        memoryRules.set(malId, []);
        return [];
    }
}

export async function fetchAniskipSkipTimes(
    malId: number,
    episode: number,
    episodeLengthSec: number
): Promise<AniskipSkipResult[]> {
    const roundedLength = Math.max(0, Math.round(episodeLengthSec));
    const key = cacheKey(malId, episode, roundedLength);
    if (memorySkips.has(key)) {
        return memorySkips.get(key)!;
    }

    const params = new URLSearchParams();
    for (const type of ['op', 'ed', 'recap', 'mixed-op', 'mixed-ed'] as AniskipType[]) {
        params.append('types', type);
    }
    params.set('episodeLength', String(roundedLength || 0));

    try {
        const resp = await fetch(
            `${ANISKIP_API}/v2/skip-times/${malId}/${episode}?${params.toString()}`
        );
        const data = await resp.json();
        const results: AniskipSkipResult[] =
            data?.found && Array.isArray(data.results) ? data.results : [];
        memorySkips.set(key, results);
        return results;
    } catch {
        memorySkips.set(key, []);
        return [];
    }
}

export function labelForSkipType(type: AniskipType): string {
    return skipTypeLabels[type] || 'Skip';
}

export function pickActiveSkip(
    skips: AniskipSkipResult[],
    currentTime: number,
    skippedIds: Set<string>
): AniskipSkipResult | null {
    const inRange = skips.filter((row) => {
        if (skippedIds.has(row.skipId)) return false;
        const { startTime, endTime } = row.interval;
        return currentTime >= startTime && currentTime < endTime - 0.25;
    });

    if (!inRange.length) return null;

    inRange.sort(
        (a, b) => skipPriority.indexOf(a.skipType) - skipPriority.indexOf(b.skipType)
    );
    return inRange[0];
}

export function shouldAutoSkip(
    skip: AniskipSkipResult,
    currentTime: number,
    prevTime: number
): boolean {
    const { startTime, endTime } = skip.interval;
    const entered =
        prevTime < startTime && currentTime >= startTime && currentTime < endTime;
    const nearStart = currentTime >= startTime && currentTime <= startTime + 1.5;
    return entered || nearStart;
}