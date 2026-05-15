import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
}

export function useKeyboardShortcuts({ onUndo, onRedo, onCopy, onPaste, onGroup, onUngroup }: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isControl = event.ctrlKey || event.metaKey;
      const isInputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');

      if (!isControl || isInputFocused) return;

      const key = event.key.toLowerCase();

      if (key === 'c') {
        onCopy();
      } else if (key === 'v') {
        onPaste();
      } else if (key === 'g') {
        event.preventDefault();
        onGroup?.();
      } else if (key === 'u') {
        event.preventDefault();
        onUngroup?.();
      } else if (key === 'z') {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) onRedo();
        else onUndo();
      } else if (key === 'y') {
        event.preventDefault();
        event.stopPropagation();
        onRedo();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => globalThis.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [onUndo, onRedo, onCopy, onPaste, onGroup, onUngroup]);
}
