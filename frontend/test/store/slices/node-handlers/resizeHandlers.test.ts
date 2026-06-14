import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';

describe('resizeHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [
        { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, width: 320, height: 160, data: {} },
        { id: 'p1', type: 'Pod', parentId: 'd1', position: { x: 20, y: 40 }, width: 140, height: 80, data: {} }
      ] as any,
      lastActionId: 'init'
    });
  });

  it('onNodeResize updates deployment size and layout', () => {
    const { onNodeResize } = useFlowStore.getState();
    const node = { id: 'd1', width: 400, height: 200 } as any;

    onNodeResize({}, node);

    const state = useFlowStore.getState();
    const deployment = state.nodes.find(n => n.id === 'd1');
    expect(deployment?.width).toBe(400);
    expect(deployment?.height).toBe(200);
    expect(deployment?.data.isManuallyResized).toBe(true);
  });

  it('onNodeResize syncs sibling pods when a pod is resized', () => {
    // Add another pod to the same deployment
    useFlowStore.setState((state) => ({
        nodes: [
            ...state.nodes,
            { id: 'p2', type: 'Pod', parentId: 'd1', position: { x: 180, y: 40 }, width: 140, height: 80, data: {} }
        ] as any
    }));

    const { onNodeResize } = useFlowStore.getState();
    const resizedPod = { id: 'p1', width: 200, height: 100 } as any;

    onNodeResize({}, resizedPod);

    const state = useFlowStore.getState();
    const p1 = state.nodes.find(n => n.id === 'p1');
    const p2 = state.nodes.find(n => n.id === 'p2');

    expect(p1?.width).toBe(200);
    expect(p2?.width).toBe(200); // p2 should have synced with p1
  });

  it('onNodeResizeStop updates lastAction', () => {
    const { onNodeResizeStop } = useFlowStore.getState();
    onNodeResizeStop({}, {} as any);

    const state = useFlowStore.getState();
    expect(state.lastActionName).toBe('Resize Element');
    expect(state.lastActionId).toContain('resize-');
  });
});
