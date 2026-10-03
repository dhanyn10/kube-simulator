import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogSlice } from '@/store/slices/createLogSlice';

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

  it('catches and logs storage errors when sessionStorage throws exception during read or write', () => {
    const originalConsoleError = vi.fn();
    (globalThis as any)._originalConsoleError = originalConsoleError;

    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage access denied');
    });

    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    storeState = { ...storeState, ...slice };

    expect(originalConsoleError).toHaveBeenCalledWith(
      'Failed to load logs from storage:',
      expect.any(Error)
    );

    getItemSpy.mockRestore();

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    storeState.addLog('info', 'test msg');
    expect(originalConsoleError).toHaveBeenCalledWith(
      'Failed to save logs to storage:',
      expect.any(Error)
    );

    setItemSpy.mockRestore();
    delete (globalThis as any)._originalConsoleError;
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

  it('handles Wails WriteLog IPC rejection gracefully', () => {
    (globalThis as any).go = {
      main: {
        App: {
          WriteLog: vi.fn().mockRejectedValue(new Error('IPC Write error')),
        },
      },
    };

    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    storeState = { ...storeState, ...slice };

    slice.addLog('info', 'Info log with failing IPC', 'UI');
    expect(storeState.logs).toHaveLength(1);
    delete (globalThis as any).go;
  });

  it('setLogToastVisible and setLogModalOpen update UI state', () => {
    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    storeState = { ...storeState, ...slice };

    storeState.setLogToastVisible(true);
    expect(storeState.isLogToastVisible).toBe(true);

    storeState.setLogModalOpen(true);
    expect(storeState.isLogModalOpen).toBe(true);
  });

  it('addLog sets isLogToastVisible for warn and fatal log levels', () => {
    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    storeState = { ...storeState, ...slice, isLogToastVisible: false };

    storeState.addLog('warn', 'Warning log message');
    expect(storeState.isLogToastVisible).toBe(true);

    storeState.isLogToastVisible = false;
    storeState.addLog('fatal', 'Fatal log message');
    expect(storeState.isLogToastVisible).toBe(true);
  });

  it('internalError handles missing _originalConsoleError gracefully', () => {
    delete (globalThis as any)._originalConsoleError;
    sessionStorage.setItem('k8s_sim_logs', 'invalid json format');

    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    expect(slice.logs).toEqual([]);
  });

  it('covers initial isLogToastVisible state based on stored log levels and non-important addLog level', () => {
    // 1. Initial logs with error/warn/fatal set isLogToastVisible to true
    sessionStorage.setItem('k8s_sim_logs', JSON.stringify([{ id: '1', level: 'fatal', message: 'Fatal' }]));
    const sliceWithFatal = createLogSlice(setStore as any, getStore as any, {} as any);
    expect(sliceWithFatal.isLogToastVisible).toBe(true);

    // 2. Initial logs with info level set isLogToastVisible to false
    sessionStorage.setItem('k8s_sim_logs', JSON.stringify([{ id: '2', level: 'info', message: 'Info' }]));
    const sliceWithInfo = createLogSlice(setStore as any, getStore as any, {} as any);
    expect(sliceWithInfo.isLogToastVisible).toBe(false);

    // 3. addLog with non-important level ('info') does not alter isLogToastVisible when false
    storeState = { logs: [], isLogToastVisible: false };
    const slice = createLogSlice(setStore as any, getStore as any, {} as any);
    slice.addLog('info', 'non-important info');
    expect(storeState.isLogToastVisible).toBe(false);
  });
});
