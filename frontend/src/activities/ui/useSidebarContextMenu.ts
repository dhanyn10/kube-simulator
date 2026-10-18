import React, { useState, useEffect } from 'react';

/**
 * Custom hook for managing sidebar context menu positioning and open state.
 */
export function useSidebarContextMenu() {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    globalThis.addEventListener('click', closeContextMenu);
    globalThis.addEventListener('contextmenu', closeContextMenu, true);
    return () => {
      globalThis.removeEventListener('click', closeContextMenu);
      globalThis.removeEventListener('contextmenu', closeContextMenu, true);
    };
  }, []);

  return { contextMenu, handleContextMenu, closeContextMenu };
}
