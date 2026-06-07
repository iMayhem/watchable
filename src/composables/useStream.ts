import { useStorage } from "@vueuse/core";
import { ref } from "vue";

interface MovieServer {
  serverIndex: number;
  type: 'movie' | 'tv';
  season: number;
  episode: number;
}

interface StreamData {
  movieServerMap: Record<string, MovieServer>;
  version?: number;
}

export interface Server {
  name: string;
  urlTemplate: string;
  isApiProvider?: boolean; // Flag for providers that need API calls instead of direct URLs
}

const defaultStreamData: StreamData = {
  movieServerMap: {}
};

export const streamData = useStorage<StreamData>('streamData', defaultStreamData);

// Migrate legacy local storage preferences — force Cinemaos (index 0) as default
if (streamData.value) {
  if (!streamData.value.version || streamData.value.version < 5) {
    // v5: Hard-reset ALL saved server preferences to Cinemaos (index 0).
    // IMPORTANT: We must reassign the entire object — NOT mutate nested properties.
    // VueUse's useStorage only tracks top-level ref reassignments; direct deep
    // mutations (entry.serverIndex = 0) are silently lost and never written to localStorage.
    const oldMap = streamData.value.movieServerMap || {};
    const resetMap: Record<string, any> = {};
    for (const key in oldMap) {
      const entry = oldMap[key];
      if (entry && typeof entry === 'object') {
        resetMap[key] = { ...entry, serverIndex: 0 };
      }
    }
    // Reassign the entire value so useStorage detects and persists the change
    streamData.value = {
      movieServerMap: resetMap,
      version: 5
    };
  }
}

export const movieServers = ref<Server[]>([
  { name: 'Gulab Jamun', urlTemplate: 'https://cinemaos.tech/player/{tmdbId}' },
  { name: 'Jalebi', urlTemplate: 'https://player.smashystream.com/movie/{tmdbId}?autoplay=true' },
  { name: 'Rasgulla', urlTemplate: 'https://peachify.top/embed/movie/{tmdbId}' },
  { name: 'Kaju Katli', urlTemplate: 'https://mappletv.uk/watch/movie/{tmdbId}' },
  { name: 'Kheer', urlTemplate: 'https://www.vidking.net/embed/movie/{tmdbId}?autoPlay=true' },
  { name: 'Barfi', urlTemplate: 'https://player.videasy.net/movie/{tmdbId}?color=#4eb5ff' },
  { name: 'Laddu', urlTemplate: 'https://vidsrc-embed.ru/embed/movie/{tmdbId}' },
  { name: 'Peda', urlTemplate: 'https://vidsrc-embed.su/embed/movie/{tmdbId}' },
  { name: 'Gajar Ka Halwa', urlTemplate: 'https://vidsrcme.su/embed/movie/{tmdbId}' },
  { name: 'Soan Papdi', urlTemplate: 'https://multiembed.mov/?video_id={tmdbId}&tmdb=1' },
  { name: 'Sandesh', urlTemplate: 'https://vsrc.su/embed/movie/{tmdbId}' },
  { name: 'Cham Cham', urlTemplate: 'https://vidlink.pro/movie/{tmdbId}' },
  { name: 'Kulfi', urlTemplate: 'https://player.autoembed.app/embed/movie/{tmdbId}' },
  { name: 'Mysore Pak', urlTemplate: 'https://vidfast.pro/movie/{tmdbId}' },
  { name: 'Imarti', urlTemplate: 'https://111movies.com/movie/{tmdbId}' },
  { name: 'Ghevar', urlTemplate: 'https://vidora.su/movie/{tmdbId}?parameters' }
]);

export const tvServers = ref<Server[]>([
  { name: 'Gulab Jamun', urlTemplate: 'https://cinemaos.tech/player/{externalId}/{season}/{episode}' },
  { name: 'Jalebi', urlTemplate: 'https://player.smashystream.com/tv/{externalId}?s={season}&e={episode}' },
  { name: 'Rasgulla', urlTemplate: 'https://peachify.top/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Kaju Katli', urlTemplate: 'https://mappletv.uk/watch/tv/{externalId}/{season}/{episode}' },
  { name: 'Kheer', urlTemplate: 'https://www.vidking.net/embed/tv/{externalId}/{season}/{episode}?autoPlay=true&nextEpisode=true&episodeSelector=true' },
  { name: 'Barfi', urlTemplate: 'https://player.videasy.net/tv/{externalId}/{season}/{episode}?color=#4eb5ff&nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true' },
  { name: 'Laddu', urlTemplate: 'https://vidsrc-embed.ru/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Peda', urlTemplate: 'https://vidsrc-embed.su/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Gajar Ka Halwa', urlTemplate: 'https://vidsrcme.su/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Soan Papdi', urlTemplate: 'https://multiembed.mov/?video_id={externalId}&tmdb=1&s={season}&e={episode}' },
  { name: 'Sandesh', urlTemplate: 'https://vsrc.su/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Cham Cham', urlTemplate: 'https://vidlink.pro/tv/{externalId}/{season}/{episode}' },
  { name: 'Kulfi', urlTemplate: 'https://player.autoembed.app/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Mysore Pak', urlTemplate: 'https://vidfast.pro/tv/{externalId}/{season}/{episode}' },
  { name: 'Imarti', urlTemplate: 'https://111movies.com/tv/{externalId}/{season}/{episode}' },
  { name: 'Ghevar', urlTemplate: 'https://vidora.su/tv/{externalId}/{season}/{episode}?autoplay=true' }
]);

export const currentStreamData = ref({
  currentStreamId: 0,
  currentServer: 0,
  currentType: 'movie' as 'movie' | 'tv',
  currentSeason: 0,
  currentEpisode: 0
});

export function getPreferredStreamData(mediaId: number | string, type: 'movie' | 'tv' = 'movie'): MovieServer | null {
  const id = String(mediaId);

  if (!id) {
    console.warn('Invalid media ID provided');
    return null;
  }

  const savedData = streamData.value.movieServerMap[id];

  if (savedData) {
    currentStreamData.value = {
      currentStreamId: Number(id),
      currentServer: savedData.serverIndex,
      currentType: savedData.type,
      currentSeason: savedData.season,
      currentEpisode: savedData.episode
    };
    return savedData;
  }

  currentStreamData.value = {
    currentStreamId: Number(id),
    currentServer: 0,
    currentType: type,
    currentSeason: type === 'tv' ? 1 : 0,
    currentEpisode: type === 'tv' ? 1 : 0
  };

  return null;
}

export function savePreferredServer(mediaId: string | number, serverIndex: number, type: 'movie' | 'tv' = 'movie'): void {
  if (serverIndex < 0 || serverIndex >= (type === 'movie' ? movieServers.value : tvServers.value).length) {
    console.warn('Invalid server index');
    return;
  }

  const id = String(mediaId);

  streamData.value.movieServerMap[id] = {
    serverIndex,
    type,
    season: type === 'tv' ? (streamData.value.movieServerMap[id]?.season || 1) : 0,
    episode: type === 'tv' ? (streamData.value.movieServerMap[id]?.episode || 1) : 0
  };

  currentStreamData.value.currentServer = serverIndex;
  currentStreamData.value.currentType = type;
}

export function saveLastWatchedMetaData(
  mediaId: string | number,
  type: 'movie' | 'tv',
  meta: {
    season: number;
    episode: number;
  }
): void {
  if (type === 'tv' && (meta.season < 1 || meta.episode < 1)) {
    console.warn('Invalid season or episode number');
    return;
  }

  const id = String(mediaId);

  streamData.value.movieServerMap[id] = {
    serverIndex: streamData.value.movieServerMap[id]?.serverIndex || 0,
    type,
    season: meta.season,
    episode: meta.episode
  };

  currentStreamData.value.currentType = type;
  currentStreamData.value.currentSeason = meta.season;
  currentStreamData.value.currentEpisode = meta.episode;
}

export function getLastWatchedMetaData(mediaId: string | number): MovieServer | null {
  const id = String(mediaId);
  return streamData.value.movieServerMap[id] || null;
}

export function getServers(type: 'movie' | 'tv' = 'movie'): Server[] {
  return type === 'movie' ? movieServers.value : tvServers.value;
}

export function buildStreamUrl(
  mediaId: string | number,
  type: 'movie' | 'tv' = 'movie',
  serverIndex: number = 0,
  season: number = 1,
  episode: number = 1,
  timestamp?: number,
  _movieTitle?: string,
  _year?: number
): string {
  const id = String(mediaId);
  const servers = getServers(type);

  if (serverIndex < 0 || serverIndex >= servers.length) {
    console.warn('Invalid server index, using default');
    serverIndex = 0;
  }

  const server = servers[serverIndex] || servers[0];
  
  // Handle regular URL template providers
  let url: string;

  if (type === 'movie') {
    url = server.urlTemplate.replace('{tmdbId}', id);
  } else {
    url = server.urlTemplate
      .replace('{externalId}', id)
      .replace('{season}', String(Math.max(1, season)))
      .replace('{episode}', String(Math.max(1, episode)));
  }

  // Add timestamp parameter for sync functionality
  if (timestamp !== undefined && timestamp > 0) {
    const timestampSeconds = Math.floor(timestamp);
    const serverName = server.name.toLowerCase();
    
    // Different servers use different timestamp parameters
    if (serverName.includes('vidking')) {
      // VidKing uses 'progress' parameter
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}progress=${timestampSeconds}`;
    } else if (serverName.includes('111movies')) {
      url += `?progress=${timestampSeconds}`;
    } else if (serverName.includes('vidlink') || serverName.includes('vidfast')) {
      url += `?startAt=${timestampSeconds}`;
    }
  }

  return url;
}