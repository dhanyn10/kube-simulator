import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlowStore } from '@/store';
import {
  formatColorName,
  useEdgeConfigHandler,
  DEFAULT_RUNNING_COLOR,
  DEFAULT_ERROR_COLOR,
} from '@/activities/config/useEdgeConfig';

describe('useEdgeConfig', () => {
  beforeEach(() => {
    useFlowStore.setState({
      edges: [
        { id: 'edge-1', source: 'a', target: 'b', data: { width: 4 } },
        { id: 'edge-2', source: 'c', target: 'd', data: {} },
      ],
      globalEdgeColor: '#3b82f6',
      globalEdgeErrorColor: '#ef4444',
    });
  });

  it('formatColorName removes CSS variable prefix and suffix', () => {
    expect(formatColorName('var(--color-mat-indigo)')).toBe('indigo');
    expect(formatColorName('#3b82f6')).toBe('#3b82f6');
  });

  it('initializes edgeWidth and global colors with custom and fallback edge data', () => {
    const { result: r1 } = renderHook(() =>
      useEdgeConfigHandler({ id: 'edge-1', data: { width: 4 } })
    );
    expect(r1.current.edgeWidth).toBe(4);
    expect(r1.current.globalEdgeColor).toBe('#3b82f6');
    expect(r1.current.globalEdgeErrorColor).toBe('#ef4444');

    // Selected edge with no data object provided
    const { result: r2 } = renderHook(() =>
      useEdgeConfigHandler({ id: 'edge-2' })
    );
    expect(r2.current.edgeWidth).toBe(2);
  });

  it('updateEdgeData updates selected edge data in store while leaving other edges intact', () => {
    const { result } = renderHook(() =>
      useEdgeConfigHandler({ id: 'edge-1', data: { width: 4 } })
    );

    act(() => {
      result.current.updateEdgeData({ animated: true, width: 6 });
    });

    const storeEdges = useFlowStore.getState().edges;
    expect(storeEdges[0].data).toEqual({ width: 6, animated: true });
    expect(storeEdges[1].data).toEqual({});
  });

  it('handles running and error color changes, including collision swap when colors match', () => {
    const { result } = renderHook(() =>
      useEdgeConfigHandler({ id: 'edge-1', data: {} })
    );

    // 1. Change running color to a new distinct color
    act(() => {
      result.current.handleRunningColorChange('#10b981');
    });
    expect(useFlowStore.getState().globalEdgeColor).toBe('#10b981');
    expect(useFlowStore.getState().globalEdgeErrorColor).toBe('#ef4444');

    // 2. Change running color to match active globalEdgeErrorColor (#ef4444) -> swaps colors
    act(() => {
      result.current.handleRunningColorChange('#EF4444');
    });
    expect(useFlowStore.getState().globalEdgeColor).toBe('#EF4444');
    expect(useFlowStore.getState().globalEdgeErrorColor).toBe('#10b981');

    // 3. Change error color to a new distinct color
    act(() => {
      result.current.handleErrorColorChange('#f59e0b');
    });
    expect(useFlowStore.getState().globalEdgeColor).toBe('#EF4444');
    expect(useFlowStore.getState().globalEdgeErrorColor).toBe('#f59e0b');

    // 4. Change error color to match active globalEdgeColor (#EF4444) -> swaps colors
    act(() => {
      result.current.handleErrorColorChange('#ef4444');
    });
    expect(useFlowStore.getState().globalEdgeColor).toBe('#f59e0b');
    expect(useFlowStore.getState().globalEdgeErrorColor).toBe('#ef4444');

    // 5. Reset running and error colors to defaults
    act(() => {
      result.current.resetRunningColor();
    });
    expect(useFlowStore.getState().globalEdgeColor).toBe(DEFAULT_RUNNING_COLOR);

    act(() => {
      result.current.resetErrorColor();
    });
    expect(useFlowStore.getState().globalEdgeErrorColor).toBe(DEFAULT_ERROR_COLOR);
  });
});
