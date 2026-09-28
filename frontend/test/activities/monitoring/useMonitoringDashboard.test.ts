import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMonitoringDashboardHandler } from '@/activities/monitoring/useMonitoringDashboard';
import { useFlowStore } from '@/store';

describe('useMonitoringDashboardHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      isMonitoringOpen: true,
      isMonitoringDetached: false,
      simulationMetrics: {} as any,
      nodes: [
        { id: 'dep1', type: 'Deployment', data: {} } as any,
        { id: 'rs1', type: 'ReplicaSet', data: {} } as any,
        { id: 'pod1', type: 'Pod', parentId: undefined, data: {} } as any,
        { id: 'podChild', type: 'Pod', parentId: 'dep1', data: {} } as any,
        { id: 'svc1', type: 'Service', data: {} } as any,
      ],
      colorMode: 'dark',
    });
  });

  it('filters workload nodes and handles mouse drag events', () => {
    const { result } = renderHook(() => useMonitoringDashboardHandler());

    expect(result.current.workloads).toHaveLength(3);

    // Initial position is { x: 400, y: 100 }
    expect(result.current.position).toEqual({ x: 400, y: 100 });

    // Trigger mouse down
    act(() => {
      result.current.handleMouseDown({ clientX: 450, clientY: 150 } as any);
    });

    // Dispatch mousemove on document
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 200 }));
    });

    // Position updated
    expect(result.current.position).toEqual({ x: 450, y: 150 });

    // Mouse up stops dragging
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'));
    });

    // Subsequent mousemove should not update position
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600, clientY: 300 }));
    });

    expect(result.current.position).toEqual({ x: 450, y: 150 });
  });

  it('handles window detach opening new popup window', () => {
    const openSpy = vi.spyOn(globalThis, 'open').mockImplementation(() => null);

    const { result } = renderHook(() => useMonitoringDashboardHandler());

    act(() => {
      result.current.handleDetach();
    });

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('mode=monitoring'),
      '_blank',
      expect.stringContaining('width=800,height=600')
    );
  });
});
