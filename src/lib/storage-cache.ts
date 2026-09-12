import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Track, Playlist, SyncSettings, FolderNode } from '@/types/music';

interface MusicDBSchema extends DBSchema {
  tracks: {
    key: string;
    value: Track;
    indexes: { 'by-title': string; 'by-artist': string; 'by-album': string };
  };
  audio_blobs: {
    key: string;
    value: {
      trackId: string;
      blob: Blob;
      mimeType: string;
      size: number;
      updatedAt: number;
    };
  };
  playlists: {
    key: string;
    value: Playlist;
  };
  folders: {
    key: string;
    value: FolderNode;
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'gdrive_music_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MusicDBSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<MusicDBSchema>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in browser environment'));
  }

  if (!dbPromise) {
    dbPromise = openDB<MusicDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tracks')) {
          const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
          trackStore.createIndex('by-title', 'title');
          trackStore.createIndex('by-artist', 'artist');
          trackStore.createIndex('by-album', 'album');
        }

        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.createObjectStore('audio_blobs', { keyPath: 'trackId' });
        }

        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }

  return dbPromise;
}

// Track operations
export async function saveTrack(track: Track): Promise<void> {
  const db = await getDb();
  await db.put('tracks', track);
}

export async function saveTracks(tracks: Track[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('tracks', 'readwrite');
  for (const track of tracks) {
    await tx.store.put(track);
  }
  await tx.done;
}

export async function getTrack(id: string): Promise<Track | undefined> {
  const db = await getDb();
  return db.get('tracks', id);
}

export async function getAllTracks(): Promise<Track[]> {
  const db = await getDb();
  return db.getAll('tracks');
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('tracks', id);
  await db.delete('audio_blobs', id);
}

export async function clearAllTracks(): Promise<void> {
  const db = await getDb();
  await db.clear('tracks');
  await db.clear('audio_blobs');
}

// Audio Blob operations (Offline Caching)
export async function cacheAudioBlob(trackId: string, blob: Blob, mimeType?: string): Promise<void> {
  const db = await getDb();
  await db.put('audio_blobs', {
    trackId,
    blob,
    mimeType: mimeType || blob.type || 'audio/mpeg',
    size: blob.size,
    updatedAt: Date.now(),
  });

  // Update track cache status
  const track = await db.get('tracks', trackId);
  if (track) {
    track.cacheStatus = 'cached';
    track.cachedAt = Date.now();
    await db.put('tracks', track);
  }
}

export async function getCachedAudioBlob(trackId: string): Promise<Blob | undefined> {
  const db = await getDb();
  const entry = await db.get('audio_blobs', trackId);
  return entry?.blob;
}

export async function isTrackCached(trackId: string): Promise<boolean> {
  const db = await getDb();
  const count = await db.count('audio_blobs', trackId);
  return count > 0;
}

export async function removeCachedAudio(trackId: string): Promise<void> {
  const db = await getDb();
  await db.delete('audio_blobs', trackId);
  const track = await db.get('tracks', trackId);
  if (track) {
    track.cacheStatus = 'cloud';
    track.cachedAt = undefined;
    await db.put('tracks', track);
  }
}

// Playlist operations
export async function savePlaylist(playlist: Playlist): Promise<void> {
  const db = await getDb();
  await db.put('playlists', playlist);
}

export async function savePlaylists(playlists: Playlist[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('playlists', 'readwrite');
  for (const p of playlists) {
    await tx.store.put(p);
  }
  await tx.done;
}

export async function getAllPlaylists(): Promise<Playlist[]> {
  const db = await getDb();
  return db.getAll('playlists');
}

export async function getPlaylist(id: string): Promise<Playlist | undefined> {
  const db = await getDb();
  return db.get('playlists', id);
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('playlists', id);
}

// Folder operations
export async function saveFolders(folders: FolderNode[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('folders', 'readwrite');
  for (const f of folders) {
    await tx.store.put(f);
  }
  await tx.done;
}

export async function getAllFolders(): Promise<FolderNode[]> {
  const db = await getDb();
  return db.getAll('folders');
}

// Settings
const DEFAULT_SETTINGS: SyncSettings = {
  googleClientId: '',
  googleApiKey: '',
  selectedFolderId: '',
  selectedFolderName: '',
  cacheLocally: true,
  autoDownloadNew: false,
  downloadPlaylists: true,
  deleteMissingFiles: false,
  storageLocation: 'indexeddb',
  syncAcrossDevices: true,
};

export async function getSettings(): Promise<SyncSettings> {
  try {
    const db = await getDb();
    const entry = await db.get('settings', 'config');
    if (entry && entry.value) {
      return { ...DEFAULT_SETTINGS, ...entry.value };
    }
  } catch {
    // Return default if error
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Partial<SyncSettings>): Promise<SyncSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  try {
    const db = await getDb();
    await db.put('settings', { key: 'config', value: updated });
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
  return updated;
}

// Storage Quota & Persistence
export async function getStorageStats(): Promise<{
  usageMb: number;
  quotaMb: number;
  cachedTracksCount: number;
  isPersistent: boolean;
}> {
  let usageMb = 0;
  let quotaMb = 0;
  let isPersistent = false;

  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usageMb = Math.round((estimate.usage || 0) / (1024 * 1024));
      quotaMb = Math.round((estimate.quota || 0) / (1024 * 1024));
    } catch (e) {
      console.warn('Storage estimate failed', e);
    }
  }

  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    try {
      isPersistent = await navigator.storage.persisted();
    } catch {
      // ignore
    }
  }

  let cachedTracksCount = 0;
  try {
    const db = await getDb();
    cachedTracksCount = await db.count('audio_blobs');
  } catch {
    // ignore
  }

  return { usageMb, quotaMb, cachedTracksCount, isPersistent };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}
