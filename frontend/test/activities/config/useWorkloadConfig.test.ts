import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getReplicaValue,
  getUpdateReplicasTargetId,
  useWorkloadConfigHandler,
} from '@/activities/config/useWorkloadConfig';
import { checkWorkloadConnectedPvc } from '@/activities/config/workloadConfigHelpers';
import { useFlowStore } from '@/store';

describe('useWorkloadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ nodes: [] });
  });

  describe('getReplicaValue', () => {
    it('calculates replicas for Pod with parentId when pod group exists and handles baseName, label regex, and missing replica values', () => {
      const selectedNode = {
        id: 'p1',
        type: 'Pod',
        parentId: 'dep1',
        data: { baseName: 'worker', label: 'worker-abc12-xyz89', replicas: 2 },
      };

      const nodes = [
        selectedNode,
        {
          id: 'p2',
          type: 'Pod',
          parentId: 'dep1',
          data: { label: 'worker', replicas: 'invalid' }, // label without hash suffix
        },
        {
          id: 'p3',
          type: 'Pod',
          parentId: 'dep1',
          data: { label: 'other-label', replicas: 5 },
        },
        {
          id: 'p4',
          type: 'Pod',
          parentId: 'dep1',
          data: {}, // no label or baseName
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

    it('returns parent.data.replicas or fallback when parent is a Deployment/StatefulSet/ReplicaSet controller', () => {
      const parentDepNoReplicas = {
        id: 'dep1',
        type: 'Deployment',
        data: {}, // no replicas set
      };
      const childPodInDep = {
        id: 'p1',
        type: 'Pod',
        parentId: 'dep1',
        data: { replicas: 3 },
      };
      const parentSs = {
        id: 'ss1',
        type: 'StatefulSet',
        data: { replicas: 5 },
      };
      const childPodInSs = {
        id: 'p2',
        type: 'Pod',
        parentId: 'ss1',
        data: { replicas: 1 },
      };

      // parent.data.replicas is undefined, Number(undefined) || 1 => 1
      expect(getReplicaValue(childPodInDep, [parentDepNoReplicas, childPodInDep])).toBe(1);
      expect(getReplicaValue(childPodInSs, [parentSs, childPodInSs])).toBe(5);
    });

    it('returns data.replicas or fallback when Pod parentId points to a non-controller parent node (e.g. Namespace)', () => {
      const nsParent = {
        id: 'ns1',
        type: 'Namespace',
        data: {},
      };
      const childPodInNs = {
        id: 'p1',
        type: 'Pod',
        parentId: 'ns1',
        data: { label: 'worker', replicas: 5 },
      };

      expect(getReplicaValue(childPodInNs, [nsParent, childPodInNs])).toBe(5);
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

    it('returns parentId when parent is a controller (Deployment, StatefulSet, ReplicaSet, PodGroup)', () => {
      const podInDep = { id: 'p1', type: 'Pod', parentId: 'd1' };
      const podInSs = { id: 'p2', type: 'Pod', parentId: 'ss1' };
      const podInRs = { id: 'p3', type: 'Pod', parentId: 'rs1' };
      const podInPg = { id: 'p4', type: 'Pod', parentId: 'pg1' };

      const nodes = [
        { id: 'd1', type: 'Deployment' },
        { id: 'ss1', type: 'StatefulSet' },
        { id: 'rs1', type: 'ReplicaSet' },
        { id: 'pg1', type: 'PodGroup' },
      ];

      expect(getUpdateReplicasTargetId(podInDep, nodes as any)).toBe('d1');
      expect(getUpdateReplicasTargetId(podInSs, nodes as any)).toBe('ss1');
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

  describe('checkWorkloadConnectedPvc', () => {
    it('handles null selectedNode and unconnected nodes gracefully', () => {
      const res = checkWorkloadConnectedPvc(null as any, [], [], 1);
      expect(res.isConnectedToPvc).toBe(false);
      expect(res.isMultiReplicaRwoPvc).toBe(false);

      const depNode = { id: 'd1', type: 'Deployment', data: { label: 'web' } } as any;
      const resUnconnected = checkWorkloadConnectedPvc(depNode, [depNode], [], 1);
      expect(resUnconnected.isConnectedToPvc).toBe(false);
    });

    it('detects PVC connected via source and target edges and evaluates RWO multi-replica state', () => {
      const pvcNode = { id: 'pvc1', type: 'PVC', data: { label: 'db-vol', accessMode: 'ReadWriteOnce' } } as any;
      const depNode = { id: 'd1', type: 'Deployment', data: { label: 'db-app' } } as any;

      // 1. Source edge: depNode -> pvcNode with replicas = 3
      const edgeSource = { id: 'e1', source: 'd1', target: 'pvc1' } as any;
      const resRwo = checkWorkloadConnectedPvc(depNode, [pvcNode, depNode], [edgeSource], 3);
      expect(resRwo.isConnectedToPvc).toBe(true);
      expect(resRwo.connectedPvcAccessMode).toBe('ReadWriteOnce');
      expect(resRwo.isMultiReplicaRwoPvc).toBe(true);
      expect(resRwo.connectedPvcName).toBe('db-vol');

      // 2. Target edge: pvcNode -> depNode with replicas = 1
      const edgeTarget = { id: 'e2', source: 'pvc1', target: 'd1' } as any;
      const resSingle = checkWorkloadConnectedPvc(depNode, [pvcNode, depNode], [edgeTarget], 1);
      expect(resSingle.isConnectedToPvc).toBe(true);
      expect(resSingle.isMultiReplicaRwoPvc).toBe(false);

      // 3. PVC with ReadWriteMany access mode
      const pvcRwx = { id: 'pvc1', type: 'PVC', data: { accessMode: 'ReadWriteMany' } } as any;
      const resRwx = checkWorkloadConnectedPvc(depNode, [pvcRwx, depNode], [edgeSource], 3);
      expect(resRwx.isMultiReplicaRwoPvc).toBe(false);
    });

    it('covers child Pod with parentId connected to PVC and PVC with falsy label fallback', () => {
      const pvcNoLabel = { id: 'pvc-nolabel', type: 'PVC', data: { accessMode: 'ReadWriteOnce' } } as any;
      const parentDep = { id: 'dep-parent', type: 'Deployment', data: { label: 'parent-dep' } } as any;
      const childPod = { id: 'pod-child', type: 'Pod', data: { parentId: 'dep-parent' } } as any;
      const edge = { id: 'e1', source: 'dep-parent', target: 'pvc-nolabel' } as any;

      const res = checkWorkloadConnectedPvc(childPod, [pvcNoLabel, parentDep, childPod], [edge], 2);
      expect(res.isConnectedToPvc).toBe(true);
      expect(res.isMultiReplicaRwoPvc).toBe(true);
      expect(res.connectedPvcName).toBe('pvc-nolabel');
    });

    it('covers non-PVC edges on source/target and default ReadWriteOnce fallback when accessMode is undefined', () => {
      const depNode = { id: 'd1', type: 'Deployment', data: { label: 'web' } } as any;
      const svcNode = { id: 's1', type: 'Service', data: { label: 'svc' } } as any;
      const ingNode = { id: 'i1', type: 'Ingress', data: { label: 'ing' } } as any;
      // PVC without accessMode (falls back to 'ReadWriteOnce')
      const pvcNoAccessMode = { id: 'pvc-default-mode', type: 'PVC', data: { label: 'pvc-vol' } } as any;

      // e1: depNode -> svcNode (source matches workload, but target is Service, not PVC -> line 39 false branch)
      const edgeToSvc = { id: 'e1', source: 'd1', target: 's1' } as any;
      // e2: ingNode -> depNode (target matches workload, but source is Ingress, not PVC -> line 42 false branch)
      const edgeFromIng = { id: 'e2', source: 'i1', target: 'd1' } as any;
      // e3: ghost-node -> depNode (sourceNode is undefined -> line 42 false branch)
      const edgeGhost = { id: 'e3', source: 'non-existent', target: 'd1' } as any;
      // e4: depNode -> pvc-default-mode
      const edgeToPvc = { id: 'e4', source: 'd1', target: 'pvc-default-mode' } as any;
      // e5: unrelated edge where neither source nor target is in targetIds -> line 40 false branch
      const edgeUnrelated = { id: 'e5', source: 'other-a', target: 'other-b' } as any;

      const res = checkWorkloadConnectedPvc(
        depNode,
        [depNode, svcNode, ingNode, pvcNoAccessMode],
        [edgeToSvc, edgeFromIng, edgeGhost, edgeToPvc, edgeUnrelated],
        2
      );

      expect(res.isConnectedToPvc).toBe(true);
      expect(res.connectedPvcAccessMode).toBe('ReadWriteOnce');
      expect(res.isMultiReplicaRwoPvc).toBe(true);
      expect(res.connectedPvcName).toBe('pvc-vol');
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
