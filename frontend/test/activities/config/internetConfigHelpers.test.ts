import { describe, it, expect } from 'vitest';
import {
  formatNumberCompact,
  calculateMaxTrafficRange,
  generateTrafficRulerTicks,
  isInternetConnectionRed
} from '@/activities/config/internetConfigHelpers';

describe('internetConfigHelpers', () => {
  it('formats compact numbers properly including decimals', () => {
    expect(formatNumberCompact(500)).toBe('500');
    expect(formatNumberCompact(1000)).toBe('1k');
    expect(formatNumberCompact(2500)).toBe('2.5k');
    expect(formatNumberCompact(1000000)).toBe('1M');
    expect(formatNumberCompact(1500000)).toBe('1.5M');
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

    // A Service without a selector target is invalid, matching the engine's health rule.
    const serviceNodes = [{ id: 'pod-1', type: 'Service', data: { status: 'ready' } }];
    expect(isInternetConnectionRed(nodeId, unreadyEdges, serviceNodes)).toBe(true);
  });

  it('shares the engine rule: one ready replica keeps a controller healthy, but multi-hop failures are red', () => {
    const nodeId = 'internet-1';
    const edges = [
      { id: 'e1', source: 'internet-1', target: 'svc-1' },
      { id: 'e2', source: 'svc-1', target: 'dep-1' },
    ];

    const partiallyReadyNodes = [
      { id: 'svc-1', type: 'Service', data: { selector: 'web', serviceType: 'ClusterIP' } },
      { id: 'dep-1', type: 'Deployment', data: { label: 'web', status: 'ready' } },
      { id: 'pod-1', type: 'Pod', parentId: 'dep-1', data: { status: 'ready' } },
      { id: 'pod-2', type: 'Pod', parentId: 'dep-1', data: { status: 'pending' } },
    ];
    expect(isInternetConnectionRed(nodeId, edges, partiallyReadyNodes)).toBe(false);

    const allUnreadyNodes = partiallyReadyNodes.map((node) =>
      node.id === 'pod-1' ? { ...node, data: { ...node.data, status: 'pending' } } : node
    );
    expect(isInternetConnectionRed(nodeId, edges, allUnreadyNodes)).toBe(true);
  });
});
