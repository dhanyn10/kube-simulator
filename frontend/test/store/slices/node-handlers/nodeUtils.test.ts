import { describe, it, expect } from 'vitest';
import { getInitialData, resolveAutoImage, syncWorkloadMetadata, sanitizeResourceLimits } from '@/store/slices/node-handlers/nodeUtils';

describe('nodeUtils', () => {
  it('getInitialData returns correct defaults for various types', () => {
    const get = () => ({ nodes: [] });

    const svcData = getInitialData('Service', 's1', get as any);
    expect(svcData.port).toBe(80);
    expect(svcData.targetPort).toBe(80);

    const podData = getInitialData('Pod', 'p1', get as any);
    expect(podData.replicas).toBe(1);
    expect(podData.image).toBe('nginx:latest');

    const hpaData = getInitialData('HPA', 'h1', get as any);
    expect(hpaData.maxReplicas).toBe(10);
    expect(hpaData.targetCPU).toBe(50);
  });

  it('resolveAutoImage returns correct images for runtimes', () => {
    expect(resolveAutoImage('nodejs', 'none')).toBe('node:18-alpine');
    expect(resolveAutoImage('go', 'none')).toBe('golang:1.21-alpine');
    expect(resolveAutoImage('python', 'none')).toBe('python:3.11-slim');
    expect(resolveAutoImage('java', 'none')).toBe('openjdk:17-jdk-slim');
    expect(resolveAutoImage('php', 'nginx')).toBe('php:8.2-fpm-alpine');
    expect(resolveAutoImage('php', 'apache')).toBe('php:8.2-apache');
    expect(resolveAutoImage('php', 'none')).toBe('php:8.2-cli-alpine');
    expect(resolveAutoImage('none', 'nginx')).toBe('nginx:latest');
    expect(resolveAutoImage('none', 'apache')).toBe('httpd:latest');
    expect(resolveAutoImage('none', 'none')).toBe('nginx:latest');
  });

  it('syncWorkloadMetadata updates status and auto-image', () => {
    const data = { runtime: 'nodejs', isAutoImage: true };
    const synced = syncWorkloadMetadata('Pod', data as any);
    expect(synced.status).toBe('ready');
    expect(synced.image).toBe('node:18-alpine');

    const pending = syncWorkloadMetadata('Pod', { runtime: 'none' } as any);
    expect(pending.status).toBe('pending');
  });

  it('sanitizeResourceLimits keeps values in range', () => {
      const data = { replicas: 2000, minReplicas: -5 };
      const sanitized = sanitizeResourceLimits(data);
      expect(sanitized.replicas).toBe(1000);
      expect(sanitized.minReplicas).toBe(1);
  });
});
