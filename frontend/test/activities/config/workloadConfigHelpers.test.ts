import { describe, it, expect } from 'vitest';
import { Node, Edge } from '@xyflow/react';
import {
  checkWorkloadConnectedPvc,
  checkWorkloadHpaStatus,
} from '@/activities/config/workloadConfigHelpers';

describe('workloadConfigHelpers', () => {
  describe('checkWorkloadConnectedPvc', () => {
    it('returns false when selectedNode is undefined or null', () => {
      const res = checkWorkloadConnectedPvc(undefined as any, [], [], 1);
      expect(res).toEqual({ isConnectedToPvc: false, isMultiReplicaRwoPvc: false });
    });

    it('returns false when selectedNode has no connected PVC edges', () => {
      const node: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'web' } };
      const svcNode: Node = { id: 'svc-1', type: 'Service', position: { x: 100, y: 0 }, data: { label: 'svc' } };
      const edge: Edge = { id: 'e1', source: 'svc-1', target: 'dep-1' };

      const res = checkWorkloadConnectedPvc(node, [node, svcNode], [edge], 2);
      expect(res).toEqual({ isConnectedToPvc: false, isMultiReplicaRwoPvc: false });
    });

    it('detects connected PVC when workload is edge source and PVC is edge target', () => {
      const workload: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'web' } };
      const pvc: Node = {
        id: 'pvc-1',
        type: 'PVC',
        position: { x: 100, y: 0 },
        data: { label: 'my-storage', accessMode: 'ReadWriteOnce' },
      };
      const edge: Edge = { id: 'e-pvc', source: 'dep-1', target: 'pvc-1' };

      // replicas = 3 -> multi-replica RWO is true
      const resMulti = checkWorkloadConnectedPvc(workload, [workload, pvc], [edge], 3);
      expect(resMulti.isConnectedToPvc).toBe(true);
      expect(resMulti.connectedPvcName).toBe('my-storage');
      expect(resMulti.connectedPvcAccessMode).toBe('ReadWriteOnce');
      expect(resMulti.isMultiReplicaRwoPvc).toBe(true);

      // replicas = 1 -> multi-replica RWO is false
      const resSingle = checkWorkloadConnectedPvc(workload, [workload, pvc], [edge], 1);
      expect(resSingle.isMultiReplicaRwoPvc).toBe(false);
    });

    it('detects connected PVC when PVC is edge source and workload is edge target', () => {
      const workload: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const pvc: Node = {
        id: 'pvc-id-only',
        type: 'PVC',
        position: { x: 100, y: 0 },
        data: {}, // no label, default accessMode fallback
      };
      const edge: Edge = { id: 'e-pvc-src', source: 'pvc-id-only', target: 'dep-1' };

      const res = checkWorkloadConnectedPvc(workload, [workload, pvc], [edge], 2);
      expect(res.isConnectedToPvc).toBe(true);
      expect(res.connectedPvcName).toBe('pvc-id-only');
      expect(res.connectedPvcAccessMode).toBe('ReadWriteOnce');
      expect(res.isMultiReplicaRwoPvc).toBe(true);
    });

    it('detects PVC connection via child pod parentId in data', () => {
      const childPod: Node = {
        id: 'pod-child',
        type: 'Pod',
        position: { x: 10, y: 10 },
        data: { parentId: 'parent-dep' },
      };
      const parentDep: Node = {
        id: 'parent-dep',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: { label: 'parent' },
      };
      const pvc: Node = {
        id: 'pvc-rwx',
        type: 'PVC',
        position: { x: 200, y: 0 },
        data: { label: 'shared-data', accessMode: 'ReadWriteMany' },
      };
      const edge: Edge = { id: 'e-parent-pvc', source: 'parent-dep', target: 'pvc-rwx' };

      const res = checkWorkloadConnectedPvc(childPod, [childPod, parentDep, pvc], [edge], 5);
      expect(res.isConnectedToPvc).toBe(true);
      expect(res.connectedPvcName).toBe('shared-data');
      expect(res.connectedPvcAccessMode).toBe('ReadWriteMany');
      expect(res.isMultiReplicaRwoPvc).toBe(false); // RWX is not RWO
    });
  });

  describe('checkWorkloadHpaStatus', () => {
    it('returns isControlled: false when selectedNode is undefined or null', () => {
      const res = checkWorkloadHpaStatus(null, [], []);
      expect(res).toEqual({ isControlled: false });
    });

    it('returns HPA details from direct attached hpas on selectedNode', () => {
      const node: Node = {
        id: 'dep-hpa',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: {
          label: 'app',
          hpas: [{ id: 'hpa-item', name: 'app-scaler', minReplicas: 2, maxReplicas: 8 }],
        },
      };

      const res = checkWorkloadHpaStatus(node, [node], []);
      expect(res).toEqual({
        isControlled: true,
        hpaName: 'app-scaler',
        minReplicas: 2,
        maxReplicas: 8,
      });
    });

    it('returns HPA details from direct connected HPA node via edges (target is workload)', () => {
      const workload: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'dep' } };
      const hpaNode: Node = {
        id: 'hpa-node',
        type: 'HPA',
        position: { x: 100, y: 0 },
        data: { label: 'my-hpa', minReplicas: 3, maxReplicas: 15 },
      };
      const edge: Edge = { id: 'e-hpa-dep', source: 'hpa-node', target: 'dep-1' };

      const res = checkWorkloadHpaStatus(workload, [workload, hpaNode], [edge]);
      expect(res).toEqual({
        isControlled: true,
        hpaName: 'my-hpa',
        minReplicas: 3,
        maxReplicas: 15,
      });
    });

    it('returns HPA details from direct connected HPA node via edges (source is workload, default min/max fallback)', () => {
      const workload: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'dep' } };
      const hpaNode: Node = {
        id: 'hpa-fallback',
        type: 'HPA',
        position: { x: 100, y: 0 },
        data: {}, // no label, no min/max
      };
      const edge: Edge = { id: 'e-dep-hpa', source: 'dep-1', target: 'hpa-fallback' };

      const res = checkWorkloadHpaStatus(workload, [workload, hpaNode], [edge]);
      expect(res).toEqual({
        isControlled: true,
        hpaName: 'hpa-fallback',
        minReplicas: 1,
        maxReplicas: 10,
      });
    });

    it('returns HPA details from parent controller attached hpas for a child pod', () => {
      const parentDep: Node = {
        id: 'parent-ctrl',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: {
          label: 'parent',
          hpas: [{ name: 'parent-scaler', minReplicas: 1, maxReplicas: 5 }],
        },
      };
      const childPod: Node = {
        id: 'child-pod',
        parentId: 'parent-ctrl',
        type: 'Pod',
        position: { x: 10, y: 10 },
        data: {},
      };

      const res = checkWorkloadHpaStatus(childPod, [parentDep, childPod], []);
      expect(res).toEqual({
        isControlled: true,
        hpaName: 'parent-scaler',
        minReplicas: 1,
        maxReplicas: 5,
      });
    });

    it('returns HPA details from parent controller connected HPA node for a child pod', () => {
      const parentDep: Node = {
        id: 'parent-ctrl-2',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: { label: 'parent-2' },
      };
      const childPod: Node = {
        id: 'child-pod-2',
        type: 'Pod',
        position: { x: 10, y: 10 },
        data: { parentId: 'parent-ctrl-2' },
      };
      const hpaNode: Node = {
        id: 'hpa-conn-parent',
        type: 'HPA',
        position: { x: 200, y: 0 },
        data: { label: 'hpa-parent-link', minReplicas: 4, maxReplicas: 12 },
      };
      const edge: Edge = { id: 'e-hpa-parent', source: 'parent-ctrl-2', target: 'hpa-conn-parent' };

      const res = checkWorkloadHpaStatus(childPod, [parentDep, childPod, hpaNode], [edge]);
      expect(res).toEqual({
        isControlled: true,
        hpaName: 'hpa-parent-link',
        minReplicas: 4,
        maxReplicas: 12,
      });
    });

    it('returns isControlled: false when no HPA attached or connected anywhere', () => {
      const workload: Node = { id: 'dep-alone', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const res = checkWorkloadHpaStatus(workload, [workload], []);
      expect(res).toEqual({ isControlled: false });
    });
  });
});
