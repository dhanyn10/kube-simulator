import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MonitoringDashboard } from '@/components/Monitoring/MonitoringDashboard';
import { useFlowStore } from '@/store';

// Mock BroadcastChannel
class MockBroadcastChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
}
global.BroadcastChannel = MockBroadcastChannel as any;

describe('MonitoringDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      isMonitoringOpen: true,
      isMonitoringDetached: false,
      nodes: [],
      simulationMetrics: {},
      colorMode: 'dark',
    });
  });

  it('renders correctly when open', () => {
    render(<MonitoringDashboard />);
    expect(screen.getByText('System Monitoring')).toBeDefined();
    expect(screen.getByText('No deployments detected')).toBeDefined();
  });

  it('renders workload metrics', () => {
    const nodes = [{ id: 'd1', type: 'Deployment', data: { label: 'my-dep', replicas: 2 } }];
    const metrics = {
        'd1': [{ cpuPercent: 50, memoryPercent: 60, timestamp: Date.now() }]
    };
    useFlowStore.setState({ nodes: nodes as any, simulationMetrics: metrics as any });

    render(<MonitoringDashboard />);
    expect(screen.getByText('my-dep')).toBeDefined();
    expect(screen.getByText('2 Replicas')).toBeDefined();
    expect(screen.getByText('CPU Usage')).toBeDefined();
    expect(screen.getByText('Memory Usage')).toBeDefined();
  });

  it('handles closing the dashboard', () => {
    const setMonitoringOpenSpy = vi.spyOn(useFlowStore.getState(), 'setMonitoringOpen');
    render(<MonitoringDashboard />);

    fireEvent.click(screen.getByLabelText('Close dashboard'));
    expect(setMonitoringOpenSpy).toHaveBeenCalledWith(false);
  });

  it('handles detaching the dashboard', () => {
    const openSpy = vi.spyOn(globalThis, 'open').mockReturnValue(null);
    render(<MonitoringDashboard />);

    fireEvent.click(screen.getByText('Detach'));
    expect(openSpy).toHaveBeenCalled();
  });

  it('shows OOM and Throttled warnings', () => {
    const nodes = [{ id: 'd1', type: 'Deployment', data: { label: 'my-dep' } }];
    const metrics = {
        'd1': [{ cpuPercent: 90, memoryPercent: 95, isThrottled: true, isOOM: true, timestamp: Date.now() }]
    };
    useFlowStore.setState({ nodes: nodes as any, simulationMetrics: metrics as any });

    render(<MonitoringDashboard />);
    expect(screen.getByText('Throttled')).toBeDefined();
    expect(screen.getByText('OOM Risk')).toBeDefined();
  });
});
