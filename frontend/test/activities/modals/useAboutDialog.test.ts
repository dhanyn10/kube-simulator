import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAboutDialog } from '@/activities/modals/useAboutDialog';
import { useFlowStore } from '@/store';

describe('useAboutDialog', () => {
  beforeEach(() => {
    useFlowStore.setState({
      colorMode: 'dark',
      simulatedUpdateInfo: null,
      simulatedCurrentVersion: null,
    });
  });

  it('fetches details on open and handles clipboard copy', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    const { result } = renderHook(() => useAboutDialog({ isOpen: true }));

    expect(result.current.colorMode).toBe('dark');
    expect(result.current.appName).toBe('Kube Simulator');

    await act(async () => {
      await result.current.handleCopy();
    });

    expect(mockWriteText).toHaveBeenCalled();
    expect(result.current.copied).toBe(true);
  });

  it('uses simulated current version when provided in store', () => {
    useFlowStore.setState({
      simulatedCurrentVersion: '3.1.4',
    });

    const { result } = renderHook(() => useAboutDialog({ isOpen: false }));
    expect(result.current.displayVersion).toBe('3.1.4');
  });
});
