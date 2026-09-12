'use client';

import React, { useState } from 'react';
import {
  ListMusic,
  Plus,
  Trash2,
  Play,
  Download,
  Share2,
  FileCode,
  Music,
  HardDrive,
  Cloud,
  Clock,
} from 'lucide-react';
import { Playlist, Track } from '@/types/music';
import { exportToM3U8 } from '@/lib/playlist-parser';

interface PlaylistsPanelProps {
  playlists: Playlist[];
  allTracks: Track[];
  currentTrackId?: string;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  onCachePlaylist: (playlist: Playlist) => Promise<void>;
  onOpenImport: () => void;
}

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const PlaylistsPanel: React.FC<PlaylistsPanelProps> = ({
  playlists,
  allTracks,
  currentTrackId,
  onCreatePlaylist,
  onDeletePlaylist,
  onPlayTrack,
  onRemoveTrackFromPlaylist,
  onCachePlaylist,
  onOpenImport,
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    playlists.length > 0 ? playlists[0].id : null
  );
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
  const playlistTracks = selectedPlaylist
    ? selectedPlaylist.trackIds
        .map((id) => allTracks.find((t) => t.id === id))
        .filter(Boolean) as Track[]
    : [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    onCreatePlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setIsCreating(false);
  };

  const handleExportM3U = () => {
    if (!selectedPlaylist) return;
    const content = exportToM3U8(
      selectedPlaylist.name,
      playlistTracks.map((t) => ({
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        path: t.path || t.title,
      }))
    );

    const blob = new Blob([content], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedPlaylist.name.replace(/\s+/g, '_')}.m3u8`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCacheAll = async () => {
    if (!selectedPlaylist) return;
    setIsDownloading(true);
    try {
      await onCachePlaylist(selectedPlaylist);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row h-full gap-4">
      {/* Playlists Sidebar */}
      <div className="w-full sm:w-56 flex-shrink-0 flex flex-col gap-2 border-b sm:border-b-0 sm:border-r border-slate-800 pb-3 sm:pb-0 sm:pr-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Playlists</span>
          <button
            onClick={() => setIsCreating(true)}
            className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            title="Create Playlist"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* New Playlist Form */}
        {isCreating && (
          <form onSubmit={handleCreate} className="flex flex-col gap-2 p-2 bg-slate-900 rounded-xl border border-slate-700">
            <input
              type="text"
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              autoFocus
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2 py-1 text-[11px] bg-indigo-600 text-white rounded-md hover:bg-indigo-500"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {/* Playlist List */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
          {playlists.length === 0 ? (
            <div className="text-slate-500 text-xs text-center py-6">
              No playlists yet.
            </div>
          ) : (
            playlists.map((p) => {
              const isSelected = p.id === selectedPlaylistId;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlaylistId(p.id)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 font-semibold'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ListMusic className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 flex-shrink-0">
                    {p.trackIds.length}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Import playlist shortcut */}
        <button
          onClick={onOpenImport}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-colors mt-auto"
        >
          <FileCode className="w-3.5 h-3.5 text-indigo-400" />
          Import M3U / PLS
        </button>
      </div>

      {/* Playlist Content View */}
      <div className="flex-1 min-w-0 flex flex-col h-full gap-3">
        {selectedPlaylist ? (
          <>
            {/* Playlist Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-100">{selectedPlaylist.name}</h3>
                <p className="text-xs text-slate-400">
                  {playlistTracks.length} tracks •{' '}
                  {formatDuration(playlistTracks.reduce((acc, t) => acc + (t.duration || 0), 0))} total
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Play All */}
                <button
                  onClick={() => playlistTracks.length > 0 && onPlayTrack(playlistTracks[0], playlistTracks)}
                  disabled={playlistTracks.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play All
                </button>

                {/* Cache Entire Playlist */}
                <button
                  onClick={handleCacheAll}
                  disabled={isDownloading || playlistTracks.length === 0}
                  title="Download all tracks in playlist for offline use"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs transition-colors"
                >
                  <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                </button>

                {/* Export M3U8 */}
                <button
                  onClick={handleExportM3U}
                  title="Export to .m3u8"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                {/* Delete Playlist */}
                <button
                  onClick={() => {
                    if (confirm(`Delete playlist "${selectedPlaylist.name}"?`)) {
                      onDeletePlaylist(selectedPlaylist.id);
                      setSelectedPlaylistId(null);
                    }
                  }}
                  title="Delete playlist"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 text-xs transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tracks List */}
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pr-1">
              {playlistTracks.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  This playlist is empty. Add songs from your library!
                </div>
              ) : (
                playlistTracks.map((track, idx) => (
                  <div
                    key={`${track.id}-${idx}`}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs group cursor-pointer transition-colors ${
                      currentTrackId === track.id
                        ? 'bg-indigo-950/60 border border-indigo-500/30 text-indigo-200'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                    onClick={() => onPlayTrack(track, playlistTracks)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-slate-500 text-[10px] w-4 text-center font-mono">
                        {idx + 1}
                      </span>
                      <Music className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold truncate">{track.title}</span>
                        <span className="text-[10px] text-slate-400 truncate">{track.artist}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {track.cacheStatus === 'cached' ? (
                        <span title="Cached" className="text-emerald-400 flex items-center">
                          <HardDrive className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span title="In Cloud" className="text-sky-400 flex items-center">
                          <Cloud className="w-3.5 h-3.5" />
                        </span>
                      )}

                      <span className="font-mono text-slate-400 text-[11px]">
                        {formatDuration(track.duration)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveTrackFromPlaylist(selectedPlaylist.id, track.id);
                        }}
                        title="Remove from playlist"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-slate-500 text-xs">
            Select or create a playlist.
          </div>
        )}
      </div>
    </div>
  );
};
