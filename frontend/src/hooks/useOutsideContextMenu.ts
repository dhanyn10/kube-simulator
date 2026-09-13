import { useEffect, RefObject } from 'react';

/**
 * Custom hook to handle outside click & context menu events for popups/menus.
 *
 * @param ref target element ref
 * @param active whether listener should be active
 * @param onOutsideClick callback to trigger when click occurs outside
 */
export function useOutsideContextMenu(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutsideClick: () => void
) {
  useEffect(() => {
    if (!active) return;

    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutsideClick();
      }
    };

    globalThis.addEventListener('click', handler);
    globalThis.addEventListener('contextmenu', handler, true);

    return () => {
      globalThis.removeEventListener('click', handler);
      globalThis.removeEventListener('contextmenu', handler, true);
    };
  }, [ref, active, onOutsideClick]);
}
