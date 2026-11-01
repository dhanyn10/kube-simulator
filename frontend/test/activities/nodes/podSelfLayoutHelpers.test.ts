import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Node } from '@xyflow/react';
import { useFlowStore } from '@/store';
import {
  getPodEffectiveBounds,
  isPodOverlappingWithSibling,
  checkPodOverlapWithSiblings,
  autoAdjustWorkloadPodLayout,
  usePodOverlapAutoCorrection,
} from '@/activities/nodes/podSelfLayoutHelpers';

describe('podSelfLayoutHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      draggedNodeId: null,
    });
  });

  describe('getPodEffectiveBounds', () => {
    it('returns bounding box with width and height from node properties', () => {
      const pod: Node = {
        id: 'p1',
        type: 'Pod',
        position: { x: 50, y: 70 },
        width: 180,
        height: 120,
        data: {},
      };
      const bounds = getPodEffectiveBounds(pod);
      expect(bounds).toEqual({ x: 50, y: 70, width: 180, height: 120 });
    });

    it('falls back to measured dimensions or default minimum size when width/height are undefined', () => {
      const pod: Node = {
        id: 'p1',
        type: 'Pod',
        position: { x: 10, y: 20 },
        measured: { width: 160, height: 90 },
        data: {},
      };
      const bounds = getPodEffectiveBounds(pod);
      expect(bounds.x).toBe(10);
      expect(bounds.y).toBe(20);
      expect(bounds.width).toBe(160);
      expect(bounds.height).toBe(90);
    });
  });

  describe('isPodOverlappingWithSibling', () => {
    it('returns false when comparing the exact same pod id', () => {
      const podA: Node = { id: 'p1', type: 'Pod', position: { x: 10, y: 10 }, data: {} };
      expect(isPodOverlappingWithSibling(podA, podA)).toBe(false);
    });

    it('returns true when pods have identical or near-identical coordinates', () => {
      const podA: Node = { id: 'p1', type: 'Pod', position: { x: 25, y: 80 }, data: {} };
      const podB: Node = { id: 'p2', type: 'Pod', position: { x: 26, y: 81 }, data: {} };
      expect(isPodOverlappingWithSibling(podA, podB)).toBe(true);
    });

    it('returns true when pod bounding boxes intersect with overlap', () => {
      const podA: Node = {
        id: 'p1',
        type: 'Pod',
        position: { x: 25, y: 50 },
        width: 160,
        height: 80,
        data: {},
      };
      const podB: Node = {
        id: 'p2',
        type: 'Pod',
        position: { x: 100, y: 80 }, // Partially inside podA
        width: 160,
        height: 80,
        data: {},
      };
      expect(isPodOverlappingWithSibling(podA, podB)).toBe(true);
    });

    it('returns false when pods are positioned cleanly without overlap', () => {
      const podA: Node = {
        id: 'p1',
        type: 'Pod',
        position: { x: 24, y: 48 },
        width: 160,
        height: 80,
        data: {},
      };
      const podB: Node = {
        id: 'p2',
        type: 'Pod',
        position: { x: 24, y: 148 }, // 20px gap below podA
        width: 160,
        height: 80,
        data: {},
      };
      expect(isPodOverlappingWithSibling(podA, podB)).toBe(false);
    });
  });

  describe('checkPodOverlapWithSiblings', () => {
    it('returns false when pod does not exist or is not a Pod type', () => {
      const nodes: Node[] = [{ id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} }];
      expect(checkPodOverlapWithSiblings('non-existent', nodes)).toEqual({ hasOverlap: false, parentNode: null });
      expect(checkPodOverlapWithSiblings('d1', nodes)).toEqual({ hasOverlap: false, parentNode: null });
    });

    it('returns false when pod has no parent or parent is not a workload controller', () => {
      const standalonePod: Node = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
      expect(checkPodOverlapWithSiblings('p1', [standalonePod])).toEqual({ hasOverlap: false, parentNode: null });

      const ns: Node = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
      const nsPod: Node = { id: 'p2', type: 'Pod', parentId: 'ns1', position: { x: 0, y: 0 }, data: {} };
      expect(checkPodOverlapWithSiblings('p2', [ns, nsPod])).toEqual({ hasOverlap: false, parentNode: null });
    });

    it('detects overlap for a Pod inside Deployment and returns parentNode', () => {
      const deployment: Node = {
        id: 'dep1',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: { replicas: 2, label: 'app-dep' },
      };
      const pod1: Node = { id: 'p1', type: 'Pod', parentId: 'dep1', position: { x: 25, y: 80 }, data: {} };
      const pod2: Node = { id: 'p2', type: 'Pod', parentId: 'dep1', position: { x: 25, y: 80 }, data: {} };

      const result = checkPodOverlapWithSiblings('p1', [deployment, pod1, pod2]);
      expect(result.hasOverlap).toBe(true);
      expect(result.parentNode?.id).toBe('dep1');
    });

    it('detects overlap for a Pod inside ReplicaSet', () => {
      const rs: Node = {
        id: 'rs1',
        type: 'ReplicaSet',
        position: { x: 0, y: 0 },
        data: { replicas: 2, label: 'app-rs' },
      };
      const pod1: Node = { id: 'p1', type: 'Pod', parentId: 'rs1', position: { x: 24, y: 30 }, data: {} };
      const pod2: Node = { id: 'p2', type: 'Pod', parentId: 'rs1', position: { x: 24, y: 30 }, data: {} };

      const result = checkPodOverlapWithSiblings('p2', [rs, pod1, pod2]);
      expect(result.hasOverlap).toBe(true);
      expect(result.parentNode?.id).toBe('rs1');
    });

    it('detects overlap for a Pod inside StatefulSet when parentId is stored in data', () => {
      const ss: Node = {
        id: 'ss1',
        type: 'StatefulSet',
        position: { x: 0, y: 0 },
        data: { replicas: 2, label: 'app-ss' },
      };
      const pod1: Node = { id: 'p1', type: 'Pod', data: { parentId: 'ss1' }, position: { x: 25, y: 48 } };
      const pod2: Node = { id: 'p2', type: 'Pod', data: { parentId: 'ss1' }, position: { x: 25, y: 48 } };

      const result = checkPodOverlapWithSiblings('p1', [ss, pod1, pod2]);
      expect(result.hasOverlap).toBe(true);
      expect(result.parentNode?.id).toBe('ss1');
    });

    it('returns false when child pods inside controller are neatly separated', () => {
      const deployment: Node = {
        id: 'dep1',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: { replicas: 2, label: 'app-dep' },
      };
      const pod1: Node = {
        id: 'p1',
        type: 'Pod',
        parentId: 'dep1',
        position: { x: 24, y: 48 },
        width: 160,
        height: 80,
        data: {},
      };
      const pod2: Node = {
        id: 'p2',
        type: 'Pod',
        parentId: 'dep1',
        position: { x: 24, y: 150 },
        width: 160,
        height: 80,
        data: {},
      };

      const result = checkPodOverlapWithSiblings('p1', [deployment, pod1, pod2]);
      expect(result.hasOverlap).toBe(false);
      expect(result.parentNode?.id).toBe('dep1');
    });
  });

  describe('autoAdjustWorkloadPodLayout', () => {
    it('returns false when a node is actively being dragged', () => {
      useFlowStore.setState({ draggedNodeId: 'some-node' });
      const parentNode: Node = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const result = autoAdjustWorkloadPodLayout(
        parentNode,
        () => useFlowStore.getState(),
        (patch) => useFlowStore.setState(patch)
      );
      expect(result).toBe(false);
    });

    it('performs Yoga layout auto-adjustment and separates overlapping pods', async () => {
      const deployment: Node = {
        id: 'dep1',
        type: 'Deployment',
        position: { x: 100, y: 100 },
        data: { replicas: 2, label: 'test-app' },
      };
      const pod1: Node = {
        id: 'p1',
        type: 'Pod',
        parentId: 'dep1',
        position: { x: 25, y: 80 },
        data: { label: 'p1' },
      };
      const pod2: Node = {
        id: 'p2',
        type: 'Pod',
        parentId: 'dep1',
        position: { x: 25, y: 80 }, // Stacked at exact same spot
        data: { label: 'p2' },
      };

      useFlowStore.setState({ nodes: [deployment, pod1, pod2] });

      // Fast-forward cooldown timer if any
      await new Promise((r) => setTimeout(r, 60));

      const adjusted = autoAdjustWorkloadPodLayout(
        deployment,
        () => useFlowStore.getState(),
        (patch) => useFlowStore.setState(patch)
      );
      expect(adjusted).toBe(true);

      const updatedNodes = useFlowStore.getState().nodes;
      const updatedP1 = updatedNodes.find((n) => n.id === 'p1');
      const updatedP2 = updatedNodes.find((n) => n.id === 'p2');

      expect(updatedP1).toBeDefined();
      expect(updatedP2).toBeDefined();
      expect(updatedP2!.position.y).toBeGreaterThan(updatedP1!.position.y);
    });
  });

  describe('usePodOverlapAutoCorrection hook', () => {
    it('automatically checks and corrects overlap when rendered for an overlapping pod', async () => {
      const deployment: Node = {
        id: 'dep1',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: { replicas: 2, label: 'auto-app' },
      };
      const pod1: Node = {
        id: 'p1',
        type: 'Pod',
        parentId: 'dep1',
        position: { x: 25, y: 80 },
        data: {},
      };
      const pod2: Node = {
        id: 'p2',
        type: 'Pod',
        parentId: 'dep1',
        position: { x: 25, y: 80 },
        data: {},
      };

      useFlowStore.setState({ nodes: [deployment, pod1, pod2] });
      await new Promise((r) => setTimeout(r, 60));

      renderHook(() => usePodOverlapAutoCorrection('p1'));

      const nodesAfter = useFlowStore.getState().nodes;
      const p1After = nodesAfter.find((n) => n.id === 'p1');
      const p2After = nodesAfter.find((n) => n.id === 'p2');
      expect(p2After!.position.y).toBeGreaterThan(p1After!.position.y);
    });
  });
});
