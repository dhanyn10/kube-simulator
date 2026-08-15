import { describe, it, expect } from 'vitest';
import {
  getNodeData,
  isAllowed,
  getAbsPos,
  sortNodes,
  syncPodsInDeployment,
  layoutPodsInDeployment,
  resolveGlobalCollisions
} from '../../src/store/helpers';
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
});
