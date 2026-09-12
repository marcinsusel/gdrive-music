export interface ParsedPlaylistItem {
  title?: string;
  artist?: string;
  duration?: number;
  location: string; // filename, relative path, or URL
}

export interface ParsedPlaylistResult {
  name: string;
  items: ParsedPlaylistItem[];
}

/**
 * Parse .m3u and .m3u8 playlist content
 */
export function parseM3U(content: string, defaultName: string = 'Imported Playlist'): ParsedPlaylistResult {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const items: ParsedPlaylistItem[] = [];
  let currentTitle: string | undefined = undefined;
  let currentDuration: number | undefined = undefined;

  for (const line of lines) {
    if (line.startsWith('#EXTM3U')) {
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      // #EXTINF:123,Artist - Title  OR  #EXTINF:123,Title
      const infoPart = line.substring(8).trim();
      const commaIndex = infoPart.indexOf(',');
      if (commaIndex !== -1) {
        const durStr = infoPart.substring(0, commaIndex).trim();
        const dur = parseInt(durStr, 10);
        if (!isNaN(dur) && dur > 0) {
          currentDuration = dur;
        }
        currentTitle = infoPart.substring(commaIndex + 1).trim();
      } else {
        currentTitle = infoPart;
      }
      continue;
    }

    if (line.startsWith('#')) {
      // Ignore other comments/directives
      continue;
    }

    // It's a file path or URL
    items.push({
      title: currentTitle,
      duration: currentDuration,
      location: line,
    });

    currentTitle = undefined;
    currentDuration = undefined;
  }

  return {
    name: defaultName,
    items,
  };
}

/**
 * Parse .pls playlist content
 * Format:
 * [playlist]
 * NumberOfEntries=...
 * File1=...
 * Title1=...
 * Length1=...
 */
export function parsePLS(content: string, defaultName: string = 'Imported Playlist'): ParsedPlaylistResult {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const map: Record<string, string> = {};

  for (const line of lines) {
    if (line.startsWith('[') || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      const key = line.substring(0, eqIdx).trim().toLowerCase();
      const val = line.substring(eqIdx + 1).trim();
      map[key] = val;
    }
  }

  const items: ParsedPlaylistItem[] = [];
  let i = 1;
  while (map[`file${i}`]) {
    const file = map[`file${i}`];
    const title = map[`title${i}`];
    const lengthStr = map[`length${i}`];
    const duration = lengthStr ? parseInt(lengthStr, 10) : undefined;

    items.push({
      location: file,
      title: title || undefined,
      duration: duration && duration > 0 ? duration : undefined,
    });
    i++;
  }

  return {
    name: defaultName,
    items,
  };
}

/**
 * Export a list of tracks to standard extended M3U8 string
 */
export function exportToM3U8(playlistName: string, tracks: { title: string; artist: string; duration: number; path: string }[]): string {
  const lines = ['#EXTM3U', `#PLAYLIST:${playlistName}`];

  for (const track of tracks) {
    lines.push(`#EXTINF:${Math.round(track.duration)},${track.artist} - ${track.title}`);
    lines.push(track.path);
  }

  return lines.join('\n');
}
