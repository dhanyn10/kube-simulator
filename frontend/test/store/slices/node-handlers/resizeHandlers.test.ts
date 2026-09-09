import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';
import { resizeHandlers } from '@/store/slices/node-handlers/resizeHandlers';

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

  it('onNodeResize syncs sibling pods when a pod with style minHeight is resized', () => {
    useFlowStore.setState((state) => ({
      nodes: [
        ...state.nodes,
        { id: 'p2', type: 'Pod', parentId: 'd1', position: { x: 180, y: 40 }, width: 140, height: 80, data: {} }
      ] as any
    }));

    const { onNodeResize } = useFlowStore.getState();
    const resizedPod = { id: 'p1', width: 200, height: 120, style: { minHeight: 120 } } as any;

    onNodeResize({}, resizedPod);

    const state = useFlowStore.getState();
    const p1 = state.nodes.find(n => n.id === 'p1');
    const p2 = state.nodes.find(n => n.id === 'p2');

    expect(p1?.width).toBe(200);
    expect(p2?.width).toBe(200);
  });

  it('onNodeResize handles pods without explicit position/dimensions or measured sizes in containers', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'd1', type: 'Deployment', position: { x: 10, y: 10 }, width: 320, height: 160, data: {} },
        { id: 'p1', type: 'Pod', parentId: 'd1', position: {} as any, style: {} as any, data: {} }
      ] as any
    });

    const { onNodeResize } = useFlowStore.getState();
    onNodeResize({}, { id: 'p1', width: 0, height: 0 } as any);

    const state = useFlowStore.getState();
    const p1 = state.nodes.find(n => n.id === 'p1');
    expect(p1).toBeDefined();
  });

  it('onNodeResizeStop updates lastAction and logs canvas resize activity with measured size and fallback label', () => {
    const addLogSpy = vi.fn();
    useFlowStore.setState({
      nodes: [
        { id: 'p-unlabeled', type: 'Pod', position: { x: 10, y: 10 }, measured: { width: 180, height: 120 }, data: {} }
      ] as any,
      addLog: addLogSpy
    });

    const { onNodeResizeStop } = useFlowStore.getState();
    const resizedNode = { id: 'p-unlabeled' };

    onNodeResizeStop({}, resizedNode as any);

    const state = useFlowStore.getState();
    expect(state.lastActionName).toBe('Resize Element');
    expect(state.lastActionId).toContain('resize-');
    expect(addLogSpy).toHaveBeenCalledWith('info', expect.stringContaining("Resized card 'p-unlabeled'"), 'UI');
  });

  it('onNodeResizeStop falls back to 150x100 when width and height and measured are missing', () => {
    const addLogSpy = vi.fn();
    useFlowStore.setState({
      nodes: [
        { id: 'node-nodim', type: 'Service', position: { x: 0, y: 0 }, data: {} }
      ] as any,
      addLog: addLogSpy
    });

    const { onNodeResizeStop } = useFlowStore.getState();
    onNodeResizeStop({}, { id: 'node-nodim' } as any);

    expect(addLogSpy).toHaveBeenCalledWith('info', expect.stringContaining('to size: 150x100px'), 'UI');
  });

  it('onNodeResizeStop works without get parameter function provided', () => {
    const setMock = vi.fn();
    const handlers = resizeHandlers(setMock, undefined);

    handlers.onNodeResizeStop({}, { id: 'd1' } as any);

    expect(setMock).toHaveBeenCalledWith({
      lastActionId: expect.stringContaining('resize-'),
      lastActionName: 'Resize Element'
    });
  });

  it('handles edge cases in onNodeResize for standalone pods, missing parents, and non-workload nodes without width/height', () => {
    const { onNodeResize } = useFlowStore.getState();

    // 1. Non-existent node
    onNodeResize({}, { id: 'non-existent', width: 200, height: 100 } as any);

    // 2. Standalone pod without parentId
    useFlowStore.setState({
      nodes: [
        { id: 'p-standalone', type: 'Pod', position: { x: 0, y: 0 }, width: 140, height: 80, data: {} }
      ] as any
    });
    onNodeResize({}, { id: 'p-standalone', width: 180, height: 90 } as any);

    // 3. Pod with missing parent in state
    useFlowStore.setState({
      nodes: [
        { id: 'p-orphan', type: 'Pod', parentId: 'missing-dep', position: { x: 0, y: 0 }, width: 140, height: 80, data: {} }
      ] as any
    });
    onNodeResize({}, { id: 'p-orphan', width: 180, height: 90 } as any);

    // 4. Resizing a Service card without pre-existing width/height
    useFlowStore.setState({
      nodes: [
        { id: 'svc-1', type: 'Service', position: { x: 0, y: 0 }, data: {} }
      ] as any
    });
    onNodeResize({}, { id: 'svc-1', width: 150, height: 80 } as any);

    const updatedSvc = useFlowStore.getState().nodes.find(n => n.id === 'svc-1');
    expect(updatedSvc?.width).toBe(150);
  });
});
