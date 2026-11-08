import { describe, it, expect } from 'vitest';
import {
  getNodeAbsCenter,
  isNodeInDirection,
  getQuickConnectHandles,
  resolveEdgeHandlesByPosition,
  findBestCandidateInDirection,
  checkValidConnectionDirection,
  canConnectRule,
} from '@/activities/nodes/quickConnectHelpers';
import { getNodeConnectionGuidance } from '@/constants/connections';
import { Node, Edge } from '@xyflow/react';

describe('getNodeConnectionGuidance', () => {
  it('returns appropriate architectural guidance for each Kubernetes resource', () => {
    expect(getNodeConnectionGuidance('Internet')).toContain('LoadBalancer or NodePort');
    expect(getNodeConnectionGuidance('Ingress')).toContain('ClusterIP');
    expect(getNodeConnectionGuidance('Service', { serviceType: 'LoadBalancer' })).toContain('Ingress');
    expect(getNodeConnectionGuidance('Service', { serviceType: 'NodePort' })).toContain('Workload');
    expect(getNodeConnectionGuidance('Service', { serviceType: 'Headless' })).toContain('Workload endpoints');
    expect(getNodeConnectionGuidance('Service', { serviceType: 'ClusterIP' })).toContain('Workload');
    expect(getNodeConnectionGuidance('Deployment')).toContain('PVC');
    expect(getNodeConnectionGuidance('StatefulSet')).toContain('Storage');
    expect(getNodeConnectionGuidance('Pod')).toContain('ConfigMap');
    expect(getNodeConnectionGuidance('ReplicaSet')).toContain('Secret');
    expect(getNodeConnectionGuidance('HPA')).toContain('Resource Limits');
    expect(getNodeConnectionGuidance('ResourceLimit')).toContain('Workload');
    expect(getNodeConnectionGuidance('ConfigMap')).toContain('volume mounts');
    expect(getNodeConnectionGuidance('Secret')).toContain('volume mounts');
    expect(getNodeConnectionGuidance('PVC')).toContain('volume mounts');
    expect(getNodeConnectionGuidance('Unknown' as any)).toBe('Compatible Kubernetes resource');
  });
});

describe('quickConnectHelpers', () => {
  const sourceNode: Node = {
    id: 'src-1',
    type: 'Service',
    position: { x: 100, y: 100 },
    measured: { width: 150, height: 100 },
    data: { label: 'web-service', serviceType: 'ClusterIP' },
  };

  const rightPod: Node = {
    id: 'pod-right',
    type: 'Pod',
    position: { x: 400, y: 100 },
    measured: { width: 150, height: 100 },
    data: { label: 'app-pod' },
  };

  const bottomPod: Node = {
    id: 'pod-bottom',
    type: 'Pod',
    position: { x: 100, y: 400 },
    measured: { width: 150, height: 100 },
    data: { label: 'worker-pod' },
  };

  const leftPod: Node = {
    id: 'pod-left',
    type: 'Pod',
    position: { x: -200, y: 100 },
    measured: { width: 150, height: 100 },
    data: { label: 'legacy-pod' },
  };

  const topPod: Node = {
    id: 'pod-top',
    type: 'Pod',
    position: { x: 100, y: -200 },
    measured: { width: 150, height: 100 },
    data: { label: 'top-pod' },
  };

  const allNodes = [sourceNode, rightPod, bottomPod, leftPod, topPod];

  it('computes getNodeAbsCenter correctly', () => {
    const center = getNodeAbsCenter(sourceNode, allNodes);
    expect(center.x).toBe(175);
    expect(center.y).toBe(150);
  });

  it('evaluates isNodeInDirection correctly for all 4 quadrants', () => {
    expect(isNodeInDirection(sourceNode, rightPod, 'right', allNodes)).toBe(true);
    expect(isNodeInDirection(sourceNode, bottomPod, 'bottom', allNodes)).toBe(true);
    expect(isNodeInDirection(sourceNode, leftPod, 'left', allNodes)).toBe(true);
    expect(isNodeInDirection(sourceNode, topPod, 'top', allNodes)).toBe(true);

    // Negative cases
    expect(isNodeInDirection(sourceNode, rightPod, 'left', allNodes)).toBe(false);
    expect(isNodeInDirection(sourceNode, sourceNode, 'right', allNodes)).toBe(false);
  });

  it('maps getQuickConnectHandles for all directions', () => {
    expect(getQuickConnectHandles('right')).toEqual({ sourceHandle: 'right-s', targetHandle: 'left-t' });
    expect(getQuickConnectHandles('left')).toEqual({ sourceHandle: 'left-s', targetHandle: 'right-t' });
    expect(getQuickConnectHandles('top')).toEqual({ sourceHandle: 'top-s', targetHandle: 'bottom-t' });
    expect(getQuickConnectHandles('bottom')).toEqual({ sourceHandle: 'bottom-s', targetHandle: 'top-t' });
  });

  it('resolves edge handles by relative position', () => {
    expect(resolveEdgeHandlesByPosition(sourceNode, rightPod, allNodes)).toEqual({
      sourceHandle: 'right-s',
      targetHandle: 'left-t',
    });
    expect(resolveEdgeHandlesByPosition(sourceNode, bottomPod, allNodes)).toEqual({
      sourceHandle: 'bottom-s',
      targetHandle: 'top-t',
    });
    expect(resolveEdgeHandlesByPosition(sourceNode, leftPod, allNodes)).toEqual({
      sourceHandle: 'left-s',
      targetHandle: 'right-t',
    });
    expect(resolveEdgeHandlesByPosition(sourceNode, topPod, allNodes)).toEqual({
      sourceHandle: 'top-s',
      targetHandle: 'bottom-t',
    });
    expect(resolveEdgeHandlesByPosition(undefined, undefined)).toEqual({
      sourceHandle: 'right-s',
      targetHandle: 'left-t',
    });
  });

  it('finds best candidate and provides edgeSource and edgeTarget conforming to rules', () => {
    const candidate = findBestCandidateInDirection(sourceNode, 'right', allNodes, []);
    expect(candidate?.targetNode.id).toBe('pod-right');
    expect(candidate?.edgeSource.id).toBe('src-1');
    expect(candidate?.edgeTarget.id).toBe('pod-right');
  });

  it('supports reverse rule connections when clicking from downstream card towards upstream card', () => {
    const internetNode: Node = {
      id: 'net-1',
      type: 'Internet',
      position: { x: -300, y: 100 },
      data: { label: 'Internet' },
    };
    const nodesWithNet = [sourceNode, internetNode];

    // Clicking left on Service towards Internet
    const result = findBestCandidateInDirection(sourceNode, 'left', nodesWithNet, []);
    expect(result?.targetNode.id).toBe('net-1');
    expect(result?.edgeSource.id).toBe('net-1'); // Internet is source
    expect(result?.edgeTarget.id).toBe('src-1'); // Service is target
  });

  it('supports HPA connecting to Deployment when clicking from Deployment towards HPA', () => {
    const depNode: Node = {
      id: 'dep-1',
      type: 'Deployment',
      position: { x: 100, y: 300 },
      data: { label: 'my-dep' },
    };
    const hpaNode: Node = {
      id: 'hpa-1',
      type: 'HPA',
      position: { x: 100, y: 50 },
      data: { label: 'my-hpa' },
    };
    const nodes = [depNode, hpaNode];

    // Clicking top on Deployment towards HPA
    const result = findBestCandidateInDirection(depNode, 'top', nodes, []);
    expect(result?.targetNode.id).toBe('hpa-1');
    expect(result?.edgeSource.id).toBe('hpa-1'); // HPA is source
    expect(result?.edgeTarget.id).toBe('dep-1'); // Deployment is target
  });

  it('prefers unconnected candidates over already connected ones', () => {
    const farPod: Node = {
      id: 'pod-far',
      type: 'Pod',
      position: { x: 800, y: 100 },
      measured: { width: 150, height: 100 },
      data: { label: 'far-pod' },
    };
    const nodesWithFar = [...allNodes, farPod];
    const existingEdges: Edge[] = [
      { id: 'e1', source: 'src-1', target: 'pod-right' },
    ];

    const chosen = findBestCandidateInDirection(sourceNode, 'right', nodesWithFar, existingEdges);
    expect(chosen?.targetNode.id).toBe('pod-far');
  });

  it('validates rules correctly with canConnectRule and checkValidConnectionDirection', () => {
    expect(canConnectRule(sourceNode, rightPod, allNodes)).toBe(true);
    expect(canConnectRule(sourceNode, sourceNode, allNodes)).toBe(false);

    const nsNode: Node = { id: 'ns-1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
    expect(canConnectRule(sourceNode, nsNode, allNodes)).toBe(false);

    const dirCheck = checkValidConnectionDirection(sourceNode, rightPod, allNodes);
    expect(dirCheck).not.toBeNull();
    expect(dirCheck?.edgeSource.id).toBe('src-1');
  });
});
