import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { MonitoringDashboard } from '@/components/Monitoring/MonitoringDashboard';
import { useMonitoringDashboardHandler } from '@/activities/monitoring/useMonitoringDashboard';
import { useFlowStore } from '@/store';

let broadcastChannelListener: any = null;
class MockBroadcastChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
  constructor() {
    broadcastChannelListener = (msg: any) => {
      if (this.onmessage) this.onmessage({ data: msg } as any);
    };
  }
}
global.BroadcastChannel = MockBroadcastChannel as any;

describe('MonitoringDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    broadcastChannelListener = null;
    (globalThis as any).runtime = undefined;

    useFlowStore.setState({
      isMonitoringOpen: true,
      isMonitoringDetached: false,
      nodes: [],
      simulationMetrics: {},
      colorMode: 'dark',
    });
  });

  it('returns null when monitoring is not open or is detached', () => {
    useFlowStore.setState({ isMonitoringOpen: false });
    const { container, rerender } = render(<MonitoringDashboard />);
    expect(container.firstChild).toBeNull();

    useFlowStore.setState({ isMonitoringOpen: true, isMonitoringDetached: true });
    rerender(<MonitoringDashboard />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when open and handles standalone pod, pod with parentId, replica set, and service workloads in light mode', () => {
    useFlowStore.setState({
      colorMode: 'light',
      nodes: [
        { id: 'pod1', type: 'Pod', data: { label: 'standalone-pod' } },
        { id: 'pod2', type: 'Pod', parentId: 'dep1', data: { label: 'child-pod' } },
        { id: 'rs1', type: 'ReplicaSet', data: { label: 'my-rs', replicas: 3 } },
        { id: 'svc1', type: 'Service', data: { label: 'my-svc' } },
      ] as any,
    });

    render(<MonitoringDashboard />);
    expect(screen.getByText('System Monitoring')).toBeDefined();
    expect(screen.getByText('standalone-pod')).toBeDefined();
    expect(screen.getByText('my-rs')).toBeDefined();
    expect(screen.queryByText('child-pod')).toBeNull();
    expect(screen.queryByText('my-svc')).toBeNull();
  });

  it('renders workload metrics and throttling / OOM warnings', () => {
    const nodes = [{ id: 'd1', type: 'Deployment', data: { label: 'my-dep', replicas: 2 } }];
    const metrics = {
      'd1': [{ cpuPercent: 90, memoryPercent: 95, isThrottled: true, isOOM: true, timestamp: Date.now() }]
    };
    useFlowStore.setState({ nodes: nodes as any, simulationMetrics: metrics as any });

    render(<MonitoringDashboard />);
    expect(screen.getByText('my-dep')).toBeDefined();
    expect(screen.getByText('2 Replicas')).toBeDefined();
    expect(screen.getByText('Throttled')).toBeDefined();
    expect(screen.getByText('OOM Risk')).toBeDefined();
  });

  it('handles BroadcastChannel messages and runtime events for detaching', () => {
    const setMonitoringDetachedSpy = vi.spyOn(useFlowStore.getState(), 'setMonitoringDetached');
    const setMonitoringOpenSpy = vi.spyOn(useFlowStore.getState(), 'setMonitoringOpen');

    const mockEventsOn = vi.fn();
    (globalThis as any).runtime = { EventsOn: mockEventsOn };

    render(<MonitoringDashboard />);

    expect(mockEventsOn).toHaveBeenCalledWith('detached-open', expect.any(Function));
    expect(mockEventsOn).toHaveBeenCalledWith('detached-closed', expect.any(Function));

    // Simulate BroadcastChannel message DETACHED_OPEN
    fireEvent(window, new Event('dummy'));
    broadcastChannelListener({ type: 'DETACHED_OPEN' });
    expect(setMonitoringDetachedSpy).toHaveBeenCalledWith(true);
    expect(setMonitoringOpenSpy).toHaveBeenCalledWith(false);

    // Simulate BroadcastChannel message DETACHED_CLOSED
    broadcastChannelListener({ type: 'DETACHED_CLOSED' });
    expect(setMonitoringDetachedSpy).toHaveBeenCalledWith(false);

    // Simulate BroadcastChannel message with unknown type (ignored)
    broadcastChannelListener({ type: 'UNKNOWN_TYPE' });

    // Simulate Wails runtime events callbacks
    const handleOpenCb = mockEventsOn.mock.calls.find((c) => c[0] === 'detached-open')?.[1];
    const handleCloseCb = mockEventsOn.mock.calls.find((c) => c[0] === 'detached-closed')?.[1];

    if (handleOpenCb) handleOpenCb();
    expect(setMonitoringDetachedSpy).toHaveBeenCalledWith(true);

    if (handleCloseCb) handleCloseCb();
    expect(setMonitoringDetachedSpy).toHaveBeenCalledWith(false);
  });

  it('handles dashboard header drag movement via mouse events and mousemove when not dragging', () => {
    render(<MonitoringDashboard />);

    const dragBtn = screen.getByLabelText('Drag to move dashboard');

    // mousemove when not dragging should early return
    fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });

    fireEvent.mouseDown(dragBtn, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 150, clientY: 120 });
    fireEvent.mouseUp(document);
  });

  it('handles closing dashboard', () => {
    const setMonitoringOpenSpy = vi.spyOn(useFlowStore.getState(), 'setMonitoringOpen');
    render(<MonitoringDashboard />);

    fireEvent.click(screen.getByLabelText('Close dashboard'));
    expect(setMonitoringOpenSpy).toHaveBeenCalledWith(false);
  });

  it('handles detaching dashboard window', () => {
    const openSpy = vi.spyOn(globalThis, 'open').mockReturnValue(null);
    render(<MonitoringDashboard />);

    fireEvent.click(screen.getByText('Detach'));
    expect(openSpy).toHaveBeenCalled();
  });

  it('handles BroadcastChannel message with non-matching type and handles hook when runtime is undefined', () => {
    (globalThis as any).runtime = undefined;

    render(<MonitoringDashboard />);

    // BroadcastChannel message with unhandled type
    expect(() => broadcastChannelListener({ type: 'UNHANDLED_EVENT' })).not.toThrow();
  });

  it('covers mousemove handler and mouseup handler in useMonitoringDashboardHandler hook', () => {
    const { result } = renderHook(() => useMonitoringDashboardHandler());

    // Call handleMouseDown to set isDragging to true and attach listener
    act(() => {
      result.current.handleMouseDown({ clientX: 100, clientY: 100 } as any);
    });

    // Create a mousemove event
    const moveEvent = new MouseEvent('mousemove', { clientX: 150, clientY: 150 });

    // Trigger mousemove event on document
    act(() => {
      document.dispatchEvent(moveEvent);
    });

    expect(result.current.position).toEqual({ x: 450, y: 150 });

    // Trigger mouseup event on document
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'));
    });
  });
});
