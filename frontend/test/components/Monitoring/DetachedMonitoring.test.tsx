import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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
    expect(screen.getByText('Real-time Monitoring')).toBeDefined();
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

    expect(screen.getByText('my-dep')).toBeDefined();
    expect(screen.getByText('3 Replicas')).toBeDefined();
  });

  it('updates theme when receiving message', async () => {
    render(<DetachedMonitoring />);
    const channelInstance = latestChannelInstance;

    await act(async () => {
        channelInstance.onmessage({ data: { type: 'THEME_SYNC', colorMode: 'light' } } as MessageEvent);
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
