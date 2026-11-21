import { describe, it, expect } from 'vitest';
import {
  clampReplicaRange,
  HPA_DEFAULT_MAX_REPLICAS,
  HPA_TARGET_MAX_PERCENT,
  HPA_TARGET_MIN_PERCENT,
  resolveMissingLimits,
} from '@/activities/config/hpaConfigHelpers';

describe('hpaConfigHelpers', () => {
  describe('clampReplicaRange', () => {
    it('never re-applies the creation default while editing', () => {
      expect(HPA_DEFAULT_MAX_REPLICAS).toBe(10);
      expect(clampReplicaRange(2, 0)).toEqual({ minReplicas: 2, maxReplicas: 2 });
    });

    it('raises max when min moves above it', () => {
      expect(clampReplicaRange(8, 2)).toEqual({ minReplicas: 8, maxReplicas: 8 });
    });

    it('lowers min when max moves below it', () => {
      expect(clampReplicaRange(5, 2, 'max')).toEqual({ minReplicas: 2, maxReplicas: 2 });
    });

    it('never allows a min below 1', () => {
      expect(clampReplicaRange(0, 5)).toEqual({ minReplicas: 1, maxReplicas: 5 });
    });

    it('normalizes fractional inputs', () => {
      expect(clampReplicaRange(2.8, 6.4)).toEqual({ minReplicas: 2, maxReplicas: 6 });
    });
  });

  describe('resolveMissingLimits', () => {
    it('fills both limits from requests when available', () => {
      expect(resolveMissingLimits({ cpuRequest: '200m', memoryRequest: '128Mi' } as any)).toEqual({
        cpuLimit: '200m',
        memoryLimit: '128Mi',
      });
    });

    it('falls back to safe defaults when requests are absent', () => {
      expect(resolveMissingLimits()).toEqual({ cpuLimit: '500m', memoryLimit: '256Mi' });
    });

    it('only touches the missing limit', () => {
      expect(resolveMissingLimits({ cpuLimit: '500m', memoryRequest: '128Mi' } as any)).toEqual({
        memoryLimit: '128Mi',
      });
    });

    it('returns no updates when both limits already exist', () => {
      expect(resolveMissingLimits({ cpuLimit: '500m', memoryLimit: '256Mi' } as any)).toEqual({});
    });
  });

  it('keeps target percentages in the same 1-100 range as the modal', () => {
    expect(HPA_TARGET_MIN_PERCENT).toBe(1);
    expect(HPA_TARGET_MAX_PERCENT).toBe(100);
  });
});
