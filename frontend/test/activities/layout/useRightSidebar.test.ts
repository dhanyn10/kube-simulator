import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRightSidebar } from '@/activities/layout/useRightSidebar';
import { useFlowStore } from '@/store';

describe('useRightSidebar', () => {
  beforeEach(() => {
    useFlowStore.setState({
      colorMode: 'dark',
      isTerminalOpen: false,
      isRightSidebarVisible: true,
      isHistoryViewOpen: false,
      configuringNodeId: null,
      configuringEdgeId: null,
      nodes: [{ id: 'node-1', type: 'Pod', data: {} }],
      edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
      visibleWidgets: ['hardware-budget'],
    });
  });

  it('initializes tab as canvas and handles tab change', () => {
    const { result } = renderHook(() => useRightSidebar());

    expect(result.current.activeTab).toBe('canvas');
    expect(result.current.isElementSelected).toBe(false);

    act(() => {
      result.current.handleTabChange('history');
    });

    expect(result.current.activeTab).toBe('history');
    expect(useFlowStore.getState().isHistoryViewOpen).toBe(true);
  });

  it('switches tab to settings when an element is selected', () => {
    const { result, rerender } = renderHook(() => useRightSidebar());

    act(() => {
      useFlowStore.setState({ configuringNodeId: 'node-1' });
    });

    rerender();

    expect(result.current.isElementSelected).toBe(true);
    expect(result.current.selectedNode?.id).toBe('node-1');
    expect(result.current.activeTab).toBe('settings');
  });

  it('closes right sidebar and clears history view state', () => {
    useFlowStore.setState({ isHistoryViewOpen: true });
    const { result } = renderHook(() => useRightSidebar());

    act(() => {
      result.current.handleCloseSidebar();
    });

    expect(useFlowStore.getState().isRightSidebarVisible).toBe(false);
    expect(useFlowStore.getState().isHistoryViewOpen).toBe(false);
  });
});
