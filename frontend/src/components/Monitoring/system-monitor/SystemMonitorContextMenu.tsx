import React, { useRef, useEffect } from 'react';
import { Sun, Moon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContextMenuPosition } from '@/lib/contextMenuUtils';
import { useOutsideContextMenu } from '@/hooks/useOutsideContextMenu';

export interface SystemMonitorContextMenuProps {
  readonly x: number;
  readonly y: number;
  readonly isDark: boolean;
  readonly onToggleTheme: () => void;
  readonly onCloseWindow: () => void;
  readonly onCloseMenu: () => void;
}

export const SystemMonitorContextMenu: React.FC<SystemMonitorContextMenuProps> = ({
  x,
  y,
  isDark,
  onToggleTheme,
  onCloseWindow,
  onCloseMenu,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useContextMenuPosition(x, y, menuRef);

  useOutsideContextMenu(menuRef, true, onCloseMenu);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMenu();
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [onCloseMenu]);

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-label="System monitor context menu"
      data-testid="system-monitor-context-menu"
      style={{ top: position.top, left: position.left }}
      className={cn(
        "fixed z-50 min-w-[160px] py-1 rounded-lg border text-xs shadow-xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100 select-none",
        isDark
          ? "bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-black/50"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50"
      )}
    >
      <button
        type="button"
        role="menuitem"
        data-testid="system-monitor-menu-change-theme"
        onClick={() => {
          onToggleTheme();
          onCloseMenu();
        }}
        className={cn(
          "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors cursor-pointer",
          isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
        )}
      >
        {isDark ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-slate-600" />}
        <span>Change Theme</span>
      </button>

      <div className={cn("my-1 border-t", isDark ? "border-slate-800" : "border-slate-100")} />

      <button
        type="button"
        role="menuitem"
        data-testid="system-monitor-menu-close"
        onClick={() => {
          onCloseMenu();
          onCloseWindow();
        }}
        className={cn(
          "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors cursor-pointer",
          isDark ? "text-rose-400 hover:bg-slate-800" : "text-rose-600 hover:bg-slate-100"
        )}
      >
        <X size={14} />
        <span>Close</span>
      </button>
    </div>
  );
};
