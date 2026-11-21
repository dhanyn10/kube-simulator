import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { getBackendGateway } from '@/gateway';
import { DetachedMonitoring } from '@/components/Monitoring/DetachedMonitoring';

// Mock BroadcastChannel
let latestChannelInstance: any = null;
class MockBroadcastChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
  constructor() {
    latestChannelInstance = this;
  }
}
global.BroadcastChannel = MockBroadcastChannel as any;

describe('DetachedMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders waiting state initially', () => {
    render(<DetachedMonitoring />);
    expect(screen.getByText('System Monitor')).toBeDefined();
    expect(screen.getByText('Waiting for simulation data...')).toBeDefined();
  });

  it('updates metrics when receiving message from BroadcastChannel', async () => {
    render(<DetachedMonitoring />);

    const channelInstance = latestChannelInstance;

    const mockData = {
        type: 'METRICS_UPDATE',
        deployments: [{ id: 'd1', label: 'my-dep', replicas: 3 }],
        metrics: {
            'd1': [{ cpuPercent: 40, memoryPercent: 50, timestamp: Date.now() }]
        }
    };

    await act(async () => {
        channelInstance.onmessage({ data: mockData } as MessageEvent);
    });

    expect(screen.getAllByText('my-dep')[0]).toBeDefined();
    expect(screen.getAllByText('3 Replicas')[0]).toBeDefined();
  });

  it('updates theme when receiving message and handles unknown BroadcastChannel message type', async () => {
    render(<DetachedMonitoring />);
    const channelInstance = latestChannelInstance;

    await act(async () => {
        channelInstance.onmessage({ data: { type: 'THEME_SYNC', colorMode: 'light' } } as MessageEvent);
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Test unhandled BroadcastChannel message type
    await act(async () => {
        channelInstance.onmessage({ data: { type: 'UNKNOWN_TYPE' } } as MessageEvent);
    });
  });

  it('handles Wails runtime events and renders throttled and OOM risk badges', async () => {
    const eventsOnMap: Record<string, (data: any) => void> = {};
    const mockEventsEmit = vi.fn();
    (globalThis as any).runtime = {
      EventsOn: (eventName: string, callback: (data: any) => void) => {
        eventsOnMap[eventName] = callback;
      },
      EventsEmit: mockEventsEmit,
    };

    const { unmount } = render(<DetachedMonitoring />);

    expect(mockEventsEmit).toHaveBeenCalledWith('detached-open');

    // Trigger metrics-update via runtime event
    await act(async () => {
      eventsOnMap['metrics-update'](JSON.stringify({
        deployments: [{ id: 'dep-1', label: 'throttled-dep', replicas: 2 }],
        metrics: {
          'dep-1': [{ cpuPercent: 95, memoryPercent: 90, isThrottled: true, isOOM: true }]
        }
      }));
    });

    expect(screen.getAllByText('throttled-dep')[0]).toBeDefined();
    expect(screen.getAllByText('Throttled')[0]).toBeDefined();
    expect(screen.getAllByText('OOM Risk')[0]).toBeDefined();
    // Detached monitor stays open and shows the overload state in red
    expect(screen.getByRole('alert').textContent).toContain('Resource overload detected');

    // Trigger invalid json metrics-update
    await act(async () => {
      eventsOnMap['metrics-update']('invalid-json-data');
    });

    // Trigger theme-sync via runtime event
    await act(async () => {
      eventsOnMap['theme-sync']('light');
    });

    unmount();
    expect(mockEventsEmit).toHaveBeenCalledWith('detached-closed');

    delete (globalThis as any).runtime;
  });

  it('renders deployment cards with empty metrics points and default 1 replicas in light mode', async () => {
    render(<DetachedMonitoring />);
    const channelInstance = latestChannelInstance;

    await act(async () => {
      channelInstance.onmessage({
        data: {
          type: 'THEME_SYNC',
          colorMode: 'light',
        },
      } as MessageEvent);
    });

    await act(async () => {
      channelInstance.onmessage({
        data: {
          type: 'METRICS_UPDATE',
          deployments: [{ id: 'dep-no-metrics', label: 'empty-dep' }],
          metrics: {},
        },
      } as MessageEvent);
    });

    expect(screen.getAllByText('empty-dep')[0]).toBeDefined();
    expect(screen.getAllByText('1 Replicas')[0]).toBeDefined();
  });

  it('opens context menu on right click and handles Change Theme, Close, and Escape key', async () => {
    const mockCloseWindow = vi.fn().mockResolvedValue(true);
    (getBackendGateway() as any).closeSimulationWindow = mockCloseWindow;

    render(<DetachedMonitoring />);

    const header = screen.getByText('System Monitor');
    const dashboard = header.closest('.h-screen') || header.parentElement;
    expect(dashboard).toBeDefined();

    // Context menu should not be initially visible
    expect(screen.queryByTestId('system-monitor-context-menu')).toBeNull();

    // Right-click dashboard
    await act(async () => {
      fireEvent.contextMenu(dashboard!, { clientX: 200, clientY: 150 });
    });

    // Context menu should now be visible
    expect(screen.getByTestId('system-monitor-context-menu')).toBeDefined();
    expect(screen.getByText('Change Theme')).toBeDefined();
    expect(screen.getByText('Close')).toBeDefined();

    // Test Change Theme updates app store and broadcasts THEME_SYNC to all windows
    useFlowStore.setState({ colorMode: 'dark' });
    const changeThemeBtn = screen.getByTestId('system-monitor-menu-change-theme');
    await act(async () => {
      fireEvent.click(changeThemeBtn);
    });
    expect(screen.queryByTestId('system-monitor-context-menu')).toBeNull();
    expect(useFlowStore.getState().colorMode).toBe('light');
    expect(latestChannelInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'THEME_SYNC', colorMode: 'light' })
    );

    // Right click again to test Close
    await act(async () => {
      fireEvent.contextMenu(dashboard!, { clientX: 250, clientY: 200 });
    });
    expect(screen.getByTestId('system-monitor-context-menu')).toBeDefined();

    const closeBtn = screen.getByTestId('system-monitor-menu-close');
    await act(async () => {
      fireEvent.click(closeBtn);
    });
    expect(mockCloseWindow).toHaveBeenCalled();
    expect(screen.queryByTestId('system-monitor-context-menu')).toBeNull();

    // Right click again and test Escape key closes menu
    await act(async () => {
      fireEvent.contextMenu(dashboard!, { clientX: 250, clientY: 200 });
    });
    expect(screen.getByTestId('system-monitor-context-menu')).toBeDefined();
    await act(async () => {
      fireEvent.keyDown(globalThis, { key: 'Escape' });
    });
    expect(screen.queryByTestId('system-monitor-context-menu')).toBeNull();
  });
});
