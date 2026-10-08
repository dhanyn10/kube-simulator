import { useState, useEffect } from 'react';

/** Interface defining coordinates for context menu positioning. */
export interface ContextMenuPosition {
  x: number;
  y: number;
}

/**
 * Custom React hook handling global right-click context menu events outside the main canvas area.
 * Attaches window event listeners for `contextmenu` and `click` to trigger or dismiss the default fallback context menu.
 *
 * @returns Object containing `defaultContextMenu` position state and `setDefaultContextMenu` state setter.
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
