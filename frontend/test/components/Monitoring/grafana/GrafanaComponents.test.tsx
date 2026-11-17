import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GrafanaHeader } from '@/components/Monitoring/grafana/GrafanaHeader';
import { GrafanaStatCard } from '@/components/Monitoring/grafana/GrafanaStatCard';
import { GrafanaTimeSeriesPanel } from '@/components/Monitoring/grafana/GrafanaTimeSeriesPanel';
import { GrafanaReplicasPanel } from '@/components/Monitoring/grafana/GrafanaReplicasPanel';
import { GrafanaNetworkPanel } from '@/components/Monitoring/grafana/GrafanaNetworkPanel';
import { Activity } from 'lucide-react';

describe('Grafana UI Components', () => {
  it('renders GrafanaHeader and triggers controls (start, pause, speed, spike, timeRange)', () => {
    const sendControl = vi.fn();
    const setTimeRange = vi.fn();

    const { rerender } = render(
      <GrafanaHeader
        isSimulating={false}
        isPaused={false}
        simulationSpeed={1}
        timeRange="5m"
        setTimeRange={setTimeRange}
        sendControl={sendControl}
        colorMode="dark"
      />
    );

    expect(screen.getByText('Real-time Monitoring')).toBeDefined();
    expect(screen.getByText('Idle')).toBeDefined();

    // Click Start
    fireEvent.click(screen.getByTitle('Start Simulation'));
    expect(sendControl).toHaveBeenCalledWith('start', { speed: 1 });

    // Click speed 5x
    fireEvent.click(screen.getByText('5x'));
    expect(sendControl).toHaveBeenCalledWith('speed', { speed: 5 });

    // Click Spike
    fireEvent.click(screen.getByTitle('Inject 2x Traffic Spike (Chaos Test)'));
    expect(sendControl).toHaveBeenCalledWith('traffic_spike', { multiplier: 2 });

    // Click Time Range 1m
    fireEvent.click(screen.getByText('1m'));
    expect(setTimeRange).toHaveBeenCalledWith('1m');

    // Rerender as Simulating & Running
    rerender(
      <GrafanaHeader
        isSimulating={true}
        isPaused={false}
        simulationSpeed={5}
        timeRange="1m"
        setTimeRange={setTimeRange}
        sendControl={sendControl}
        colorMode="dark"
      />
    );
    expect(screen.getByText('Live')).toBeDefined();
    fireEvent.click(screen.getByTitle('Pause Simulation'));
    expect(sendControl).toHaveBeenCalledWith('pause');

    // Rerender as Paused
    rerender(
      <GrafanaHeader
        isSimulating={true}
        isPaused={true}
        simulationSpeed={10}
        timeRange="1m"
        setTimeRange={setTimeRange}
        sendControl={sendControl}
        colorMode="light"
      />
    );
    expect(screen.getByText('Paused')).toBeDefined();
    fireEvent.click(screen.getByTitle('Resume Simulation'));
    expect(sendControl).toHaveBeenCalledWith('resume');

    // Click Stop
    fireEvent.click(screen.getByTitle('Stop Simulation'));
    expect(sendControl).toHaveBeenCalledWith('stop');
  });

  it('renders GrafanaStatCard with normal, warning, and critical thresholds and sparkline', () => {
    const { rerender } = render(
      <GrafanaStatCard
        title="Cluster CPU"
        value={45}
        unit="%"
        subtitle="450m / 1000m"
        icon={<Activity size={14} />}
        sparklineData={[10, 20, 30, 45]}
        threshold="normal"
        colorMode="dark"
      />
    );

    expect(screen.getByText('Cluster CPU')).toBeDefined();
    expect(screen.getByText('45')).toBeDefined();

    // Warning threshold
    rerender(
      <GrafanaStatCard
        title="Cluster CPU"
        value={78}
        unit="%"
        subtitle="780m / 1000m"
        icon={<Activity size={14} />}
        sparklineData={[50, 78]}
        threshold="warning"
        colorMode="light"
      />
    );
    expect(screen.getByText('78')).toBeDefined();

    // Critical threshold with empty sparkline
    rerender(
      <GrafanaStatCard
        title="Cluster CPU"
        value={96}
        unit="%"
        subtitle="960m / 1000m"
        icon={<Activity size={14} />}
        sparklineData={[]}
        threshold="critical"
        colorMode="dark"
      />
    );
    expect(screen.getByText('96')).toBeDefined();
  });

  it('renders GrafanaTimeSeriesPanel with empty and populated metrics', () => {
    const { rerender } = render(
      <GrafanaTimeSeriesPanel
        title="CPU Utilization"
        description="CPU per deployment"
        deployments={[]}
        metrics={{}}
        metricKey="cpuPercent"
        showThresholds={true}
      />
    );
    expect(screen.getByText('No active workload metrics')).toBeDefined();

    rerender(
      <GrafanaTimeSeriesPanel
        title="CPU Utilization"
        description="CPU per deployment"
        deployments={[{ id: 'dep-1', label: 'web-server', replicas: 2 }]}
        metrics={{
          'dep-1': [
            { cpuPercent: 30, memoryPercent: 40, isThrottled: false, isOOM: false },
            { cpuPercent: 60, memoryPercent: 50, isThrottled: false, isOOM: false }
          ]
        }}
        metricKey="cpuPercent"
        showThresholds={true}
      />
    );
    expect(screen.getByText('web-server')).toBeDefined();
    expect(screen.getAllByText('60%')[0]).toBeDefined();
  });

  it('renders GrafanaReplicasPanel and GrafanaNetworkPanel', () => {
    render(
      <div>
        <GrafanaReplicasPanel
          deployments={[{ id: 'dep-1', label: 'api-service', replicas: 4 }]}
          metrics={{ 'dep-1': [{ cpuPercent: 50, memoryPercent: 40 }] }}
        />
        <GrafanaNetworkPanel
          deployments={[{ id: 'dep-1', label: 'api-service', replicas: 4 }]}
          metrics={{ 'dep-1': [{ cpuPercent: 50, memoryPercent: 40 }] }}
        />
      </div>
    );

    expect(screen.getByText('HPA & Pod Autoscaling Replicas')).toBeDefined();
    expect(screen.getByText('4 Replicas')).toBeDefined();
    expect(screen.getByText('Network Ingress & Response Latency')).toBeDefined();
  });
});
