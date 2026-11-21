import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useFlowStore } from '@/store';
import { getBackendGateway } from '@/gateway';
import { SystemMonitorHeader } from '@/components/Monitoring/system-monitor/SystemMonitorHeader';
import { SystemMonitorStatCard } from '@/components/Monitoring/system-monitor/SystemMonitorStatCard';
import {
  SystemMonitorTimeSeriesPanel,
  DynamicThresholdLines,
} from '@/components/Monitoring/system-monitor/SystemMonitorTimeSeriesPanel';
import { SystemMonitorReplicasPanel } from '@/components/Monitoring/system-monitor/SystemMonitorReplicasPanel';
import { SystemMonitorNetworkPanel } from '@/components/Monitoring/system-monitor/SystemMonitorNetworkPanel';
import { SystemMonitorContextMenu } from '@/components/Monitoring/system-monitor/SystemMonitorContextMenu';
import { SystemMonitorScrubber } from '@/components/Monitoring/system-monitor/SystemMonitorScrubber';
import { SystemMonitorDashboard } from '@/components/Monitoring/system-monitor/SystemMonitorDashboard';
import {
  SystemMonitorChartCanvas,
  SystemMonitorPanelCard,
  SystemMonitorVerticalGrid,
  SystemMonitorAxisBottom,
  SystemMonitorInteractiveChart,
} from '@/components/Monitoring/system-monitor/SystemMonitorChartAxes';
import { Activity } from 'lucide-react';

describe('SystemMonitor UI Components', () => {
  it('renders SystemMonitorHeader and triggers controls (start, pause, speed, timeRange)', () => {
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

    // Auto-pause (error/red chart) is broadcast as isSimulating=false + isPaused=true.
    // The monitor must still offer Resume and Stop, like the main window.
    rerender(
      <SystemMonitorHeader
        isSimulating={false}
        isPaused={true}
        simulationSpeed={10}
        timeRange="1h"
        setTimeRange={setTimeRange}
        sendControl={sendControl}
        colorMode="dark"
      />
    );
    expect(screen.getByText('Paused')).toBeDefined();
    expect(screen.getByTitle('Resume Simulation')).toBeDefined();
    expect(screen.getByTitle('Stop Simulation')).toBeDefined();
    fireEvent.click(screen.getByTitle('Resume Simulation'));
    expect(sendControl).toHaveBeenCalledWith('resume');

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

    // Rerender with isThrottled and isOOM in light mode
    rerender(
      <SystemMonitorTimeSeriesPanel
        title="CPU Utilization"
        description="CPU per deployment"
        deployments={[{ id: 'dep-1', label: 'web-server', replicas: 2 }]}
        metrics={{
          'dep-1': [
            { cpuPercent: 95, isThrottled: true, isOOM: true }
          ]
        }}
        metricKey="cpuPercent"
        colorMode="light"
        showThresholds={false}
      />
    );
    expect(screen.getByText('Throttled')).toBeDefined();
    expect(screen.getByText('OOM Risk')).toBeDefined();

    // Rerender with isThrottled and isOOM in dark mode
    rerender(
      <SystemMonitorTimeSeriesPanel
        title="CPU Utilization"
        description="CPU per deployment"
        deployments={[{ id: 'dep-1', label: 'web-server', replicas: 2 }]}
        metrics={{
          'dep-1': [
            { cpuPercent: 95, isThrottled: true, isOOM: true }
          ]
        }}
        metricKey="cpuPercent"
        colorMode="dark"
        showThresholds={true}
      />
    );
    expect(screen.getByText('Throttled')).toBeDefined();
    expect(screen.getByText('OOM Risk')).toBeDefined();
  });

  it('renders DynamicThresholdLines with empty lines, dark mode default, and light mode colors', () => {
    // 1. Empty lines returns null
    const { container, rerender } = render(<DynamicThresholdLines lines={[]} />);
    expect(container.firstChild).toBeNull();

    // 2. Populated lines in light mode
    rerender(
      <DynamicThresholdLines
        lines={[
          { label: 'Limit', value: 100, percentFromTop: 10, color: 'rose', badge: '100% Limit' },
          { label: 'Warning', value: 80, percentFromTop: 30, color: 'amber', badge: '80% Warning' },
          { label: 'Quota', value: 120, percentFromTop: 5, color: 'red', badge: '120% Quota' },
        ]}
        isDark={false}
      />
    );
    expect(screen.getByText('100% Limit')).toBeDefined();
    expect(screen.getByText('80% Warning')).toBeDefined();
    expect(screen.getByText('120% Quota')).toBeDefined();

    // 3. Default isDark parameter (undefined)
    rerender(
      <DynamicThresholdLines
        lines={[
          { label: 'Limit', value: 100, percentFromTop: 10, color: 'rose', badge: '100% Limit' },
        ]}
      />
    );
    expect(screen.getByText('100% Limit')).toBeDefined();

    // 4. TimeSeriesPanel with deployment missing from metrics dictionary covers fallbacks on lines 102 and 147
    rerender(
      <SystemMonitorTimeSeriesPanel
        title="CPU Utilization"
        deployments={[{ id: 'dep-unrecorded', label: 'unrecorded-service', replicas: 1 }]}
        metrics={{}}
        metricKey="cpuPercent"
      />
    );
    expect(screen.getByText('unrecorded-service')).toBeDefined();
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

    // 30m interval renders timing interval steps (0, 30, 60... 360) and unit Minutes
    expect(screen.getByText('30')).toBeDefined();
    expect(screen.getByText('360')).toBeDefined();
    expect(screen.getByText('Minutes')).toBeDefined();
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

    // 4. Dynamic X-axis with 15m interval (shows timing interval steps 15, 30... 180)
    rerender(
      <SystemMonitorTimeSeriesPanel
        title="CPU Utilization"
        deployments={[{ id: 'dep-1', label: 'web-server', replicas: 1 }]}
        metrics={{ 'dep-1': [{ cpuPercent: 30 }] }}
        metricKey="cpuPercent"
        interval="15m"
      />
    );
    expect(screen.getByText('15')).toBeDefined();
    expect(screen.getByText('180')).toBeDefined();
  });

  it('renders SystemMonitorContextMenu and triggers Change Theme, Close, and Escape key', () => {
    const onToggleTheme = vi.fn();
    const onCloseWindow = vi.fn();
    const onCloseMenu = vi.fn();

    const { rerender } = render(
      <SystemMonitorContextMenu
        x={100}
        y={150}
        isDark={true}
        onToggleTheme={onToggleTheme}
        onCloseWindow={onCloseWindow}
        onCloseMenu={onCloseMenu}
      />
    );

    const menu = screen.getByTestId('system-monitor-context-menu');
    expect(menu).toBeDefined();
    expect(screen.getByText('Change Theme')).toBeDefined();
    expect(screen.getByText('Close')).toBeDefined();

    // Click Change Theme
    fireEvent.click(screen.getByTestId('system-monitor-menu-change-theme'));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
    expect(onCloseMenu).toHaveBeenCalledTimes(1);

    // Rerender in Light mode
    rerender(
      <SystemMonitorContextMenu
        x={100}
        y={150}
        isDark={false}
        onToggleTheme={onToggleTheme}
        onCloseWindow={onCloseWindow}
        onCloseMenu={onCloseMenu}
      />
    );

    // Click Close
    fireEvent.click(screen.getByTestId('system-monitor-menu-close'));
    expect(onCloseWindow).toHaveBeenCalledTimes(1);
    expect(onCloseMenu).toHaveBeenCalledTimes(2);

    // Press non-Escape key (e.g. Tab) should not trigger onCloseMenu
    fireEvent.keyDown(globalThis, { key: 'Tab' });
    expect(onCloseMenu).toHaveBeenCalledTimes(2);

    // Press Escape key
    fireEvent.keyDown(globalThis, { key: 'Escape' });
    expect(onCloseMenu).toHaveBeenCalledTimes(3);
  });

  it('renders SystemMonitorPanelCard and SystemMonitorChartCanvas with empty state', () => {
    render(
      <SystemMonitorPanelCard
        isDark={false}
        headerLeft={<span>Test Header</span>}
        headerRight={<span>Test Action</span>}
        footer={<span>Test Footer</span>}
      >
        <SystemMonitorChartCanvas
          isDark={false}
          xTicks={[{ label: '0h', minute: 0, percent: 100 }]}
          yScaleTicks={[{ value: 100, label: '100%', percentFromTop: 0 }]}
          isEmpty={true}
          emptyText="No items found"
        />
      </SystemMonitorPanelCard>
    );

    expect(screen.getByText('Test Header')).toBeDefined();
    expect(screen.getByText('Test Action')).toBeDefined();
    expect(screen.getByText('Test Footer')).toBeDefined();
    expect(screen.getByText('No items found')).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('renders empty states for Network and Replicas panels when deployments is empty', () => {
    render(
      <div>
        <SystemMonitorNetworkPanel deployments={[]} metrics={{}} />
        <SystemMonitorReplicasPanel deployments={[]} metrics={{}} />
      </div>
    );

    expect(screen.getByText('No active traffic simulation')).toBeDefined();
    expect(screen.getByText('No workload deployments active')).toBeDefined();
  });

  it('renders SystemMonitorVerticalGrid with absolute positioned lines matching tick percent', () => {
    const xTicks = [
      { label: '-24h', minute: 1440, percent: 0 },
      { label: '-12h', minute: 720, percent: 50 },
      { label: '0 (Now)', minute: 0, percent: 100 },
    ];
    const { container } = render(
      <SystemMonitorVerticalGrid xTicks={xTicks} isDark={true} />
    );
    const gridLines = container.querySelectorAll('.border-l');
    expect(gridLines).toHaveLength(3);
    expect((gridLines[0] as HTMLElement).style.left).toBe('0%');
    expect((gridLines[1] as HTMLElement).style.left).toBe('50%');
    expect((gridLines[2] as HTMLElement).style.left).toBe('100%');
  });

  it('renders SystemMonitorScrubber guideline, time badge, and series tooltip', () => {
    const { rerender } = render(
      <SystemMonitorScrubber
        hoverPercent={50}
        timeLabel="14:30"
        values={[
          { id: 'dep-1', label: 'api-gateway', color: '#3b82f6', value: 72, unit: '%', isThrottled: true },
          { id: 'dep-2', label: 'db-cache', color: '#10b981', value: 240, unit: ' MiB', isOOM: true },
        ]}
        isDark={true}
      />
    );

    expect(screen.getByText('14:30')).toBeDefined();
    expect(screen.getByText('api-gateway')).toBeDefined();
    expect(screen.getByText('72%')).toBeDefined();
    expect(screen.getByText('db-cache')).toBeDefined();
    expect(screen.getByText('240 MiB')).toBeDefined();

    rerender(
      <SystemMonitorScrubber
        hoverPercent={85}
        timeLabel="23:45"
        values={[]}
        isDark={false}
      />
    );
    expect(screen.getByText('23:45')).toBeDefined();
  });

  it('handles mouse move and leave on SystemMonitorTimeSeriesPanel for scrubber tooltip', () => {
    const deployments = [{ id: 'dep-1', label: 'web-service', replicas: 1 }];
    const metrics = {
      'dep-1': [
        { minuteIndex: 60, cpuPercent: 40, isThrottled: false, isOOM: false },
        { minuteIndex: 61, cpuPercent: 80, isThrottled: true, isOOM: false },
      ],
    };

    const { container } = render(
      <SystemMonitorTimeSeriesPanel
        title="CPU Utilization"
        description="CPU per deployment"
        deployments={deployments}
        metrics={metrics}
        metricKey="cpuPercent"
        showThresholds={true}
      />
    );

    const canvasArea = container.querySelector('.cursor-crosshair');
    expect(canvasArea).not.toBeNull();
    if (canvasArea) {
      vi.spyOn(canvasArea, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 1000,
        bottom: 200,
        width: 1000,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      fireEvent.mouseMove(canvasArea, { clientX: 500 });
      expect(screen.getByText('Snapshot')).toBeDefined();

      fireEvent.mouseLeave(canvasArea);
      expect(screen.queryByText('Snapshot')).toBeNull();
    }
  });

  it('handles mouse move and leave on SystemMonitorReplicasPanel for scrubber tooltip', () => {
    const deployments = [{ id: 'dep-rep', label: 'rep-service', replicas: 2 }];
    const metrics = {
      'dep-rep': [
        { minuteIndex: 10, replicas: 2 },
        { minuteIndex: 11, replicas: 4 },
      ],
    };

    const { container } = render(
      <SystemMonitorReplicasPanel
        deployments={deployments}
        metrics={metrics}
        colorMode="dark"
      />
    );

    const canvasArea = container.querySelector('.cursor-crosshair');
    expect(canvasArea).not.toBeNull();
    if (canvasArea) {
      vi.spyOn(canvasArea, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 1000,
        bottom: 200,
        width: 1000,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      fireEvent.mouseMove(canvasArea, { clientX: 400 });
      expect(screen.getByText('Snapshot')).toBeDefined();

      fireEvent.mouseLeave(canvasArea);
      expect(screen.queryByText('Snapshot')).toBeNull();
    }
  });

  it('handles mouse move and leave on SystemMonitorNetworkPanel for scrubber tooltip', () => {
    const deployments = [{ id: 'dep-net', label: 'net-service', replicas: 1 }];
    const metrics = {
      'dep-net': [
        { minuteIndex: 10, cpuPercent: 50 },
        { minuteIndex: 11, cpuPercent: 80 },
      ],
    };

    const { container } = render(
      <SystemMonitorNetworkPanel
        deployments={deployments}
        metrics={metrics}
        colorMode="dark"
      />
    );

    const canvasArea = container.querySelector('.cursor-crosshair');
    expect(canvasArea).not.toBeNull();
    if (canvasArea) {
      vi.spyOn(canvasArea, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 1000,
        bottom: 200,
        width: 1000,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      fireEvent.mouseMove(canvasArea, { clientX: 600 });
      expect(screen.getByText('Snapshot')).toBeDefined();

      fireEvent.mouseLeave(canvasArea);
      expect(screen.queryByText('Snapshot')).toBeNull();
    }
  });

  it('renders SystemMonitorDashboard container, opens and closes context menu, and triggers exports', async () => {
    const gw = getBackendGateway();
    let metricsCb: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') {
        metricsCb = cb;
      }
      return () => {};
    });

    // 1. Initial empty state
    useFlowStore.setState({ nodes: [] });
    const { container } = render(<SystemMonitorDashboard />);

    expect(screen.getByText('System Monitor')).toBeDefined();
    expect(screen.getByText('Cluster CPU')).toBeDefined();
    expect(screen.getByText('Workload Pods')).toBeDefined();
    expect(screen.getByText(/Waiting for simulation data/i)).toBeDefined();

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).not.toBeNull();

    // Scroll area uses the shared app scrollbar style and sits inside a right gutter
    const scrollArea = screen.getByTestId('system-monitor-scroll-area');
    expect(scrollArea.className).toContain('custom-scrollbar');
    expect(scrollArea.className).toContain('overflow-y-auto');
    expect(scrollArea.parentElement?.className).toContain('pr-1.5');

    // Trigger right-click context menu
    fireEvent.contextMenu(mainContainer, { clientX: 150, clientY: 200 });
    expect(screen.getByText('Change Theme')).toBeDefined();

    // Close context menu by clicking Change Theme
    fireEvent.click(screen.getByText('Change Theme'));
    expect(screen.queryByText('Change Theme')).toBeNull();

    // 2. Hydrate data with deployment and 35 points (critical CPU and warning Memory)
    const points = Array.from({ length: 35 }, (_, i) => ({
      minuteIndex: i,
      cpuPercent: 90,
      memoryPercent: 75,
      isThrottled: false,
      isOOM: false,
    }));

    await act(async () => {
      metricsCb?.(
        JSON.stringify({
          timestamp: 9999,
          deployments: [
            { id: 'dep-dashboard', label: 'dash-service', replicas: 3 },
          ],
          metrics: {
            'dep-dashboard': points,
          },
        })
      );
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText('HPA & Pod Autoscaling Replicas')).toBeDefined();
    expect(screen.getByText('Network Ingress & Response Latency')).toBeDefined();

    // Trigger right click and click Close
    fireEvent.contextMenu(mainContainer, { clientX: 200, clientY: 250 });
    const closeMenuItem = screen.getByTestId('system-monitor-menu-close');
    expect(closeMenuItem).toBeDefined();
    fireEvent.click(closeMenuItem);
    expect(screen.queryByTestId('system-monitor-menu-close')).toBeNull();

    // Click Close Window button in header
    fireEvent.click(screen.getByLabelText('close'));
  });

  it('covers SystemMonitorAxisBottom edge cases for zero step interval and missing last tick minute', () => {
    // 1. Equal minutes on first two ticks -> stepVal becomes 0, so || 1 fallback is triggered (covers line 32)
    // 2. Last tick has minute: undefined -> ?? 0 fallback is triggered (covers line 33)
    const mockTicks = [
      { minute: 5, label: '5m' },
      { minute: 5, label: '5m' },
      { minute: undefined as any, label: 'end' },
    ];

    const { rerender } = render(
      <SystemMonitorAxisBottom xTicks={mockTicks} isDark={false} unit="Minutes" />
    );

    expect(screen.getByText('1m / div')).toBeDefined();
    expect(screen.getByText('0 Minutes')).toBeDefined();

    // Suffix 'h' when unit is Hours
    rerender(
      <SystemMonitorAxisBottom
        xTicks={[
          { minute: 0, label: '0h' },
          { minute: 2, label: '2h' },
        ]}
        isDark={true}
        unit="Hours"
      />
    );
    expect(screen.getByText('2h / div')).toBeDefined();
  });

  it('covers handleMouseMove early return when canvas bounding rect width <= 0 in SystemMonitorInteractiveChart', () => {
    const { container } = render(
      <SystemMonitorInteractiveChart maxVal={100} series={[]} heightClass="h-40">
        <div>Content</div>
      </SystemMonitorInteractiveChart>
    );

    const canvasArea = container.querySelector('.cursor-crosshair');
    expect(canvasArea).not.toBeNull();
    if (canvasArea) {
      // Mock getBoundingClientRect to return width <= 0 (covers line 304)
      vi.spyOn(canvasArea, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 0,
        bottom: 100,
        width: 0,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      fireEvent.mouseMove(canvasArea, { clientX: 50 });
      expect(screen.queryByText('Snapshot')).toBeNull();
    }
  });
});
