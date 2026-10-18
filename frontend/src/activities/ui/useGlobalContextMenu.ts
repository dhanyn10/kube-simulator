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

    globalThis.addEventListener('contextmenu', handleGlobalContextMenu);
    globalThis.addEventListener('contextmenu', handleClose, true);
    globalThis.addEventListener('click', handleClose);
    return () => {
      globalThis.removeEventListener('contextmenu', handleGlobalContextMenu);
      globalThis.removeEventListener('contextmenu', handleClose, true);
      globalThis.removeEventListener('click', handleClose);
    };
  }, []);

  return {
    defaultContextMenu,
    setDefaultContextMenu,
  };
};
