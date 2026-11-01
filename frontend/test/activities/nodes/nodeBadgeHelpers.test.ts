import { describe, it, expect } from 'vitest';
import { getPodBadgeVisibility } from '@/activities/nodes/nodeBadgeHelpers';

describe('nodeBadgeHelpers', () => {
  it('returns false for non-pod data or missing display settings', () => {
    expect(getPodBadgeVisibility(null)).toEqual({
      showRuntime: false,
      showWebserver: false,
      showImage: false,
      showNodeBadge: false,
      hasAnyBadge: false,
    });

    expect(getPodBadgeVisibility({ type: 'Deployment' })).toEqual({
      showRuntime: false,
      showWebserver: false,
      showImage: false,
      showNodeBadge: false,
      hasAnyBadge: false,
    });
  });

  it('evaluates runtime and webserver visibility correctly for Pods while excluding redundant image badge', () => {
    const podData = {
      type: 'Pod',
      runtime: 'nodejs',
      webserver: 'nginx',
      image: 'nginx:alpine',
      displaySettings: { runtime: true, webserver: true, image: true, assignedNode: true },
    };

    const result = getPodBadgeVisibility(podData);
    expect(result.showRuntime).toBe(true);
    expect(result.showWebserver).toBe(true);
    expect(result.showImage).toBe(false);
    expect(result.showNodeBadge).toBe(true);
    expect(result.hasAnyBadge).toBe(true);
  });

  it('hides node badge when displaySettings.assignedNode is false', () => {
    const podData = {
      type: 'Pod',
      displaySettings: { runtime: false, webserver: false, assignedNode: false },
    };
    const result = getPodBadgeVisibility(podData);
    expect(result.showNodeBadge).toBe(false);
    expect(result.hasAnyBadge).toBe(false);
  });

  it('hides node badge for stacked pods when replicas > 3', () => {
    const stackedPodData = {
      type: 'Pod',
      parentReplicas: 4,
      displaySettings: { assignedNode: true },
    };
    const result = getPodBadgeVisibility(stackedPodData);
    expect(result.showNodeBadge).toBe(false);
  });
});
