import { describe, it, expect } from 'vitest';
import { getPodBadgeVisibility } from '@/activity/nodes/nodeBadgeHelpers';

describe('nodeBadgeHelpers', () => {
  it('returns false for non-pod data or missing display settings', () => {
    expect(getPodBadgeVisibility(null)).toEqual({
      showRuntime: false,
      showWebserver: false,
      showImage: false,
      hasAnyBadge: false,
    });

    expect(getPodBadgeVisibility({ type: 'Deployment' })).toEqual({
      showRuntime: false,
      showWebserver: false,
      showImage: false,
      hasAnyBadge: false,
    });
  });

  it('evaluates runtime, webserver, and image visibility correctly for Pods', () => {
    const podData = {
      type: 'Pod',
      runtime: 'nodejs',
      webserver: 'nginx',
      image: 'nginx:alpine',
      displaySettings: { runtime: true, webserver: true, image: true },
    };

    const result = getPodBadgeVisibility(podData);
    expect(result.showRuntime).toBe(true);
    expect(result.showWebserver).toBe(true);
    expect(result.showImage).toBe(true);
    expect(result.hasAnyBadge).toBe(true);
  });
});
