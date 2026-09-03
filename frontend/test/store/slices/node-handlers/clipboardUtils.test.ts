import { describe, it, expect, vi } from 'vitest';
import { Node } from '@xyflow/react';
import { findLogicalPodMatch, updateReplicaDelta } from '@/store/slices/node-handlers/clipboardUtils';

describe('clipboardUtils', () => {
  describe('findLogicalPodMatch', () => {
    it('returns null if pastedPod has no parentId', () => {
      const pod: Node = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
      expect(findLogicalPodMatch(pod, [])).toBeNull();
    });

    it('returns null if parent node is not found in nodes', () => {
      const pod: Node = { id: 'p1', type: 'Pod', parentId: 'dep1', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
      expect(findLogicalPodMatch(pod, [])).toBeNull();
    });

    it('returns null if parent is a Namespace', () => {
      const pod: Node = { id: 'p1', type: 'Pod', parentId: 'ns1', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
      const ns: Node = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
      expect(findLogicalPodMatch(pod, [ns])).toBeNull();
    });

    it('returns matching pod when parent is a Deployment', () => {
      const pod: Node = { id: 'p1', type: 'Pod', parentId: 'dep1', position: { x: 0, y: 0 }, data: { label: 'app-pod' } };
      const dep: Node = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const existingPod: Node = { id: 'p2', type: 'Pod', parentId: 'dep1', position: { x: 0, y: 0 }, data: { label: 'app-pod' } };

      const match = findLogicalPodMatch(pod, [dep, existingPod]);
      expect(match).toBe(existingPod);
    });
  });

  describe('updateReplicaDelta', () => {
    it('returns early if target has no parentId and is not a controller', () => {
      const target: Node = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
      const updateNodeData = vi.fn();

      updateReplicaDelta(target, 1, [], updateNodeData);
      expect(updateNodeData).not.toHaveBeenCalled();
    });

    it('updates Deployment directly when target is Deployment', () => {
      const target: Node = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 2 } };
      const updateNodeData = vi.fn();

      updateReplicaDelta(target, 1, [target], updateNodeData);
      expect(updateNodeData).toHaveBeenCalledWith('dep1', { replicas: 3 });
    });

    it('updates ReplicaSet directly when target is ReplicaSet', () => {
      const target: Node = { id: 'rs1', type: 'ReplicaSet', position: { x: 0, y: 0 }, data: { replicas: 1 } };
      const updateNodeData = vi.fn();

      updateReplicaDelta(target, -1, [target], updateNodeData);
      expect(updateNodeData).toHaveBeenCalledWith('rs1', { replicas: 0 });
    });

    it('updates parent controller when target is a child pod', () => {
      const parentDep: Node = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 2 } };
      const childPod: Node = { id: 'p1', type: 'Pod', parentId: 'dep1', position: { x: 0, y: 0 }, data: {} };
      const updateNodeData = vi.fn();

      updateReplicaDelta(childPod, 1, [parentDep, childPod], updateNodeData);
      expect(updateNodeData).toHaveBeenCalledWith('dep1', { replicas: 3 });
    });

    it('does not update if parent is Namespace', () => {
      const parentNs: Node = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
      const childPod: Node = { id: 'p1', type: 'Pod', parentId: 'ns1', position: { x: 0, y: 0 }, data: {} };
      const updateNodeData = vi.fn();

      updateReplicaDelta(childPod, 1, [parentNs, childPod], updateNodeData);
      expect(updateNodeData).not.toHaveBeenCalled();
    });
  });
});
