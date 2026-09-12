'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Track,
  FolderNode,
  Playlist,
  SyncSettings,
  WindowId,
  WindowState,
} from '@/types/music';
import {
  getAllTracks,
  saveTracks,
  saveTrack,
  getAllFolders,
  saveFolders,
  getAllPlaylists,
  savePlaylist,
  savePlaylists,
  deletePlaylist,
  getSettings,
  saveSettings,
  cacheAudioBlob,
} from '@/lib/storage-cache';
import { googleDriveService } from '@/lib/google-drive';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { Navbar } from '@/components/Navbar';
import { FloatingWindow } from '@/components/FloatingWindow';
import { PlayerPanel } from '@/components/PlayerPanel';
import { LibraryPanel } from '@/components/LibraryPanel';
import { PlaylistsPanel } from '@/components/PlaylistsPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ImportModal } from '@/components/ImportModal';
import { SAMPLE_TRACKS, SAMPLE_FOLDERS, SAMPLE_PLAYLISTS } from '@/lib/sample-data';
import {
  Play,
  Library,
  ListMusic,
  Settings as SettingsIcon,
  Download,
  Smartphone,
  Sparkles,
  AlertCircle,
  Folder,
} from 'lucide-react';

const INITIAL_WINDOWS: Record<WindowId, WindowState> = {
  library: {
    id: 'library',
    title: 'Music Library & Explorer',
    isOpen: true,
    isMinimized: false,
    isMaximized: false,
    position: { x: 20, y: 74 },
    size: { width: 620, height: 600 },
    zIndex: 10,
  },
  player: {
    id: 'player',
    title: 'Now Playing',
    isOpen: true,
    isMinimized: false,
    isMaximized: false,
    position: { x: 660, y: 74 },
    size: { width: 440, height: 320 },
    zIndex: 12,
  },
  playlists: {
    id: 'playlists',
    title: 'Playlists Manager',
    isOpen: true,
    isMinimized: false,
    isMaximized: false,
    position: { x: 660, y: 414 },
    size: { width: 440, height: 340 },
    zIndex: 11,
  },
  settings: {
    id: 'settings',
    title: 'Settings & Cloud Sync',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 200, y: 80 },
    size: { width: 680, height: 640 },
    zIndex: 20,
  },
  import: {
    id: 'import',
    title: 'Import Music',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    position: { x: 260, y: 120 },
    size: { width: 500, height: 480 },
    zIndex: 25,
  },
};

export default function Home() {
  const [windows, setWindows] = useState<Record<WindowId, WindowState>>(INITIAL_WINDOWS);
  const [topZIndex, setTopZIndex] = useState<number>(30);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [settings, setSettings] = useState<SyncSettings>({
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
  });
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  const player = useAudioPlayer(tracks);

  // Load saved data on startup
  useEffect(() => {
    async function loadData() {
      try {
        const [savedTracks, savedFolders, savedPlaylists, savedSettings] = await Promise.all([
          getAllTracks(),
          getAllFolders(),
          getAllPlaylists(),
          getSettings(),
        ]);

        if (savedTracks.length > 0) {
          setTracks(savedTracks);
        } else {
          // First launch: load sample demo tracks matching gdrive-music-test folder
          await saveTracks(SAMPLE_TRACKS);
          await saveFolders(SAMPLE_FOLDERS);
          await savePlaylists(SAMPLE_PLAYLISTS);
          setTracks(SAMPLE_TRACKS);
          setFolders(SAMPLE_FOLDERS);
          setPlaylists(SAMPLE_PLAYLISTS);
        }

        if (savedFolders.length > 0) setFolders(savedFolders);
        if (savedPlaylists.length > 0) setPlaylists(savedPlaylists);
        setSettings(savedSettings);

        // Adjust default positions on small mobile screens
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setWindows((prev) => ({
            ...prev,
            player: { ...prev.player, position: { x: 10, y: 70 }, size: { width: window.innerWidth - 20, height: 280 } },
            library: { ...prev.library, position: { x: 10, y: 360 }, size: { width: window.innerWidth - 20, height: 400 } },
            playlists: { ...prev.playlists, isOpen: false },
          }));
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }

    loadData();

    // Register Service Worker cleanly via useEffect
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }

    // Listen for PWA installation prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Bring clicked window to top
  const bringToFront = (id: WindowId) => {
    setTopZIndex((prev) => {
      const nextZ = prev + 1;
      setWindows((w) => ({
        ...w,
        [id]: { ...w[id], zIndex: nextZ },
      }));
      return nextZ;
    });
  };

  const openWindow = (id: WindowId) => {
    setTopZIndex((prev) => {
      const nextZ = prev + 1;
      setWindows((w) => {
        const win = w[id];
        const screenW = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 768;
        const targetW = Math.min(win.size.width, screenW - 24);
        const targetX = Math.max(10, Math.min(win.position.x, screenW - targetW - 20));
        const targetY = Math.max(65, Math.min(win.position.y, screenH - 120));

        return {
          ...w,
          [id]: {
            ...win,
            isOpen: true,
            isMinimized: false,
            position: { x: targetX, y: targetY },
            zIndex: nextZ,
          },
        };
      });
      return nextZ;
    });
  };

  const toggleWindow = (id: WindowId) => {
    setWindows((prev) => {
      const win = prev[id];
      const willOpen = !win.isOpen || win.isMinimized;
      const nextZ = willOpen ? topZIndex + 1 : win.zIndex;
      if (willOpen) setTopZIndex(nextZ);

      return {
        ...prev,
        [id]: {
          ...win,
          isOpen: true,
          isMinimized: willOpen ? false : !win.isMinimized,
          zIndex: nextZ,
        },
      };
    });
  };

  const closeWindow = (id: WindowId) => {
    setWindows((prev) => ({
      ...prev,
      [id]: { ...prev[id], isOpen: false },
    }));
  };

  const minimizeWindow = (id: WindowId) => {
    setWindows((prev) => ({
      ...prev,
      [id]: { ...prev[id], isMinimized: true },
    }));
  };

  const handlePositionChange = (id: WindowId, pos: { x: number; y: number }) => {
    setWindows((prev) => ({
      ...prev,
      [id]: { ...prev[id], position: pos },
    }));
  };

  // Update Settings
  const handleUpdateSettings = async (newSettings: Partial<SyncSettings>) => {
    const updated = await saveSettings(newSettings);
    setSettings(updated);

    if (updated.syncAcrossDevices && googleDriveService.getAccessToken()) {
      await googleDriveService.syncSettingsToDrive(updated);
    }
  };

  // Scan Google Drive Folder
  const handleScanDriveFolder = async (folderId: string, folderName: string) => {
    setIsScanning(true);
    setScanStatus(`Scanning "${folderName}" for music files...`);

    try {
      const { tracks: scannedTracks, folders: scannedFolders } =
        await googleDriveService.scanFolderRecursively(
          folderId,
          folderName,
          (count, currentPath) => {
            setScanStatus(`Scanning (${count} tracks): ${currentPath}`);
          }
        );

      // Save tracks to state and DB
      await saveTracks(scannedTracks);
      await saveFolders(scannedFolders);
      setTracks(scannedTracks);
      setFolders(scannedFolders);

      // Check auto-download option
      if (settings.autoDownloadNew) {
        setScanStatus('Auto-downloading new music files for offline cache...');
        for (const track of scannedTracks) {
          if (track.driveFileId && track.cacheStatus !== 'cached') {
            try {
              const blob = await googleDriveService.downloadFileBlob(track.driveFileId);
              await cacheAudioBlob(track.id, blob, track.mimeType);
              track.cacheStatus = 'cached';
            } catch (err) {
              console.warn(`Failed to auto-cache ${track.title}`, err);
            }
          }
        }
        setTracks([...scannedTracks]);
      }

      setScanStatus(`Scanned ${scannedTracks.length} tracks successfully!`);
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanStatus(`Scan failed: ${err.message || err}`);
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanStatus(null), 3000);
    }
  };

  // Cache single track
  const handleCacheTrack = async (track: Track) => {
    try {
      if (track.driveFileId) {
        const blob = await googleDriveService.downloadFileBlob(track.driveFileId);
        await cacheAudioBlob(track.id, blob, track.mimeType);
      } else if (track.path && track.path.startsWith('http')) {
        const res = await fetch(track.path);
        const blob = await res.blob();
        await cacheAudioBlob(track.id, blob, track.mimeType);
      }

      // Update in state
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, cacheStatus: 'cached', cachedAt: Date.now() } : t))
      );
    } catch (err) {
      console.error('Cache track error:', err);
    }
  };

  // Cache entire playlist
  const handleCachePlaylist = async (playlist: Playlist) => {
    const playlistTracks = tracks.filter((t) => playlist.trackIds.includes(t.id));
    for (const track of playlistTracks) {
      if (track.cacheStatus !== 'cached') {
        await handleCacheTrack(track);
      }
    }
  };

  // Playlists management
  const handleCreatePlaylist = async (name: string) => {
    const newPl: Playlist = {
      id: `pl_${Date.now()}`,
      name,
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await savePlaylist(newPl);
    setPlaylists((prev) => [...prev, newPl]);
  };

  const handleDeletePlaylist = async (id: string) => {
    await deletePlaylist(id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddToPlaylist = async (playlistId: string, trackId: string) => {
    const target = playlists.find((p) => p.id === playlistId);
    if (!target || target.trackIds.includes(trackId)) return;

    const updated: Playlist = {
      ...target,
      trackIds: [...target.trackIds, trackId],
      updatedAt: Date.now(),
    };
    await savePlaylist(updated);
    setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? updated : p)));
  };

  const handleRemoveTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    const target = playlists.find((p) => p.id === playlistId);
    if (!target) return;

    const updated: Playlist = {
      ...target,
      trackIds: target.trackIds.filter((id) => id !== trackId),
      updatedAt: Date.now(),
    };
    await savePlaylist(updated);
    setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? updated : p)));
  };

  // Load demo library
  const handleLoadDemoTracks = async () => {
    await saveTracks(SAMPLE_TRACKS);
    await saveFolders(SAMPLE_FOLDERS);
    await savePlaylists(SAMPLE_PLAYLISTS);
    setTracks(SAMPLE_TRACKS);
    setFolders(SAMPLE_FOLDERS);
    setPlaylists(SAMPLE_PLAYLISTS);
  };

  // PWA Install Prompt Trigger
  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden flex flex-col bg-[#080b12] select-none">
      {/* Dynamic Ambient Glow Backdrops */}
      <div className="ambient-glow-1 top-[-100px] left-[-100px]" />
      <div className="ambient-glow-2 bottom-[-100px] right-[-100px]" />
      <div className="ambient-glow-3 top-[30%] left-[40%]" />

      {/* Top Navigation */}
      <Navbar
        windows={windows}
        onToggleWindow={toggleWindow}
        onOpenSettings={() => openWindow('settings')}
        onOpenImport={() => setIsImportOpen(true)}
        settings={settings}
        isPlaying={player.isPlaying}
        currentTrackTitle={player.currentTrack?.title}
      />

      {/* Scanning / Sync Notification Toast */}
      {scanStatus && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl glass-panel text-xs text-indigo-200 border border-indigo-500/40 shadow-xl flex items-center gap-2 animate-pulse">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{scanStatus}</span>
        </div>
      )}

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="absolute bottom-16 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 max-w-sm glass-panel p-3 rounded-2xl border border-indigo-500/30 flex items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white flex-shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-100">Install GDrive Music</span>
              <span className="text-[10px] text-slate-400">Install as native app for offline listening</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleInstallApp}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              Install
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="p-1 text-slate-400 hover:text-slate-200 text-xs"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Floating Windows Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden p-2">
        {/* Window 1: Player */}
        <FloatingWindow
          windowState={windows.player}
          onClose={() => closeWindow('player')}
          onMinimize={() => minimizeWindow('player')}
          onFocus={() => bringToFront('player')}
          onPositionChange={(pos) => handlePositionChange('player', pos)}
          icon={<Play className="w-4 h-4" />}
        >
          <PlayerPanel
            player={player}
            playlists={playlists}
            onAddToPlaylist={handleAddToPlaylist}
            onCreatePlaylist={handleCreatePlaylist}
          />
        </FloatingWindow>

        {/* Window 2: Library */}
        <FloatingWindow
          windowState={windows.library}
          onClose={() => closeWindow('library')}
          onMinimize={() => minimizeWindow('library')}
          onFocus={() => bringToFront('library')}
          onPositionChange={(pos) => handlePositionChange('library', pos)}
          icon={<Library className="w-4 h-4" />}
        >
          <LibraryPanel
            tracks={tracks}
            folders={folders}
            playlists={playlists}
            currentTrackId={player.currentTrack?.id}
            onPlayTrack={(track, queue) => player.playTrack(track, queue)}
            onCacheTrack={handleCacheTrack}
            onAddToPlaylist={handleAddToPlaylist}
            onCreatePlaylist={handleCreatePlaylist}
            onOpenImport={() => setIsImportOpen(true)}
          />
        </FloatingWindow>

        {/* Window 3: Playlists */}
        <FloatingWindow
          windowState={windows.playlists}
          onClose={() => closeWindow('playlists')}
          onMinimize={() => minimizeWindow('playlists')}
          onFocus={() => bringToFront('playlists')}
          onPositionChange={(pos) => handlePositionChange('playlists', pos)}
          icon={<ListMusic className="w-4 h-4" />}
        >
          <PlaylistsPanel
            playlists={playlists}
            allTracks={tracks}
            currentTrackId={player.currentTrack?.id}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onPlayTrack={(track, queue) => player.playTrack(track, queue)}
            onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
            onCachePlaylist={handleCachePlaylist}
            onOpenImport={() => setIsImportOpen(true)}
          />
        </FloatingWindow>

        {/* Window 4: Settings & Sync */}
        <FloatingWindow
          windowState={windows.settings}
          onClose={() => closeWindow('settings')}
          onMinimize={() => minimizeWindow('settings')}
          onFocus={() => bringToFront('settings')}
          onPositionChange={(pos) => handlePositionChange('settings', pos)}
          icon={<SettingsIcon className="w-4 h-4" />}
        >
          <SettingsPanel
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onScanDriveFolder={handleScanDriveFolder}
            onLoadDemoTracks={handleLoadDemoTracks}
            isScanning={isScanning}
          />
        </FloatingWindow>
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onTracksImported={async (newTracks) => {
          await saveTracks(newTracks);
          setTracks((prev) => [...newTracks, ...prev]);
        }}
        onPlaylistImported={async (newPl) => {
          setPlaylists((prev) => [...prev, newPl]);
        }}
      />
    </main>
  );
}
