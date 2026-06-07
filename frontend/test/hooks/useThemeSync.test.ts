import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useThemeSync } from '../../src/hooks/useThemeSync';
import { useFlowStore } from '../../src/store';

describe('useThemeSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('dark', 'light');
  });

  it('syncs dark mode to document element', () => {
    useFlowStore.setState({ colorMode: 'dark' });
    renderHook(() => useThemeSync());

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('syncs light mode to document element', () => {
    useFlowStore.setState({ colorMode: 'light' });
    renderHook(() => useThemeSync());

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
