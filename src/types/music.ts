export type CacheStatus = 'cached' | 'cloud' | 'missing';

export interface Track {
  id: string;                      // unique id (driveFileId or generated UUID)
  driveFileId?: string;           // Google Drive file ID if cloud track
  title: string;
  artist: string;
  album: string;
  year?: number | string;
  genre?: string;
  duration: number;               // in seconds
  size?: number;                  // file size in bytes
  mimeType: string;
  path: string;                   // relative path or folder path
  folderId?: string;              // parent folder ID in Drive
  coverArtUrl?: string;           // base64 or blob URL of embedded/folder artwork
  cacheStatus: CacheStatus;
  cachedAt?: number;
  addedAt: number;
  format?: string;                // mp3, flac, m4a, etc.
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  parentId?: string;
  children: FolderNode[];
  trackIds: string[];
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
  driveFileId?: string;
  isCloudSynced?: boolean;
}

export interface SyncSettings {
  googleClientId: string;
  googleApiKey: string;
  selectedFolderId: string;
  selectedFolderName: string;
  cacheLocally: boolean;
  autoDownloadNew: boolean;
  downloadPlaylists: boolean;
  deleteMissingFiles: boolean;
  storageLocation: 'indexeddb' | 'local_home';
  syncAcrossDevices: boolean;
  lastSyncedAt?: number;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
}

export type WindowId = 'player' | 'library' | 'playlists' | 'settings' | 'import';

export interface WindowState {
  id: WindowId;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

export type SortField = 'title' | 'artist' | 'album' | 'duration' | 'addedAt';
export type SortOrder = 'asc' | 'desc';
export type ViewMode = 'folder' | 'flat';

export interface FilterOptions {
  search: string;
  artist: string;
  album: string;
  genre: string;
  fileType: string;
  sortBy: SortField;
  sortOrder: SortOrder;
  viewMode: ViewMode;
}
