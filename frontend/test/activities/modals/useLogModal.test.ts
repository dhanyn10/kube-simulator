import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLogModal } from '@/activities/modals/useLogModal';
import { useFlowStore } from '@/store';
import { LogEntry } from '@/store/types';

describe('useLogModal', () => {
  const dummyLogs: LogEntry[] = [
    { id: '1', level: 'info', message: 'System boot', timestamp: 1000, scope: 'System' },
    { id: '2', level: 'error', message: 'Container crashed', timestamp: 2000, scope: 'Simulation' },
    { id: '3', level: 'warn', message: 'High CPU usage', timestamp: 3000, scope: 'KubeConsole' },
    { id: '4', level: 'fatal', message: 'Fatal OOM', timestamp: 4000 }, // missing scope defaults to System in filter
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      logs: dummyLogs,
      isLogModalOpen: true,
      colorMode: 'dark',
      deleteLogs: vi.fn(),
      clearLogs: vi.fn(),
      deleteLog: vi.fn(),
      setLogModalOpen: vi.fn(),
    });
  });

  it('initializes with reversed logs and handles level, scope, and search filtering', () => {
    const { result } = renderHook(() => useLogModal());

    expect(result.current.isOpen).toBe(true);
    expect(result.current.filteredLogs).toHaveLength(4);
    // Reverse order
    expect(result.current.filteredLogs[0].id).toBe('4');

    // Filter level: error (includes error and fatal)
    act(() => {
      result.current.setActiveLevelFilter('error');
    });
    expect(result.current.filteredLogs).toHaveLength(2);

    // Filter scope: System (includes l4 with missing scope fallback)
    act(() => {
      result.current.setActiveLevelFilter('all');
      result.current.setActiveScopeFilter('System');
    });
    expect(result.current.filteredLogs).toHaveLength(2);

    // Search query
    act(() => {
      result.current.setActiveScopeFilter('all');
      result.current.setSearchQuery('boot');
    });
    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].message).toBe('System boot');
  });

  it('handles row selection, expansion, selectByType, bulk delete, and export', () => {
    const deleteLogsSpy = vi.spyOn(useFlowStore.getState(), 'deleteLogs');
    const { result } = renderHook(() => useLogModal());

    // Toggle selection
    act(() => {
      result.current.toggleSelection('1');
    });
    expect(result.current.selectedIds.has('1')).toBe(true);

    act(() => {
      result.current.toggleSelection('1');
    });
    expect(result.current.selectedIds.has('1')).toBe(false);

    // Toggle expand
    act(() => {
      result.current.toggleExpand('2');
    });
    expect(result.current.expandedIds.has('2')).toBe(true);

    // Select by type: 'error'
    act(() => {
      result.current.selectByType('error');
    });
    expect(result.current.selectedIds.size).toBe(2);

    // Bulk delete
    act(() => {
      result.current.handleBulkDelete();
    });
    expect(deleteLogsSpy).toHaveBeenCalled();
    expect(result.current.selectedIds.size).toBe(0);

    // Select all / deselect all
    act(() => {
      result.current.handleSelectAll();
    });
    expect(result.current.selectedIds.size).toBe(4);

    act(() => {
      result.current.handleSelectAll();
    });
    expect(result.current.selectedIds.size).toBe(0);

    // Select by type: 'none'
    act(() => {
      result.current.selectByType('none');
    });
    expect(result.current.selectedIds.size).toBe(0);
  });
});
