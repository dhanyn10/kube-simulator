import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThemeSync } from '@/hooks/useThemeSync';
import { useFlowStore } from '@/store';
import { getBackendGateway, setBackendGateway, resetBackendGateway, MockBackendGateway } from '@/gateway';

describe('useThemeSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setBackendGateway(new MockBackendGateway());
    document.documentElement.classList.remove('dark', 'light');
    document.body.classList.remove('dark', 'light');
  });

  afterEach(() => {
    resetBackendGateway();
  });

  it('syncs dark mode to document element and body', () => {
    useFlowStore.setState({ colorMode: 'dark' });
    renderHook(() => useThemeSync());

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.body.classList.contains('dark')).toBe(true);
    expect(document.body.classList.contains('light')).toBe(false);
  });

  it('syncs light mode to document element and body', () => {
    useFlowStore.setState({ colorMode: 'light' });
    renderHook(() => useThemeSync());

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.body.classList.contains('light')).toBe(true);
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('syncs theme when THEME_SYNC message arrives from BroadcastChannel', async () => {
    useFlowStore.setState({ colorMode: 'dark' });
    renderHook(() => useThemeSync());

    const channel = new BroadcastChannel('monitoring-data');
    await act(async () => {
      channel.postMessage({ type: 'THEME_SYNC', colorMode: 'light' });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(useFlowStore.getState().colorMode).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    channel.close();
  });

  it('syncs theme when theme-sync event is received from backend gateway', async () => {
    useFlowStore.setState({ colorMode: 'light' });
    renderHook(() => useThemeSync());

    await act(async () => {
      getBackendGateway().emitEvent('theme-sync', 'dark');
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(useFlowStore.getState().colorMode).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
