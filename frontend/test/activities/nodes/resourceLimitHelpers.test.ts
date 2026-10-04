import { describe, it, expect } from 'vitest';
import { hasResourceLimitAttachedOrConnected } from '@/activities/nodes/resourceLimitHelpers';
import { Node, Edge } from '@xyflow/react';

describe('resourceLimitHelpers', () => {
  it('returns false when targetNode or targetNode.data is null/undefined', () => {
    expect(hasResourceLimitAttachedOrConnected(null, [], [])).toBe(false);
    expect(hasResourceLimitAttachedOrConnected(undefined, [], [])).toBe(false);
    expect(hasResourceLimitAttachedOrConnected({ id: 'n1', position: { x: 0, y: 0 }, data: null } as any, [], [])).toBe(false);
  });

  it('returns true when targetNode has attached resourceLimits array', () => {
    const node: Node = {
      id: 'dep-1',
      position: { x: 0, y: 0 },
      data: {
        resourceLimits: [{ id: 'rl-1', name: 'limit-1', cpuLimit: '500m' }],
      },
    };

    expect(hasResourceLimitAttachedOrConnected(node, [node], [])).toBe(true);
  });

  it('returns true when targetNode data has explicit limit/request properties', () => {
    const nodeCpuLimit: Node = { id: 'p1', position: { x: 0, y: 0 }, data: { cpuLimit: '1000m' } };
    const nodeCpuReq: Node = { id: 'p2', position: { x: 0, y: 0 }, data: { cpuRequest: '500m' } };
    const nodeMemLimit: Node = { id: 'p3', position: { x: 0, y: 0 }, data: { memoryLimit: '512Mi' } };
    const nodeMemReq: Node = { id: 'p4', position: { x: 0, y: 0 }, data: { memoryRequest: '256Mi' } };

    expect(hasResourceLimitAttachedOrConnected(nodeCpuLimit, [], [])).toBe(true);
    expect(hasResourceLimitAttachedOrConnected(nodeCpuReq, [], [])).toBe(true);
    expect(hasResourceLimitAttachedOrConnected(nodeMemLimit, [], [])).toBe(true);
    expect(hasResourceLimitAttachedOrConnected(nodeMemReq, [], [])).toBe(true);
  });

  it('returns true when targetNode is connected to a ResourceLimit node via an edge', () => {
    const resLimitNode: Node = { id: 'rl-node', type: 'ResourceLimit', position: { x: 0, y: 0 }, data: {} };
    const targetNode: Node = { id: 'dep-target', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
    const edge: Edge = { id: 'e1', source: 'rl-node', target: 'dep-target' };

    const nodes = [resLimitNode, targetNode];
    const edges = [edge];

    expect(hasResourceLimitAttachedOrConnected(targetNode, nodes, edges)).toBe(true);
  });

  it('returns false when targetNode has no attached or connected resource limits', () => {
    const otherNode: Node = { id: 'svc-node', type: 'Service', position: { x: 0, y: 0 }, data: {} };
    const targetNode: Node = { id: 'dep-target', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
    const edge: Edge = { id: 'e1', source: 'svc-node', target: 'dep-target' };

    const nodes = [otherNode, targetNode];
    const edges = [edge];

    expect(hasResourceLimitAttachedOrConnected(targetNode, nodes, edges)).toBe(false);
  });
});
