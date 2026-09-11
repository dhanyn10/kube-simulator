import React from 'react';
import { Sun, Moon, RotateCcw, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { RecentFileItem } from '../../activity/layout/fileBackstageHelpers';

export interface BackstageContextMenuProps {
  readonly contextMenu: { readonly x: number; readonly y: number; readonly item: RecentFileItem | null } | null;
  readonly contextMenuRef: React.RefObject<HTMLDivElement | null>;
  readonly colorMode: 'dark' | 'light';
  readonly toggleColorMode: () => void;
  readonly setContextMenu: (val: { x: number; y: number; item: RecentFileItem | null } | null) => void;
  readonly handleRestoreFile: (item: RecentFileItem) => void;
  readonly onClose: () => void;
}

/**
 * Context menu overlay for recent profile rows in FileBackstageView.
 */
export const BackstageContextMenu: React.FC<BackstageContextMenuProps> = ({
  contextMenu,
  contextMenuRef,
  colorMode,
  toggleColorMode,
  setContextMenu,
  handleRestoreFile,
  onClose,
}) => {
  if (!contextMenu) return null;

  const isDark = colorMode === 'dark';

  return (
    <div
      ref={contextMenuRef}
      style={{ top: contextMenu.y, left: contextMenu.x }}
      className={cn(
        "fixed z-[250] min-w-[180px] py-1.5 rounded-xl border shadow-2xl text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100",
        isDark
          ? "bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-black/50"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50"
      )}
    >
      <button
        type="button"
        onClick={() => {
          toggleColorMode();
          setContextMenu(null);
        }}
        className={cn(
          "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors cursor-pointer",
          isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
        )}
      >
        {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-600" />}
        <span>Change Theme</span>
      </button>

      {contextMenu.item && (
        <button
          type="button"
          onClick={() => {
            const targetItem = contextMenu.item;
            setContextMenu(null);
            if (targetItem) handleRestoreFile(targetItem);
          }}
          className={cn(
            "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors text-blue-500 hover:text-blue-400 cursor-pointer",
            isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
          )}
        >
          <RotateCcw size={15} />
          <span>Load Profile</span>
        </button>
      )}

      <div className={cn("my-1 border-t", isDark ? "border-slate-800" : "border-slate-100")} />

      <button
        type="button"
        onClick={() => {
          setContextMenu(null);
          onClose();
        }}
        className={cn(
          "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors text-rose-500 hover:text-rose-400 cursor-pointer",
          isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
        )}
      >
        <X size={15} />
        <span>Close File Menu</span>
      </button>
    </div>
  );
};
