import { useState, useEffect, useRef, useCallback } from 'react';
import { RecentFileItem, fetchRecentFiles } from './fileBackstageHelpers';
import { useOutsideContextMenu } from '@/hooks/useOutsideContextMenu';

/**
 * Shared hook to manage recent files state, loading, and context menu outside click listening.
 */
export function useRecentFilesState(isOpen: boolean) {
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(isOpen);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: RecentFileItem | null } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const loadRecentFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await fetchRecentFiles();
      setRecentFiles(items);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (isOpen) {
      void loadRecentFiles();
    } else {
      setIsLoading(false);
    }
  }, [isOpen, loadRecentFiles]);

  useOutsideContextMenu(contextMenuRef, Boolean(contextMenu), closeContextMenu);

  const handleRowContextMenu = (e: React.MouseEvent, item: RecentFileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  return {
    recentFiles,
    setRecentFiles,
    isLoading,
    setIsLoading,
    contextMenu,
    setContextMenu,
    contextMenuRef,
    loadRecentFiles,
    handleRowContextMenu,
  };
}
