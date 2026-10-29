import { useEffect, RefObject } from 'react';

/**
 * Custom hook to trigger a callback when a mousedown event occurs outside the referenced element.
 */
export function useOutsideMouseDown(
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

    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, [ref, active, onOutsideClick]);
}
