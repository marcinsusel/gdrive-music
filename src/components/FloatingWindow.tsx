'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Minus, Square, X, Move } from 'lucide-react';
import { WindowState } from '@/types/music';

interface FloatingWindowProps {
  windowState: WindowState;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
  onPositionChange?: (pos: { x: number; y: number }) => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  windowState,
  onClose,
  onMinimize,
  onFocus,
  onPositionChange,
  children,
  icon,
}) => {
  const [pos, setPos] = useState(windowState.position);
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  useEffect(() => {
    setPos(windowState.position);
  }, [windowState.position]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only allow dragging from header
    if ((e.target as HTMLElement).closest('.window-control-btn')) return;
    onFocus();
    if (isMaximized) return;

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isMaximized) return;

    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;

    // Viewport bounds
    const maxX = Math.max(0, window.innerWidth - 100);
    const maxY = Math.max(0, window.innerHeight - 80);

    const newX = Math.max(10, Math.min(maxX, dragStartRef.current.startX + dx));
    const newY = Math.max(60, Math.min(maxY, dragStartRef.current.startY + dy));

    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (onPositionChange) {
        onPositionChange(pos);
      }
    }
  };

  if (!windowState.isOpen || windowState.isMinimized) {
    return null;
  }

  const windowStyle: React.CSSProperties = isMaximized
    ? {
        position: 'fixed',
        top: '64px',
        left: '12px',
        right: '12px',
        bottom: '12px',
        zIndex: windowState.zIndex,
      }
    : {
        position: 'fixed',
        top: `${pos.y}px`,
        left: `${pos.x}px`,
        width: `min(${windowState.size.width}px, calc(100vw - 24px))`,
        height: `min(${windowState.size.height}px, calc(100vh - 100px))`,
        zIndex: windowState.zIndex,
      };

  return (
    <div
      style={windowStyle}
      onMouseDown={onFocus}
      onTouchStart={onFocus}
      className={`glass-panel rounded-2xl flex flex-col shadow-2xl transition-shadow overflow-hidden ${
        isDragging ? 'ring-2 ring-indigo-500/50 shadow-indigo-500/20' : ''
      }`}
    >
      {/* Window Header / Title Bar */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="glass-header px-4 py-3 flex items-center justify-between cursor-move select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="text-indigo-400 flex-shrink-0">{icon || <Move className="w-4 h-4" />}</div>
          <span className="font-semibold text-sm text-slate-100 truncate tracking-wide">
            {windowState.title}
          </span>
        </div>

        {/* Window Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            title="Minimize"
            className="window-control-btn w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMaximized(!isMaximized);
            }}
            title={isMaximized ? 'Restore' : 'Maximize'}
            className="window-control-btn w-7 h-7 rounded-lg hidden sm:flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close"
            className="window-control-btn w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Window Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
    </div>
  );
};
