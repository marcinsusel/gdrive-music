'use client';

import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Cloud,
  HardDrive,
  AlertTriangle,
  Download,
  Music,
  Disc,
  Plus,
  ListPlus,
  Check,
} from 'lucide-react';
import { UseAudioPlayerReturn } from '@/hooks/use-audio-player';
import { Playlist } from '@/types/music';

interface PlayerPanelProps {
  player: UseAudioPlayerReturn;
  playlists?: Playlist[];
  onAddToPlaylist?: (playlistId: string, trackId: string) => void;
  onCreatePlaylist?: (name: string) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  player,
  playlists = [],
  onAddToPlaylist,
  onCreatePlaylist,
}) => {
  const [showPlaylistMenu, setShowPlaylistMenu] = React.useState(false);
  const [newPlaylistName, setNewPlaylistName] = React.useState('');
  const [isCreatingInline, setIsCreatingInline] = React.useState(false);
  const [addedNotice, setAddedNotice] = React.useState<string | null>(null);
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    cacheCurrentTrack,
    isLoading,
    error,
  } = player;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-full justify-between gap-4">
      {/* Top Section: Album Artwork & Track Info */}
      <div className="flex items-center gap-4">
        {/* Album Artwork */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-800/80 flex-shrink-0 border border-slate-700/50 shadow-lg flex items-center justify-center group">
          {currentTrack?.coverArtUrl ? (
            <img
              src={currentTrack.coverArtUrl}
              alt={currentTrack.album || 'Album Art'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500">
              <Disc className={`w-10 h-10 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            </div>
          )}

          {/* Playing animated wave overlay */}
          {isPlaying && (
            <div className="absolute bottom-1.5 right-1.5 flex items-end gap-0.5 bg-slate-950/80 px-1.5 py-1 rounded-md backdrop-blur-sm">
              <div className="w-1 bg-indigo-400 rounded-full animate-bar-1" />
              <div className="w-1 bg-indigo-400 rounded-full animate-bar-2" />
              <div className="w-1 bg-indigo-400 rounded-full animate-bar-3" />
              <div className="w-1 bg-indigo-400 rounded-full animate-bar-4" />
            </div>
          )}
        </div>

        {/* Track Title, Artist, Album, Status */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-slate-100 truncate">
              {currentTrack ? currentTrack.title : 'No track selected'}
            </h3>
          </div>

          <p className="text-xs text-slate-300 font-medium truncate mb-0.5">
            {currentTrack ? currentTrack.artist : 'Select a track from the library'}
          </p>

          <p className="text-xs text-slate-500 truncate mb-2">
            {currentTrack?.album || '—'}
          </p>

          {/* Status Badge & Cache Button */}
          {currentTrack && (
            <div className="flex items-center gap-2">
              {currentTrack.cacheStatus === 'cached' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <HardDrive className="w-3 h-3" /> Locally Cached
                </span>
              )}
              {currentTrack.cacheStatus === 'cloud' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <Cloud className="w-3 h-3" /> Cloud Streaming
                </span>
              )}
              {currentTrack.cacheStatus === 'missing' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="w-3 h-3" /> Missing from Cloud
                </span>
              )}

              {currentTrack.cacheStatus === 'cloud' && (
                <button
                  onClick={cacheCurrentTrack}
                  disabled={isLoading}
                  title="Cache this track for offline playback"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-indigo-300 hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  <Download className="w-3 h-3" /> Cache Offline
                </button>
              )}

              {/* Add to Playlist button & popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
                  title="Add to playlist"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-purple-300 hover:bg-slate-700 hover:text-purple-200 transition-colors border border-slate-700"
                >
                  <ListPlus className="w-3 h-3 text-purple-400" /> Add to Playlist
                </button>

                {showPlaylistMenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-0 top-full mt-1.5 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 text-xs backdrop-blur-xl"
                  >
                    <div className="px-2 py-1 text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-between border-b border-slate-800 mb-1">
                      <span>Add to Playlist</span>
                      <button
                        type="button"
                        onClick={() => setShowPlaylistMenu(false)}
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
                          const alreadyIn = pl.trackIds.includes(currentTrack.id);
                          return (
                            <button
                              key={pl.id}
                              type="button"
                              onClick={() => {
                                if (onAddToPlaylist) {
                                  onAddToPlaylist(pl.id, currentTrack.id);
                                  setAddedNotice(`Added to "${pl.name}"`);
                                  setTimeout(() => setAddedNotice(null), 2000);
                                  setShowPlaylistMenu(false);
                                }
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

                    {/* Inline create playlist */}
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
            </div>
          )}

          {addedNotice && (
            <div className="mt-1 text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" /> {addedNotice}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 p-2 rounded-lg flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Center Section: Progress Scrubber */}
      <div className="flex flex-col gap-1.5">
        <div className="relative flex items-center group">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer group-hover:h-2 transition-all"
            style={{
              background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${progressPercent}%, #334155 ${progressPercent}%, #334155 100%)`,
            }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls: Shuffle, Previous, Play/Pause, Next, Repeat */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            title={isShuffle ? 'Shuffle On' : 'Shuffle Off'}
            className={`p-2 rounded-lg transition-colors ${
              isShuffle ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Repeat */}
          <button
            onClick={cycleRepeat}
            title={`Repeat: ${repeatMode}`}
            className={`p-2 rounded-lg transition-colors ${
              repeatMode !== 'off' ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={prevTrack}
            title="Previous Track"
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors shadow-md"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            disabled={isLoading}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-transform active:scale-95 shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            title="Next Track"
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors shadow-md"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Volume Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            className="text-slate-400 hover:text-slate-200 p-1"
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 sm:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${
                (isMuted ? 0 : volume) * 100
              }%, #334155 ${(isMuted ? 0 : volume) * 100}%, #334155 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
