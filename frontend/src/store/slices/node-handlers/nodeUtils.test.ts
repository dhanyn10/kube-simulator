import { describe, it, expect } from 'vitest';
import { evaluateStatus, resolveAutoImage, sanitizeResourceLimits } from './nodeUtils';
import { K8sNodeData } from '../../../types';

describe('nodeUtils', () => {
  describe('evaluateStatus', () => {
    it('returns ready for workloads with runtime', () => {
      const data: any = { runtime: 'nodejs' };
      expect(evaluateStatus('Pod', data)).toBe('ready');
    });

    it('returns pending for workloads without runtime or webserver', () => {
      const data: any = { runtime: 'none', webserver: 'none' };
      expect(evaluateStatus('Pod', data)).toBe('pending');
    });

    it('returns ready for non-workload nodes by default', () => {
      const data: any = {};
      expect(evaluateStatus('Service', data)).toBe('ready');
    });
  });

  describe('resolveAutoImage', () => {
    it('returns correct image for nodejs', () => {
      expect(resolveAutoImage('nodejs', 'none')).toBe('node:18-alpine');
    });

    it('returns nginx for nginx webserver', () => {
      expect(resolveAutoImage('none', 'nginx')).toBe('nginx:latest');
    });
  });

  describe('sanitizeResourceLimits', () => {
    it('limits replicas between 0 and 1000', () => {
      expect(sanitizeResourceLimits({ replicas: 2000 }).replicas).toBe(1000);
      expect(sanitizeResourceLimits({ replicas: -10 }).replicas).toBe(0);
    });
  });
});
