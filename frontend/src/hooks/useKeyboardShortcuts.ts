import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
}

export function useKeyboardShortcuts({ onUndo, onRedo, onCopy, onPaste }: UseKeyboardShortcutsOptions) {
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

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [onUndo, onRedo, onCopy, onPaste]);
}
