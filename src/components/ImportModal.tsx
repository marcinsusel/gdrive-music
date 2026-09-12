'use client';

import React, { useState, useRef } from 'react';
import {
  Upload,
  FolderUp,
  FileCode,
  X,
  Music,
  CheckCircle2,
  AlertCircle,
  Disc,
} from 'lucide-react';
import { Track, Playlist } from '@/types/music';
import { parseAudioBlobMetadata } from '@/lib/metadata-parser';
import { parseM3U, parsePLS } from '@/lib/playlist-parser';
import { cacheAudioBlob, saveTrack, savePlaylist } from '@/lib/storage-cache';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTracksImported: (tracks: Track[]) => void;
  onPlaylistImported: (playlist: Playlist) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onTracksImported,
  onPlaylistImported,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'folder' | 'playlist'>('files');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const playlistInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAudioFiles = async (files: FileList | File[]) => {
    setIsProcessing(true);
    const audioFiles = Array.from(files).filter(
      (f) =>
        f.type.startsWith('audio/') ||
        /\.(mp3|flac|m4a|wav|ogg|aac|opus)$/i.test(f.name)
    );

    if (audioFiles.length === 0) {
      setStatusMessage('No valid audio files found.');
      setIsProcessing(false);
      return;
    }

    setProgress({ current: 0, total: audioFiles.length });
    const importedTracks: Track[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      setProgress({ current: i + 1, total: audioFiles.length });
      setStatusMessage(`Extracting metadata: ${file.name}`);

      try {
        const meta = await parseAudioBlobMetadata(file, file.name);
        const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
        const trackId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const track: Track = {
          id: trackId,
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          year: meta.year,
          genre: meta.genre,
          duration: meta.duration,
          size: file.size,
          mimeType: file.type || `audio/${ext}`,
          path: (file as any).webkitRelativePath || file.name,
          coverArtUrl: meta.coverArtUrl,
          cacheStatus: 'cached',
          cachedAt: Date.now(),
          addedAt: Date.now(),
          format: ext,
        };

        // Save blob in IndexedDB for offline playback
        await cacheAudioBlob(trackId, file, track.mimeType);
        await saveTrack(track);
        importedTracks.push(track);
      } catch (err) {
        console.error(`Error processing ${file.name}:`, err);
      }
    }

    onTracksImported(importedTracks);
    setStatusMessage(`Successfully imported ${importedTracks.length} tracks!`);
    setIsProcessing(false);
    setTimeout(() => {
      onClose();
      setStatusMessage(null);
    }, 1200);
  };

  const handlePlaylistFile = async (file: File) => {
    setIsProcessing(true);
    setStatusMessage(`Parsing playlist ${file.name}...`);

    try {
      const text = await file.text();
      const isPLS = /\.pls$/i.test(file.name);
      const playlistName = file.name.replace(/\.[^/.]+$/, '');
      const parsed = isPLS ? parsePLS(text, playlistName) : parseM3U(text, playlistName);

      const playlistId = `pl_${Date.now()}`;
      const playlist: Playlist = {
        id: playlistId,
        name: parsed.name,
        trackIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await savePlaylist(playlist);
      onPlaylistImported(playlist);

      setStatusMessage(`Playlist "${playlist.name}" imported with ${parsed.items.length} items!`);
    } catch (err: any) {
      setStatusMessage(`Failed to parse playlist: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        onClose();
        setStatusMessage(null);
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="glass-header px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Import Music & Playlists</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/40">
          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 transition-colors border-b-2 ${
              activeTab === 'files'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="w-4 h-4" /> Music Files
          </button>
          <button
            onClick={() => setActiveTab('folder')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 transition-colors border-b-2 ${
              activeTab === 'folder'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderUp className="w-4 h-4" /> Entire Folder
          </button>
          <button
            onClick={() => setActiveTab('playlist')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 transition-colors border-b-2 ${
              activeTab === 'playlist'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" /> Playlist (.m3u, .pls)
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 flex flex-col items-center justify-center">
          {activeTab === 'files' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-700 hover:border-indigo-500/70 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all text-center group"
            >
              <Music className="w-10 h-10 text-indigo-400 mb-3 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-sm text-slate-200 mb-1">
                Click to Select Audio Files
              </span>
              <span className="text-xs text-slate-400">
                Supports MP3, FLAC, M4A, WAV, OGG, AAC
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.flac,.m4a,.wav,.ogg,.aac,.opus"
                className="hidden"
                onChange={(e) => e.target.files && handleAudioFiles(e.target.files)}
              />
            </div>
          )}

          {activeTab === 'folder' && (
            <div
              onClick={() => folderInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-700 hover:border-indigo-500/70 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all text-center group"
            >
              <FolderUp className="w-10 h-10 text-indigo-400 mb-3 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-sm text-slate-200 mb-1">
                Select Music Folder
              </span>
              <span className="text-xs text-slate-400">
                Imports all audio files recursively and preserves structure
              </span>
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory="true"
                directory="true"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleAudioFiles(e.target.files)}
              />
            </div>
          )}

          {activeTab === 'playlist' && (
            <div
              onClick={() => playlistInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-700 hover:border-indigo-500/70 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all text-center group"
            >
              <FileCode className="w-10 h-10 text-indigo-400 mb-3 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-sm text-slate-200 mb-1">
                Select Playlist File
              </span>
              <span className="text-xs text-slate-400">
                Supports .m3u, .m3u8, and .pls playlists
              </span>
              <input
                ref={playlistInputRef}
                type="file"
                accept=".m3u,.m3u8,.pls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handlePlaylistFile(e.target.files[0])}
              />
            </div>
          )}

          {/* Progress / Status feedback */}
          {isProcessing && (
            <div className="w-full mt-4 flex flex-col gap-2">
              <div className="flex justify-between text-xs text-slate-400 font-medium">
                <span>Processing...</span>
                {progress.total > 0 && <span>{progress.current} / {progress.total}</span>}
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="mt-3 text-xs text-indigo-300 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
