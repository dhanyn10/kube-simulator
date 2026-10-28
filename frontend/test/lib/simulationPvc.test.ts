import { describe, it, expect, vi } from 'vitest';
import { Node, Edge } from '@xyflow/react';
import {
  countConnectedPvcReplicas,
  checkPvcReadiness,
  handleUnboundPvcs,
  handleBoundPvcs,
} from '@/lib/simulationPvc';
import { SimulationContext } from '@/lib/simulationTypes';
import * as utils from '@/lib/utils';

describe('simulationPvc', () => {
  const createMockCtx = (nodes: Node[] = [], edges: Edge[] = []): SimulationContext => {
    const updatedNodes = nodes.map(n => ({ ...n, data: { ...n.data } }));
    const edgeMap = new Map<string, Edge[]>();
    const targetEdgeMap = new Map<string, Edge[]>();
    const nodeMap = new Map<string, Node>();
    const childPodMap = new Map<string, Node[]>();

    edges.forEach(e => {
      const outList = edgeMap.get(e.source) || [];
      outList.push(e);
      edgeMap.set(e.source, outList);

      const inList = targetEdgeMap.get(e.target) || [];
      inList.push(e);
      targetEdgeMap.set(e.target, inList);
    });

    nodes.forEach(n => {
      nodeMap.set(n.id, n);
      if (n.type === 'Pod' && n.parentId) {
        const pods = childPodMap.get(n.parentId) || [];
        pods.push(n);
        childPodMap.set(n.parentId, pods);
      }
    });

    return {
      nodes,
      edges,
      activeSimulationEdges: [],
      updatedNodes,
      newMetrics: {},
      ticks: 1,
      get: vi.fn().mockReturnValue({ addLog: vi.fn() } as any),
      set: vi.fn(),
      edgeMap,
      targetEdgeMap,
      nodeMap,
      childPodMap,
    };
  };

  describe('countConnectedPvcReplicas', () => {
    it('counts replicas from StatefulSet workloadType returning 1', () => {
      const pvcNode: Node = { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } };
      const ssNode: Node = {
        id: 'workload-ss',
        type: 'Pod',
        data: { workloadType: 'StatefulSet', replicas: 5 },
        position: { x: 0, y: 0 },
      };
      const edge: Edge = { id: 'e1', source: 'pvc-1', target: 'workload-ss' };

      const ctx = createMockCtx([pvcNode, ssNode], [edge]);
      const result = countConnectedPvcReplicas(pvcNode, ctx);

      expect(result.totalReplicas).toBe(1);
      expect(result.connectedEdges.length).toBe(1);
    });

    it('counts replicas for controllers with invalid or valid replica numbers', () => {
      const pvcNode: Node = { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } };
      const depInvalid: Node = {
        id: 'dep-invalid',
        type: 'Deployment',
        data: { replicas: 'invalid' as any },
        position: { x: 0, y: 0 },
      };
      const depValid: Node = {
        id: 'dep-valid',
        type: 'StatefulSet',
        data: { replicas: 3 },
        position: { x: 0, y: 0 },
      };
      const edge1: Edge = { id: 'e1', source: 'dep-invalid', target: 'pvc-1' };
      const edge2: Edge = { id: 'e2', source: 'pvc-1', target: 'dep-valid' };

      const ctx = createMockCtx([pvcNode, depInvalid, depValid], [edge1, edge2]);
      const result = countConnectedPvcReplicas(pvcNode, ctx);

      // depInvalid fallback is 1, depValid is 3 => total = 4
      expect(result.totalReplicas).toBe(4);
    });

    it('avoids double-counting child pod when its parent controller is also connected', () => {
      const pvcNode: Node = { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } };
      const parentDep: Node = {
        id: 'parent-dep',
        type: 'Deployment',
        data: { replicas: 2 },
        position: { x: 0, y: 0 },
      };
      const childPod: Node = {
        id: 'child-pod',
        type: 'Pod',
        parentId: 'parent-dep',
        data: { parentId: 'parent-dep' },
        position: { x: 0, y: 0 },
      };
      const standalonePod: Node = {
        id: 'standalone-pod',
        type: 'Pod',
        data: {},
        position: { x: 0, y: 0 },
      };

      const edges: Edge[] = [
        { id: 'e1', source: 'pvc-1', target: 'parent-dep' },
        { id: 'e2', source: 'pvc-1', target: 'child-pod' },
        { id: 'e3', source: 'pvc-1', target: 'standalone-pod' },
      ];

      const ctx = createMockCtx([pvcNode, parentDep, childPod, standalonePod], edges);
      const result = countConnectedPvcReplicas(pvcNode, ctx);

      // parentDep = 2, childPod = 0 (parent is in connectedWorkloadIds), standalonePod = 1 => total = 3
      expect(result.totalReplicas).toBe(3);
    });

    it('falls back to updatedNodes and nodes when nodeMap is missing or workload is not found', () => {
      const pvcNode: Node = { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } };
      const depNode: Node = { id: 'dep-1', type: 'Deployment', data: { replicas: 2 }, position: { x: 0, y: 0 } };
      const edge: Edge = { id: 'e1', source: 'pvc-1', target: 'dep-1' };
      const phantomEdge: Edge = { id: 'e2', source: 'pvc-1', target: 'non-existent' };

      const ctx = createMockCtx([pvcNode, depNode], [edge, phantomEdge]);
      delete ctx.nodeMap; // test fallback to ctx.updatedNodes / ctx.nodes

      const result = countConnectedPvcReplicas(pvcNode, ctx);
      expect(result.totalReplicas).toBe(2);
    });
  });

  describe('checkPvcReadiness', () => {
    it('returns false when no PVCs are connected to workload', () => {
      const dep: Node = { id: 'dep-1', type: 'Deployment', data: {}, position: { x: 0, y: 0 } };
      const ctx = createMockCtx([dep], []);
      const result = checkPvcReadiness(dep, ctx);

      expect(result).toEqual({ hasChanges: false, isBlocked: false });
    });

    it('triggers and resolves Multi-Attach Error on ReadWriteOnce PVC with multiple replicas', () => {
      const pvcNode: Node = {
        id: 'pvc-1',
        type: 'PVC',
        data: { label: 'my-vol', accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' },
        position: { x: 0, y: 0 },
      };
      const depNode: Node = {
        id: 'dep-1',
        type: 'Deployment',
        data: { replicas: 2 },
        position: { x: 0, y: 0 },
      };
      const pod1: Node = {
        id: 'pod-1',
        type: 'Pod',
        parentId: 'dep-1',
        data: { status: 'ready', image: 'nginx:latest' },
        position: { x: 0, y: 0 },
      };
      const edge: Edge = { id: 'e1', source: 'dep-1', target: 'pvc-1', data: {} };

      const ctx = createMockCtx([pvcNode, depNode, pod1], [edge]);

      // 1. Initial multi-attach conflict
      const conflictRes = checkPvcReadiness(depNode, ctx);
      expect(conflictRes.isBlocked).toBe(true);
      expect(conflictRes.hasChanges).toBe(true);
      expect(ctx.updatedNodes.find(n => n.id === 'pvc-1')?.data.pvcStatus).toBe('Multi-Attach Error');
      expect(ctx.updatedNodes.find(n => n.id === 'pod-1')?.data.status).toBe('pending');
      expect(edge.data?.validationError).toContain('Multi-Attach Error');

      // 2. Calling again while already in error status
      const repeatRes = checkPvcReadiness(depNode, ctx);
      expect(repeatRes.isBlocked).toBe(true);

      // 3. Resolve conflict by scaling down to 1 replica (syncing state across ticks)
      ctx.nodes = ctx.updatedNodes.map(n => ({ ...n, data: { ...n.data } }));
      ctx.nodeMap = new Map(ctx.nodes.map(n => [n.id, n]));
      const depInNodes = ctx.nodes.find(n => n.id === 'dep-1');
      if (depInNodes) depInNodes.data.replicas = 1;
      const updatedDep = ctx.updatedNodes.find(n => n.id === 'dep-1');
      if (updatedDep) updatedDep.data.replicas = 1;

      const resolveRes = checkPvcReadiness(depInNodes || depNode, ctx);
      expect(resolveRes.isBlocked).toBe(false);
      expect(resolveRes.hasChanges).toBe(true);
      expect(ctx.updatedNodes.find(n => n.id === 'pvc-1')?.data.pvcStatus).toBe('Bound');
      expect(edge.data?.validationError).toBeUndefined();
    });

    it('does not trigger Multi-Attach Error for ReadWriteMany access mode with multiple replicas', () => {
      const pvcNode: Node = {
        id: 'pvc-rwm',
        type: 'PVC',
        data: { accessMode: 'ReadWriteMany', pvcStatus: 'Bound' },
        position: { x: 0, y: 0 },
      };
      const depNode: Node = {
        id: 'dep-1',
        type: 'Deployment',
        data: { replicas: 3 },
        position: { x: 0, y: 0 },
      };
      const podNode: Node = {
        id: 'pod-1',
        type: 'Pod',
        parentId: 'dep-1',
        data: { status: 'pending', image: 'redis:latest' },
        position: { x: 0, y: 0 },
      };
      const edge: Edge = { id: 'e1', source: 'pvc-rwm', target: 'dep-1' };

      const ctx = createMockCtx([pvcNode, depNode, podNode], [edge]);
      const res = checkPvcReadiness(depNode, ctx);

      expect(res.isBlocked).toBe(false);
      // Bound pods are transitioned to ready
      expect(ctx.updatedNodes.find(n => n.id === 'pod-1')?.data.status).toBe('ready');
    });

    it('handles logging catch blocks when addLog throws error during multi-attach and resolve', () => {
      const pvcNode: Node = {
        id: 'pvc-1',
        type: 'PVC',
        data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' },
        position: { x: 0, y: 0 },
      };
      const depNode: Node = {
        id: 'dep-1',
        type: 'Deployment',
        data: { replicas: 2 },
        position: { x: 0, y: 0 },
      };
      const edge: Edge = { id: 'e1', source: 'pvc-1', target: 'dep-1' };

      const ctx = createMockCtx([pvcNode, depNode], [edge]);
      ctx.get = vi.fn().mockReturnValue({
        addLog: vi.fn().mockImplementation(() => {
          throw new Error('Log dispatch failed');
        }),
      });

      expect(() => checkPvcReadiness(depNode, ctx)).not.toThrow();

      // Resolve step with throw
      ctx.nodes = ctx.updatedNodes.map(n => ({ ...n, data: { ...n.data } }));
      ctx.nodeMap = new Map(ctx.nodes.map(n => [n.id, n]));
      const depInNodesThrow = ctx.nodes.find(n => n.id === 'dep-1');
      if (depInNodesThrow) depInNodesThrow.data.replicas = 1;
      const updatedDepThrow = ctx.updatedNodes.find(n => n.id === 'dep-1');
      if (updatedDepThrow) updatedDepThrow.data.replicas = 1;

      expect(() => checkPvcReadiness(depInNodesThrow || depNode, ctx)).not.toThrow();
    });

    it('handles unbound PVC state and blocks workload readiness', () => {
      const pvcNode: Node = {
        id: 'pvc-unbound',
        type: 'PVC',
        data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Pending' },
        position: { x: 0, y: 0 },
      };
      const podNode: Node = {
        id: 'pod-1',
        type: 'Pod',
        data: { status: 'ready', image: 'nginx:alpine' },
        position: { x: 0, y: 0 },
      };
      const edge: Edge = { id: 'e1', source: 'pod-1', target: 'pvc-unbound' };

      const ctx = createMockCtx([pvcNode, podNode], [edge]);
      const res = checkPvcReadiness(podNode, ctx);

      expect(res.isBlocked).toBe(true);
      expect(ctx.updatedNodes.find(n => n.id === 'pod-1')?.data.status).toBe('pending');
    });
  });

  describe('handleUnboundPvcs and handleBoundPvcs', () => {
    it('attempts binding unbound PVC when safeRandom exceeds 0.7', () => {
      const pvcUnbound: Node = { id: 'pvc-1', type: 'PVC', data: { pvcStatus: 'Pending' }, position: { x: 0, y: 0 } };
      const pvcBound: Node = { id: 'pvc-2', type: 'PVC', data: { pvcStatus: 'Bound' }, position: { x: 0, y: 0 } };
      const pvcError: Node = { id: 'pvc-3', type: 'PVC', data: { pvcStatus: 'Multi-Attach Error' }, position: { x: 0, y: 0 } };
      const readyPod: Node = { id: 'pod-1', type: 'Pod', data: { status: 'ready' }, position: { x: 0, y: 0 } };

      const ctx = createMockCtx([pvcUnbound, pvcBound, pvcError, readyPod], []);

      const safeRandomSpy = vi.spyOn(utils, 'safeRandom').mockReturnValue(0.9);
      const res = handleUnboundPvcs([pvcUnbound, pvcBound, pvcError], [readyPod], ctx);

      expect(res.isBlocked).toBe(true);
      expect(res.hasChanges).toBe(true);
      expect(ctx.updatedNodes.find(n => n.id === 'pvc-1')?.data.pvcStatus).toBe('Bound');
      expect(ctx.updatedNodes.find(n => n.id === 'pod-1')?.data.status).toBe('pending');

      safeRandomSpy.mockRestore();
    });

    it('does not bind unbound PVC when safeRandom is 0.7 or lower', () => {
      const pvcUnbound: Node = { id: 'pvc-1', type: 'PVC', data: { pvcStatus: 'Pending' }, position: { x: 0, y: 0 } };
      const pendingPod: Node = { id: 'pod-1', type: 'Pod', data: { status: 'pending' }, position: { x: 0, y: 0 } };

      const ctx = createMockCtx([pvcUnbound, pendingPod], []);
      const safeRandomSpy = vi.spyOn(utils, 'safeRandom').mockReturnValue(0.5);

      const res = handleUnboundPvcs([pvcUnbound], [pendingPod], ctx);
      expect(res.hasChanges).toBe(false);
      expect(ctx.updatedNodes.find(n => n.id === 'pvc-1')?.data.pvcStatus).toBe('Pending');

      safeRandomSpy.mockRestore();
    });

    it('handles bound PVCs transitioning pending pods with images to ready', () => {
      const podWithImage: Node = { id: 'p1', type: 'Pod', data: { status: 'pending', image: 'nginx:1.25' }, position: { x: 0, y: 0 } };
      const podNoImage: Node = { id: 'p2', type: 'Pod', data: { status: 'pending' }, position: { x: 0, y: 0 } };
      const podAlreadyReady: Node = { id: 'p3', type: 'Pod', data: { status: 'ready', image: 'busybox' }, position: { x: 0, y: 0 } };

      const ctx = createMockCtx([podWithImage, podNoImage, podAlreadyReady], []);
      const res = handleBoundPvcs([podWithImage, podNoImage, podAlreadyReady], ctx);

      expect(res.hasChanges).toBe(true);
      expect(res.isBlocked).toBe(false);
      expect(ctx.updatedNodes.find(n => n.id === 'p1')?.data.status).toBe('ready');
      expect(ctx.updatedNodes.find(n => n.id === 'p2')?.data.status).toBe('pending');
      expect(ctx.updatedNodes.find(n => n.id === 'p3')?.data.status).toBe('ready');
    });

    it('covers edge cases: unrelated edges, missing accessMode, updateNodeData failure and non-ready pods', () => {
      // 1. PVC without accessMode fallback to ReadWriteOnce
      const pvcNoAccessMode: Node = { id: 'pvc-no-mode', type: 'PVC', data: {}, position: { x: 0, y: 0 } };
      const dep: Node = { id: 'dep-1', type: 'Deployment', data: { replicas: 2 }, position: { x: 0, y: 0 } };
      const podAlreadyPending: Node = { id: 'pod-pending', type: 'Pod', parentId: 'dep-1', data: { status: 'pending' }, position: { x: 0, y: 0 } };
      
      const edgePvc: Edge = { id: 'e1', source: 'pvc-no-mode', target: 'dep-1', data: {} };
      // Unrelated edge to cover line 63
      const unrelatedEdge: Edge = { id: 'e-unrelated', source: 'other-1', target: 'other-2' };

      const ctx = createMockCtx([pvcNoAccessMode, dep, podAlreadyPending], [edgePvc, unrelatedEdge]);
      delete ctx.nodeMap; // test fallback in findConnectedPVCs

      // Call multi-attach error
      const res1 = checkPvcReadiness(dep, ctx);
      expect(res1.isBlocked).toBe(true);

      // Call again when already in error to cover false branch of line 90 and line 156
      const res2 = checkPvcReadiness(dep, ctx);
      expect(res2.isBlocked).toBe(true);

      // 2. updateNodeData failure when updatedNodes is empty
      const emptyCtx = createMockCtx([pvcNoAccessMode, podAlreadyPending], [edgePvc]);
      emptyCtx.updatedNodes = []; // causes updateNodeData to return false

      const unboundRes = handleUnboundPvcs([pvcNoAccessMode], [podAlreadyPending], emptyCtx);
      expect(unboundRes.isBlocked).toBe(true);
      expect(unboundRes.hasChanges).toBe(false);

      const readyPodToFail: Node = { id: 'pod-fail', type: 'Pod', data: { status: 'ready' }, position: { x: 0, y: 0 } };
      handleUnboundPvcs([], [readyPodToFail], emptyCtx);

      const pendingPodWithImage: Node = { id: 'pod-img-fail', type: 'Pod', data: { status: 'pending', image: 'nginx' }, position: { x: 0, y: 0 } };
      const boundRes = handleBoundPvcs([pendingPodWithImage], emptyCtx);
      expect(boundRes.isBlocked).toBe(false);
      expect(boundRes.hasChanges).toBe(false);

      // 3. Fallback when pvc is not in updatedNodes during checkPvcReadiness
      const orphanPvc: Node = { id: 'pvc-orphan', type: 'PVC', data: { pvcStatus: 'Pending' }, position: { x: 0, y: 0 } };
      const orphanPod: Node = { id: 'pod-orphan', type: 'Pod', data: { status: 'ready' }, position: { x: 0, y: 0 } };
      const orphanEdge: Edge = { id: 'e-orphan', source: 'pod-orphan', target: 'pvc-orphan' };
      const orphanCtx = createMockCtx([orphanPvc, orphanPod], [orphanEdge]);
      orphanCtx.updatedNodes = [orphanPod]; // pvc-orphan is not in updatedNodes, triggers line 166 fallback
      const orphanCheck = checkPvcReadiness(orphanPod, orphanCtx);
      expect(orphanCheck.isBlocked).toBe(true);

      // 4. Non-workload (e.g. Service) connected to PVC covering line 40 false branch
      const svcNode: Node = { id: 'svc-1', type: 'Service', data: {}, position: { x: 0, y: 0 } };
      const pvcForSvc: Node = { id: 'pvc-svc', type: 'PVC', data: {}, position: { x: 0, y: 0 } };
      const svcEdge: Edge = { id: 'e-svc', source: 'svc-1', target: 'pvc-svc' };
      const svcCtx = createMockCtx([svcNode, pvcForSvc], [svcEdge]);
      const svcCount = countConnectedPvcReplicas(pvcForSvc, svcCtx);
      expect(svcCount.totalReplicas).toBe(0);

      // 5. Already in error status with matching validationError to cover lines 90, 156 false branches
      const errorMsg = 'Multi-Attach Error: Volume "pvc-already-err" (ReadWriteOnce) cannot be mounted by 2 replicas simultaneously';
      const pvcAlreadyErr: Node = { id: 'pvc-already-err', type: 'PVC', data: { pvcStatus: 'Multi-Attach Error', accessMode: 'ReadWriteOnce' }, position: { x: 0, y: 0 } };
      const depAlreadyErr: Node = { id: 'dep-err', type: 'Deployment', data: { replicas: 2 }, position: { x: 0, y: 0 } };
      const edgeAlreadyErr: Edge = { id: 'e-err', source: 'pvc-already-err', target: 'dep-err', data: { validationError: errorMsg } };
      const noReadyPod: Node = { id: 'pod-non-ready', type: 'Pod', parentId: 'dep-err', data: { status: 'pending' }, position: { x: 0, y: 0 } };
      const errCtx = createMockCtx([pvcAlreadyErr, depAlreadyErr, noReadyPod], [edgeAlreadyErr]);
      const noChangeErrRes = checkPvcReadiness(depAlreadyErr, errCtx);
      expect(noChangeErrRes.hasChanges).toBe(false);
      expect(noChangeErrRes.isBlocked).toBe(true);

      // 6. Multi-attach conflict when updateNodeData fails for ready pod
      const podReadyNotInUpdated: Node = { id: 'pod-unindexed', type: 'Pod', parentId: 'dep-1', data: { status: 'ready' }, position: { x: 0, y: 0 } };
      const failMultiAttachCtx = createMockCtx([pvcNoAccessMode, dep, podReadyNotInUpdated], [edgePvc]);
      failMultiAttachCtx.updatedNodes = []; // causes updateNodeData to return false
      checkPvcReadiness(dep, failMultiAttachCtx);

      // 7. handleUnboundPvcs when safeRandom > 0.7 but updateNodeData fails
      const safeRandomSpy = vi.spyOn(utils, 'safeRandom').mockReturnValue(0.95);
      const unboundFailCtx = createMockCtx([pvcNoAccessMode], []);
      unboundFailCtx.updatedNodes = []; // updateNodeData will return false
      pvcNoAccessMode.data.pvcStatus = 'Pending';
      handleUnboundPvcs([pvcNoAccessMode], [], unboundFailCtx);
      safeRandomSpy.mockRestore();

      // 8. Resolve multi-attach conflict when updateNodeData fails
      const pvcToResolveFail: Node = { id: 'pvc-res-fail', type: 'PVC', data: { pvcStatus: 'Multi-Attach Error', accessMode: 'ReadWriteOnce' }, position: { x: 0, y: 0 } };
      const depResolved: Node = { id: 'dep-res', type: 'Deployment', data: { replicas: 1 }, position: { x: 0, y: 0 } };
      const edgeToClean: Edge = { id: 'e-clean', source: 'pvc-res-fail', target: 'dep-res', data: { validationError: 'Multi-Attach Error' } };
      const edgeNoClean: Edge = { id: 'e-noclean', source: 'pvc-res-fail', target: 'dep-res', data: { validationError: 'Other Error' } };
      const failResolveCtx = createMockCtx([pvcToResolveFail, depResolved], [edgeToClean, edgeNoClean]);
      failResolveCtx.updatedNodes = []; // updateNodeData fails in resolvePvcMultiAttachError
      checkPvcReadiness(depResolved, failResolveCtx);
    });
  });
});
