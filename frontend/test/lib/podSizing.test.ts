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

      const dataImageExplicitlyFalse = {
        label: 'hidden-img-2',
        image: '',
        displaySettings: { image: true },
      };
      const widthNoImage = calculatePodWidth(dataImageExplicitlyFalse, []);
      expect(widthNoImage).toBe(POD_MIN_DIMENSIONS.width);
    });
  });

  describe('calculatePodHeight', () => {
    it('returns base height for simple pod', () => {
      const data = { type: 'Pod' as any };
      const height = calculatePodHeight(data, 168, [], false);
      expect(height).toBeGreaterThanOrEqual(POD_MIN_DIMENSIONS.height);
    });

    it('increases height for resource limits', () => {
      const data1 = { type: 'Pod' as any, displaySettings: { restartPolicy: false } };
      const data2 = { type: 'Pod' as any, displaySettings: { restartPolicy: false }, cpuLimit: '100m', memoryLimit: '128Mi' };
      const h1 = calculatePodHeight(data1, 168, [], false);
      const h2 = calculatePodHeight(data2, 168, [], false);
      expect(h2).toBeGreaterThan(h1);
    });

    it('increases height for restart policy and attached resources', () => {
      const base = { type: 'Pod' as any, displaySettings: { restartPolicy: false } };
      const withRestart = { type: 'Pod' as any, displaySettings: { restartPolicy: true }, restartPolicy: 'Always' as const };
      const withAttached = { type: 'Pod' as any, displaySettings: { restartPolicy: false }, resourceLimits: [{ id: 'rl-1', cpuLimit: '1000m' }] };

      const hBase = calculatePodHeight(base, 168, [], false);
      const hRestart = calculatePodHeight(withRestart, 168, [], false);
      const hAttached = calculatePodHeight(withAttached, 168, [], false);

      expect(hRestart).toBeGreaterThan(hBase);
      expect(hAttached).toBeGreaterThan(hBase);
    });

    it('increases height proportionally when total attached items exceeds 3', () => {
      const base = { type: 'Pod' as any, displaySettings: { restartPolicy: false } };
      const with1Attached = { type: 'Pod' as any, displaySettings: { restartPolicy: false }, resourceLimits: [{ id: 'rl-1' }] };
      const with4Attached = {
        type: 'Pod' as any,
        displaySettings: { restartPolicy: false },
        roles: [{ id: 'r1' }],
        configMaps: [{ id: 'cm1' }],
        secrets: [{ id: 's1' }],
        hpas: [{ id: 'h1' }],
      };

      const hBase = calculatePodHeight(base, 168, [], false);
      const h1Attached = calculatePodHeight(with1Attached, 168, [], false);
      const h4Attached = calculatePodHeight(with4Attached, 168, [], false);

      expect(h1Attached).toBe(hBase + 36);
      expect(h4Attached).toBe(hBase + 72);
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
        displaySettings: { resources: false, restartPolicy: false },
      };
      const h = calculatePodHeight(childPodSmallReplicas, 168, [], false);
      expect(h).toBe(POD_MIN_DIMENSIONS.height);

      // Standalone pod without parentId and replicas = 0 -> data.replicas || 1 evaluates 1, 1 > 1 is false
      const standaloneSingleReplica = {
        type: 'Pod' as any,
        parentId: undefined,
        replicas: 0,
        displaySettings: { restartPolicy: false },
      };
      const hSingle = calculatePodHeight(standaloneSingleReplica, 168, [], false);
      expect(hSingle).toBe(POD_MIN_DIMENSIONS.height);

      // Standalone pod without parentId and replicas = undefined -> data.replicas || 1 evaluates 1
      const standaloneUndefinedReplicas = {
        type: 'Pod' as any,
        parentId: undefined,
        replicas: undefined,
        displaySettings: { restartPolicy: false },
      };
      const hUndef = calculatePodHeight(standaloneUndefinedReplicas, 168, [], false);
      expect(hUndef).toBe(POD_MIN_DIMENSIONS.height);

      // Non-Pod type (e.g. Deployment or undefined) -> data.type === 'Pod' evaluates to false
      const nonPodData = {
        type: 'Deployment' as any,
        replicas: 5,
        parentId: undefined,
        displaySettings: { restartPolicy: false },
      };
      const hNonPod = calculatePodHeight(nonPodData, 168, [], false);
      expect(hNonPod).toBe(POD_MIN_DIMENSIONS.height);
    });

    it('covers replicas > 1 with parentId defined, and memoryLimit without cpuLimit', () => {
      // 1. Replicas > 1 with parentId defined -> !data.parentId evaluates to false
      const childPodWithParent = {
        type: 'Pod' as any,
        parentId: 'dep-2',
        replicas: 3,
        parentReplicas: 1,
        displaySettings: { restartPolicy: false },
      };
      const h1 = calculatePodHeight(childPodWithParent, 168, [], false);
      expect(h1).toBe(POD_MIN_DIMENSIONS.height);

      // 2. memoryLimit defined without cpuLimit -> evaluates false || true branch
      const podMemoryOnly = {
        type: 'Pod' as any,
        memoryLimit: '256Mi',
        displaySettings: { restartPolicy: false },
      };
      const h2 = calculatePodHeight(podMemoryOnly, 168, [], false);
      expect(h2).toBeGreaterThan(POD_MIN_DIMENSIONS.height);
    });

    it('covers cpuRequest and memoryRequest without limits, and standalone pod with replicas > 1 for dashed progress', () => {
      const base = { type: 'Pod' as any, displaySettings: { restartPolicy: false } };
      const podCpuReq = { type: 'Pod' as any, displaySettings: { restartPolicy: false }, cpuRequest: '250m' };
      const podMemReq = { type: 'Pod' as any, displaySettings: { restartPolicy: false }, memoryRequest: '512Mi' };

      const hBase = calculatePodHeight(base, 168, [], false);
      const hCpu = calculatePodHeight(podCpuReq, 168, [], false);
      const hMem = calculatePodHeight(podMemReq, 168, [], false);

      expect(hCpu).toBeGreaterThan(hBase);
      expect(hMem).toBeGreaterThan(hBase);

      const standaloneMultiReplica = {
        type: 'Pod' as any,
        replicas: 2,
        parentId: undefined,
        displaySettings: { restartPolicy: false },
      };
      const hDashed = calculatePodHeight(standaloneMultiReplica, 168, [], false);
      expect(hDashed).toBeGreaterThan(POD_MIN_DIMENSIONS.height);
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

  it('covers uncovered conditions in podSizing: image width clamping, isMegaPod base height boost, and small width content height calculation', () => {
    // 1. Image string length lower bound clamping (148) with short string ('a'), middle width ('a'.repeat(30)), and upper bound clamping (320) with long string ('a'.repeat(100))
    const shortImageWidth = calculatePodWidth({ image: 'a', displaySettings: { image: true } }, []);
    expect(shortImageWidth).toBe(172); // 148 + 24 = 172

    const midImageWidth = calculatePodWidth({ image: 'a'.repeat(30), displaySettings: { image: true } }, []);
    expect(midImageWidth).toBe(205); // Math.ceil(181 + 24) = 205

    const longImageWidth = calculatePodWidth({ image: 'a'.repeat(100), displaySettings: { image: true } }, []);
    expect(longImageWidth).toBe(344); // 320 + 24 = 344

    // 2. calculatePodBaseHeight when showDashedProgress is true and isMegaPod is true (adds 120 instead of 16 to height)
    const megaDashedPod = {
      type: 'Pod' as any,
      parentReplicas: 100,
      displaySettings: { restartPolicy: false },
    };
    const heightMegaDashed = calculatePodHeight(megaDashedPod, 336, [], true);
    expect(heightMegaDashed).toBe(200); // 80 + 120 = 200

    // 3. calculatePodContentHeight with width < 24 (e.g. width = 10) to test Math.max(10, Math.floor((width - 24) / 5.5)) lower bound
    const narrowPodWithImage = {
      image: 'nginx:latest',
      displaySettings: { image: true },
    };
    const sizeNarrow = getPodMinimumSize(narrowPodWithImage);
    expect(sizeNarrow.height).toBeGreaterThan(POD_MIN_DIMENSIONS.height);
  });
});
