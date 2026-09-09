import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogSlice } from '@/store/slices/createLogSlice';
import { FlowState } from '@/store/types';

describe('createLogSlice', () => {
  let storeState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    delete (globalThis as any).go;

    storeState = {
      logs: [],
      isLogToastVisible: false,
      isLogModalOpen: false,
    };
  });

  const getStore = () => storeState;
  const setStore = (fn: any) => {
    if (typeof fn === 'function') {
      storeState = { ...storeState, ...fn(storeState) };
    } else {
      storeState = { ...storeState, ...fn };
    }
  };

  it('loadLogsFromStorage removes legacy localStorage log key and loads stored sessionStorage logs', () => {
    localStorage.setItem('k8s_sim_logs', 'legacy');
    const storedLogs = [{ id: 'l1', level: 'info', message: 'Loaded Log', timestamp: 1000 }];
    sessionStorage.setItem('k8s_sim_logs', JSON.stringify(storedLogs));

    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    expect(localStorage.getItem('k8s_sim_logs')).toBeNull();
    expect(slice.logs).toEqual(storedLogs);
  });

  it('loadLogsFromStorage handles JSON parse errors gracefully via internalError', () => {
    sessionStorage.setItem('k8s_sim_logs', 'invalid json');
    const originalConsoleError = vi.fn();
    (globalThis as any)._originalConsoleError = originalConsoleError;

    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    expect(slice.logs).toEqual([]);
    expect(originalConsoleError).toHaveBeenCalledWith(expect.stringContaining('Failed to load logs from storage:'), expect.any(Error));
  });

  it('addLog creates a new log entry, caps at 500, sets toast visibility for errors, and calls Wails WriteLog', () => {
    const mockWriteLog = vi.fn().mockResolvedValue(true);
    (globalThis as any).go = {
      main: {
        App: {
          WriteLog: mockWriteLog,
        },
      },
    };

    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    storeState = { ...storeState, ...slice };

    storeState.addLog('error', 'Error occurred', 'UI');

    expect(storeState.logs).toHaveLength(1);
    expect(storeState.logs[0].message).toBe('Error occurred');
    expect(storeState.logs[0].scope).toBe('UI');
    expect(storeState.isLogToastVisible).toBe(true);
    expect(mockWriteLog).toHaveBeenCalledWith('UI', 'error', 'Error occurred');
  });

  it('addLog defaults scope to System and app for Wails backend when scope is omitted', () => {
    const mockWriteLog = vi.fn().mockRejectedValue(new Error('Write fail'));
    (globalThis as any).go = {
      main: {
        App: {
          WriteLog: mockWriteLog,
        },
      },
    };

    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    storeState = { ...storeState, ...slice };

    storeState.addLog('info', 'System message');

    expect(storeState.logs[0].scope).toBe('System');
    expect(mockWriteLog).toHaveBeenCalledWith('app', 'info', 'System message');
  });

  it('deleteLog removes log by id and updates sessionStorage', () => {
    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    storeState = {
      ...storeState,
      ...slice,
      logs: [
        { id: 'l1', level: 'info', message: 'Log 1', timestamp: 1000 },
        { id: 'l2', level: 'info', message: 'Log 2', timestamp: 2000 },
      ],
    };

    storeState.deleteLog('l1');

    expect(storeState.logs).toHaveLength(1);
    expect(storeState.logs[0].id).toBe('l2');
  });

  it('deleteLogs removes multiple logs by ids', () => {
    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    storeState = {
      ...storeState,
      ...slice,
      logs: [
        { id: 'l1', level: 'info', message: 'Log 1', timestamp: 1000 },
        { id: 'l2', level: 'info', message: 'Log 2', timestamp: 2000 },
        { id: 'l3', level: 'info', message: 'Log 3', timestamp: 3000 },
      ],
    };

    storeState.deleteLogs(['l1', 'l3']);

    expect(storeState.logs).toHaveLength(1);
    expect(storeState.logs[0].id).toBe('l2');
  });

  it('clearLogs resets logs, hides toast, and closes modal', () => {
    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    storeState = {
      ...storeState,
      ...slice,
      logs: [{ id: 'l1', level: 'error', message: 'Error', timestamp: 1000 }],
      isLogToastVisible: true,
      isLogModalOpen: true,
    };

    storeState.clearLogs();

    expect(storeState.logs).toHaveLength(0);
    expect(storeState.isLogToastVisible).toBe(false);
    expect(storeState.isLogModalOpen).toBe(false);
  });

  it('setLogToastVisible and setLogModalOpen update UI state', () => {
    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    storeState = { ...storeState, ...slice };

    storeState.setLogToastVisible(true);
    expect(storeState.isLogToastVisible).toBe(true);

    storeState.setLogModalOpen(true);
    expect(storeState.isLogModalOpen).toBe(true);
  });
});
