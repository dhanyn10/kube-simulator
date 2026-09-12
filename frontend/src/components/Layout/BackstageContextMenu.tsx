import React from 'react';
import { Sun, Moon, RotateCcw, X } from 'lucide-react';
import { RecentFileItem } from '@/activities/layout/fileBackstageHelpers';
import {
  getContextMenuContainerClass,
  getContextMenuButtonClass,
  getContextMenuLoadProfileClass,
  getContextMenuExitClass,
  getContextMenuDividerClass,
  handleThemeToggleClick,
  handleLoadProfileClick,
  handleExitClick,
} from '@/activities/layout/backstageContextMenuHelpers';

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
      className={getContextMenuContainerClass(isDark)}
    >
      <button
        type="button"
        onClick={() => handleThemeToggleClick(toggleColorMode, setContextMenu)}
        className={getContextMenuButtonClass(isDark)}
      >
        {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-600" />}
        <span>Change Theme</span>
      </button>

      {contextMenu.item && (
        <button
          type="button"
          onClick={() => handleLoadProfileClick(contextMenu.item, setContextMenu, handleRestoreFile)}
          className={getContextMenuLoadProfileClass(isDark)}
        >
          <RotateCcw size={15} />
          <span>Load Profile</span>
        </button>
      )}

      <div className={getContextMenuDividerClass(isDark)} />

      <button
        type="button"
        onClick={() => handleExitClick(setContextMenu, onClose)}
        className={getContextMenuExitClass(isDark)}
      >
        <X size={15} />
        <span>Exit</span>
      </button>
    </div>
  );
};
