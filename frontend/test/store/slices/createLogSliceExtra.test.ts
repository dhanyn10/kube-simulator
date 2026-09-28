import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogSlice } from '@/store/slices/createLogSlice';

describe('createLogSlice extra uncovered conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('removes legacy log storage key from localStorage during initialization', () => {
    localStorage.setItem('k8s_sim_logs', JSON.stringify([{ id: 'leg-1', level: 'info' }]));
    sessionStorage.setItem('k8s_sim_logs', JSON.stringify([{ id: 'sess-1', level: 'info' }]));

    const get = vi.fn();
    const set = vi.fn();
    const slice = createLogSlice(set, get, {} as any);

    expect(localStorage.getItem('k8s_sim_logs')).toBeNull();
    expect(slice.logs).toHaveLength(1);
    expect(slice.logs[0].id).toBe('sess-1');
  });

  it('executes globalThis.go.main.App.WriteLog during addLog when present', () => {
    const writeLogSpy = vi.fn().mockResolvedValue(true);
    (globalThis as any).go = {
      main: {
        App: {
          WriteLog: writeLogSpy,
        },
      },
    };

    const get = vi.fn().mockReturnValue({ logs: [] });
    const set = vi.fn();
    const slice = createLogSlice(set, get, {} as any);

    slice.addLog('warn', 'warning test', 'UI');

    expect(writeLogSpy).toHaveBeenCalledWith('UI', 'warn', 'warning test');

    delete (globalThis as any).go;
  });

  it('catches and logs storage errors when sessionStorage throws exception', () => {
    const originalConsoleError = vi.fn();
    (globalThis as any)._originalConsoleError = originalConsoleError;

    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage access denied');
    });

    const get = vi.fn().mockReturnValue({ logs: [] });
    const set = vi.fn();

    const slice = createLogSlice(set, get, {} as any);
    expect(originalConsoleError).toHaveBeenCalledWith(
      'Failed to load logs from storage:',
      expect.any(Error)
    );

    getItemSpy.mockRestore();

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    slice.addLog('info', 'test msg');
    expect(originalConsoleError).toHaveBeenCalledWith(
      'Failed to save logs to storage:',
      expect.any(Error)
    );

    setItemSpy.mockRestore();
    delete (globalThis as any)._originalConsoleError;
  });
});
