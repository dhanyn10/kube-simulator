import { describe, it, expect, vi } from 'vitest';
import {
  createNodeHandlers,
  getInitialData,
  resolveAutoImage,
  syncWorkloadMetadata,
  sanitizeResourceLimits,
  applyAutoImageLogic,
  ensureUniqueResourceName,
  isDuplicateResourceName,
  resolveTargetInfo,
} from '@/store/handlers/nodeUtils';

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
    expect(updateNodeDataMock).toHaveBeenCalledWith("node-1", { baseName: "my-new-node", label: "my-new-node" });

    // Test onRename on Pod with Deployment parent
    updateNodeDataMock.mockClear();
    const storeWithParent = () =>
      ({
        nodes: [
          { id: "dep-1", type: "Deployment", data: { label: "old-dep" } },
          { id: "pod-1", type: "Pod", parentId: "dep-1", data: {} },
        ],
        updateNodeData: updateNodeDataMock,
      } as any);

    const podParentHandlers = createNodeHandlers("pod-1", storeWithParent);
    podParentHandlers.onRename("renamed-app");
    expect(updateNodeDataMock).toHaveBeenCalledWith("dep-1", { label: "renamed-app" });

    // Test onRename on Pod with ReplicaSet parent
    updateNodeDataMock.mockClear();
    const storeWithReplicaSet = () =>
      ({
        nodes: [
          { id: "rs-1", type: "ReplicaSet", data: { label: "old-rs" } },
          { id: "pod-1", type: "Pod", parentId: "rs-1", data: {} },
        ],
        updateNodeData: updateNodeDataMock,
      } as any);

    const podRsHandlers = createNodeHandlers("pod-1", storeWithReplicaSet);
    podRsHandlers.onRename("renamed-rs-app");
    expect(updateNodeDataMock).toHaveBeenCalledWith("rs-1", { label: "renamed-rs-app" });

    // Test onRename on Service node
    updateNodeDataMock.mockClear();
    const serviceStore = () =>
      ({
        nodes: [{ id: "svc-1", type: "Service", data: {} }],
        updateNodeData: updateNodeDataMock,
      } as any);

    const svcHandlers = createNodeHandlers("svc-1", serviceStore);
    svcHandlers.onRename("my-svc");
    expect(updateNodeDataMock).toHaveBeenCalledWith("svc-1", { label: "my-svc" });

    // Test onRename on Pod with non-deployment parent (e.g., Namespace parent)
    updateNodeDataMock.mockClear();
    const nsParentStore = () =>
      ({
        nodes: [
          { id: "ns-1", type: "Namespace", data: { label: "my-ns" } },
          { id: "pod-2", type: "Pod", parentId: "ns-1", data: { podHash: "abc12", replicaSuffix: "xyz34", replicas: 2 } },
        ],
        updateNodeData: updateNodeDataMock,
      } as any);

    const nsPodHandlers = createNodeHandlers("pod-2", nsParentStore);
    nsPodHandlers.onRename("worker-pod");
    expect(updateNodeDataMock).toHaveBeenCalledWith("pod-2", {
      baseName: "worker-pod",
      label: expect.stringContaining("worker-pod-abc12-xyz34"),
    });

    // Test onRename when newName sanitizes to empty string (falls back to 'pod')
    updateNodeDataMock.mockClear();
    const emptyNameStore = () =>
      ({
        nodes: [{ id: "pod-empty", type: "Pod", data: {} }],
        updateNodeData: updateNodeDataMock,
      } as any);
    const emptyPodHandlers = createNodeHandlers("pod-empty", emptyNameStore);
    emptyPodHandlers.onRename("   !!!   ");
    expect(updateNodeDataMock).toHaveBeenCalledWith("pod-empty", {
      baseName: "pod",
      label: "pod",
    });

    // Test onRename on Pod with StatefulSet parent when name sanitizes to empty string (fallback to 'statefulset')
    updateNodeDataMock.mockClear();
    const storeWithStatefulSet = () =>
      ({
        nodes: [
          { id: "ss-1", type: "StatefulSet", data: { label: "old-ss" } },
          { id: "pod-ss", type: "Pod", parentId: "ss-1", data: {} },
        ],
        updateNodeData: updateNodeDataMock,
      } as any);

    const podSsHandlers = createNodeHandlers("pod-ss", storeWithStatefulSet);
    podSsHandlers.onRename("   !!!   ");
    expect(updateNodeDataMock).toHaveBeenCalledWith("ss-1", { label: "statefulset" });

    // Test ordinal suffix stripping on StatefulSet parent
    updateNodeDataMock.mockClear();
    podSsHandlers.onRename("my-cluster-0");
    expect(updateNodeDataMock).toHaveBeenCalledWith("ss-1", { label: "my-cluster" });
  });

  it('getInitialData returns correct defaults for various types', () => {
    const get = () => ({ nodes: [] });

    const svcData = getInitialData('Service', 's1', get as any);
    expect(svcData.port).toBe(80);
    expect(svcData.targetPort).toBe(80);

    const podData = getInitialData('Pod', 'p1', get as any);
    expect(podData.replicas).toBe(1);
    expect(podData.image).toBe('');
    expect(podData.status).toBe('pending');

    const hpaData = getInitialData('HPA', 'h1', get as any);
    expect(hpaData.maxReplicas).toBe(10);
    expect(hpaData.targetCPU).toBe(50);

    const netData = getInitialData('Internet', 'net1', get as any);
    expect(netData.type).toBe('Internet');

    const pvcData = getInitialData('PVC', 'pvc1', get as any);
    expect(pvcData.type).toBe('PVC');

    const cmData = getInitialData('ConfigMap', 'cm1', get as any);
    expect(cmData.type).toBe('ConfigMap');

    const depData = getInitialData('Deployment', 'd1', get as any);
    expect(depData.type).toBe('Deployment');
    expect(depData.replicas).toBe(0);

    const ssData = getInitialData('StatefulSet', 'ss1', get as any);
    expect(ssData.type).toBe('StatefulSet');
    expect(ssData.workloadType).toBe('StatefulSet');
    expect(ssData.replicas).toBe(0);

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

    const syncedReady = syncWorkloadMetadata('Pod', { image: 'nginx:latest' } as any);
    expect(syncedReady.status).toBe('ready');

    const syncedPending = syncWorkloadMetadata('Pod', { image: '' } as any);
    expect(syncedPending.status).toBe('pending');

    const nonWorkload = syncWorkloadMetadata('Service', { image: 'test' } as any);
    expect(nonWorkload).toEqual({ image: 'test' });
  });

  it('sanitizeResourceLimits keeps values in range and handles undefined fields', () => {
    const data = { replicas: 2000, minReplicas: -5, maxReplicas: 5000 };
    const sanitized = sanitizeResourceLimits(data);
    expect(sanitized.replicas).toBe(1000);
    expect(sanitized.minReplicas).toBe(1);
    expect(sanitized.maxReplicas).toBe(1000);

    const emptyData = sanitizeResourceLimits({});
    expect(emptyData).toEqual({});
  });

  describe('ensureUniqueResourceName', () => {
    it('disallows duplicate names for the SAME Kind in the SAME Namespace', () => {
      const nodes: any[] = [
        { id: 's1', type: 'Service', parentId: 'ns1', data: { label: 'backend' } },
      ];

      const name = ensureUniqueResourceName('backend', 'Service', 'ns1', nodes);
      expect(name).toBe('backend-1');
    });

    it('handles ensureUniqueResourceName loop exhaustion (> 1000 duplicates) to hit line 63 fallback', () => {
      const nodes: any[] = [];
      nodes.push({ id: 's0', type: 'Service', parentId: 'ns1', data: { label: 'app' } });
      for (let i = 1; i < 1000; i++) {
        nodes.push({ id: `s${i}`, type: 'Service', parentId: 'ns1', data: { label: `app-${i}` } });
      }

      const name = ensureUniqueResourceName('app', 'Service', 'ns1', nodes);
      expect(name).toMatch(/^app-[a-z0-9]+$/);
    });

    it('allows identical names for DIFFERENT Kinds in the SAME Namespace', () => {
      const nodes: any[] = [
        { id: 's1', type: 'Service', parentId: 'ns1', data: { label: 'backend' } },
      ];

      const name = ensureUniqueResourceName('backend', 'Deployment', 'ns1', nodes);
      expect(name).toBe('backend');
    });

    it('allows identical names for the SAME Kind in DIFFERENT Namespaces', () => {
      const nodes: any[] = [
        { id: 's1', type: 'Service', parentId: 'ns1', data: { label: 'backend' } },
      ];

      const name = ensureUniqueResourceName('backend', 'Service', 'ns2', nodes);
      expect(name).toBe('backend');
    });

    it('handles desiredName sanitizing to empty string falling back to type name', () => {
      const name = ensureUniqueResourceName('$$$###', 'Pod', undefined, []);
      expect(name).toBe('pod');
    });

    it('filters out nodes missing type and nodes matching excludeNodeId (by id or parentId)', () => {
      const nodes: any[] = [
        { id: 'n-notype', data: { label: 'web' } },
        { id: 'ex-node', type: 'Pod', data: { label: 'web' } },
        { id: 'child-node', parentId: 'ex-parent', type: 'Pod', data: { label: 'worker' } },
        { id: 'empty-data-node', type: 'Pod', data: {} },
      ];

      // Exclude by n.id
      const name1 = ensureUniqueResourceName('web', 'Pod', undefined, nodes, 'ex-node');
      expect(name1).toBe('web');

      // Exclude by n.parentId
      const name2 = ensureUniqueResourceName('worker', 'Pod', undefined, nodes, 'ex-parent');
      expect(name2).toBe('worker');

      // Node with empty data (no baseName, no label) falls back to ''
      const name3 = ensureUniqueResourceName('runner', 'Pod', undefined, nodes);
      expect(name3).toBe('runner');
    });
  });

  describe('isDuplicateResourceName', () => {
    it('detects duplicate name for the same Kind in the same Namespace', () => {
      const nodes: any[] = [
        { id: 'dep-1', type: 'Deployment', parentId: 'ns-1', data: { label: 'web-api' } },
      ];

      expect(isDuplicateResourceName('web-api', 'Deployment', 'ns-1', nodes)).toBe(true);
      expect(isDuplicateResourceName('web-api-2', 'Deployment', 'ns-1', nodes)).toBe(false);
    });

    it('allows identical name for the same Kind in a different Namespace', () => {
      const nodes: any[] = [
        { id: 'dep-1', type: 'Deployment', parentId: 'ns-1', data: { label: 'web-api' } },
      ];

      expect(isDuplicateResourceName('web-api', 'Deployment', 'ns-2', nodes)).toBe(false);
      expect(isDuplicateResourceName('web-api', 'Deployment', undefined, nodes)).toBe(false);
    });

    it('allows identical name for different Kinds in the same Namespace', () => {
      const nodes: any[] = [
        { id: 'dep-1', type: 'Deployment', parentId: 'ns-1', data: { label: 'web-api' } },
      ];

      expect(isDuplicateResourceName('web-api', 'Service', 'ns-1', nodes)).toBe(false);
      expect(isDuplicateResourceName('web-api', 'ConfigMap', 'ns-1', nodes)).toBe(false);
    });

    it('enforces cluster-wide uniqueness for Namespace type regardless of parentId', () => {
      const nodes: any[] = [
        { id: 'ns-1', type: 'Namespace', data: { label: 'production' } },
      ];

      expect(isDuplicateResourceName('production', 'Namespace', undefined, nodes)).toBe(true);
      expect(isDuplicateResourceName('staging', 'Namespace', undefined, nodes)).toBe(false);
    });

    it('excludes specified node ID or parent ID during duplicate check', () => {
      const nodes: any[] = [
        { id: 'svc-1', type: 'Service', parentId: 'ns-1', data: { label: 'redis' } },
        { id: 'child-1', type: 'Pod', parentId: 'dep-parent', data: { label: 'worker' } },
      ];

      // Self-exclusion
      expect(isDuplicateResourceName('redis', 'Service', 'ns-1', nodes, 'svc-1')).toBe(false);
      // Parent exclusion
      expect(isDuplicateResourceName('worker', 'Pod', undefined, nodes, 'dep-parent')).toBe(false);
    });

    it('returns false for empty string or inputs that sanitize to empty', () => {
      const nodes: any[] = [
        { id: 'svc-1', type: 'Service', data: { label: 'redis' } },
      ];

      expect(isDuplicateResourceName('', 'Service', undefined, nodes)).toBe(false);
      expect(isDuplicateResourceName('   ', 'Service', undefined, nodes)).toBe(false);
      expect(isDuplicateResourceName('$$$###', 'Service', undefined, nodes)).toBe(false);
    });
  });

  describe('createNodeHandlers onRename duplicate prevention', () => {
    it('prevents renaming when duplicate exists for Service and logs warning', () => {
      const updateNodeDataMock = vi.fn();
      const addLogMock = vi.fn();
      const getStore = () => ({
        nodes: [
          { id: 's1', type: 'Service', data: { label: 'api' } },
          { id: 's2', type: 'Service', data: { label: 'auth' } },
        ],
        updateNodeData: updateNodeDataMock,
        addLog: addLogMock,
      } as any);

      const handlers = createNodeHandlers('s2', getStore);
      handlers.onRename('api');

      expect(updateNodeDataMock).not.toHaveBeenCalled();
      expect(addLogMock).toHaveBeenCalledWith('warn', expect.stringContaining("Cannot rename: Service 'api' already exists"), 'UI');
    });

    it('prevents renaming when duplicate exists for Pod under Deployment', () => {
      const updateNodeDataMock = vi.fn();
      const addLogMock = vi.fn();
      const getStore = () => ({
        nodes: [
          { id: 'dep-1', type: 'Deployment', data: { label: 'web-prod' } },
          { id: 'dep-2', type: 'Deployment', data: { label: 'web-stage' } },
          { id: 'pod-2', type: 'Pod', parentId: 'dep-2', data: { label: 'web-stage-abcde' } },
        ],
        updateNodeData: updateNodeDataMock,
        addLog: addLogMock,
      } as any);

      const handlers = createNodeHandlers('pod-2', getStore);
      handlers.onRename('web-prod');

      expect(updateNodeDataMock).not.toHaveBeenCalled();
      expect(addLogMock).toHaveBeenCalledWith('warn', expect.stringContaining("Cannot rename: Deployment 'web-prod' already exists"), 'UI');
    });
  });

  it('handles applyAutoImageLogic and syncWorkloadMetadata edge cases', () => {
    // Neither runtime nor webserver provided in data
    const noRtWsData = applyAutoImageLogic({ label: 'pod' } as any, { label: 'updated' });
    expect(noRtWsData).toEqual({ label: 'updated' });

    // Target has custom image (isAutoImage: false)
    const customImgTarget = { label: 'pod', image: 'custom:1.0', isAutoImage: false } as any;
    const customResult = applyAutoImageLogic(customImgTarget, { runtime: 'nodejs' });
    expect(customResult).toEqual({ runtime: 'nodejs' });

    // Fallbacks for data.runtime undefined and data.webserver undefined
    const rtFallbackResult = applyAutoImageLogic(
      { label: 'pod', runtime: 'go', isAutoImage: true } as any,
      { webserver: 'nginx' }
    );
    expect(rtFallbackResult.image).toBeDefined();

    const noneFallbackResult = applyAutoImageLogic(
      { label: 'pod', isAutoImage: true } as any,
      { webserver: 'apache' }
    );
    expect(noneFallbackResult.image).toBe('httpd:latest');

    const wsFallbackResult = applyAutoImageLogic(
      { label: 'pod', webserver: 'apache', isAutoImage: true } as any,
      { runtime: 'php' }
    );
    expect(wsFallbackResult.image).toBe('php:8.2-apache');

    const noneWsFallbackResult = applyAutoImageLogic(
      { label: 'pod', isAutoImage: true } as any,
      { runtime: 'nodejs' }
    );
    expect(noneWsFallbackResult.image).toBe('node:18-alpine');

    // syncWorkloadMetadata for ReplicaSet with image
    const customWorkload = syncWorkloadMetadata('ReplicaSet', { image: 'custom:2.0' } as any);
    expect(customWorkload.status).toBe('ready');

    const customStatefulSet = syncWorkloadMetadata('StatefulSet', { image: 'postgres:alpine' } as any);
    expect(customStatefulSet.status).toBe('ready');

    // syncWorkloadMetadata with empty image
    const pendingWorkload = syncWorkloadMetadata('Deployment', { image: '' } as any);
    expect(pendingWorkload.status).toBe('pending');

    // syncWorkloadMetadata with image undefined (neither image nor empty string)
    const noImageWorkload = syncWorkloadMetadata('Pod', { label: 'worker' } as any);
    expect(noImageWorkload.status).toBeUndefined();
  });

  describe('resolveTargetInfo & onRename validation', () => {
    it('resolves target info for a Pod under a Deployment parent', () => {
      const nodes = [
        { id: 'ns-1', type: 'Namespace', data: {} },
        { id: 'dep-1', type: 'Deployment', parentId: 'ns-1', data: { label: 'my-dep' } },
        { id: 'pod-1', type: 'Pod', parentId: 'dep-1', data: { label: 'my-dep-pod' } },
      ];

      const info = resolveTargetInfo('pod-1', nodes);
      expect(info.type).toBe('Deployment');
      expect(info.parentId).toBe('ns-1');
      expect(info.excludeId).toBe('dep-1');
    });

    it('resolves target info for a Pod under a StatefulSet parent', () => {
      const nodes = [
        { id: 'sts-1', type: 'StatefulSet', data: { label: 'my-sts' } },
        { id: 'pod-sts', type: 'Pod', parentId: 'sts-1', data: {} },
      ];

      const info = resolveTargetInfo('pod-sts', nodes);
      expect(info.type).toBe('StatefulSet');
      expect(info.parentId).toBeUndefined();
      expect(info.excludeId).toBe('sts-1');
    });

    it('resolves target info for a standalone Pod without parent', () => {
      const nodes = [
        { id: 'pod-standalone', type: 'Pod', data: { label: 'orphan' } },
      ];

      const info = resolveTargetInfo('pod-standalone', nodes);
      expect(info.type).toBe('Pod');
      expect(info.parentId).toBeUndefined();
      expect(info.excludeId).toBe('pod-standalone');
    });

    it('blocks renaming standalone Pod when candidate name already exists in same namespace', () => {
      const addLogMock = vi.fn();
      const updateNodeDataMock = vi.fn();

      const getStore = () =>
        ({
          nodes: [
            { id: 'pod-a', type: 'Pod', parentId: 'ns-1', data: { baseName: 'worker', label: 'worker' } },
            { id: 'pod-b', type: 'Pod', parentId: 'ns-1', data: { baseName: 'runner', label: 'runner' } },
          ],
          addLog: addLogMock,
          updateNodeData: updateNodeDataMock,
        } as any);

      const handlers = createNodeHandlers('pod-b', getStore);
      handlers.onRename('worker');

      expect(updateNodeDataMock).not.toHaveBeenCalled();
      expect(addLogMock).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining("Cannot rename: Pod 'worker' already exists in this namespace."),
        'UI'
      );
    });

    it('handles onRename for Pod with StatefulSet parent and numeric suffix', () => {
      const updateNodeDataMock = vi.fn();
      const getStore = () =>
        ({
          nodes: [
            { id: 'sts-1', type: 'StatefulSet', data: { label: 'db-cluster' } },
            { id: 'pod-sts-0', type: 'Pod', parentId: 'sts-1', data: { label: 'db-cluster-0' } },
          ],
          updateNodeData: updateNodeDataMock,
        } as any);

      const handlers = createNodeHandlers('pod-sts-0', getStore);
      handlers.onRename('database-0');

      expect(updateNodeDataMock).toHaveBeenCalledWith('sts-1', { label: 'database' });
    });
  });
});