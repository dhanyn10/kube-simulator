import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore } from 'zustand';
import { createLogSlice } from '../../../src/store/slices/createLogSlice';
import { FlowState } from '../../../src/store/types';
import { webcrypto } from 'node:crypto';

// Mock crypto.randomUUID using node:crypto for better safety/randomness in tests
if (!globalThis.crypto) {
    (globalThis as any).crypto = webcrypto;
}

describe('createLogSlice', () => {
  let store: any;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // Create a fresh store for each test
    store = createStore<FlowState>()((...a) => ({
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
    expect(state.logs.length).toBe(1);
    expect(state.logs[0].level).toBe('error');
    expect(state.logs[0].message).toBe('Test error message');
    expect(state.isLogToastVisible).toBe(true);
  });

  it('should persist logs to localStorage', () => {
    store.getState().addLog('warn', 'Persistence test');

    const stored = JSON.parse(localStorage.getItem('k8s_sim_logs') || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].message).toBe('Persistence test');
  });

  it('should respect MAX_LOGS limit', () => {
    // Add 505 logs (MAX_LOGS is now 500)
    for (let i = 0; i < 505; i++) {
      store.getState().addLog('error', `Error ${i}`);
    }

    expect(store.getState().logs.length).toBe(500);
    // Should contain the LAST 500 logs
    expect(store.getState().logs[0].message).toBe('Error 5');
    expect(store.getState().logs[499].message).toBe('Error 504');
  });

  it('should clear logs', () => {
    store.getState().addLog('error', 'To be cleared');
    store.getState().clearLogs();

    expect(store.getState().logs).toEqual([]);
    expect(store.getState().isLogToastVisible).toBe(false);
    expect(localStorage.getItem('k8s_sim_logs')).toBe('[]');
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
});
