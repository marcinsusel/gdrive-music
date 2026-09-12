'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Folder,
  FolderOpen,
  List,
  FolderTree,
  Play,
  Download,
  CheckCircle2,
  Cloud,
  HardDrive,
  AlertTriangle,
  Music,
  ChevronRight,
  ChevronDown,
  Plus,
  Filter,
  ArrowUpDown,
  Check,
} from 'lucide-react';
import { Track, FolderNode, FilterOptions, SortField, SortOrder, ViewMode, Playlist } from '@/types/music';

interface LibraryPanelProps {
  tracks: Track[];
  folders: FolderNode[];
  playlists: Playlist[];
  currentTrackId?: string;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  onCacheTrack: (track: Track) => Promise<void>;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onCreatePlaylist?: (name: string) => void;
  onOpenImport: () => void;
}

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  tracks,
  folders,
  playlists,
  currentTrackId,
  onPlayTrack,
  onCacheTrack,
  onAddToPlaylist,
  onCreatePlaylist,
  onOpenImport,
}) => {
  const [filter, setFilter] = useState<FilterOptions>({
    search: '',
    artist: '',
    album: '',
    genre: '',
    fileType: '',
    sortBy: 'title',
    sortOrder: 'asc',
    viewMode: 'flat',
  });

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [playlistMenuTrackId, setPlaylistMenuTrackId] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  const renderPlaylistDropdown = (track: Track) => {
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => {
            setPlaylistMenuTrackId(playlistMenuTrackId === track.id ? null : track.id);
            setIsCreatingInline(false);
          }}
          title="Add to playlist"
          className="p-1 rounded-md text-slate-400 hover:text-purple-300 hover:bg-slate-700/60 transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {playlistMenuTrackId === track.id && (
          <div
            className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 text-xs backdrop-blur-xl"
          >
            <div className="px-2 py-1 text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-between border-b border-slate-800 mb-1">
              <span>Add to Playlist</span>
              <button
                type="button"
                onClick={() => setPlaylistMenuTrackId(null)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                ×
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
              {playlists.length === 0 ? (
                <div className="text-[11px] text-slate-500 text-center py-2">No playlists yet</div>
              ) : (
                playlists.map((pl) => {
                  const alreadyIn = pl.trackIds.includes(track.id);
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => {
                        onAddToPlaylist(pl.id, track.id);
                        setPlaylistMenuTrackId(null);
                        setAddedNotice(`Added "${track.title}" to ${pl.name}`);
                        setTimeout(() => setAddedNotice(null), 2500);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center justify-between group transition-colors"
                    >
                      <span className="truncate text-xs">{pl.name}</span>
                      {alreadyIn ? (
                        <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Plus className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Quick inline create */}
            <div className="mt-1 pt-1 border-t border-slate-800">
              {isCreatingInline ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newPlaylistName.trim() && onCreatePlaylist) {
                      onCreatePlaylist(newPlaylistName.trim());
                      setNewPlaylistName('');
                      setIsCreatingInline(false);
                    }
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    type="text"
                    placeholder="New playlist..."
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-200 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-semibold"
                  >
                    Add
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreatingInline(true)}
                  className="w-full text-left px-2 py-1 rounded text-[11px] text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/60 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> New Playlist
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Extract unique options for filter dropdowns
  const artists = useMemo(() => Array.from(new Set(tracks.map(t => t.artist).filter(Boolean))).sort(), [tracks]);
  const albums = useMemo(() => Array.from(new Set(tracks.map(t => t.album).filter(Boolean))).sort(), [tracks]);
  const genres = useMemo(() => Array.from(new Set(tracks.map(t => t.genre).filter(Boolean) as string[])).sort(), [tracks]);
  const fileTypes = useMemo(() => Array.from(new Set(tracks.map(t => t.format || t.mimeType.split('/')[1]).filter(Boolean))).sort(), [tracks]);

  // Filter and sort tracks for Flat View
  const filteredTracks = useMemo(() => {
    return tracks
      .filter((t) => {
        if (filter.search) {
          const s = filter.search.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(s);
          const matchArtist = t.artist.toLowerCase().includes(s);
          const matchAlbum = t.album.toLowerCase().includes(s);
          if (!matchTitle && !matchArtist && !matchAlbum) return false;
        }

        if (filter.artist && t.artist !== filter.artist) return false;
        if (filter.album && t.album !== filter.album) return false;
        if (filter.genre && t.genre !== filter.genre) return false;
        if (filter.fileType && (t.format || t.mimeType) !== filter.fileType) return false;

        return true;
      })
      .sort((a, b) => {
        let valA = (a[filter.sortBy] ?? '') as any;
        let valB = (b[filter.sortBy] ?? '') as any;

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return filter.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return filter.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [tracks, filter]);

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSortChange = (field: SortField) => {
    if (filter.sortBy === field) {
      setFilter(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }));
    } else {
      setFilter(prev => ({ ...prev, sortBy: field, sortOrder: 'asc' }));
    }
  };

  // Render Folder Tree Item recursively
  const renderFolderNode = (node: FolderNode, depth: number = 0) => {
    const isExpanded = expandedFolders[node.id] ?? true;
    const nodeTracks = tracks.filter(t => node.trackIds.includes(t.id));

    return (
      <div key={node.id} className="flex flex-col" style={{ marginLeft: `${depth * 14}px` }}>
        <div
          onClick={() => toggleFolder(node.id)}
          className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs text-slate-300 font-medium transition-colors"
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          {isExpanded ? <FolderOpen className="w-4 h-4 text-indigo-400" /> : <Folder className="w-4 h-4 text-indigo-400" />}
          <span className="truncate">{node.name}</span>
          <span className="text-[10px] text-slate-500 ml-auto">({nodeTracks.length})</span>
        </div>

        {isExpanded && (
          <div className="flex flex-col">
            {node.children.map(child => renderFolderNode(child, depth + 1))}
            {nodeTracks.map(track => (
              <div
                key={track.id}
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-800/80 cursor-pointer text-xs transition-colors ${
                  currentTrackId === track.id ? 'bg-indigo-950/60 border border-indigo-500/30 text-indigo-300' : 'text-slate-300'
                }`}
                style={{ marginLeft: '16px' }}
                onClick={() => onPlayTrack(track, nodeTracks)}
              >
                <Music className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <span className="truncate font-medium flex-1">{track.title}</span>
                <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{track.artist}</span>
                <span className="text-[10px] text-slate-500 font-mono">{formatDuration(track.duration)}</span>
                {renderStatusBadge(track)}
                {renderPlaylistDropdown(track)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderStatusBadge = (track: Track) => {
    switch (track.cacheStatus) {
      case 'cached':
        return (
          <span title="Locally Cached" className="text-emerald-400 flex items-center">
            <HardDrive className="w-3.5 h-3.5" />
          </span>
        );
      case 'cloud':
        return (
          <span title="Available in Cloud" className="text-sky-400 flex items-center">
            <Cloud className="w-3.5 h-3.5" />
          </span>
        );
      case 'missing':
        return (
          <span title="Missing from Cloud" className="text-amber-400 flex items-center">
            <AlertTriangle className="w-3.5 h-3.5" />
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Search & View Controls */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search title, artist, album..."
            value={filter.search}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {filter.search && (
            <button
              onClick={() => setFilter(prev => ({ ...prev, search: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* View Mode Toggle: Folder vs Flat */}
        <div className="flex items-center bg-slate-900/80 border border-slate-700/60 rounded-xl p-0.5">
          <button
            onClick={() => setFilter(prev => ({ ...prev, viewMode: 'flat' }))}
            title="Flat List View"
            className={`p-1.5 rounded-lg transition-colors ${
              filter.viewMode === 'flat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFilter(prev => ({ ...prev, viewMode: 'folder' }))}
            title="Folder Structure View"
            className={`p-1.5 rounded-lg transition-colors ${
              filter.viewMode === 'folder' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderTree className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          title="Filter options"
          className={`p-2 rounded-xl border transition-colors ${
            showFilters || filter.artist || filter.album || filter.genre || filter.fileType
              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400'
              : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Filter className="w-4 h-4" />
        </button>

        {/* Quick Import Button */}
        <button
          onClick={onOpenImport}
          title="Import Files / Playlists"
          className="px-2.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Import</span>
        </button>
      </div>

      {/* Filter Options Bar (Expandable) */}
      {showFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
          {/* Artist Filter */}
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-400 mb-1 block">Artist</label>
            <select
              value={filter.artist}
              onChange={(e) => setFilter(prev => ({ ...prev, artist: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">All Artists</option>
              {artists.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Album Filter */}
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-400 mb-1 block">Album</label>
            <select
              value={filter.album}
              onChange={(e) => setFilter(prev => ({ ...prev, album: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">All Albums</option>
              {albums.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Genre Filter */}
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-400 mb-1 block">Genre</label>
            <select
              value={filter.genre}
              onChange={(e) => setFilter(prev => ({ ...prev, genre: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">All Genres</option>
              {genres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Format Filter */}
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-400 mb-1 block">Format</label>
            <select
              value={filter.fileType}
              onChange={(e) => setFilter(prev => ({ ...prev, fileType: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">All Formats</option>
              {fileTypes.map(ft => <option key={ft} value={ft}>{ft.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Main Track List or Folder Tree */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {filter.viewMode === 'folder' ? (
          // Folder Structure View
          <div className="flex flex-col gap-1">
            {folders.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No folders scanned yet. Connect Google Drive or import files.
              </div>
            ) : (
              folders.filter(f => !f.parentId).map(rootFolder => renderFolderNode(rootFolder))
            )}
          </div>
        ) : (
          // Flattened Alphabetical List View
          <div className="flex flex-col">
            {/* Table Header with Sort Buttons */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-semibold text-slate-400 border-b border-slate-800 select-none">
              <button
                onClick={() => handleSortChange('title')}
                className="col-span-5 text-left flex items-center gap-1 hover:text-slate-200"
              >
                Title {filter.sortBy === 'title' && <ArrowUpDown className="w-3 h-3 text-indigo-400" />}
              </button>
              <button
                onClick={() => handleSortChange('artist')}
                className="col-span-3 text-left flex items-center gap-1 hover:text-slate-200"
              >
                Artist {filter.sortBy === 'artist' && <ArrowUpDown className="w-3 h-3 text-indigo-400" />}
              </button>
              <button
                onClick={() => handleSortChange('album')}
                className="col-span-2 text-left hidden sm:flex items-center gap-1 hover:text-slate-200"
              >
                Album {filter.sortBy === 'album' && <ArrowUpDown className="w-3 h-3 text-indigo-400" />}
              </button>
              <button
                onClick={() => handleSortChange('duration')}
                className="col-span-2 sm:col-span-1 text-right flex items-center justify-end gap-1 hover:text-slate-200"
              >
                Time {filter.sortBy === 'duration' && <ArrowUpDown className="w-3 h-3 text-indigo-400" />}
              </button>
              <div className="col-span-2 sm:col-span-1 text-center">Status</div>
            </div>

            {/* Track Rows */}
            {filteredTracks.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No tracks match your query or your library is empty.
              </div>
            ) : (
              filteredTracks.map((track) => {
                const isSelected = currentTrackId === track.id;

                return (
                  <div
                    key={track.id}
                    className={`grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-xl text-xs transition-colors group cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/60 border border-indigo-500/40 text-indigo-200'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                    onClick={() => onPlayTrack(track, filteredTracks)}
                  >
                    {/* Title + Play button */}
                    <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex-shrink-0 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-indigo-600 transition-colors">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                      <span className="font-semibold truncate">{track.title}</span>
                    </div>

                    {/* Artist */}
                    <div className="col-span-3 truncate text-slate-400 font-medium">{track.artist}</div>

                    {/* Album */}
                    <div className="col-span-2 truncate text-slate-500 hidden sm:block">{track.album}</div>

                    {/* Duration */}
                    <div className="col-span-2 sm:col-span-1 text-right font-mono text-slate-400 text-[11px]">
                      {formatDuration(track.duration)}
                    </div>

                    {/* Status & Actions */}
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5">
                      {renderStatusBadge(track)}

                      {/* Cache button if not cached */}
                      {track.cacheStatus === 'cloud' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCacheTrack(track);
                          }}
                          title="Cache for offline"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-700/60 transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Add to Playlist button */}
                      {renderPlaylistDropdown(track)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <span>{filteredTracks.length} tracks</span>
          {addedNotice && (
            <span className="text-emerald-400 font-medium flex items-center gap-1 animate-pulse">
              <Check className="w-3 h-3" /> {addedNotice}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-400">
            <HardDrive className="w-3 h-3" /> {tracks.filter(t => t.cacheStatus === 'cached').length} cached
          </span>
          <span className="flex items-center gap-1 text-sky-400">
            <Cloud className="w-3 h-3" /> {tracks.filter(t => t.cacheStatus === 'cloud').length} in cloud
          </span>
        </div>
      </div>
    </div>
  );
};
