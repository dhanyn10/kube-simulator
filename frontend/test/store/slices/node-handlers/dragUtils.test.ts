import { describe, it, expect } from 'vitest';
import { calculateOverlap, handlePodMoveToDeployment, handleGenericContainerMove } from '@/store/slices/node-handlers/dragUtils';

describe('dragUtils', () => {
  it('calculateOverlap detects partial intersections and handles fallback dimensions', () => {
    const node = { id: 'p1', measured: { width: 100, height: 100 } } as any;
    const nodeAbs = { x: 150, y: 150 };
    const container = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 } } as any;
    const nodes = [container];

    const res = calculateOverlap(node, nodeAbs, container, nodes);
    expect(res.intersects).toBe(true);
    expect(res.overlapPercentage).toBe(10);

    const nsContainer = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 } } as any;
    const resNs = calculateOverlap(node, nodeAbs, nsContainer, [nsContainer]);
    expect(resNs.intersects).toBe(true);
  });

  it('calculateOverlap handles unmeasured node without width/height defaults', () => {
    const node = { id: 'p1' } as any;
    const nodeAbs = { x: 0, y: 0 };
    const container = { id: 'd1', type: 'Deployment', measured: { width: 320, height: 160 }, position: { x: 0, y: 0 } } as any;

    const res = calculateOverlap(node, nodeAbs, container, [container]);
    expect(res.intersects).toBe(true);
  });

  it('handleGenericContainerMove updates parent and position', () => {
    const node = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 } } as any;
    const targetParent = { id: 'ns1', type: 'Namespace', position: { x: 100, y: 100 }, data: {} } as any;
    const nodes = [node, targetParent];
    const absPos = { x: 150, y: 150 };
    const get = () => ({}) as any;

    const result = handleGenericContainerMove('ns1', node, nodes, undefined, absPos, get);
    const movedNode = result.find(n => n.id === 'p1');
    expect(movedNode?.parentId).toBe('ns1');
    expect(movedNode?.position).toEqual({ x: 50, y: 50 });
  });

  it('handleGenericContainerMove syncs old parent deployment when moving pod out', () => {
    const pod = { id: 'p1', type: 'Pod', parentId: 'd1', data: { replicas: 1 } } as any;
    const oldDep = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 2 } } as any;
    const ns = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} } as any;
    const nodes = [pod, oldDep, ns];
    const absPos = { x: 10, y: 10 };
    const get = () => ({}) as any;

    const result = handleGenericContainerMove('ns1', pod, nodes, 'd1', absPos, get);
    const updatedOldDep = result.find(n => n.id === 'd1');
    expect(updatedOldDep?.data.replicas).toBe(1);
  });

  it('handlePodMoveToDeployment syncs replicas and handles old parent deployment or non-deployment parent', () => {
    const pod = { id: 'p1', type: 'Pod', parentId: 'd1', data: { replicas: 2 } } as any;
    const oldDep = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 3 } } as any;
    const targetDep = { id: 'd2', type: 'Deployment', position: { x: 100, y: 100 }, data: { replicas: 0 } } as any;
    const nodes = [pod, oldDep, targetDep];
    const get = () => ({}) as any;

    const result = handlePodMoveToDeployment('d2', targetDep, pod, nodes, 'd1', get, pod);
    const updatedTargetDep = result.find(n => n.id === 'd2');
    expect(updatedTargetDep?.data.replicas).toBe(2);

    const updatedOldDep = result.find(n => n.id === 'd1');
    expect(updatedOldDep?.data.replicas).toBe(1);

    // Test with non-Deployment/non-ReplicaSet old parent
    const oldNs = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} } as any;
    const result2 = handlePodMoveToDeployment('d2', targetDep, pod, [pod, oldNs, targetDep], 'ns1', get, pod);
    expect(result2).toBeDefined();
  });
});
