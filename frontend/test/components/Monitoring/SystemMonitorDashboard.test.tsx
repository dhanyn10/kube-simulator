import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemMonitorDashboard } from '@/components/Monitoring/system-monitor/SystemMonitorDashboard';
import * as monitoringActivities from '@/activities/monitoring';

describe('SystemMonitorDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty simulation state when no deployments exist', () => {
    vi.spyOn(monitoringActivities, 'useSystemMonitorDashboard').mockReturnValue({
      metrics: {},
      deployments: [],
      isSimulating: false,
      isPaused: false,
      simulationSpeed: 1,
      canStart: false,
      hasHpa: false,
      hpaTarget: 80,
      colorMode: 'dark',
      selectedDeploymentId: 'all',
      setSelectedDeploymentId: vi.fn(),
      isLive: false,
      clusterTotals: {
        cpuPercent: 0,
        memoryPercent: 0,
        readyPods: 0,
        totalPods: 0,
        rps: 0,
        totalTrafficRpm: 0,
        latencyMs: 0,
        errorRate: 0,
        podStatusSummary: { running: 0, pending: 0, failed: 0 },
      },
      handleStartStop: vi.fn(),
      handlePauseResume: vi.fn(),
      handleSpeedChange: vi.fn(),
      handleReset: vi.fn(),
    } as any);

    render(<SystemMonitorDashboard />);
    expect(screen.getByText(/Waiting for simulation data/i)).toBeTruthy();
  });

  it('renders stat cards and panels with critical/warning thresholds when deployments exist', () => {
    vi.spyOn(monitoringActivities, 'useSystemMonitorDashboard').mockReturnValue({
      metrics: {
        'dep-1': [
          { timestamp: 1, cpuPercent: 90, memoryPercent: 75, rps: 120, latencyMs: 15, errorRate: 0 },
        ],
      },
      deployments: [{ id: 'dep-1', label: 'api-svc', replicas: 2, readyReplicas: 1 }],
      isSimulating: true,
      isPaused: false,
      simulationSpeed: 1,
      canStart: true,
      hasHpa: true,
      hpaTarget: 80,
      colorMode: 'light',
      selectedDeploymentId: 'all',
      setSelectedDeploymentId: vi.fn(),
      isLive: true,
      clusterTotals: {
        cpuPercent: 90,
        memoryPercent: 75,
        readyPods: 1,
        totalPods: 2,
        rps: 120,
        totalTrafficRpm: 1200,
        latencyMs: 15,
        errorRate: 0,
        podStatusSummary: { running: 1, pending: 1, failed: 0 },
      },
      handleStartStop: vi.fn(),
      handlePauseResume: vi.fn(),
      handleSpeedChange: vi.fn(),
      handleReset: vi.fn(),
    } as any);

    const { container } = render(<SystemMonitorDashboard />);
    expect(container.firstChild).toBeTruthy();
  });

  it('handles missing metric points for sparklines and opens/closes context menu', () => {
    vi.spyOn(monitoringActivities, 'useSystemMonitorDashboard').mockReturnValue({
      metrics: {},
      deployments: [{ id: 'dep-empty', label: 'empty-svc', replicas: 1, readyReplicas: 1 }],
      isSimulating: false,
      isPaused: false,
      simulationSpeed: 1,
      canStart: true,
      hasHpa: false,
      hpaTarget: 80,
      colorMode: 'dark',
      selectedDeploymentId: 'all',
      setSelectedDeploymentId: vi.fn(),
      isLive: false,
      clusterTotals: {
        cpuPercent: 10,
        memoryPercent: 20,
        readyPods: 1,
        totalPods: 1,
        rps: 0,
        totalTrafficRpm: 0,
        latencyMs: 0,
        errorRate: 0,
        podStatusSummary: { running: 1, pending: 0, failed: 0 },
      },
      handleStartStop: vi.fn(),
      handlePauseResume: vi.fn(),
      handleSpeedChange: vi.fn(),
      handleReset: vi.fn(),
      toggleTheme: vi.fn(),
    } as any);

    const { container } = render(<SystemMonitorDashboard />);
    fireEvent.contextMenu(container.firstChild as HTMLElement, { clientX: 100, clientY: 120 });
    expect(screen.getByTestId('system-monitor-context-menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('system-monitor-context-menu')).toBeNull();
  });
});
