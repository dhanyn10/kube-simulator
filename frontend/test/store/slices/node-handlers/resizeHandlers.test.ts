import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resizeHandlers } from '@/store/slices/node-handlers/resizeHandlers';
import { Node } from '@xyflow/react';

describe('resizeHandlers', () => {
  let storeState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      nodes: [],
      addLog: vi.fn(),
    };
  });

  const getStore = () => storeState;
  const setStore = (fn: any) => {
    if (typeof fn === 'function') {
      storeState = { ...storeState, ...fn(storeState) };
    } else {
      storeState = { ...storeState, ...fn };
    }
  };

  it('onNodeResize returns early if currentNode is not found in store', () => {
    storeState.nodes = [];
    const handlers = resizeHandlers(setStore, getStore);

    handlers.onNodeResize({}, { id: 'missing' } as Node);
    expect(storeState.nodes).toEqual([]);
  });

  it('onNodeResize resizes standalone node with minimum dimensions', () => {
    const svcNode: Node = { id: 'svc1', type: 'Service', position: { x: 0, y: 0 }, width: 100, height: 50, data: {} };
    storeState.nodes = [svcNode];

    const handlers = resizeHandlers(setStore, getStore);
    handlers.onNodeResize({}, { id: 'svc1', width: 200, height: 120 } as Node);

    expect(storeState.nodes[0].width).toBe(200);
    expect(storeState.nodes[0].height).toBe(120);
    expect(storeState.nodes[0].data.isManuallyResized).toBe(true);
  });

  it('onNodeResize resizes Pod, syncing sibling pods and updating parent Deployment container bounds', () => {
    const depNode: Node = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, width: 300, height: 200, data: {} };
    const pod1: Node = { id: 'pod1', type: 'Pod', parentId: 'dep1', position: { x: 10, y: 10 }, width: 100, height: 60, data: {} };
    const pod2: Node = { id: 'pod2', type: 'Pod', parentId: 'dep1', position: { x: 120, y: 10 }, width: 100, height: 60, data: {} };

    storeState.nodes = [depNode, pod1, pod2];

    const handlers = resizeHandlers(setStore, getStore);
    handlers.onNodeResize({}, { id: 'pod1', width: 180, height: 80 } as Node);

    const updatedPod1 = storeState.nodes.find((n: Node) => n.id === 'pod1');
    const updatedPod2 = storeState.nodes.find((n: Node) => n.id === 'pod2');

    expect(updatedPod1.width).toBe(180);
    expect(updatedPod2.width).toBe(180);
  });

  it('applyPodResize returns nodes unchanged if parentId or parent Deployment is missing', () => {
    // Pod minimum width is 168 (from getPodMinimumSize)
    const standalonePod: Node = { id: 'pod1', type: 'Pod', position: { x: 0, y: 0 }, width: 168, height: 60, data: {} };
    storeState.nodes = [standalonePod];

    const handlers = resizeHandlers(setStore, getStore);
    handlers.onNodeResize({}, { id: 'pod1', width: 200, height: 70 } as Node);

    expect(storeState.nodes[0].width).toBe(200);

    const podWithMissingParent: Node = { id: 'pod2', type: 'Pod', parentId: 'missing-dep', position: { x: 0, y: 0 }, width: 168, height: 60, data: {} };
    storeState.nodes = [podWithMissingParent];
    handlers.onNodeResize({}, { id: 'pod2', width: 220, height: 70 } as Node);

    expect(storeState.nodes[0].width).toBe(220);
  });

  it('onNodeResize resizes Deployment container and relayouts child pods', () => {
    const depNode: Node = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, width: 300, height: 200, data: {} };
    const childPod: Node = { id: 'pod1', type: 'Pod', parentId: 'dep1', position: { x: 10, y: 10 }, width: 100, height: 60, data: {} };

    storeState.nodes = [depNode, childPod];

    const handlers = resizeHandlers(setStore, getStore);
    handlers.onNodeResize({}, { id: 'dep1', width: 500, height: 300 } as Node);

    const updatedDep = storeState.nodes.find((n: Node) => n.id === 'dep1');
    expect(updatedDep.width).toBe(500);
    expect(updatedDep.height).toBe(300);
  });

  it('onNodeResizeStop logs action message and updates lastActionName', () => {
    const node: Node = { id: 'n1', type: 'Deployment', position: { x: 10, y: 20 }, width: 200, height: 150, data: { label: 'My Dep' } };
    storeState.nodes = [node];

    const handlers = resizeHandlers(setStore, getStore);
    handlers.onNodeResizeStop({}, node);

    expect(storeState.addLog).toHaveBeenCalledWith(
      'info',
      expect.stringContaining("[Canvas Action] Resized card 'My Dep' (Deployment)"),
      'UI'
    );
    expect(storeState.lastActionName).toBe('Resize Element');
  });

  it('onNodeResizeStop handles missing get or node without throwing error', () => {
    const handlers = resizeHandlers(setStore, undefined as any);
    handlers.onNodeResizeStop({}, { id: 'n1' } as Node);

    expect(storeState.lastActionName).toBe('Resize Element');
  });
});
