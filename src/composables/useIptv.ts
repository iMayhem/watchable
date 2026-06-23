export interface IptvCountry {
    name: string;
    path: string;
}

export interface IptvChannel {
    title: string;
    link: string;
}

interface GithubContentEntry {
    name: string;
    path: string;
    type: string;
}

const IPTV_STREAMS_API =
    'https://api.github.com/repos/iptv-org/iptv/contents/streams';
const IPTV_RAW_BASE =
    'https://raw.githubusercontent.com/iptv-org/iptv/master/';

/** Parse iptv-org M3U playlists into channel rows. */
export function parseM3uPlaylist(text: string): IptvChannel[] {
    const lines = text.split(/\r?\n/);
    const channels: IptvChannel[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('#EXTINF')) continue;

        const title = line.split(',').slice(1).join(',').trim() || 'Unknown channel';
        const link = lines[i + 1]?.trim() ?? '';
        if (/^https:\/\//i.test(link)) {
            channels.push({ title, link });
        }
        i++;
    }

    return channels;
}

export async function fetchIptvCountries(): Promise<IptvCountry[]> {
    const response = await fetch(IPTV_STREAMS_API);
    if (!response.ok) {
        throw new Error(`Failed to load countries (${response.status})`);
    }

    const entries = (await response.json()) as GithubContentEntry[];
    let regionNames: Intl.DisplayNames | null = null;
    try {
        regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
        // Fallback to code
    }

    return entries
        .filter((entry) => entry.type === 'file' && entry.name.endsWith('.m3u'))
        .map((entry) => {
            const code = entry.name.replace(/\.m3u$/i, '');
            let name = code.toUpperCase();
            if (regionNames) {
                try {
                    name = regionNames.of(name) || name;
                } catch {
                    // Fallback
                }
            }
            return {
                name,
                path: entry.path
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchIptvPlaylist(path: string): Promise<IptvChannel[]> {
    const response = await fetch(`${IPTV_RAW_BASE}${path}`);
    if (!response.ok) {
        throw new Error(`Failed to load playlist (${response.status})`);
    }

    return parseM3uPlaylist(await response.text());
}