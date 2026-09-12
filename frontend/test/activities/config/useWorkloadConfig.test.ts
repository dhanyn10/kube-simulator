import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getReplicaValue,
  getUpdateReplicasTargetId,
  useWorkloadConfigHandler,
} from '@/activities/config/useWorkloadConfig';
import { useFlowStore } from '@/store';

describe('useWorkloadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ nodes: [] });
  });

  describe('getReplicaValue', () => {
    it('calculates replicas for Pod with parentId when pod group exists and handles missing replica values', () => {
      const selectedNode = {
        id: 'p1',
        type: 'Pod',
        parentId: 'dep1',
        data: { label: 'worker', replicas: 2 },
      };

      const nodes = [
        selectedNode,
        {
          id: 'p2',
          type: 'Pod',
          parentId: 'dep1',
          data: { label: 'worker', replicas: 'invalid' },
        },
        {
          id: 'p3',
          type: 'Pod',
          parentId: 'dep1',
          data: { label: 'other-label', replicas: 5 },
        },
      ];

      // 2 + 1 (from fallback Number('invalid') || 1) = 3
      expect(getReplicaValue(selectedNode, nodes as any)).toBe(3);
    });

    it('returns data.replicas or fallback when Pod has parentId but no matching pod group is found', () => {
      const selectedNode = {
        id: 'p1',
        type: 'Pod',
        parentId: 'dep1',
        data: { label: 'worker', replicas: 4 },
      };

      // Empty nodes list
      expect(getReplicaValue(selectedNode, [])).toBe(4);
    });

    it('returns default fallback of 1 for standalone Pod with no replicas property', () => {
      const selectedNode = {
        id: 'p1',
        type: 'Pod',
        data: {},
      };

      expect(getReplicaValue(selectedNode, [])).toBe(1);
    });

    it('returns data.replicas or 0 for non-Pod workload node without replicas property', () => {
      const nodeWithReplicas = {
        id: 'd1',
        type: 'Deployment',
        data: { replicas: 3 },
      };

      const nodeWithoutReplicas = {
        id: 's1',
        type: 'Service',
        data: {},
      };

      expect(getReplicaValue(nodeWithReplicas, [])).toBe(3);
      expect(getReplicaValue(nodeWithoutReplicas, [])).toBe(0);
    });
  });

  describe('getUpdateReplicasTargetId', () => {
    it('returns selectedNode.id for non-Pod or Pod without parentId', () => {
      const depNode = { id: 'd1', type: 'Deployment' };
      const podWithoutParent = { id: 'p1', type: 'Pod' };

      expect(getUpdateReplicasTargetId(depNode, [])).toBe('d1');
      expect(getUpdateReplicasTargetId(podWithoutParent, [])).toBe('p1');
    });

    it('returns parentId when parent is a controller (Deployment, ReplicaSet, PodGroup)', () => {
      const podInDep = { id: 'p1', type: 'Pod', parentId: 'd1' };
      const podInRs = { id: 'p2', type: 'Pod', parentId: 'rs1' };
      const podInPg = { id: 'p3', type: 'Pod', parentId: 'pg1' };

      const nodes = [
        { id: 'd1', type: 'Deployment' },
        { id: 'rs1', type: 'ReplicaSet' },
        { id: 'pg1', type: 'PodGroup' },
      ];

      expect(getUpdateReplicasTargetId(podInDep, nodes as any)).toBe('d1');
      expect(getUpdateReplicasTargetId(podInRs, nodes as any)).toBe('rs1');
      expect(getUpdateReplicasTargetId(podInPg, nodes as any)).toBe('pg1');
    });

    it('returns selectedNode.id when parent is not a controller or parent is missing', () => {
      const podInNs = { id: 'p1', type: 'Pod', parentId: 'ns1' };
      const podWithMissingParent = { id: 'p2', type: 'Pod', parentId: 'unknown' };

      const nodes = [{ id: 'ns1', type: 'Namespace' }];

      expect(getUpdateReplicasTargetId(podInNs, nodes as any)).toBe('p1');
      expect(getUpdateReplicasTargetId(podWithMissingParent, nodes as any)).toBe('p2');
    });
  });

  describe('useWorkloadConfigHandler', () => {
    it('returns replicaValue and handles updateReplicas by invoking updateNodeData on flow store', () => {
      const updateNodeDataMock = vi.fn();
      const parentDep = { id: 'd1', type: 'Deployment', data: { replicas: 2 } };
      const podNode = { id: 'p1', type: 'Pod', parentId: 'd1', data: { label: 'web', replicas: 2 } };

      useFlowStore.setState({
        nodes: [parentDep, podNode] as any,
        updateNodeData: updateNodeDataMock,
      });

      const { result } = renderHook(() => useWorkloadConfigHandler(podNode));

      expect(result.current.replicaValue).toBe(2);

      act(() => {
        result.current.updateReplicas(5);
      });

      expect(updateNodeDataMock).toHaveBeenCalledWith('d1', { replicas: 5 });
    });
  });
});
