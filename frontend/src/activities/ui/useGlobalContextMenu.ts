import { useState, useEffect } from 'react';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

/**
 * Custom hook managing global window context menu state outside canvas-main.
 */
export const useGlobalContextMenu = () => {
  const [defaultContextMenu, setDefaultContextMenu] = useState<ContextMenuPosition | null>(null);

  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('#canvas-main')) {
        return;
      }
      e.preventDefault();
      setDefaultContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleClose = () => setDefaultContextMenu(null);

    window.addEventListener('contextmenu', handleGlobalContextMenu);
    window.addEventListener('contextmenu', handleClose, true);
    window.addEventListener('click', handleClose);
    return () => {
      window.removeEventListener('contextmenu', handleGlobalContextMenu);
      window.removeEventListener('contextmenu', handleClose, true);
      window.removeEventListener('click', handleClose);
    };
  }, []);

  return {
    defaultContextMenu,
    setDefaultContextMenu,
  };
};
