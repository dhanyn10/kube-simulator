import { describe, it, expect } from 'vitest';
import {
  formatNumberCompact,
  calculateMaxTrafficRange,
  generateTrafficRulerTicks,
  isInternetConnectionRed
} from '@/activities/config/internetConfigHelpers';

describe('internetConfigHelpers', () => {
  it('formats compact numbers properly', () => {
    expect(formatNumberCompact(500)).toBe('500');
    expect(formatNumberCompact(1000)).toBe('1k');
    expect(formatNumberCompact(2500)).toBe('2.5k');
    expect(formatNumberCompact(1000000)).toBe('1M');
  });

  it('calculates max traffic range limits dynamically', () => {
    expect(calculateMaxTrafficRange(500)).toBe(1000);
    expect(calculateMaxTrafficRange(1000)).toBe(2000);
    expect(calculateMaxTrafficRange(2500)).toBe(4000);
  });

  it('generates 4-part traffic ruler ticks', () => {
    const ticks = generateTrafficRulerTicks(1000);
    expect(ticks).toHaveLength(5);
    expect(ticks[0].val).toBe(1);
    expect(ticks[4].val).toBe(1000);
  });

  it('evaluates whether internet node connection is red', () => {
    const nodeId = 'internet-1';

    // No outgoing edges -> true (red)
    expect(isInternetConnectionRed(nodeId, [], [])).toBe(true);

    // Edge has validation error -> true
    const errorEdges = [{ id: 'e1', source: 'internet-1', target: 'pod-1', data: { validationError: 'error' } }];
    expect(isInternetConnectionRed(nodeId, errorEdges, [])).toBe(true);

    // Target pod is not ready -> true
    const unreadyEdges = [{ id: 'e1', source: 'internet-1', target: 'pod-1' }];
    const unreadyNodes = [{ id: 'pod-1', type: 'Pod', data: { status: 'pending' } }];
    expect(isInternetConnectionRed(nodeId, unreadyEdges, unreadyNodes)).toBe(true);

    // Healthy target -> false
    const healthyNodes = [{ id: 'pod-1', type: 'Pod', data: { status: 'ready' } }];
    expect(isInternetConnectionRed(nodeId, unreadyEdges, healthyNodes)).toBe(false);
  });
});
