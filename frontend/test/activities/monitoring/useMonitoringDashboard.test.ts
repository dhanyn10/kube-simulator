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

  it('handles BroadcastChannel messages and Wails runtime event listeners', () => {
    let onMessageCallback: ((event: any) => void) | null = null;
    class MockBroadcastChannel {
      set onmessage(cb: any) {
        onMessageCallback = cb;
      }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

    const runtimeEvents: Record<string, Function> = {};
    (globalThis as any).runtime = {
      EventsOn: (eventName: string, cb: Function) => {
        runtimeEvents[eventName] = cb;
      },
    };

    renderHook(() => useMonitoringDashboardHandler());

    // Trigger BroadcastChannel DETACHED_OPEN
    act(() => {
      onMessageCallback?.({ data: { type: 'DETACHED_OPEN' } });
    });
    expect(useFlowStore.getState().isMonitoringDetached).toBe(true);

    // Trigger BroadcastChannel DETACHED_CLOSED
    act(() => {
      onMessageCallback?.({ data: { type: 'DETACHED_CLOSED' } });
    });
    expect(useFlowStore.getState().isMonitoringDetached).toBe(false);

    // Trigger BroadcastChannel with unhandled message type
    act(() => {
      onMessageCallback?.({ data: { type: 'OTHER_EVENT' } });
    });

    // Trigger runtime event handlers
    act(() => {
      runtimeEvents['detached-open']?.();
    });
    expect(useFlowStore.getState().isMonitoringDetached).toBe(true);

    act(() => {
      runtimeEvents['detached-closed']?.();
    });
    expect(useFlowStore.getState().isMonitoringDetached).toBe(false);

    delete (globalThis as any).runtime;
  });

  it('ignores mousemove when not dragging and handles broadcast channel when runtime is missing', () => {
    delete (globalThis as any).runtime;

    let onMessageCallback: ((event: any) => void) | null = null;
    class MockBroadcastChannel {
      set onmessage(cb: any) {
        onMessageCallback = cb;
      }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

    const { result } = renderHook(() => useMonitoringDashboardHandler());

    // Dispatch mousemove on document without dragging
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 999, clientY: 999 }));
    });
    expect(result.current.position).toEqual({ x: 400, y: 100 });

    // BroadcastChannel message when runtime is undefined
    act(() => {
      onMessageCallback?.({ data: { type: 'DETACHED_OPEN' } });
    });
    expect(useFlowStore.getState().isMonitoringDetached).toBe(true);

    // BroadcastChannel message with DETACHED_CLOSED when runtime is undefined
    act(() => {
      onMessageCallback?.({ data: { type: 'DETACHED_CLOSED' } });
    });
    expect(useFlowStore.getState().isMonitoringDetached).toBe(false);
  });
});
