import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  const options = {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onCopy: vi.fn(),
    onPaste: vi.fn(),
    onGroup: vi.fn(),
    onUngroup: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset active element
    (document.activeElement as any)?.blur();
  });

  const fireKey = (key: string, ctrl: boolean = true, shift: boolean = false) => {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: ctrl,
      shiftKey: shift,
      bubbles: true,
      cancelable: true
    });
    globalThis.dispatchEvent(event);
    return event;
  };

  it('triggers copy on Ctrl+C', () => {
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('c');
    expect(options.onCopy).toHaveBeenCalled();
  });

  it('triggers paste on Ctrl+V', () => {
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('v');
    expect(options.onPaste).toHaveBeenCalled();
  });

  it('triggers undo on Ctrl+Z', () => {
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('z');
    expect(options.onUndo).toHaveBeenCalled();
  });

  it('triggers redo on Ctrl+Shift+Z', () => {
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('z', true, true);
    expect(options.onRedo).toHaveBeenCalled();
  });

  it('triggers redo on Ctrl+Y', () => {
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('y');
    expect(options.onRedo).toHaveBeenCalled();
  });

  it('triggers group on Ctrl+G', () => {
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('g');
    expect(options.onGroup).toHaveBeenCalled();
  });

  it('triggers ungroup on Ctrl+U', () => {
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('u');
    expect(options.onUngroup).toHaveBeenCalled();
  });

  it('ignores shortcuts when input is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useKeyboardShortcuts(options));
    fireKey('c');

    expect(options.onCopy).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
