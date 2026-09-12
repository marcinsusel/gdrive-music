'use client';

import React from 'react';
import {
  Play,
  Library,
  ListMusic,
  Settings,
  Cloud,
  HardDrive,
  Upload,
  Sparkles,
  Smartphone,
  Menu,
  X,
  Disc,
} from 'lucide-react';
import { WindowId, WindowState, SyncSettings } from '@/types/music';

interface NavbarProps {
  windows: Record<WindowId, WindowState>;
  onToggleWindow: (id: WindowId) => void;
  onOpenSettings?: () => void;
  onOpenImport: () => void;
  settings: SyncSettings;
  isPlaying: boolean;
  currentTrackTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  windows,
  onToggleWindow,
  onOpenSettings,
  onOpenImport,
  settings,
  isPlaying,
  currentTrackTitle,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const navItems: { id: WindowId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'player',
      label: 'Player',
      icon: isPlaying ? (
        <Disc className="w-4 h-4 text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
      ) : (
        <Play className="w-4 h-4 text-indigo-400" />
      ),
    },
    {
      id: 'library',
      label: 'Library',
      icon: <Library className="w-4 h-4 text-sky-400" />,
    },
    {
      id: 'playlists',
      label: 'Playlists',
      icon: <ListMusic className="w-4 h-4 text-purple-400" />,
    },
    {
      id: 'settings',
      label: 'Settings & Sync',
      icon: <Settings className="w-4 h-4 text-emerald-400" />,
    },
  ];

  return (
    <>
      {/* Top Navbar */}
      <header className="glass-header h-14 px-4 flex items-center justify-between relative z-40">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Disc className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '10s' }} />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              GDrive Music
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PWA
              </span>
            </span>
            {currentTrackTitle && (
              <span className="text-[10px] text-slate-400 truncate max-w-[140px] sm:max-w-xs">
                Playing: {currentTrackTitle}
              </span>
            )}
          </div>
        </div>

        {/* Desktop Navigation Windows Buttons */}
        <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          {navItems.map((item) => {
            const win = windows[item.id];
            const isActive = win && win.isOpen && !win.isMinimized;

            return (
              <button
                key={item.id}
                onClick={() => onToggleWindow(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Quick Import Button */}
          <button
            onClick={onOpenImport}
            title="Import Music"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>Import</span>
          </button>

          {/* Connection Status Button */}
          <button
            type="button"
            onClick={() => (onOpenSettings ? onOpenSettings() : onToggleWindow('settings'))}
            title={
              isMounted && (settings.userEmail || !!localStorage.getItem('gdrive_music_access_token'))
                ? 'Google Drive Connected - Click to view settings'
                : 'Click to open settings and connect Google Drive'
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800/80 border border-slate-700/80 hover:border-indigo-500/60 hover:bg-slate-800 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            {isMounted && (settings.userEmail || !!localStorage.getItem('gdrive_music_access_token')) ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-200 hidden sm:inline truncate max-w-[130px]">
                  {settings.userName || settings.userEmail || 'Google Drive'}
                </span>
                <span className="text-slate-200 sm:hidden">Drive</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-indigo-300 font-semibold">Connect Drive</span>
              </>
            )}
          </button>

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bg-slate-950/95 border-b border-slate-800 p-4 z-50 backdrop-blur-xl flex flex-col gap-2">
          {navItems.map((item) => {
            const win = windows[item.id];
            const isActive = win && win.isOpen && !win.isMinimized;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onToggleWindow(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => {
              onOpenImport();
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/60 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
          >
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Import Music & Playlists</span>
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation Dock */}
      <div className="md:hidden fixed bottom-0 inset-x-0 glass-header border-t border-slate-800 px-3 py-2 flex items-center justify-around z-40">
        {navItems.map((item) => {
          const win = windows[item.id];
          const isActive = win && win.isOpen && !win.isMinimized;

          return (
            <button
              key={item.id}
              onClick={() => onToggleWindow(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
                isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400'
              }`}
            >
              {item.icon}
              <span className="text-[10px]">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
