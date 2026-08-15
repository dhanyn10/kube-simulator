import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
}

const handleUndoRedo = (event: KeyboardEvent, key: string, onUndo: () => void, onRedo: () => void) => {
  if (key === 'z') {
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) onRedo();
    else onUndo();
    return true;
  }
  if (key === 'y') {
    event.preventDefault();
    event.stopPropagation();
    onRedo();
    return true;
  }
  return false;
};

const handleGroupShortcut = (event: KeyboardEvent, key: string, onGroup?: () => void, onUngroup?: () => void) => {
  if (key === 'g') {
    event.preventDefault();
    onGroup?.();
    return true;
  }
  if (key === 'u') {
    event.preventDefault();
    onUngroup?.();
    return true;
  }
  return false;
};

const dispatchShortcutKey = (event: KeyboardEvent, options: UseKeyboardShortcutsOptions) => {
  const key = event.key.toLowerCase();
  if (key === 'c') {
    options.onCopy();
    return;
  }
  if (key === 'v') {
    options.onPaste();
    return;
  }
  if (handleGroupShortcut(event, key, options.onGroup, options.onUngroup)) return;
  handleUndoRedo(event, key, options.onUndo, options.onRedo);
};

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isControl = event.ctrlKey || event.metaKey;
      const isInputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');

      if (!isControl || isInputFocused) return;
      dispatchShortcutKey(event, options);
    };

    globalThis.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => globalThis.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [options]);
}
