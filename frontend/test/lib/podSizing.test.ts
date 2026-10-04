import { describe, it, expect } from 'vitest';
import { calculatePodWidth, calculatePodHeight, getPodMinimumSize, POD_MIN_DIMENSIONS } from '@/lib/podSizing';

describe('podSizing utils', () => {
  describe('calculatePodWidth', () => {
    it('returns base width for simple pod', () => {
      const data = { label: 'test-pod' };
      const width = calculatePodWidth(data, []);
      expect(width).toBeGreaterThanOrEqual(POD_MIN_DIMENSIONS.width);
    });

    it('increases width for long labels', () => {
      const data1 = { label: 'short' };
      const data2 = { label: 'this-is-a-very-long-label-for-a-pod' };
      const w1 = calculatePodWidth(data1, []);
      const w2 = calculatePodWidth(data2, []);
      expect(w2).toBeGreaterThan(w1);
    });

    it('increases width for badges', () => {
      const data = { label: 'test' };
      const w1 = calculatePodWidth(data, []);
      // badges: ['nginx', 'php']
      // badgeWidth = (5*5 + 14) + (3*5 + 14) + 4 = 39 + 29 + 4 = 72
      // baseWidth = 168
      // labelWidth = 4*7 + 16 = 44
      // horizontalPadding = 24
      // badgeWidth + 24 = 96
      // Still smaller than baseWidth (168)

      const longBadges = ['very-long-badge-name', 'another-long-one'];
      const w2 = calculatePodWidth(data, longBadges);
      expect(w2).toBeGreaterThan(w1);
    });

    it('doubles base width for mega pods by parentReplicas and accounts for multiple replicas and visible image', () => {
      const dataMega = { label: 'mega', parentReplicas: 100 };
      const widthMega = calculatePodWidth(dataMega, []);
      expect(widthMega).toBeGreaterThanOrEqual(POD_MIN_DIMENSIONS.width * 2);

      const dataMegaReplicas = { label: 'mega-rep', replicas: 100 };
      const widthMegaRep = calculatePodWidth(dataMegaReplicas, []);
      expect(widthMegaRep).toBeGreaterThanOrEqual(POD_MIN_DIMENSIONS.width * 2);

      const dataMulti = {
        label: 'multi-pod',
        replicas: 10,
        image: 'docker.io/library/nginx:1.25.0-alpine-slim',
        displaySettings: { image: true },
      };
      const widthMulti = calculatePodWidth(dataMulti, []);
      expect(widthMulti).toBeGreaterThan(POD_MIN_DIMENSIONS.width);

      const dataImageHidden = {
        label: 'hidden-img',
        image: 'nginx:latest',
        displaySettings: { image: false },
      };
      const widthHidden = calculatePodWidth(dataImageHidden, []);
      expect(widthHidden).toBe(POD_MIN_DIMENSIONS.width);
    });
  });

  describe('calculatePodHeight', () => {
    it('returns base height for simple pod', () => {
      const data = { type: 'Pod' as any };
      const height = calculatePodHeight(data, 168, [], false);
      expect(height).toBeGreaterThanOrEqual(POD_MIN_DIMENSIONS.height);
    });

    it('increases height for resource limits', () => {
      const data1 = { type: 'Pod' as any };
      const data2 = { type: 'Pod' as any, cpuLimit: '100m', memoryLimit: '128Mi' };
      const h1 = calculatePodHeight(data1, 168, [], false);
      const h2 = calculatePodHeight(data2, 168, [], false);
      expect(h2).toBeGreaterThan(h1);
    });

    it('increases height for dashed progress, badges, and image display', () => {
      const dataWithDashed = { type: 'Pod' as any, parentReplicas: 5, image: 'nginx:latest' };
      const height = calculatePodHeight(dataWithDashed, 168, ['runtime-go'], false);
      expect(height).toBeGreaterThan(POD_MIN_DIMENSIONS.height);

      const heightMega = calculatePodHeight(dataWithDashed, 168, ['runtime-go'], true);
      expect(heightMega).toBeGreaterThan(height);
    });

    it('covers showDashedProgress false for child Pod with parentReplicas <= 3, and displaySettings.resources = false', () => {
      const childPodSmallReplicas = {
        type: 'Pod' as any,
        parentId: 'dep-1',
        parentReplicas: 2,
        replicas: 1,
        cpuLimit: '100m',
        displaySettings: { resources: false },
      };
      const h = calculatePodHeight(childPodSmallReplicas, 168, [], false);
      expect(h).toBe(POD_MIN_DIMENSIONS.height);
    });

    it('covers replicas > 1 with parentId defined, and memoryLimit without cpuLimit', () => {
      // 1. Replicas > 1 with parentId defined -> !data.parentId evaluates to false
      const childPodWithParent = {
        type: 'Pod' as any,
        parentId: 'dep-2',
        replicas: 3,
        parentReplicas: 1,
      };
      const h1 = calculatePodHeight(childPodWithParent, 168, [], false);
      expect(h1).toBe(POD_MIN_DIMENSIONS.height);

      // 2. memoryLimit defined without cpuLimit -> evaluates false || true branch
      const podMemoryOnly = {
        type: 'Pod' as any,
        memoryLimit: '256Mi',
      };
      const h2 = calculatePodHeight(podMemoryOnly, 168, [], false);
      expect(h2).toBeGreaterThan(POD_MIN_DIMENSIONS.height);
    });
  });

  describe('getPodMinimumSize', () => {
    it('calculates both dimensions with default empty parameter and webserver badge', () => {
      const defaultSize = getPodMinimumSize();
      expect(defaultSize.width).toBeGreaterThan(0);
      expect(defaultSize.height).toBeGreaterThan(0);

      const sizeWithWebserver = getPodMinimumSize({
        label: 'web-app',
        runtime: 'nodejs',
        webserver: 'nginx',
        displaySettings: { runtime: true, webserver: true },
      });
      expect(sizeWithWebserver.width).toBeGreaterThan(0);
      expect(sizeWithWebserver.height).toBeGreaterThan(0);

      const sizeWithNone = getPodMinimumSize({
        label: 'app',
        runtime: 'none',
        webserver: 'none',
      });
      expect(sizeWithNone.width).toBeGreaterThan(0);
      expect(sizeWithNone.height).toBeGreaterThan(0);

      // Explicit false displaySettings for runtime/webserver and falsy runtime/webserver values
      const sizeDisabledBadges = getPodMinimumSize({
        label: 'app-disabled',
        runtime: 'go',
        webserver: 'apache',
        displaySettings: { runtime: false, webserver: false },
      });
      expect(sizeDisabledBadges.width).toBeGreaterThan(0);

      const sizeFalsyValues = getPodMinimumSize({
        label: 'app-falsy',
        runtime: '',
        webserver: '',
        displaySettings: { runtime: true, webserver: true },
      });
      expect(sizeFalsyValues.width).toBeGreaterThan(0);
    });
  });
});
