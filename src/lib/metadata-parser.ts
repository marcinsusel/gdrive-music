import * as mm from 'music-metadata-browser';

export interface ParsedAudioMetadata {
  title: string;
  artist: string;
  album: string;
  year?: number | string;
  genre?: string;
  duration: number;
  coverArtUrl?: string;
  trackNo?: number;
}

/**
 * Clean up and parse track/artist from filename when tags are missing
 */
export function parseFilenameFallback(filename: string): { title: string; artist: string } {
  // Strip extension
  const base = filename.replace(/\.[^/.]+$/, '').trim();

  // Handle common patterns like "Artist - Title" or "01 - Artist - Title" or "01. Artist - Title"
  const cleaned = base.replace(/^\d+[\s.-]+/, ''); // remove leading track numbers like "01 - " or "01. "

  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ');
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(' - ').trim(),
      };
    }
  }

  return {
    artist: 'Unknown Artist',
    title: cleaned || filename,
  };
}

/**
 * Parse metadata from an audio Blob using music-metadata-browser
 */
export async function parseAudioBlobMetadata(
  blob: Blob,
  filename: string
): Promise<ParsedAudioMetadata> {
  const fallback = parseFilenameFallback(filename);

  try {
    const metadata = await mm.parseBlob(blob, {
      duration: true,
      skipCovers: false,
    });

    const common = metadata.common;
    const format = metadata.format;

    let coverArtUrl: string | undefined = undefined;
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      const picBlob = new Blob([new Uint8Array(pic.data)], { type: pic.format });
      coverArtUrl = URL.createObjectURL(picBlob);
    }

    return {
      title: common.title?.trim() || fallback.title,
      artist: common.artist?.trim() || fallback.artist,
      album: common.album?.trim() || 'Unknown Album',
      year: common.year || undefined,
      genre: common.genre && common.genre.length > 0 ? common.genre[0] : undefined,
      duration: format.duration ? Math.round(format.duration) : 0,
      coverArtUrl,
      trackNo: common.track?.no || undefined,
    };
  } catch (error) {
    console.warn(`Could not parse audio metadata for ${filename}, using fallback:`, error);
    return {
      title: fallback.title,
      artist: fallback.artist,
      album: 'Unknown Album',
      duration: 0,
    };
  }
}
