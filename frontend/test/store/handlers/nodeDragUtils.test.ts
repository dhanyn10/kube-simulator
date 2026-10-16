import { describe, it, expect, vi } from 'vitest';
import { calculateOverlap, handlePodMoveToDeployment, handleGenericContainerMove } from '@/store/handlers/nodeDragUtils';

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

  it('calculateOverlap tests explicit node width/height and container width/height properties', () => {
    const nodeWithExplicit = { id: 'p1', width: 200, height: 100 } as any;
    const containerWithExplicit = { id: 'd1', type: 'Deployment', width: 400, height: 200, position: { x: 0, y: 0 } } as any;

    const res1 = calculateOverlap(nodeWithExplicit, { x: 0, y: 0 }, containerWithExplicit, [containerWithExplicit]);
    expect(res1.intersects).toBe(true);
    expect(res1.overlapPercentage).toBe(100);

    // Non-deployment container with no width or height or measured fallback
    const bareContainer = { id: 'c1', type: 'Namespace', position: { x: 0, y: 0 } } as any;
    const res2 = calculateOverlap(nodeWithExplicit, { x: 0, y: 0 }, bareContainer, [bareContainer]);
    expect(res2.intersects).toBe(true);
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

    // Test with oldParentId undefined
    const result3 = handlePodMoveToDeployment('d2', targetDep, pod, [pod, targetDep], undefined, get, pod);
    expect(result3).toBeDefined();

    // Test with pod lacking replicas in data (triggers fallback to 1)
    const podNoRep = { id: 'p2', type: 'Pod', parentId: 'd1', data: {} } as any;
    const result4 = handlePodMoveToDeployment('d2', targetDep, podNoRep, [podNoRep, oldDep, targetDep], 'd1', get, podNoRep);
    expect(result4).toBeDefined();
  });

  it('syncOldParentDeployment handles ReplicaSet parent, missing old parent ID, and pod with no replicas in data', () => {
    const podNoRep = { id: 'p1_norep', type: 'Pod', parentId: 'd1', data: {} } as any;
    const oldDep = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 2 } } as any;
    const nsNode = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} } as any;
    const getDummy = () => ({}) as any;

    const resNoRep = handleGenericContainerMove('ns1', podNoRep, [podNoRep, oldDep, nsNode], 'd1', { x: 0, y: 0 }, getDummy);
    expect(resNoRep).toBeDefined();

    const pod = { id: 'p1', type: 'Pod', parentId: 'rs1', data: { replicas: 1 } } as any;
    const oldRS = { id: 'rs1', type: 'ReplicaSet', position: { x: 0, y: 0 }, data: { replicas: 3 } } as any;
    const ns = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} } as any;
    const get = () => ({}) as any;

    // Move pod out of ReplicaSet
    const resultRS = handleGenericContainerMove('ns1', pod, [pod, oldRS, ns], 'rs1', { x: 0, y: 0 }, get);
    const updatedRS = resultRS.find(n => n.id === 'rs1');
    expect(updatedRS?.data.replicas).toBe(2);

    // Non-Pod node move with oldParentId provided
    const svc = { id: 's1', type: 'Service', parentId: 'ns1', position: { x: 0, y: 0 } } as any;
    const resultSvc = handleGenericContainerMove('ns1', svc, [svc, ns], 'old-parent-id', { x: 0, y: 0 }, get);
    expect(resultSvc).toBeDefined();

    // Move pod out when oldParentId is missing from nodes array
    const resultMissingOld = handleGenericContainerMove('ns1', pod, [pod, ns], 'missing-old-id', { x: 0, y: 0 }, get);
    expect(resultMissingOld).toBeDefined();
  });

  it('calculateOverlap covers unmeasured container dimension fallbacks and handleGenericContainerMove covers non-Pod with oldParentId', () => {
    // 1. unmeasured container with Deployment type (320x160 fallback) vs non-Deployment type (600x400 fallback)
    const node = { id: 'p1', width: 50, height: 50 } as any;
    const depBareContainer = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 } } as any;
    const resDep = calculateOverlap(node, { x: 0, y: 0 }, depBareContainer, [depBareContainer]);
    expect(resDep.intersects).toBe(true);

    const otherBareContainer = { id: 'c1', type: 'Service', position: { x: 0, y: 0 } } as any;
    const resOther = calculateOverlap(node, { x: 0, y: 0 }, otherBareContainer, [otherBareContainer]);
    expect(resOther.intersects).toBe(true);

    // 2. handleGenericContainerMove when oldParentId is set on a non-Pod node
    const svcNode = { id: 's1', type: 'Service', parentId: 'old-ns', position: { x: 0, y: 0 } } as any;
    const targetNs = { id: 'new-ns', type: 'Namespace', position: { x: 100, y: 100 } } as any;
    const getDummy = () => ({}) as any;

    const resSvc = handleGenericContainerMove('new-ns', svcNode, [svcNode, targetNs], 'old-ns', { x: 150, y: 150 }, getDummy);
    expect(resSvc.find(n => n.id === 's1')?.parentId).toBe('new-ns');
  });

  it('handles calculateOverlap with unmeasured height/width fallbacks and syncOldParentDeployment with non-deployment old parent', () => {
    // 1. node height/width fallbacks (160x80) and container height/width fallbacks
    const bareNode = { id: 'p-bare' } as any;
    const depContainer = { id: 'd-bare', type: 'Deployment' } as any;
    const res = calculateOverlap(bareNode, { x: 0, y: 0 }, depContainer, [depContainer]);
    expect(res.intersects).toBe(true);

    // Node using measured width/height without top-level width/height
    const measuredNode = { id: 'p-measured', measured: { width: 120, height: 60 } } as any;
    const measuredNonDep = { id: 'c-measured', type: 'Namespace', measured: { width: 500, height: 300 } } as any;
    const resMeasured = calculateOverlap(measuredNode, { x: 0, y: 0 }, measuredNonDep, [measuredNonDep]);
    expect(resMeasured.intersects).toBe(true);

    // 2. handlePodMoveToDeployment with oldParentId pointing to non-Deployment/non-ReplicaSet parent
    const pod = { id: 'p1', type: 'Pod', parentId: 'ns1', data: {} } as any;
    const oldParentNs = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 } } as any;
    const targetDep = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as any;
    const getDummy = () => ({}) as any;

    const resMove = handlePodMoveToDeployment('d1', targetDep, pod, [pod, oldParentNs, targetDep], 'ns1', getDummy, pod);
    expect(resMove).toHaveLength(3);
  });

  it('covers unmeasured container empty measured object fallbacks and non-Pod targetParentId children retention in handlePodMoveToDeployment', () => {
    // 1. Container with measured: {} (measured width/height undefined) for Deployment vs non-Deployment
    const bareNode = { id: 'p1', width: 100, height: 100 } as any;
    const depEmptyMeasured = { id: 'd1', type: 'Deployment', measured: {} as any, position: { x: 0, y: 0 } } as any;
    const resDep = calculateOverlap(bareNode, { x: 0, y: 0 }, depEmptyMeasured, [depEmptyMeasured]);
    expect(resDep.intersects).toBe(true);

    const nonDepEmptyMeasured = { id: 'c1', type: 'Namespace', measured: {} as any, position: { x: 0, y: 0 } } as any;
    const resNonDep = calculateOverlap(bareNode, { x: 0, y: 0 }, nonDepEmptyMeasured, [nonDepEmptyMeasured]);
    expect(resNonDep.intersects).toBe(true);

    // 2. handlePodMoveToDeployment with non-Pod child node inside targetParentId (e.g. Service or Role)
    const pod = { id: 'p1', type: 'Pod', data: {} } as any;
    const targetDep = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as any;
    const nonPodChild = { id: 'role1', type: 'Role', parentId: 'd1', data: {} } as any;
    const getDummy = () => ({}) as any;

    const res = handlePodMoveToDeployment('d1', targetDep, pod, [pod, targetDep, nonPodChild], undefined, getDummy, pod);
    expect(res.some(n => n.id === 'role1')).toBe(true);
  });
});
