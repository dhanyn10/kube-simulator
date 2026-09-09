import { describe, it, expect, vi } from 'vitest';
import {
  createNodeHandlers,
  getInitialData,
  resolveAutoImage,
  syncWorkloadMetadata,
  sanitizeResourceLimits,
  applyAutoImageLogic,
} from '@/store/slices/node-handlers/nodeUtils';

describe('nodeUtils', () => {
  it('executes onDelete and onRename handlers', () => {
    const deleteNodesMock = vi.fn();
    const updateNodeDataMock = vi.fn();
    const getStore = () =>
      ({
        nodes: [{ id: "node-1", type: "Pod", data: {} }],
        deleteNodes: deleteNodesMock,
        updateNodeData: updateNodeDataMock,
      } as any);

    const handlers = createNodeHandlers("node-1", getStore);

    handlers.onDelete();
    expect(deleteNodesMock).toHaveBeenCalled();

    // Test onDelete when node is not found
    deleteNodesMock.mockClear();
    const missingHandlers = createNodeHandlers("non-existent-node", getStore);
    missingHandlers.onDelete();
    expect(deleteNodesMock).not.toHaveBeenCalled();

    handlers.onRename("My New Node");
    expect(updateNodeDataMock).toHaveBeenCalledWith("node-1", { label: "my-new-node" });
  });

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

    const netData = getInitialData('Internet', 'net1', get as any);
    expect(netData.type).toBe('Internet');
    expect(netData.durationUnit).toBe('second');

    const pvcData = getInitialData('PVC', 'pvc1', get as any);
    expect(pvcData.type).toBe('PVC');

    const cmData = getInitialData('ConfigMap', 'cm1', get as any);
    expect(cmData.type).toBe('ConfigMap');

    const depData = getInitialData('Deployment', 'd1', get as any);
    expect(depData.type).toBe('Deployment');
    expect(depData.replicas).toBe(0);

    const ingData = getInitialData('Ingress', 'i1', get as any);
    expect(ingData.type).toBe('Ingress');
    expect(ingData.ingressHost).toBe('example.local');

    const roleData = getInitialData('Role', 'r1', get as any);
    expect(roleData.type).toBe('Role');
    expect(roleData.rules).toHaveLength(1);

    const secretData = getInitialData('Secret', 'sec1', get as any);
    expect(secretData.type).toBe('Secret');

    const defaultData = getInitialData('CustomType' as any, 'c1', get as any);
    expect(defaultData.type).toBe('CustomType');
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

  it('applies auto image logic and syncs workload metadata status', () => {
    const targetData = { label: "pod", status: "pending", image: "", isAutoImage: true } as any;

    const result = applyAutoImageLogic(targetData, { runtime: "nodejs" });
    expect(result.image).toBe("node:18-alpine");
    expect(result.isAutoImage).toBe(true);

    const syncedReady = syncWorkloadMetadata('Pod', { runtime: 'go' } as any);
    expect(syncedReady.status).toBe('ready');

    const syncedPending = syncWorkloadMetadata('Pod', { runtime: 'none' } as any);
    expect(syncedPending.status).toBe('pending');

    const nonWorkload = syncWorkloadMetadata('Service', { runtime: 'nodejs' } as any);
    expect(nonWorkload).toEqual({ runtime: 'nodejs' });
  });

  it('sanitizeResourceLimits keeps values in range', () => {
    const data = { replicas: 2000, minReplicas: -5, maxReplicas: 5000 };
    const sanitized = sanitizeResourceLimits(data);
    expect(sanitized.replicas).toBe(1000);
    expect(sanitized.minReplicas).toBe(1);
    expect(sanitized.maxReplicas).toBe(1000);
  });

  it('handles applyAutoImageLogic and syncWorkloadMetadata edge cases', () => {
    // Neither runtime nor webserver provided in data
    const noRtWsData = applyAutoImageLogic({ label: 'pod' } as any, { label: 'updated' });
    expect(noRtWsData).toEqual({ label: 'updated' });

    // Target has custom image (isAutoImage: false)
    const customImgTarget = { label: 'pod', image: 'custom:1.0', isAutoImage: false } as any;
    const customResult = applyAutoImageLogic(customImgTarget, { runtime: 'nodejs' });
    expect(customResult).toEqual({ runtime: 'nodejs' });

    // syncWorkloadMetadata with isAutoImage = false
    const customWorkload = syncWorkloadMetadata('Pod', { runtime: 'nodejs', isAutoImage: false, image: 'custom:2.0' } as any);
    expect(customWorkload.status).toBe('ready');
    expect(customWorkload.image).toBe('custom:2.0');

    // syncWorkloadMetadata with runtime = 'none' and webserver = 'none'
    const pendingWorkload = syncWorkloadMetadata('Deployment', { runtime: 'none', webserver: 'none' } as any);
    expect(pendingWorkload.status).toBe('pending');
  });
});
