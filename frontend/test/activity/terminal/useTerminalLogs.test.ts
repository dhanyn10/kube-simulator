import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTerminalLogs, getTabClass } from '../../../src/activity/terminal/useTerminalLogs';

describe('useTerminalLogs extra branch conditions', () => {
  it('covers getTabClass light mode non-active tab styling branch', () => {
    const activeClass = getTabClass('activity', 'activity', 'light');
    expect(activeClass).toContain('text-slate-900');

    const inactiveLight = getTabClass('logs', 'activity', 'light');
    expect(inactiveLight).toContain('text-slate-400 hover:text-slate-600');
  });

  it('handles activeLogs fallback when selected resource id is not present in terminalLogs', () => {
    const { result } = renderHook(() =>
      useTerminalLogs({
        terminalActiveTab: 'logs',
        terminalSelectedResourceId: 'res-unknown',
        setTerminalSelectedResourceId: vi.fn(),
        nodes: [{ id: 'res-1', type: 'Pod', data: {} } as any],
        activityLogs: ['activity line 1'],
        terminalLogs: {},
        searchQuery: '',
        pageSize: 10,
      })
    );

    expect(result.current.activeLogs).toEqual([]);
    expect(result.current.filteredLogs).toEqual([]);
  });

  it('handles activeLogs fallback when terminalActiveTab is logs but terminalSelectedResourceId is null', () => {
    const { result } = renderHook(() =>
      useTerminalLogs({
        terminalActiveTab: 'logs',
        terminalSelectedResourceId: null,
        setTerminalSelectedResourceId: vi.fn(),
        nodes: [],
        activityLogs: ['act 1'],
        terminalLogs: {},
        searchQuery: '',
        pageSize: 10,
      })
    );

    expect(result.current.activeLogs).toEqual([]);
  });
});
