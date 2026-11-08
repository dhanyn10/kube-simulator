import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecentFilesState } from '@/activities/layout/useRecentFilesState';
import * as fileBackstageHelpers from '@/activities/layout/fileBackstageHelpers';

describe('useRecentFilesState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads recent files when isOpen is true', async () => {
    const mockFiles: any[] = [
      { id: '1', name: 'proj1.infra', path: '/path/1', type: 'project' },
      { id: '2', name: 'autosave.infra', path: '/path/2', type: 'autosave' },
    ];
    vi.spyOn(fileBackstageHelpers, 'fetchRecentFiles').mockResolvedValue(mockFiles);

    const { result } = renderHook(() => useRecentFilesState(true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.recentFiles).toEqual(mockFiles);
  });

  it('sets isLoading to false immediately when isOpen is false without fetching', () => {
    const fetchSpy = vi.spyOn(fileBackstageHelpers, 'fetchRecentFiles');

    const { result } = renderHook(() => useRecentFilesState(false));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.recentFiles).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handles row context menu open and close events', () => {
    const { result } = renderHook(() => useRecentFilesState(false));

    const item: any = { id: 'file-1', name: 'test.infra', path: '/test.infra', type: 'project' };
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const mockEvent = {
      preventDefault,
      stopPropagation,
      clientX: 150,
      clientY: 250,
    } as any;

    act(() => {
      result.current.handleRowContextMenu(mockEvent, item);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({
      x: 150,
      y: 250,
      item,
    });

    // Close context menu
    act(() => {
      result.current.setContextMenu(null);
    });
    expect(result.current.contextMenu).toBeNull();
  });

  it('allows manual reload via loadRecentFiles', async () => {
    const initialFiles: any[] = [{ id: '1', name: 'initial.infra', path: '/1', type: 'project' }];
    const updatedFiles: any[] = [{ id: '2', name: 'updated.infra', path: '/2', type: 'project' }];

    const fetchSpy = vi.spyOn(fileBackstageHelpers, 'fetchRecentFiles')
      .mockResolvedValueOnce(initialFiles)
      .mockResolvedValueOnce(updatedFiles);

    const { result } = renderHook(() => useRecentFilesState(true));

    await waitFor(() => {
      expect(result.current.recentFiles).toEqual(initialFiles);
    });

    act(() => {
      void result.current.loadRecentFiles();
    });

    await waitFor(() => {
      expect(result.current.recentFiles).toEqual(updatedFiles);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
