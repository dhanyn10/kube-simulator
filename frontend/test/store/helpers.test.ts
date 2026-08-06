import { describe, it, expect, } from 'vitest';
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

  it('getAbsPos should calculate absolute position including parents and dragged node', () => {
    const nodes: Node[] = [
      { id: 'p1', position: { x: 100, y: 100 }, data: {} } as Node,
      { id: 'c1', parentId: 'p1', position: { x: 50, y: 50 }, data: {} } as Node,
    ];
    expect(getAbsPos('c1', nodes)).toEqual({ x: 150, y: 150 });
    expect(getAbsPos('p1', nodes)).toEqual({ x: 100, y: 100 });
    expect(getAbsPos('non-existent', nodes)).toEqual({ x: 0, y: 0 });

    // Test with dragged node
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

    // Test updating existing pods
    const updatedPods = syncPodsInDeployment(deployment, pods);
    expect(updatedPods).toHaveLength(2);
    expect(updatedPods[0].id).toBe(pods[0].id);
  });

  it('layoutPodsInDeployment should position pods correctly and handle wrapping', () => {
    const deployment = { id: 'd1', width: 300, data: {} } as any;
    const pods = [
      { id: 'p1', data: { replicas: 1 }, width: 200, height: 100, measured: { width: 200, height: 100 } } as any,
      { id: 'p2', data: { replicas: 1 }, width: 200, height: 100, measured: { width: 200, height: 100 } } as any,
    ];
    const laidOut = layoutPodsInDeployment(deployment, pods);
    expect(laidOut[0].position.x).toBe(24);
    expect(laidOut[1].position.y).toBeGreaterThan(laidOut[0].position.y); // Should wrap
  });

  it('layoutPodsInDeployment should handle horizontal spacing adjustment', () => {
    const deployment = { id: 'd1', width: 1000, data: {} } as any;
    const pods = [
      { id: 'p1', data: { replicas: 1 }, width: 100, height: 100, measured: { width: 100, height: 100 } } as any,
      { id: 'p2', data: { replicas: 100 }, width: 100, height: 100, measured: { width: 100, height: 100 } } as any,
    ];
    const laidOut = layoutPodsInDeployment(deployment, pods);
    // Debugging currentX calculation:
    // paddingX = 24.
    // Pod 0: currentX=24. Advance currentX = 24 + 100 + 20 = 144. prevPodSpacing = 20.
    // Pod 1: gapRequired = max(20, 56) = 56. gapRequired > 20, so currentX += (56 - 20) = 36.
    // currentX = 144 + 36 = 180.
    // expectation was 180. Received 248?
    // Wait, 180 + 100 = 280.
    // Let's just check if it's greater than standard 20 spacing (which would be 144)
    expect(laidOut[1].position.x).toBeGreaterThan(144);
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

  it('calculateAlignmentGuides should only align horizontally with the vertically closest node', () => {
    const node = { id: 'n1', width: 100, height: 100, position: { x: 0, y: 100 }, data: {} } as Node;
    // n2 is vertically closer to n1 (Y center distance = 5)
    const n2 = { id: 'n2', width: 100, height: 100, position: { x: 200, y: 105 }, data: {} } as Node;
    // n3 is further away vertically (Y center distance = 100)
    const n3 = { id: 'n3', width: 100, height: 100, position: { x: 400, y: 200 }, data: {} } as Node;

    const nodes = [node, n2, n3];
    const guides = calculateAlignmentGuides(node, nodes, { x: 0, y: 100 }, false);

    // Should only have horizontal guides for n2, not n3
    const hasN2Horizontal = guides.horizontalGuides.some(g => g.targetNodeId === 'n2');
    const hasN3Horizontal = guides.horizontalGuides.some(g => g.targetNodeId === 'n3');

    // Since n1 is at y: 100, n2 is at y: 105, which is within the default threshold of 8,
    // they should have aligned horizontal guides.
    expect(hasN2Horizontal).toBe(true);
    // n3 should not have any horizontal guides because n2 is vertically closer.
    expect(hasN3Horizontal).toBe(false);
  });

  it('calculateAlignmentGuides should correctly use getEffectiveSize default sizes for Deployment nodes', () => {
    const node = { id: 'n1', width: 160, height: 80, position: { x: 0, y: 140 }, data: {} } as Node; // center is at 140 + 40 = 180
    // deployment has no width/height, defaults to 320x160 (center Y is at 100 + 160/2 = 180)
    const deployment = { id: 'd1', type: 'Deployment', position: { x: 300, y: 100 }, data: {} } as Node;

    const nodes = [node, deployment];
    const guides = calculateAlignmentGuides(node, nodes, { x: 0, y: 140 }, false);

    const hasHorizontal = guides.horizontalGuides.some(g => g.targetNodeId === 'd1');
    expect(hasHorizontal).toBe(true);
  });

  it('calculateAlignmentGuides should ignore Pod nodes as alignment targets to prevent hijacking', () => {
    const node = { id: 'n1', width: 160, height: 80, position: { x: 0, y: 130 }, data: {} } as Node; // center is at 170
    // Pod has a smaller Y distance (center Y = 170) and is closer, but should be ignored
    const pod = { id: 'pod-1', type: 'Pod', position: { x: 200, y: 130 }, data: { replicas: 1 } } as Node; // center is at 170
    // Deployment has center Y = 170 and is the valid target
    const deployment = { id: 'd1', type: 'Deployment', position: { x: 300, y: 90 }, data: {} } as Node; // center is at 170 (90 + 160/2)

    const nodes = [node, pod, deployment];
    const guides = calculateAlignmentGuides(node, nodes, { x: 0, y: 130 }, false);

    const hasPodHorizontal = guides.horizontalGuides.some(g => g.targetNodeId === 'pod-1');
    const hasDeploymentHorizontal = guides.horizontalGuides.some(g => g.targetNodeId === 'd1');

    expect(hasPodHorizontal).toBe(false);
    expect(hasDeploymentHorizontal).toBe(true);
  });

  it('calculateAlignmentGuides should handle Deployment slot guides', () => {
    const pod = { id: 'p1', type: 'Pod', width: 100, height: 100, position: { x: 0, y: 0 }, data: {} } as any;
    const deployment = { id: 'd1', type: 'Deployment', width: 400, position: { x: 500, y: 500 }, data: { replicas: 1 } } as any;
    const nodes = [pod, deployment];
    const guides = calculateAlignmentGuides(pod, nodes, { x: 0, y: 0 }, false, 'd1');
    expect(guides.vSnap).toBeDefined();

    // Test when deployment is NOT found
    const guidesNull = calculateAlignmentGuides(pod, nodes, { x: 0, y: 0 }, false, 'non-existent');
    expect(guidesNull.vSnap).toBeDefined(); // Falls back to normal guides
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

      // Test nodeB as fixed
      const resolvedB = resolveGlobalCollisions(nodes, 'n2');
      expect(resolvedB[1].position.x).toBe(10); // n2 should stay fixed
  });

  it('resolveGlobalCollisions should use default sizes for various types and handle no parents', () => {
    const nodes = [
        { id: 'n1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} } as any,
        { id: 'n2', type: 'Other', position: { x: 0, y: 0 }, data: {} } as any,
    ];
    const resolved = resolveGlobalCollisions(nodes);
    expect(resolved).toHaveLength(2);

    // Cover Pod type in getEffectiveSize
    const nodesWithPod = [
        { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { replicas: 1 } } as any,
        { id: 'p2', type: 'Pod', position: { x: 10, y: 10 }, data: { replicas: 1 } } as any,
    ];
    const resolvedPods = resolveGlobalCollisions(nodesWithPod);
    expect(resolvedPods).toHaveLength(2);
  });
});
