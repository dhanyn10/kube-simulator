import { describe, it, expect, vi } from 'vitest';
import {
  getNodeData,
  isAllowed,
  getAbsPos,
  sortNodes,
  syncPodsInDeployment,
  layoutPodsInDeployment,
  calculateAlignmentGuides,
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

  it('getAbsPos should calculate absolute position including parents', () => {
    const nodes: Node[] = [
      { id: 'p1', position: { x: 100, y: 100 }, data: {} } as Node,
      { id: 'c1', parentId: 'p1', position: { x: 50, y: 50 }, data: {} } as Node,
    ];
    expect(getAbsPos('c1', nodes)).toEqual({ x: 150, y: 150 });
    expect(getAbsPos('p1', nodes)).toEqual({ x: 100, y: 100 });
    expect(getAbsPos('non-existent', nodes)).toEqual({ x: 0, y: 0 });
  });

  it('sortNodes should sort by priority', () => {
    const nodes: Node[] = [
      { id: '1', type: 'Pod', data: {} } as Node,
      { id: '2', type: 'Namespace', data: {} } as Node,
      { id: '3', type: 'Service', data: {} } as Node,
    ];
    const sorted = sortNodes(nodes);
    expect(sorted[0].type).toBe('Namespace');
    expect(sorted[1].type).toBe('Pod');
    expect(sorted[2].type).toBe('Service');
  });

  it('syncPodsInDeployment should create pods based on replicas', () => {
    const deployment = { id: 'd1', type: 'Deployment', data: { replicas: 2, label: 'app' } } as any;
    const pods = syncPodsInDeployment(deployment, []);
    expect(pods.length).toBe(2);
    expect(pods[0].parentId).toBe('d1');
    expect(pods[0].data.replicas).toBe(1);

    // Test updating existing pods
    const updatedPods = syncPodsInDeployment(deployment, pods);
    expect(updatedPods.length).toBe(2);
    expect(updatedPods[0].id).toBe(pods[0].id);
  });

  it('layoutPodsInDeployment should position pods correctly', () => {
    const deployment = { id: 'd1', width: 1000, data: {} } as any;
    const pods = [
      { id: 'p1', data: { replicas: 1 }, width: 100, height: 100, measured: { width: 100, height: 100 } } as any,
      { id: 'p2', data: { replicas: 1 }, width: 100, height: 100, measured: { width: 100, height: 100 } } as any,
    ];
    const laidOut = layoutPodsInDeployment(deployment, pods);
    expect(laidOut[0].position.x).toBe(24);
    expect(laidOut[1].position.x).toBeGreaterThan(24);
  });

  it('calculateAlignmentGuides should return guides', () => {
    const node = { id: 'n1', width: 100, height: 100, position: { x: 0, y: 0 }, data: {} } as Node;
    const nodes = [
        node,
        { id: 'n2', width: 100, height: 100, position: { x: 200, y: 0 }, data: {} } as Node
    ];
    const guides = calculateAlignmentGuides(node, nodes, { x: 0, y: 0 }, false);
    expect(guides.horizontalGuides.length).toBeGreaterThan(0);
  });

  it('calculateAlignmentGuides should handle Deployment slot guides', () => {
    const pod = { id: 'p1', type: 'Pod', width: 100, height: 100, position: { x: 0, y: 0 }, data: {} } as any;
    const deployment = { id: 'd1', type: 'Deployment', width: 400, position: { x: 500, y: 500 }, data: { replicas: 1 } } as any;
    const nodes = [pod, deployment];
    const guides = calculateAlignmentGuides(pod, nodes, { x: 0, y: 0 }, false, 'd1');
    expect(guides.vSnap).toBeDefined();
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
      expect(resolved[0].position.x).toBe(0); // n1 should stay fixed
      expect(resolved[1].position.x).not.toBe(10);
  });
});
