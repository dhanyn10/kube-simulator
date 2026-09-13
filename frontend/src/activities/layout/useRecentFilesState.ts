import { useState, useEffect, useRef, useCallback } from 'react';
import { RecentFileItem, fetchRecentFiles } from './fileBackstageHelpers';

/**
 * Shared hook to manage recent files state, loading, and context menu outside click listening.
 */
export function useRecentFilesState(isOpen: boolean) {
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: RecentFileItem | null } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const loadRecentFiles = useCallback(async () => {
    const items = await fetchRecentFiles();
    setRecentFiles(items);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadRecentFiles();
    }
  }, [isOpen, loadRecentFiles]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      globalThis.addEventListener('click', handleClickOutside);
      globalThis.addEventListener('contextmenu', handleClickOutside);
    }
    return () => {
      globalThis.removeEventListener('click', handleClickOutside);
      globalThis.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [contextMenu]);

  const handleRowContextMenu = (e: React.MouseEvent, item: RecentFileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  return {
    recentFiles,
    setRecentFiles,
    contextMenu,
    setContextMenu,
    contextMenuRef,
    loadRecentFiles,
    handleRowContextMenu,
  };
}
