import { useState, useEffect, useRef, useCallback } from 'react';
import { Track } from '@/types/music';
import { getCachedAudioBlob, cacheAudioBlob } from '@/lib/storage-cache';
import { googleDriveService } from '@/lib/google-drive';

export type RepeatMode = 'off' | 'all' | 'one';

export interface UseAudioPlayerReturn {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  queue: Track[];
  history: Track[];
  isLoading: boolean;
  error: string | null;
  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  cacheCurrentTrack: () => Promise<void>;
}

export function useAudioPlayer(availableTracks?: Track[]): UseAudioPlayerReturn {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  const availableTracksRef = useRef<Track[]>(availableTracks || []);
  useEffect(() => {
    availableTracksRef.current = availableTracks || [];
  }, [availableTracks]);

  const currentTrackRef = useRef<Track | null>(currentTrack);
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const queueRef = useRef<Track[]>(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Initialize audio element
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = 'metadata';
    audio.volume = volume;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => handleTrackEnded();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onError = (e: Event) => {
      console.error('Audio playback error:', e);
      setIsLoading(false);
      setIsPlaying(false);
      setError('Failed to play audio track. Check network or file permissions.');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.pause();
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
    };
  }, []);

  // Update MediaSession API for lock-screen / mobile controls
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !currentTrack) {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title || 'Unknown Title',
      artist: currentTrack.artist || 'Unknown Artist',
      album: currentTrack.album || 'Google Drive Music',
      artwork: currentTrack.coverArtUrl
        ? [{ src: currentTrack.coverArtUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });

    navigator.mediaSession.setActionHandler('play', () => resume());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) seek(details.seekTime);
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      seek(Math.max(currentTime - (details.seekOffset || 10), 0));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      seek(Math.min(currentTime + (details.seekOffset || 10), duration));
    });
  }, [currentTrack, currentTime, duration]);

  // Resolve playable URL for track
  const resolveTrackAudioUrl = async (track: Track): Promise<string> => {
    // 1. Check local IndexedDB cache
    const cachedBlob = await getCachedAudioBlob(track.id);
    if (cachedBlob) {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      const url = URL.createObjectURL(cachedBlob);
      activeBlobUrlRef.current = url;
      return url;
    }

    // 2. Check if local desktop mode is enabled and file is in local cache API
    try {
      const res = await fetch(`/api/local-cache?action=get&trackId=${track.id}`);
      if (res.ok) {
        const blob = await res.blob();
        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        activeBlobUrlRef.current = url;
        return url;
      }
    } catch {
      // ignore
    }

    // 3. If Google Drive track, download blob using access token
    if (track.driveFileId) {
      const token = googleDriveService.getAccessToken();
      if (token) {
        try {
          const blob = await googleDriveService.downloadFileBlob(track.driveFileId);
          if (activeBlobUrlRef.current) {
            URL.revokeObjectURL(activeBlobUrlRef.current);
          }
          const url = URL.createObjectURL(blob);
          activeBlobUrlRef.current = url;
          return url;
        } catch (err) {
          console.error('Failed to download from Drive', err);
          throw new Error('Google Drive access failed. Please reconnect.');
        }
      }
    }

    // 4. Fallback or demo audio
    if (track.path && (track.path.startsWith('http') || track.path.startsWith('/'))) {
      return track.path;
    }

    throw new Error('No audio source available for this track');
  };

  const playTrack = useCallback(async (track: Track, newQueue?: Track[]) => {
    if (!audioRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      const audioUrl = await resolveTrackAudioUrl(track);
      audioRef.current.src = audioUrl;
      audioRef.current.currentTime = 0;
      await audioRef.current.play();

      if (currentTrackRef.current) {
        setHistory((prev) => [currentTrackRef.current!, ...prev.slice(0, 50)]);
      }

      setCurrentTrack(track);
      setIsPlaying(true);

      if (newQueue) {
        setQueue(newQueue.filter((t) => t.id !== track.id));
      }
    } catch (err: any) {
      console.error('Play error:', err);
      setError(err.message || 'Error playing track');
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    // If no track selected yet, auto-play first available track from queue or library
    if (!currentTrackRef.current) {
      if (queueRef.current.length > 0) {
        playTrack(queueRef.current[0], queueRef.current.slice(1));
        return;
      }
      const pool = availableTracksRef.current;
      if (pool && pool.length > 0) {
        playTrack(pool[0], pool.slice(1));
        return;
      }
      return;
    }

    if (audioRef.current.paused) {
      audioRef.current.play().catch(console.error);
    } else {
      audioRef.current.pause();
    }
  }, [playTrack]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.play().catch(console.error);
    }
  }, [currentTrack]);

  // Ref to always access newest togglePlay without listener recreation
  const togglePlayRef = useRef(togglePlay);
  useEffect(() => {
    togglePlayRef.current = togglePlay;
  }, [togglePlay]);

  // Global Spacebar shortcut to pause/play music
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for space key across all browsers, operating systems, and keyboard layouts
      const isSpace =
        e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar' || e.keyCode === 32;

      if (!isSpace) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        // Only ignore space if the user is typing in a genuine text input or editable field
        const isTextInput =
          tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox' ||
          (tagName === 'INPUT' &&
            !['range', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(
              (target as HTMLInputElement).type?.toLowerCase()
            ));

        if (isTextInput) {
          return; // Let user type normal space in search, rename playlist, etc.
        }
      }

      // Prevent default page scrolling down or button re-triggering
      e.preventDefault();
      e.stopPropagation();
      togglePlayRef.current();
    };

    // Use capture: true so that no intermediate child element swallows the spacebar event
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const seek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  const cycleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const nextTrack = useCallback(() => {
    if (queue.length === 0) {
      if (repeatMode === 'all' && history.length > 0 && currentTrack) {
        // Loop back
        const allTracks = [...history.reverse(), currentTrack];
        playTrack(allTracks[0], allTracks.slice(1));
      }
      return;
    }

    let nextIndex = 0;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    }

    const next = queue[nextIndex];
    const newQueue = queue.filter((_, idx) => idx !== nextIndex);
    playTrack(next, newQueue);
  }, [queue, isShuffle, repeatMode, history, currentTrack]);

  const prevTrack = useCallback(() => {
    if (!audioRef.current) return;

    // If more than 3 seconds in, restart current track
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (history.length > 0) {
      const prev = history[0];
      const newHistory = history.slice(1);
      setHistory(newHistory);
      if (currentTrack) {
        setQueue((q) => [currentTrack, ...q]);
      }
      playTrack(prev);
    } else {
      audioRef.current.currentTime = 0;
    }
  }, [history, currentTrack]);

  const handleTrackEnded = useCallback(() => {
    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
      return;
    }
    nextTrack();
  }, [repeatMode, nextTrack]);

  const addToQueue = (track: Track) => {
    setQueue((prev) => [...prev, track]);
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  const cacheCurrentTrack = async () => {
    if (!currentTrack) return;
    try {
      setIsLoading(true);
      if (currentTrack.driveFileId) {
        const blob = await googleDriveService.downloadFileBlob(currentTrack.driveFileId);
        await cacheAudioBlob(currentTrack.id, blob, currentTrack.mimeType);
        setCurrentTrack((prev) => (prev ? { ...prev, cacheStatus: 'cached' } : null));
      }
    } catch (err) {
      console.error('Failed to cache track:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    queue,
    history,
    isLoading,
    error,
    playTrack,
    togglePlay,
    pause,
    resume,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    addToQueue,
    removeFromQueue,
    clearQueue,
    cacheCurrentTrack,
  };
}
