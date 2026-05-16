import { describe, it, expect } from 'vitest';
import { syncWorkloadMetadata, resolveAutoImage, sanitizeResourceLimits } from '@/store/slices/node-handlers/nodeUtils';

describe('nodeUtils', () => {
  describe('syncWorkloadMetadata', () => {
    it('returns ready for workloads with runtime', () => {
      const data: any = { runtime: 'nodejs' };
      expect(syncWorkloadMetadata('Pod', data).status).toBe('ready');
    });

    it('returns pending for workloads without runtime or webserver', () => {
      const data: any = { runtime: 'none', webserver: 'none' };
      expect(syncWorkloadMetadata('Pod', data).status).toBe('pending');
    });

    it('sets correct auto-image', () => {
      const data: any = { runtime: 'nodejs', isAutoImage: true };
      expect(syncWorkloadMetadata('Pod', data).image).toBe('node:18-alpine');
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
