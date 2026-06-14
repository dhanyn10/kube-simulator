import { describe, it, expect, vi } from 'vitest';
import { calculateOverlap, handlePodMoveToDeployment, handleGenericContainerMove } from '@/store/slices/node-handlers/dragUtils';

describe('dragUtils', () => {
  it('calculateOverlap detects partial intersections', () => {
    const node = { id: 'p1', width: 100, height: 100 } as any;
    const nodeAbs = { x: 150, y: 150 };
    const container = { id: 'd1', type: 'Deployment', width: 200, height: 200, position: { x: 0, y: 0 } } as any;
    const nodes = [container];

    const res = calculateOverlap(node, nodeAbs, container, nodes);
    expect(res.intersects).toBe(true);
    expect(res.overlapPercentage).toBe(25); // (50*50) / (100*100) * 100
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

  it('handlePodMoveToDeployment syncs replicas', () => {
      const pod = { id: 'p1', type: 'Pod', data: { replicas: 2 } } as any;
      const dep = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 0 } } as any;
      const nodes = [pod, dep];
      const get = () => ({}) as any;

      const result = handlePodMoveToDeployment('d1', dep, pod, nodes, undefined, get, pod);
      const updatedDep = result.find(n => n.id === 'd1');
      expect(updatedDep?.data.replicas).toBe(2);
  });
});
