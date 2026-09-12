import { Track, FolderNode, SyncSettings } from '@/types/music';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  modifiedTime?: string;
}

export interface GoogleUserInfo {
  email: string;
  name: string;
  picture?: string;
}

export class GoogleDriveService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private gisClient: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gdrive_music_access_token');
      const expires = localStorage.getItem('gdrive_music_token_expires');
      const expiresNum = expires ? parseInt(expires, 10) : 0;
      if (stored && (!expiresNum || isNaN(expiresNum) || Date.now() < expiresNum)) {
        this.accessToken = stored;
        this.tokenExpiresAt = expiresNum && !isNaN(expiresNum) ? expiresNum : Date.now() + 3600000;
      }
    }
  }

  public getAccessToken(): string | null {
    if (this.accessToken) {
      if (!this.tokenExpiresAt || isNaN(this.tokenExpiresAt) || Date.now() < this.tokenExpiresAt) {
        return this.accessToken;
      }
    }
    // Dynamic fallback to localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gdrive_music_access_token');
      const expires = localStorage.getItem('gdrive_music_token_expires');
      const expiresNum = expires ? parseInt(expires, 10) : 0;
      if (stored && (!expiresNum || isNaN(expiresNum) || Date.now() < expiresNum)) {
        this.accessToken = stored;
        this.tokenExpiresAt = expiresNum && !isNaN(expiresNum) ? expiresNum : Date.now() + 3600000;
        return this.accessToken;
      }
    }
    return null;
  }

  public setAccessToken(token: string, expiresInSeconds: number = 3600) {
    const sec = parseInt(expiresInSeconds as any, 10) || 3600;
    this.accessToken = token;
    this.tokenExpiresAt = Date.now() + (sec - 60) * 1000;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gdrive_music_access_token', token);
      localStorage.setItem('gdrive_music_token_expires', this.tokenExpiresAt.toString());
    }
  }

  public logout() {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gdrive_music_access_token');
      localStorage.removeItem('gdrive_music_token_expires');
    }
  }

  /**
   * Dynamically load Google Identity Services (GIS) script
   */
  public async loadGisScript(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (window.google?.accounts?.oauth2) return;

    return new Promise((resolve, reject) => {
      const existing = document.getElementById('google-gis-script');
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-gis-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.body.appendChild(script);
    });
  }

  public isConnected(): boolean {
    return !!this.getAccessToken();
  }

  /**
   * Request user login via Google OAuth 2.0 Token Client
   */
  public async loginWithGoogle(clientId: string): Promise<string> {
    await this.loadGisScript();

    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services not loaded');
    }

    return new Promise((resolve, reject) => {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.appdata email profile openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            if (response.access_token) {
              this.setAccessToken(response.access_token, response.expires_in);
              resolve(response.access_token);
            } else {
              reject(new Error('No access token returned'));
            }
          },
        });

        this.gisClient = client;
        client.requestAccessToken({ prompt: 'select_account' });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Get authenticated user profile info
   */
  public async fetchUserInfo(): Promise<GoogleUserInfo | null> {
    const token = this.getAccessToken();
    if (!token) return null;

    // 1. Try Drive API about endpoint (always authorized with drive.readonly scope)
    try {
      const driveRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (driveRes.ok) {
        const driveData = await driveRes.json();
        if (driveData.user) {
          return {
            email: driveData.user.emailAddress || 'Google Drive Connected',
            name: driveData.user.displayName || driveData.user.emailAddress || 'Google Account',
            picture: driveData.user.photoLink,
          };
        }
      }
    } catch (e) {
      console.warn('Drive about user fetch failed:', e);
    }

    // 2. Try oauth2 userinfo
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return {
          email: data.email,
          name: data.name || data.email,
          picture: data.picture,
        };
      }
    } catch (e) {
      console.warn('OAuth2 userinfo fetch failed:', e);
    }

    // 3. If token is present but endpoints failed, return fallback
    return {
      email: 'Google Drive Account',
      name: 'Google Drive User',
    };
  }

  /**
   * List folders in Google Drive under a parent folder (or root)
   */
  public async listFolders(parentId?: string): Promise<{ id: string; name: string }[]> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not logged into Google');

    const parentQuery = parentId ? `'${parentId}' in parents` : `'root' in parents`;
    const q = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${parentQuery}`;

    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('fields', 'files(id, name)');
    url.searchParams.set('orderBy', 'name');
    url.searchParams.set('pageSize', '100');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to list folders');
    }

    const data = await res.json();
    return data.files || [];
  }

  /**
   * Recursively crawl a Google Drive folder for audio and playlist files
   */
  public async scanFolderRecursively(
    folderId: string,
    folderName: string,
    onProgress?: (scannedFiles: number, currentFolder: string) => void
  ): Promise<{ tracks: Track[]; folders: FolderNode[] }> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not logged into Google');

    const tracks: Track[] = [];
    const folders: FolderNode[] = [];
    let scannedFilesCount = 0;

    const audioExtensions = ['mp3', 'flac', 'm4a', 'wav', 'ogg', 'aac', 'opus'];

    const traverse = async (currentFolderId: string, currentPath: string, parentNodeId?: string): Promise<FolderNode> => {
      if (onProgress) {
        onProgress(scannedFilesCount, currentPath);
      }

      const node: FolderNode = {
        id: currentFolderId,
        name: currentPath.split('/').pop() || currentPath,
        path: currentPath,
        parentId: parentNodeId,
        children: [],
        trackIds: [],
      };

      // Fetch items in current folder
      let pageToken: string | undefined = undefined;
      do {
        const url = new URL('https://www.googleapis.com/drive/v3/files');
        url.searchParams.set('q', `'${currentFolderId}' in parents and trashed = false`);
        url.searchParams.set('fields', 'nextPageToken, files(id, name, mimeType, size, modifiedTime)');
        url.searchParams.set('pageSize', '100');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) break;
        const data = await res.json();
        const files: GoogleDriveFile[] = data.files || [];
        pageToken = data.nextPageToken;

        for (const file of files) {
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            const childNode = await traverse(file.id, `${currentPath}/${file.name}`, currentFolderId);
            node.children.push(childNode);
          } else {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const isAudio = file.mimeType.startsWith('audio/') || audioExtensions.includes(ext);

            if (isAudio) {
              scannedFilesCount++;
              const trackId = file.id;
              node.trackIds.push(trackId);

              // Base track metadata from file name
              const cleanName = file.name.replace(/\.[^/.]+$/, '');
              let title = cleanName;
              let artist = 'Google Drive';

              if (cleanName.includes(' - ')) {
                const parts = cleanName.split(' - ');
                artist = parts[0].trim();
                title = parts.slice(1).join(' - ').trim();
              }

              tracks.push({
                id: trackId,
                driveFileId: file.id,
                title,
                artist,
                album: node.name,
                duration: 0,
                size: file.size ? parseInt(file.size, 10) : undefined,
                mimeType: file.mimeType || `audio/${ext}`,
                path: `${currentPath}/${file.name}`,
                folderId: currentFolderId,
                cacheStatus: 'cloud',
                addedAt: file.modifiedTime ? new Date(file.modifiedTime).getTime() : Date.now(),
                format: ext,
              });
            }
          }
        }
      } while (pageToken);

      folders.push(node);
      return node;
    };

    await traverse(folderId, folderName);
    return { tracks, folders };
  }

  /**
   * Download audio file blob from Google Drive
   */
  public async downloadFileBlob(fileId: string): Promise<Blob> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not logged into Google');

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to download audio file: ${res.statusText}`);
    }

    return await res.blob();
  }

  /**
   * Sync settings across devices via Google Drive appDataFolder
   */
  public async syncSettingsToDrive(settings: Partial<SyncSettings>): Promise<void> {
    const token = this.getAccessToken();
    if (!token) return;

    try {
      // Find existing config in appDataFolder
      const searchUrl = new URL('https://www.googleapis.com/drive/v3/files');
      searchUrl.searchParams.set('spaces', 'appDataFolder');
      searchUrl.searchParams.set('q', "name = 'gdrive-music-settings.json' and trashed = false");
      searchUrl.searchParams.set('fields', 'files(id, name)');

      const searchRes = await fetch(searchUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const searchData = await searchRes.json();
      const existingFile = searchData.files?.[0];

      const content = JSON.stringify({ ...settings, lastSyncedAt: Date.now() }, null, 2);
      const blob = new Blob([content], { type: 'application/json' });

      if (existingFile) {
        // Update
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: blob,
        });
      } else {
        // Create in appDataFolder
        const metadata = {
          name: 'gdrive-music-settings.json',
          parents: ['appDataFolder'],
        };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
      }
    } catch (err) {
      console.warn('Could not sync settings to Drive appDataFolder', err);
    }
  }

  /**
   * Load settings synced across devices from Drive appDataFolder
   */
  public async loadSettingsFromDrive(): Promise<Partial<SyncSettings> | null> {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const searchUrl = new URL('https://www.googleapis.com/drive/v3/files');
      searchUrl.searchParams.set('spaces', 'appDataFolder');
      searchUrl.searchParams.set('q', "name = 'gdrive-music-settings.json' and trashed = false");
      searchUrl.searchParams.set('fields', 'files(id, name)');

      const searchRes = await fetch(searchUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const searchData = await searchRes.json();
      const file = searchData.files?.[0];
      if (!file) return null;

      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!fileRes.ok) return null;
      return await fileRes.json();
    } catch {
      return null;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
