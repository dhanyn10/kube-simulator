import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore } from 'zustand';
import { createLogSlice } from '../../../src/store/slices/createLogSlice';
import { FlowState } from '../../../src/store/types';

// Mock crypto.randomUUID
if (!globalThis.crypto) {
    (globalThis as any).crypto = {
        randomUUID: () => Math.random().toString(36).substring(2)
    };
}

describe('createLogSlice', () => {
  let store: any;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // Create a fresh store for each test
    store = createStore<FlowState>()((...a) => ({
      ...createLogSlice(...a),
    } as any));
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
    // Add 205 logs
    for (let i = 0; i < 205; i++) {
      store.getState().addLog('error', `Error ${i}`);
    }

    expect(store.getState().logs.length).toBe(200);
    // Should contain the LAST 200 logs
    expect(store.getState().logs[0].message).toBe('Error 5');
    expect(store.getState().logs[199].message).toBe('Error 204');
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
