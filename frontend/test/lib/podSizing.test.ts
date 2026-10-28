import { describe, it, expect } from 'vitest';
import { calculatePodWidth, calculatePodHeight, getPodMinimumSize, calculatePodConfigMapVarsHeight, POD_MIN_DIMENSIONS } from '@/lib/podSizing';

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
        type: 'Pod' as const,
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

    it('covers child pod with parentReplicas > 3 and replicas = 1 where isStackedCard is false', () => {
      const dataChildSingleReplica = {
        type: 'Pod' as const,
        label: 'child-single',
        parentReplicas: 11,
        replicas: 1,
      };
      const width = calculatePodWidth(dataChildSingleReplica, []);
      expect(width).toBe(POD_MIN_DIMENSIONS.width);
    });

    it('accounts for inherited parent configMaps in pod width calculation', () => {
      const parentData = {
        configMaps: [{ id: 'cm-long', name: 'long-cm', configData: [{ key: 'VERY_LONG_CONFIGURATION_KEY_NAME_FOR_TEST', value: 'VERY_LONG_CONFIGURATION_VALUE_STRING_FOR_TEST' }] }],
      };
      const podData = { label: 'short-pod', parentId: 'dep-1' };
      const widthWithoutParent = calculatePodWidth(podData, []);
      const widthWithParent = calculatePodWidth(podData, [], parentData);
      expect(widthWithParent).toBeGreaterThan(widthWithoutParent);
    });

    it('skips configMap without configData and inherits parent configMaps when data.configMaps is an empty array', () => {
      const parentData = {
        configMaps: [
          { id: 'cm-empty', name: 'empty-cm' } as any,
          { id: 'cm-long', name: 'long-cm', configData: [{ key: 'VERY_LONG_CONFIGURATION_KEY_NAME_FOR_TEST', value: 'VERY_LONG_CONFIGURATION_VALUE_STRING_FOR_TEST' }] },
        ],
      };
      // data.configMaps is truthy but length is 0, so it falls back to parentData.configMaps
      const podData = { label: 'short-pod', parentId: 'dep-1', configMaps: [] };
      const widthWithParent = calculatePodWidth(podData, [], parentData);
      expect(widthWithParent).toBeGreaterThan(POD_MIN_DIMENSIONS.width);

      // displaySettings.configMapVars === false directly on pod
      const widthCmHidden = calculatePodWidth({
        configMaps: parentData.configMaps,
        displaySettings: { configMapVars: false },
      }, []);
      expect(widthCmHidden).toBe(POD_MIN_DIMENSIONS.width);

      // displaySettings.configMapVars === false inherited from parentData
      const widthParentCmHidden = calculatePodWidth({
        parentId: 'dep-1',
      }, [], {
        configMaps: parentData.configMaps,
        displaySettings: { configMapVars: false },
      });
      expect(widthParentCmHidden).toBe(POD_MIN_DIMENSIONS.width);
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

    it('covers cpuRequest and memoryRequest without limits, and standalone pod with replicas > 3 for dashed progress', () => {
      const base = { type: 'Pod' as any, displaySettings: { restartPolicy: false } };
      const podCpuReq = { type: 'Pod' as any, displaySettings: { restartPolicy: false }, cpuRequest: '250m' };
      const podMemReq = { type: 'Pod' as any, displaySettings: { restartPolicy: false }, memoryRequest: '512Mi' };

      const hBase = calculatePodHeight(base, 168, [], false);
      const hCpu = calculatePodHeight(podCpuReq, 168, [], false);
      const hMem = calculatePodHeight(podMemReq, 168, [], false);

      expect(hCpu).toBeGreaterThan(hBase);
      expect(hMem).toBeGreaterThan(hBase);

      const standaloneTwoReplicas = {
        type: 'Pod' as any,
        replicas: 2,
        parentId: undefined,
        displaySettings: { restartPolicy: false },
      };
      const hTwo = calculatePodHeight(standaloneTwoReplicas, 168, [], false);
      expect(hTwo).toBe(POD_MIN_DIMENSIONS.height);

      const standaloneMultiReplica = {
        type: 'Pod' as any,
        replicas: 4,
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

    it('computes larger dimensions when inheriting parent configMaps', () => {
      const parentData = {
        configMaps: [{ id: 'cm-1', name: 'cm-1', configData: [{ key: 'K1', value: 'V1' }, { key: 'K2', value: 'V2' }] }],
      };
      const podData = { type: 'Pod' as const };
      const sizeWithout = getPodMinimumSize(podData);
      const sizeWith = getPodMinimumSize(podData, parentData);
      expect(sizeWith.height).toBeGreaterThan(sizeWithout.height);
      expect(sizeWith.height).toBe(sizeWithout.height + 12 + 2 * 18);
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

  it('covers showDashedProgress and individual resource settings condition branches', () => {
    // 1. showDashedProgress: data.type === 'Pod', parentReplicas <= 3, replicas > 3, parentId defined -> evaluates false
    const podWithParentAndMultiReplicas = {
      type: 'Pod' as const,
      parentReplicas: 2,
      replicas: 4,
      parentId: 'dep-123',
      displaySettings: { restartPolicy: false },
    };
    const hParentMulti = calculatePodHeight(podWithParentAndMultiReplicas, 168, [], false);
    expect(hParentMulti).toBe(POD_MIN_DIMENSIONS.height);

    // 2. showDashedProgress: data.type === 'Pod', parentReplicas <= 3, replicas > 3, parentId undefined -> evaluates true
    const standaloneMulti = {
      type: 'Pod' as const,
      parentReplicas: 2,
      replicas: 4,
      parentId: undefined,
      displaySettings: { restartPolicy: false },
    };
    const hStandaloneMulti = calculatePodHeight(standaloneMulti, 168, [], false);
    expect(hStandaloneMulti).toBeGreaterThan(POD_MIN_DIMENSIONS.height);

    // 2b. showDashedProgress: data.type === 'Pod', parentReplicas <= 3, replicas <= 3, parentId undefined -> evaluates false
    const standaloneLowReplica = {
      type: 'Pod' as const,
      parentReplicas: 2,
      replicas: 3,
      parentId: undefined,
      displaySettings: { restartPolicy: false },
    };
    const hStandaloneLow = calculatePodHeight(standaloneLowReplica, 168, [], false);
    expect(hStandaloneLow).toBe(POD_MIN_DIMENSIONS.height);

    // 3. Each individual resource limit/request field evaluated when others are absent
    const basePod = { type: 'Pod' as const, displaySettings: { restartPolicy: false } };
    const hBase = calculatePodHeight(basePod, 168, [], false);

    const hCpuLimit = calculatePodHeight({ ...basePod, cpuLimit: '500m' }, 168, [], false);
    const hMemLimit = calculatePodHeight({ ...basePod, memoryLimit: '512Mi' }, 168, [], false);
    const hCpuReq = calculatePodHeight({ ...basePod, cpuRequest: '250m' }, 168, [], false);
    const hMemReq = calculatePodHeight({ ...basePod, memoryRequest: '256Mi' }, 168, [], false);

    expect(hCpuLimit).toBe(118);
    expect(hMemLimit).toBe(118);
    expect(hCpuReq).toBe(118);
    expect(hMemReq).toBe(118);

    // 4. getPodMinimumSize badge display toggles for runtime and webserver
    const podWithWebserverOnly = getPodMinimumSize({
      webserver: 'nginx',
      displaySettings: { webserver: true, runtime: false },
    });
    expect(podWithWebserverOnly.width).toBeGreaterThan(0);

    const podWithNoneBadges = getPodMinimumSize({
      runtime: 'none',
      webserver: 'none',
      displaySettings: { webserver: true, runtime: true },
    });
    expect(podWithNoneBadges.width).toBeGreaterThan(0);
  });

  describe('calculatePodConfigMapVarsHeight', () => {
    it('returns 0 when configMaps is undefined, empty, or displaySettings.configMapVars is false', () => {
      expect(calculatePodConfigMapVarsHeight({})).toBe(0);
      expect(calculatePodConfigMapVarsHeight({ configMaps: [] })).toBe(0);
      expect(calculatePodConfigMapVarsHeight({ configMaps: [{ id: 'cm1', name: 'cm', configData: [{ key: 'K', value: 'V' }] }], displaySettings: { configMapVars: false } })).toBe(0);
    });

    it('calculates correct height for 1-3 items and > 3 items', () => {
      const cm1 = { id: 'cm1', name: 'cm', configData: [{ key: 'K1', value: 'V1' }] };
      const h1 = calculatePodConfigMapVarsHeight({ configMaps: [cm1] });
      expect(h1).toBe(12 + 1 * 18);

      const cm5 = { id: 'cm2', name: 'cm', configData: [{ key: '1', value: '1' }, { key: '2', value: '2' }, { key: '3', value: '3' }, { key: '4', value: '4' }] };
      const h5 = calculatePodConfigMapVarsHeight({ configMaps: [cm5] });
      expect(h5).toBe(12 + 3 * 18 + 14);
    });

    it('inherits configMaps from parentData when podData has no direct configMaps', () => {
      const parentData = {
        configMaps: [{ id: 'cm-parent', name: 'parent-cm', configData: [{ key: 'PORT', value: '8080' }, { key: 'ENV', value: 'production' }] }],
      };
      const podData = { type: 'Pod' as const, parentId: 'dep-1' };
      const height = calculatePodConfigMapVarsHeight(podData, parentData);
      expect(height).toBe(12 + 2 * 18);

      const parentHidden = { ...parentData, displaySettings: { configMapVars: false } };
      expect(calculatePodConfigMapVarsHeight(podData, parentHidden)).toBe(0);
    });
  });
});
