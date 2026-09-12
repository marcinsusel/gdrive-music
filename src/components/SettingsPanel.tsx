'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cloud,
  Folder,
  HardDrive,
  RefreshCw,
  Trash2,
  CheckCircle,
  ExternalLink,
  Info,
  ShieldCheck,
  Smartphone,
  FolderSync,
  LogOut,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { SyncSettings } from '@/types/music';
import { googleDriveService } from '@/lib/google-drive';
import { getStorageStats, clearAllTracks } from '@/lib/storage-cache';

interface SettingsPanelProps {
  settings: SyncSettings;
  onUpdateSettings: (newSettings: Partial<SyncSettings>) => Promise<void>;
  onScanDriveFolder: (folderId: string, folderName: string) => Promise<void>;
  onLoadDemoTracks: () => void;
  isScanning: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onScanDriveFolder,
  onLoadDemoTracks,
  isScanning,
}) => {
  const [clientId, setClientId] = useState(settings.googleClientId || '');
  const [apiKey, setApiKey] = useState(settings.googleApiKey || '');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; picture?: string } | null>(null);
  const [storageStats, setStorageStats] = useState<{ usageMb: number; quotaMb: number; cachedTracksCount: number; isPersistent: boolean }>({
    usageMb: 0,
    quotaMb: 0,
    cachedTracksCount: 0,
    isPersistent: false,
  });
  const [driveFolders, setDriveFolders] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [localDiskAvailable, setLocalDiskAvailable] = useState<boolean>(false);
  const [localDiskInfo, setLocalDiskInfo] = useState<{ directory: string; totalSizeMb: number; cachedFilesCount: number } | null>(null);

  const isAuthed = !!userInfo || !!settings.userEmail || googleDriveService.isConnected();

  // Check login status and storage stats on mount
  useEffect(() => {
    refreshStats();
    checkLocalDiskCache();

    if (googleDriveService.isConnected()) {
      googleDriveService.fetchUserInfo().then((info) => {
        if (info) {
          setUserInfo(info);
          onUpdateSettings({
            userEmail: info.email,
            userName: info.name,
            userAvatar: info.picture,
          });
        }
      });
      loadRootFolders();
    } else if (settings.userEmail) {
      setUserInfo({
        email: settings.userEmail,
        name: settings.userName || settings.userEmail,
        picture: settings.userAvatar,
      });
    }
  }, [settings.userEmail]);

  useEffect(() => {
    if (settings.googleClientId && !clientId) {
      setClientId(settings.googleClientId);
    }
  }, [settings.googleClientId]);

  const refreshStats = async () => {
    const stats = await getStorageStats();
    setStorageStats(stats);
  };

  const checkLocalDiskCache = async () => {
    try {
      const res = await fetch('/api/local-cache?action=status');
      if (res.ok) {
        const data = await res.json();
        setLocalDiskAvailable(data.available);
        setLocalDiskInfo({
          directory: data.directory,
          totalSizeMb: data.totalSizeMb,
          cachedFilesCount: data.cachedFilesCount,
        });
      }
    } catch {
      setLocalDiskAvailable(false);
    }
  };

  const handleSaveCredentials = async () => {
    await onUpdateSettings({
      googleClientId: clientId.trim(),
      googleApiKey: apiKey.trim(),
    });
  };

  const handleLogin = async () => {
    if (!clientId.trim()) {
      alert('Please enter your Google OAuth 2.0 Client ID first.');
      return;
    }

    setIsLoggingIn(true);
    setFolderError(null);
    try {
      await onUpdateSettings({ googleClientId: clientId.trim() });
      await googleDriveService.loginWithGoogle(clientId.trim());
      const info = await googleDriveService.fetchUserInfo();
      const user = info || { email: 'Google Drive Connected', name: 'Google Account' };
      setUserInfo(user);
      await onUpdateSettings({
        googleClientId: clientId.trim(),
        userEmail: user.email,
        userName: user.name,
        userAvatar: user.picture,
      });
      await loadRootFolders();
    } catch (err: any) {
      console.error('Login error:', err);
      alert(`Google Login: ${err.message || err}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    googleDriveService.logout();
    setUserInfo(null);
    setDriveFolders([]);
    onUpdateSettings({ userEmail: '', userName: '', userAvatar: '' });
  };

  const loadRootFolders = async () => {
    setIsLoadingFolders(true);
    setFolderError(null);
    try {
      const folders = await googleDriveService.listFolders();
      setDriveFolders(folders);
    } catch (err: any) {
      console.error('Failed to load folders:', err);
      setFolderError(err.message || 'Failed to list folders');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleSelectFolder = async (folder: { id: string; name: string }) => {
    await onUpdateSettings({
      selectedFolderId: folder.id,
      selectedFolderName: folder.name,
    });
    await onScanDriveFolder(folder.id, folder.name);
  };

  const handleClearCache = async () => {
    if (confirm('Are you sure you want to clear all locally cached tracks?')) {
      await clearAllTracks();
      await refreshStats();
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto pb-6 text-xs text-slate-300">
      {/* 1-Minute Quick Start / Demo Test Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900 border border-indigo-500/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100">Instant Quick-Test Library</h4>
            <p className="text-[11px] text-slate-400">
              Load sample music tracks to immediately test playback, tagging, offline caching, and playlists in &lt;1 minute.
            </p>
          </div>
        </div>
        <button
          onClick={onLoadDemoTracks}
          className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex-shrink-0 transition-colors shadow-md"
        >
          Load Demo Music
        </button>
      </div>

      {/* Google Drive Account Section */}
      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Google Drive Connection
            </h4>
          </div>

          {isAuthed ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> Connected
              </span>
              <button
                onClick={handleLogout}
                title="Disconnect Google account"
                className="text-slate-400 hover:text-rose-400 p-1 rounded-md transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-slate-500">Not Connected</span>
          )}
        </div>

        {isAuthed ? (
          <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
            {userInfo?.picture ? (
              <img src={userInfo.picture} alt="User Avatar" className="w-9 h-9 rounded-full" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white">
                {(userInfo?.name || settings.userName || 'G').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-slate-100 truncate">
                {userInfo?.name || settings.userName || 'Google Drive Connected'}
              </span>
              <span className="text-[11px] text-slate-400 truncate">
                {userInfo?.email || settings.userEmail || 'Drive access active'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] text-slate-400">Google OAuth 2.0 Client ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 123456789-abcdefg.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <Info className="w-3 h-3 flex-shrink-0" />
              Obtain a client ID from Google Cloud Console with Google Drive API enabled.
            </p>
          </div>
        )}

        {/* Folder Selection */}
        {isAuthed && (
          <div className="mt-2 flex flex-col gap-2 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-300">Selected Music Library Folder:</span>
              <button
                onClick={loadRootFolders}
                disabled={isLoadingFolders}
                title="Refresh folders"
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFolders ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {folderError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex flex-col gap-1.5">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>Google Drive API Error</span>
                </div>
                <p className="text-[11px] text-rose-300/90">{folderError}</p>
                {(folderError.toLowerCase().includes('drive.googleapis.com') ||
                  folderError.toLowerCase().includes('disabled') ||
                  folderError.toLowerCase().includes('not been used')) && (
                  <a
                    href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-400 underline font-semibold hover:text-indigo-300 mt-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Click here to Enable Google Drive API in Google Cloud Console
                  </a>
                )}
              </div>
            )}

            {settings.selectedFolderName ? (
              <div className="flex items-center justify-between p-2.5 bg-indigo-950/40 border border-indigo-500/40 rounded-xl">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-slate-100">{settings.selectedFolderName}</span>
                </div>
                <button
                  onClick={() => handleSelectFolder({ id: settings.selectedFolderId, name: settings.selectedFolderName })}
                  disabled={isScanning}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                  {isScanning ? 'Scanning...' : 'Rescan'}
                </button>
              </div>
            ) : (
              <div className="text-slate-500 text-[11px]">No library folder selected yet.</div>
            )}

            {/* Folder list from Drive with gdrive-music-test highlighted */}
            <div className="mt-1 flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
              {driveFolders.length === 0 && !isLoadingFolders && (
                <div className="text-slate-500 text-[11px] py-2">
                  No folders found in Drive root or still loading.
                </div>
              )}
              {driveFolders.map((f) => {
                const isTestFolder = f.name.toLowerCase().includes('gdrive-music-test');
                const isCurrent = settings.selectedFolderId === f.id;

                return (
                  <div
                    key={f.id}
                    onClick={() => handleSelectFolder(f)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-indigo-600/30 border border-indigo-500/50 text-indigo-200 font-semibold'
                        : isTestFolder
                        ? 'bg-emerald-950/30 border border-emerald-500/40 hover:bg-emerald-900/40 text-emerald-200'
                        : 'hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Folder className={`w-4 h-4 ${isTestFolder ? 'text-emerald-400' : 'text-indigo-400'}`} />
                      <span>{f.name}</span>
                      {isTestFolder && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Recommended
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {isCurrent ? 'Selected' : 'Select'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sync & Caching Automation Options */}
      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <FolderSync className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Sync & Caching Rules
          </h4>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* Cache music files locally */}
          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/40 cursor-pointer">
            <div>
              <div className="font-semibold text-slate-200">Cache music files locally</div>
              <div className="text-[11px] text-slate-400">Keep tracks offline for fast instant playback</div>
            </div>
            <input
              type="checkbox"
              checked={settings.cacheLocally}
              onChange={(e) => onUpdateSettings({ cacheLocally: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700"
            />
          </label>

          {/* Download new files automatically */}
          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/40 cursor-pointer">
            <div>
              <div className="font-semibold text-slate-200">Download new files automatically</div>
              <div className="text-[11px] text-slate-400">Auto-cache newly detected songs during folder scans</div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoDownloadNew}
              onChange={(e) => onUpdateSettings({ autoDownloadNew: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700"
            />
          </label>

          {/* Download playlists and related files */}
          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/40 cursor-pointer">
            <div>
              <div className="font-semibold text-slate-200">Download playlists (m3u, pls)</div>
              <div className="text-[11px] text-slate-400">Automatically parse and sync playlist definitions</div>
            </div>
            <input
              type="checkbox"
              checked={settings.downloadPlaylists}
              onChange={(e) => onUpdateSettings({ downloadPlaylists: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700"
            />
          </label>

          {/* Delete files no longer in library */}
          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/40 cursor-pointer">
            <div>
              <div className="font-semibold text-slate-200">Delete removed files</div>
              <div className="text-[11px] text-slate-400">Remove cached files when deleted from Google Drive</div>
            </div>
            <input
              type="checkbox"
              checked={settings.deleteMissingFiles}
              onChange={(e) => onUpdateSettings({ deleteMissingFiles: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700"
            />
          </label>

          {/* Multi-device sync */}
          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/40 cursor-pointer">
            <div>
              <div className="font-semibold text-slate-200">Multi-Device Cloud Sync</div>
              <div className="text-[11px] text-slate-400">Sync library settings across phones, tablets, and desktop via Google Drive</div>
            </div>
            <input
              type="checkbox"
              checked={settings.syncAcrossDevices}
              onChange={(e) => onUpdateSettings({ syncAcrossDevices: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700"
            />
          </label>
        </div>
      </div>

      {/* Storage & Data Location */}
      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <HardDrive className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Storage Location & Statistics
          </h4>
        </div>

        {/* Choose Storage Location */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium text-slate-300">Storage Target:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div
              onClick={() => onUpdateSettings({ storageLocation: 'indexeddb' })}
              className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                settings.storageLocation === 'indexeddb'
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200'
                  : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80 text-slate-400'
              }`}
            >
              <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5 mb-1">
                <Smartphone className="w-3.5 h-3.5" /> Browser Sandbox (PWA)
              </div>
              <p className="text-[10px] text-slate-400">
                IndexedDB & Cache API. Universal across Android, iOS, and desktop browsers.
              </p>
            </div>

            <div
              onClick={() => onUpdateSettings({ storageLocation: 'local_home' })}
              className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                settings.storageLocation === 'local_home'
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200'
                  : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80 text-slate-400'
              }`}
            >
              <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5 mb-1">
                <HardDrive className="w-3.5 h-3.5" /> User Home Directory
              </div>
              <p className="text-[10px] text-slate-400">
                Direct disk storage in <code className="text-indigo-300 font-mono">~/.gdrive-music/</code> via local server.
              </p>
            </div>
          </div>
        </div>

        {/* Storage Stats Bar */}
        <div className="flex flex-col gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 mt-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">IndexedDB Cache:</span>
            <span className="font-mono text-slate-200">
              {storageStats.usageMb} MB used ({storageStats.cachedTracksCount} tracks)
            </span>
          </div>

          {localDiskAvailable && localDiskInfo && (
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">~/.gdrive-music Cache:</span>
              <span className="font-mono text-slate-200">
                {localDiskInfo.totalSizeMb} MB ({localDiskInfo.cachedFilesCount} files)
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
            <span className="text-[10px] text-slate-400">
              {storageStats.isPersistent ? 'Persistent storage granted' : 'Storage persistence active'}
            </span>
            <button
              onClick={handleClearCache}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Clear Local Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
