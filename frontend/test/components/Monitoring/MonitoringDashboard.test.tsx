import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonitoringDashboard } from '@/components/Monitoring/MonitoringDashboard';
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

  it('renders correctly when open and handles standalone pod / replica set workloads in light mode', () => {
    useFlowStore.setState({
      colorMode: 'light',
      nodes: [
        { id: 'pod1', type: 'Pod', data: { label: 'standalone-pod' } },
        { id: 'rs1', type: 'ReplicaSet', data: { label: 'my-rs', replicas: 3 } },
      ] as any,
    });

    render(<MonitoringDashboard />);
    expect(screen.getByText('System Monitoring')).toBeDefined();
    expect(screen.getByText('standalone-pod')).toBeDefined();
    expect(screen.getByText('my-rs')).toBeDefined();
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
    broadcastChannelListener({ type: 'DETACHED_OPEN' });
    expect(setMonitoringDetachedSpy).toHaveBeenCalledWith(true);
    expect(setMonitoringOpenSpy).toHaveBeenCalledWith(false);

    // Simulate BroadcastChannel message DETACHED_CLOSED
    broadcastChannelListener({ type: 'DETACHED_CLOSED' });
    expect(setMonitoringDetachedSpy).toHaveBeenCalledWith(false);
  });

  it('handles dashboard header drag movement via mouse events', () => {
    render(<MonitoringDashboard />);

    const dragBtn = screen.getByLabelText('Drag to move dashboard');

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
});
