import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemMonitorHeader } from '@/components/Monitoring/system-monitor/SystemMonitorHeader';
import { SystemMonitorStatCard } from '@/components/Monitoring/system-monitor/SystemMonitorStatCard';
import { SystemMonitorTimeSeriesPanel } from '@/components/Monitoring/system-monitor/SystemMonitorTimeSeriesPanel';
import { SystemMonitorReplicasPanel } from '@/components/Monitoring/system-monitor/SystemMonitorReplicasPanel';
import { SystemMonitorNetworkPanel } from '@/components/Monitoring/system-monitor/SystemMonitorNetworkPanel';
import { Activity } from 'lucide-react';

describe('SystemMonitor UI Components', () => {
  it('renders SystemMonitorHeader and triggers controls (start, pause, speed, spike, timeRange)', () => {
    const sendControl = vi.fn();
    const setTimeRange = vi.fn();

    const { rerender } = render(
      <SystemMonitorHeader
        isSimulating={false}
        isPaused={false}
        simulationSpeed={1}
        timeRange="5m"
        setTimeRange={setTimeRange}
        sendControl={sendControl}
        colorMode="dark"
        canStart={true}
      />
    );

    expect(screen.getByText('System Monitor')).toBeDefined();
    expect(screen.getByText('Idle')).toBeDefined();

    // Click Start
    fireEvent.click(screen.getByTitle('Start Simulation'));
    expect(sendControl).toHaveBeenCalledWith('start', { speed: 1 });

    // When canStart is false, Start button is disabled
    rerender(
      <SystemMonitorHeader
        isSimulating={false}
        isPaused={false}
        simulationSpeed={1}
        timeRange="5m"
        setTimeRange={setTimeRange}
        sendControl={sendControl}
        colorMode="dark"
        canStart={false}
      />
    );
    const disabledStartBtn = screen.getByTitle('Add an Internet card to start simulation');
    expect(disabledStartBtn.hasAttribute('disabled')).toBe(true);

    // Click speed 5x
    fireEvent.click(screen.getByText('5x'));
    expect(sendControl).toHaveBeenCalledWith('speed', { speed: 5 });

    // Click Spike
    fireEvent.click(screen.getByTitle('Inject 2x Traffic Spike (Chaos Test)'));
    expect(sendControl).toHaveBeenCalledWith('traffic_spike', { multiplier: 2 });

    // Click Interval 1h
    fireEvent.click(screen.getByText('1h'));
    expect(setTimeRange).toHaveBeenCalledWith('1h');

    // Click Interval 5m (dynamic max resolution)
    fireEvent.click(screen.getByText('5m'));
    expect(setTimeRange).toHaveBeenCalledWith('5m');

    // Rerender as Simulating & Running
    rerender(
      <SystemMonitorHeader
        isSimulating={true}
        isPaused={false}
        simulationSpeed={5}
        timeRange="1h"
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
      <SystemMonitorHeader
        isSimulating={true}
        isPaused={true}
        simulationSpeed={10}
        timeRange="1h"
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

    // Test frameless window controls (minimize, maximize, close)
    fireEvent.click(screen.getByLabelText('minimize'));
    fireEvent.click(screen.getByLabelText('maximize'));
    fireEvent.click(screen.getByLabelText('close'));

    // Test double click header to maximize
    const header = screen.getByTestId('system-monitor-header');
    fireEvent.doubleClick(header);
  });

  it('renders SystemMonitorStatCard with normal, warning, and critical thresholds and sparkline', () => {
    const { rerender } = render(
      <SystemMonitorStatCard
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
      <SystemMonitorStatCard
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
      <SystemMonitorStatCard
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

  it('renders SystemMonitorTimeSeriesPanel with empty and populated metrics', () => {
    const { rerender } = render(
      <SystemMonitorTimeSeriesPanel
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
      <SystemMonitorTimeSeriesPanel
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
    // When hasHpa is false (no HPA on canvas), HPA helper line is NOT shown
    expect(screen.queryByText('80% HPA')).toBeNull();
    expect(screen.queryByText('80% HPA Target')).toBeNull();
    expect(screen.getByText('90% Throttle')).toBeDefined();
    expect(screen.getByText('90% Throttle Risk')).toBeDefined();

    // Rerender with hasHpa=true -> HPA helper line is shown
    rerender(
      <SystemMonitorTimeSeriesPanel
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
        hasHpa={true}
      />
    );
    expect(screen.getByText('80% HPA')).toBeDefined();
    expect(screen.getByText('80% HPA Target')).toBeDefined();

    // Rerender with Memory Allocation panel
    rerender(
      <SystemMonitorTimeSeriesPanel
        title="Memory Allocation"
        description="Memory per deployment"
        deployments={[{ id: 'dep-1', label: 'web-server', replicas: 2 }]}
        metrics={{
          'dep-1': [
            {
              cpuPercent: 30,
              memoryPercent: 40,
              cpuValue: 200,
              memoryValue: 180,
              cpuLimit: 1000,
              memoryLimit: 512,
              isThrottled: false,
              isOOM: false,
            },
          ],
        }}
        metricKey="memoryValue"
        unit=" MiB"
        maxVal={256}
        showThresholds={true}
      />
    );
    expect(screen.getByText('85% OOM Risk')).toBeDefined();
    expect(screen.getByText('85% OOM Risk (435 MiB)')).toBeDefined();
    expect(screen.getAllByText('Limit: 512 MiB')).toHaveLength(2);
  });

  it('renders SystemMonitorReplicasPanel and SystemMonitorNetworkPanel', () => {
    render(
      <div>
        <SystemMonitorReplicasPanel
          deployments={[{ id: 'dep-1', label: 'api-service', replicas: 4 }]}
          metrics={{ 'dep-1': [{ cpuPercent: 50, memoryPercent: 40 }] }}
        />
        <SystemMonitorNetworkPanel
          deployments={[{ id: 'dep-1', label: 'api-service', replicas: 4 }]}
          metrics={{ 'dep-1': [{ cpuPercent: 50, memoryPercent: 40 }] }}
        />
      </div>
    );

    expect(screen.getByText('HPA & Pod Autoscaling Replicas')).toBeDefined();
    expect(screen.getByText('4 Replicas')).toBeDefined();
    expect(screen.getByText('Network Ingress & Response Latency')).toBeDefined();
  });

  it('dynamically adapts X-axis and Y-axis scale based on interval and Task Manager autoscaling', () => {
    // 1. Dynamic X-axis with interval 30m (shows 03:00, 06:00, etc.)
    const { rerender } = render(
      <SystemMonitorTimeSeriesPanel
        title="CPU Utilization"
        deployments={[{ id: 'dep-1', label: 'web-server', replicas: 1 }]}
        metrics={{
          'dep-1': [
            { cpuPercent: 40, memoryPercent: 20 },
            { cpuPercent: 50, memoryPercent: 30 }
          ]
        }}
        metricKey="cpuPercent"
        interval="30m"
        maxVal={100}
      />
    );

    // 30m interval renders -21h tick and 0 (Now)
    expect(screen.getByText('-21h')).toBeDefined();
    expect(screen.getByText('0 (Now)')).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined(); // Y-axis top tick at 100%

    // 2. Dynamic Y-axis scale UP when peak exceeds limit (e.g. multi-core spike to 140%)
    rerender(
      <SystemMonitorTimeSeriesPanel
        title="CPU Utilization"
        deployments={[{ id: 'dep-1', label: 'web-server', replicas: 1 }]}
        metrics={{
          'dep-1': [
            { cpuPercent: 140, memoryPercent: 20 }
          ]
        }}
        metricKey="cpuPercent"
        interval="1h"
        maxVal={100}
      />
    );

    // Scaled up to 200% on Y-axis
    expect(screen.getByText('200%')).toBeDefined();
    expect(screen.getByText('100% Limit')).toBeDefined();
    expect(screen.getByText('100% Quota Limit')).toBeDefined();

    // 3. Dynamic Y-axis scale DOWN when values decrease back to normal
    rerender(
      <SystemMonitorTimeSeriesPanel
        title="CPU Utilization"
        deployments={[{ id: 'dep-1', label: 'web-server', replicas: 1 }]}
        metrics={{
          'dep-1': [
            { cpuPercent: 45, memoryPercent: 20 }
          ]
        }}
        metricKey="cpuPercent"
        interval="1h"
        maxVal={100}
      />
    );

    // Scaled down back to 100%
    expect(screen.getByText('100%')).toBeDefined();

    // 4. Dynamic X-axis with 15m interval (shows -22h, -20h, etc.)
    rerender(
      <SystemMonitorTimeSeriesPanel
        title="CPU Utilization"
        deployments={[{ id: 'dep-1', label: 'web-server', replicas: 1 }]}
        metrics={{ 'dep-1': [{ cpuPercent: 30 }] }}
        metricKey="cpuPercent"
        interval="15m"
      />
    );
    expect(screen.getByText('-22h')).toBeDefined();
  });
});
