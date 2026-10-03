import { describe, it, expect } from 'vitest';
import {
  getNodeData,
  isAllowed,
  getAbsPos,
  sortNodes,
  syncPodsInDeployment,
  layoutPodsInDeployment,
  resolveGlobalCollisions
} from '@/store/helpers';
import { Node } from '@xyflow/react';

describe('store helpers', () => {
  it('getNodeData should return data or empty object', () => {
    const node = { id: '1', data: { label: 'test' } } as any;
    expect(getNodeData(node)).toEqual({ label: 'test' });
    expect(getNodeData({ id: '2' } as any)).toEqual({});
  });

  it('isAllowed should validate parent-child relationships', () => {
    expect(isAllowed('Deployment', 'Pod')).toBe(true);
    expect(isAllowed('Deployment', 'Service')).toBe(false);
    expect(isAllowed('Namespace', 'Pod')).toBe(true);
    expect(isAllowed('Namespace', 'Deployment')).toBe(true);
    expect(isAllowed('Service', 'Pod')).toBe(false);
  });

  it('getAbsPos should calculate absolute position including parents and dragged node', () => {
    const nodes: Node[] = [
      { id: 'p1', position: { x: 100, y: 100 }, data: {} } as Node,
      { id: 'c1', parentId: 'p1', position: { x: 50, y: 50 }, data: {} } as Node,
    ];
    expect(getAbsPos('c1', nodes)).toEqual({ x: 150, y: 150 });
    expect(getAbsPos('p1', nodes)).toEqual({ x: 100, y: 100 });
    expect(getAbsPos('non-existent', nodes)).toEqual({ x: 0, y: 0 });

    const draggedNode = { id: 'c1', parentId: 'p1', position: { x: 60, y: 60 }, data: {} } as Node;
    expect(getAbsPos('c1', nodes, draggedNode)).toEqual({ x: 160, y: 160 });
  });

  it('sortNodes should sort by priority and handle unknown types', () => {
    const nodes: Node[] = [
      { id: '1', type: 'Pod', data: {} } as Node,
      { id: '2', type: 'Namespace', data: {} } as Node,
      { id: '3', type: 'Service', data: {} } as Node,
      { id: '4', type: 'Unknown', data: {} } as Node,
    ];
    const sorted = sortNodes(nodes);
    expect(sorted[0].type).toBe('Namespace');
    expect(sorted[sorted.length - 1].type).toBe('Unknown');
  });

  it('syncPodsInDeployment should create pods based on replicas', () => {
    const deployment = { id: 'd1', type: 'Deployment', data: { replicas: 2, label: 'app' } } as any;
    const pods = syncPodsInDeployment(deployment, []);
    expect(pods).toHaveLength(2);
    expect(pods[0].parentId).toBe('d1');
    expect(pods[0].data.replicas).toBe(1);

    const updatedPods = syncPodsInDeployment(deployment, pods);
    expect(updatedPods).toHaveLength(2);
    expect(updatedPods[0].id).toBe(pods[0].id);
  });

  it('syncPodsInDeployment adheres strictly to data model: baseName, podHash, replicaSuffix and label formula', () => {
    const deployment = { id: 'd1', type: 'Deployment', data: { replicas: 2, label: 'myapp' } } as any;
    const pods = syncPodsInDeployment(deployment, []);
    expect(pods).toHaveLength(2);

    const pod1 = pods[0].data;
    const pod2 = pods[1].data;

    expect(pod1.baseName).toBe('myapp');
    expect(pod2.baseName).toBe('myapp');

    // Shared podHash for the group
    expect(pod1.podHash).toBeDefined();
    expect(pod1.podHash).toHaveLength(5);
    expect(pod2.podHash).toBe(pod1.podHash);

    // Unique replicaSuffix per pod
    expect(pod1.replicaSuffix).toBeDefined();
    expect(pod1.replicaSuffix).toHaveLength(5);
    expect(pod2.replicaSuffix).toBeDefined();
    expect(pod2.replicaSuffix).toHaveLength(5);
    expect(pod1.replicaSuffix).not.toBe(pod2.replicaSuffix);

    // Label formula: baseName-podHash-replicaSuffix
    expect(pod1.label).toBe(`${pod1.baseName}-${pod1.podHash}-${pod1.replicaSuffix}`);
    expect(pod2.label).toBe(`${pod2.baseName}-${pod2.podHash}-${pod2.replicaSuffix}`);
  });

  it('syncPodsInDeployment with forceRandomize = true re-randomizes group podHash and replicaSuffixes', () => {
    const deployment = { id: 'd1', type: 'Deployment', data: { replicas: 2, label: 'myapp' } } as any;
    const initialPods = syncPodsInDeployment(deployment, []);
    const oldPodHash = initialPods[0].data.podHash;
    const oldSuffix1 = initialPods[0].data.replicaSuffix;
    const oldSuffix2 = initialPods[1].data.replicaSuffix;

    const randomizedPods = syncPodsInDeployment(deployment, initialPods, undefined, true);

    const newPod1 = randomizedPods[0].data;
    const newPod2 = randomizedPods[1].data;

    expect(newPod1.podHash).not.toBe(oldPodHash);
    expect(newPod1.podHash).toBe(newPod2.podHash);

    expect(newPod1.replicaSuffix).not.toBe(oldSuffix1);
    expect(newPod2.replicaSuffix).not.toBe(oldSuffix2);

    expect(newPod1.label).toBe(`${newPod1.baseName}-${newPod1.podHash}-${newPod1.replicaSuffix}`);
    expect(newPod2.label).toBe(`${newPod2.baseName}-${newPod2.podHash}-${newPod2.replicaSuffix}`);
  });

  it('syncPodsInDeployment removes child pods when replicas <= 0', () => {
    const deployment = { id: 'd1', type: 'Deployment', data: { replicas: 0, label: 'app' } } as any;
    const existingChild = { id: 'p1', parentId: 'd1', type: 'Pod', data: { baseName: 'app', podHash: 'h1', replicaSuffix: 's1' } } as any;

    const pods = syncPodsInDeployment(deployment, [existingChild]);
    expect(pods).toHaveLength(0);
  });

  it('syncPodsInDeployment should handle dataTemplate for displaySettings', () => {
    const deployment = { id: 'd1', type: 'Deployment', data: { replicas: 1, label: 'app' } } as any;
    const dataTemplate = { data: { displaySettings: { some: 'setting' }, image: 'templ-img' } } as any;
    const pods = syncPodsInDeployment(deployment, [], dataTemplate);

    expect(pods[0].data.displaySettings).toEqual({ some: 'setting' });
    expect(pods[0].data.image).toBe('templ-img');
  });

  it('syncPodsInDeployment should fallback to deployment displaySettings if template and pods are missing', () => {
    const deployment = {
      id: 'd1',
      type: 'Deployment',
      data: {
        replicas: 1,
        label: 'app',
        displaySettings: { dep: 'setting' }
      }
    } as any;
    const pods = syncPodsInDeployment(deployment, []);
    expect(pods[0].data.displaySettings).toEqual({ dep: 'setting' });
  });

  it('layoutPodsInDeployment should position pods correctly and handle wrapping', () => {
    const deployment = { id: 'd1', width: 300, data: {} } as any;
    const pods = [
      { id: 'p1', data: { replicas: 1 }, width: 200, height: 100, measured: { width: 200, height: 100 } } as any,
      { id: 'p2', data: { replicas: 1 }, width: 200, height: 100, measured: { width: 200, height: 100 } } as any,
    ];
    const laidOut = layoutPodsInDeployment(deployment, pods);
    expect(laidOut[0].position.x).toBe(24);
    expect(laidOut[1].position.y).toBeGreaterThan(laidOut[0].position.y);
  });

  it('layoutPodsInDeployment should handle horizontal spacing adjustment', () => {
    const deployment = { id: 'd1', width: 1000, data: {} } as any;
    const pods = [
      { id: 'p1', data: { replicas: 1 }, width: 100, height: 100, measured: { width: 100, height: 100 } } as any,
      { id: 'p2', data: { replicas: 100 }, width: 100, height: 100, measured: { width: 100, height: 100 } } as any,
    ];
    const laidOut = layoutPodsInDeployment(deployment, pods);
    expect(laidOut[1].position.x).toBeGreaterThan(144);
  });

  it('resolveGlobalCollisions should move overlapping nodes', () => {
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, width: 100, height: 100, data: {} } as any,
      { id: 'n2', position: { x: 10, y: 10 }, width: 100, height: 100, data: {} } as any,
    ];
    const resolved = resolveGlobalCollisions(nodes);
    expect(resolved[0].position.x).not.toBe(0);
    expect(resolved[1].position.x).not.toBe(10);
  });

  it('resolveGlobalCollisions with fixedNodeId', () => {
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, width: 100, height: 100, data: {} } as any,
      { id: 'n2', position: { x: 10, y: 10 }, width: 100, height: 100, data: {} } as any,
    ];
    const resolved = resolveGlobalCollisions(nodes, 'n1');
    expect(resolved[0].position.x).toBe(0);
    expect(resolved[1].position.x).not.toBe(10);

    const resolvedB = resolveGlobalCollisions(nodes, 'n2');
    expect(resolvedB[1].position.x).toBe(10);
  });

  it('resolveGlobalCollisions should skip Deployment and ReplicaSet parents', () => {
    const nodes = [
      { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as any,
      { id: 'p1', parentId: 'dep1', position: { x: 10, y: 10 }, width: 100, height: 100, data: {} } as any,
      { id: 'p2', parentId: 'dep1', position: { x: 20, y: 20 }, width: 100, height: 100, data: {} } as any,
    ];
    const resolved = resolveGlobalCollisions(nodes);
    expect(resolved.find(n => n.id === 'p1')?.position.x).toBe(10);
    expect(resolved.find(n => n.id === 'p2')?.position.x).toBe(20);
  });

  it('resolveGlobalCollisions should handle manual resizing in getEffectiveSize for Pods', () => {
    const pods = [
      { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { replicas: 1, isManuallyResized: true }, width: 500, height: 500 } as any,
      { id: 'p2', type: 'Pod', position: { x: 10, y: 10 }, data: { replicas: 1 }, width: 100, height: 100 } as any,
    ];
    const resolved = resolveGlobalCollisions(pods);
    expect(resolved[0].position.x).not.toBe(0);
  });

  it('covers applyOverlapResolution y-axis overlap branch, vertical collision, and replicaSuffix preservation', () => {
    // 1. Vertical collision (dy > dx) triggers y-axis overlap resolution
    const vertNodes = [
      { id: 'v1', position: { x: 0, y: 0 }, width: 100, height: 100, data: {} } as any,
      { id: 'v2', position: { x: 0, y: 10 }, width: 100, height: 100, data: {} } as any,
    ];
    const resolvedVert = resolveGlobalCollisions(vertNodes);
    expect(resolvedVert[0].position.y).not.toBe(0);
    expect(resolvedVert[1].position.y).not.toBe(10);

    // 2. Vertical collision with fixedNodeId = 'v1'
    const resolvedFixedV1 = resolveGlobalCollisions(vertNodes, 'v1');
    expect(resolvedFixedV1[0].position.y).toBe(0);

    // 3. Vertical collision with fixedNodeId = 'v2'
    const resolvedFixedV2 = resolveGlobalCollisions(vertNodes, 'v2');
    expect(resolvedFixedV2[1].position.y).toBe(10);

    // 4. syncPodsInDeployment with existingPod containing replicaSuffix and forceRandomize = false
    const dep = { id: 'd1', type: 'Deployment', data: { replicas: 2, label: 'app' } } as any;
    const pod1 = {
      id: 'p1',
      parentId: 'd1',
      type: 'Pod',
      width: 200,
      height: 150,
      measured: { width: 200, height: 150 },
      data: {
        label: 'app-h1-s1',
        baseName: 'app',
        podHash: 'h1',
        replicaSuffix: 's1',
        replicaSuffixes: ['s1', 's2'],
        isManuallyResized: true,
      }
    } as any;

    const synced = syncPodsInDeployment(dep, [pod1]);
    expect(synced[0].data.replicaSuffix).toBe('s1');
    expect(synced[0].width).toBe(200);
  });

  it('covers getEffectiveSize for Namespace, PodGroup collision skip, and fallback sizes', () => {
    // 1. getEffectiveSize for Namespace
    const nsNode = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} } as any;
    const nsNode2 = { id: 'ns2', type: 'Namespace', position: { x: 10, y: 10 }, data: {} } as any;
    const resolvedNs = resolveGlobalCollisions([nsNode, nsNode2]);
    expect(resolvedNs[0].position.x).not.toBe(0);

    // 2. getEffectiveSize for unknown node type (fallback 160x80)
    const unknownNode1 = { id: 'u1', type: 'UnknownWidget', position: { x: 0, y: 0 }, data: {} } as any;
    const unknownNode2 = { id: 'u2', type: 'UnknownWidget', position: { x: 5, y: 5 }, data: {} } as any;
    const resolvedUnknown = resolveGlobalCollisions([unknownNode1, unknownNode2]);
    expect(resolvedUnknown[0].position.x).not.toBe(0);

    // 3. Collision resolution skips PodGroup parent
    const pgParent = { id: 'pg1', type: 'PodGroup', position: { x: 0, y: 0 }, data: {} } as any;
    const pgChild1 = { id: 'p1', parentId: 'pg1', position: { x: 0, y: 0 }, data: {} } as any;
    const pgChild2 = { id: 'p2', parentId: 'pg1', position: { x: 5, y: 5 }, data: {} } as any;
    const resolvedPg = resolveGlobalCollisions([pgParent, pgChild1, pgChild2]);
    expect(resolvedPg.find(n => n.id === 'p1')?.position.x).toBe(0);
  });
});
