import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore } from 'zustand';
import { createLogSlice } from '../../../src/store/slices/createLogSlice';
import { webcrypto } from 'node:crypto';

// Mock crypto.randomUUID using node:crypto for better safety/randomness in tests
if (!globalThis.crypto) {
    (globalThis as any).crypto = webcrypto;
}

describe('createLogSlice', () => {
  let store: any;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();

    // Create a fresh store for each test
    store = createStore<any>()((...a) => ({
      ...createLogSlice(...a),
    }));
  });

  it('should initialize with empty logs if nothing in storage', () => {
    expect(store.getState().logs).toEqual([]);
    expect(store.getState().isLogToastVisible).toBe(false);
  });

  it('should add a log and show toast', () => {
    store.getState().addLog('error', 'Test error message');

    const state = store.getState();
    expect(state.logs).toHaveLength(1);
    expect(state.logs[0].level).toBe('error');
    expect(state.logs[0].message).toBe('Test error message');
    expect(state.isLogToastVisible).toBe(true);
  });

  it('should persist logs to sessionStorage', () => {
    store.getState().addLog('warn', 'Persistence test');

    const stored = JSON.parse(sessionStorage.getItem('k8s_sim_logs') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].message).toBe('Persistence test');
  });

  it('should respect MAX_LOGS limit', () => {
    // Add 505 logs (MAX_LOGS is 500)
    for (let i = 0; i < 505; i++) {
      store.getState().addLog('error', `Error ${i}`);
    }

    expect(store.getState().logs).toHaveLength(500);
    // Should contain the LAST 500 logs
    expect(store.getState().logs[0].message).toBe('Error 5');
    expect(store.getState().logs[499].message).toBe('Error 504');
  });

  it('should delete a single log', () => {
    store.getState().addLog('info', 'Log to delete');
    const id = store.getState().logs[0].id;
    store.getState().deleteLog(id);
    expect(store.getState().logs).toHaveLength(0);
  });

  it('should delete multiple logs', () => {
    store.getState().addLog('info', 'L1');
    store.getState().addLog('error', 'L2');
    store.getState().addLog('warn', 'L3');

    const ids = [store.getState().logs[0].id, store.getState().logs[2].id];
    store.getState().deleteLogs(ids);

    expect(store.getState().logs).toHaveLength(1);
    expect(store.getState().logs[0].message).toBe('L2');
  });

  it('should clear logs', () => {
    store.getState().addLog('error', 'To be cleared');
    store.getState().clearLogs();

    expect(store.getState().logs).toEqual([]);
    expect(store.getState().isLogToastVisible).toBe(false);
    expect(sessionStorage.getItem('k8s_sim_logs')).toBe('[]');
  });

  it('should set toast visibility', () => {
    store.getState().setLogToastVisible(true);
    expect(store.getState().isLogToastVisible).toBe(true);
    store.getState().setLogToastVisible(false);
    expect(store.getState().isLogToastVisible).toBe(false);
  });

  it('should set modal open state', () => {
    store.getState().setLogModalOpen(true);
    expect(store.getState().isLogModalOpen).toBe(true);
    store.getState().setLogModalOpen(false);
    expect(store.getState().isLogModalOpen).toBe(false);
  });

  it('should store explicitly passed scope', () => {
    store.getState().addLog('info', 'Deployment updated', 'Simulation');
    const log = store.getState().logs[0];
    expect(log.scope).toBe('Simulation');
    expect(log.message).toBe('Deployment updated');
  });

  it('should fallback scope to System when not provided', () => {
    store.getState().addLog('info', 'System initialization completed');
    const log = store.getState().logs[0];
    expect(log.scope).toBe('System');
    expect(log.message).toBe('System initialization completed');
  });

  it('should set isLogToastVisible based on stored log levels and handle non-important logs', () => {
    sessionStorage.setItem('k8s_sim_logs', JSON.stringify([
      { id: '1', level: 'warn', message: 'Warning log', timestamp: Date.now(), scope: 'System' }
    ]));

    const warnStore = createStore<any>()((...a) => ({
      ...createLogSlice(...a),
    }));

    expect(warnStore.getState().isLogToastVisible).toBe(true);

    sessionStorage.setItem('k8s_sim_logs', JSON.stringify([
      { id: '2', level: 'info', message: 'Info log', timestamp: Date.now(), scope: 'System' }
    ]));

    const infoStore = createStore<any>()((...a) => ({
      ...createLogSlice(...a),
    }));

    expect(infoStore.getState().isLogToastVisible).toBe(false);

    // Adding non-important log does not show toast
    infoStore.getState().addLog('info', 'Another info message');
    expect(infoStore.getState().isLogToastVisible).toBe(false);
  });

  it('should migrate legacy localStorage logs and invoke Wails WriteLog if available', async () => {
    localStorage.setItem('k8s_sim_logs', JSON.stringify([{ id: 'legacy-1', message: 'legacy' }]));
    sessionStorage.setItem('k8s_sim_logs', JSON.stringify([{ id: 'stored-1', message: 'stored' }]));

    const mockWriteLog = vi.fn().mockRejectedValue(new Error('Wails offline'));
    (globalThis as any).go = {
      main: {
        App: {
          WriteLog: mockWriteLog,
        },
      },
    };

    const newStore = createStore<any>()((...a) => ({
      ...createLogSlice(...a),
    }));

    expect(localStorage.getItem('k8s_sim_logs')).toBeNull();
    expect(newStore.getState().logs).toHaveLength(1);

    newStore.getState().addLog('info', 'Test Wails Log', 'KubeConsole');
    expect(mockWriteLog).toHaveBeenCalledWith('KubeConsole', 'info', 'Test Wails Log');

    delete (globalThis as any).go;
  });

  it('should handle storage errors gracefully', () => {
    const originalGetItem = sessionStorage.getItem;
    const originalConsoleError = (globalThis as any)._originalConsoleError;
    (globalThis as any)._originalConsoleError = vi.fn();

    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });

    const newStore = createStore<any>()((...a) => ({
      ...createLogSlice(...a),
    }));

    expect(newStore.getState().logs).toEqual([]);

    sessionStorage.getItem = originalGetItem;
    delete (globalThis as any)._originalConsoleError;
  });

  it('should handle setItem error in sessionStorage gracefully', () => {
    const testStore = createStore<any>()((...a) => ({
      ...createLogSlice(...a),
    }));

    const spy = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => {
      testStore.getState().addLog('error', 'Trigger save error');
    }).not.toThrow();

    expect(testStore.getState().logs).toHaveLength(1);
    spy.mockRestore();
  });
});
