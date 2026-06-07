import { describe, it, expect, vi } from 'vitest';
import { createFlowSlice } from '../../../src/store/slices/createFlowSlice';
import { Node, Edge } from '@xyflow/react';

describe('createFlowSlice', () => {
  const set = vi.fn();
  const get = vi.fn();

  it('should initialize with empty nodes and edges', () => {
    const slice = createFlowSlice(set, get, {} as any);
    expect(slice.nodes).toEqual([]);
    expect(slice.edges).toEqual([]);
  });

  it('should set nodes and edges', () => {
    const slice = createFlowSlice(set, get, {} as any);
    const nodes = [{ id: '1' } as Node];
    const edges = [{ id: 'e1' } as Edge];

    slice.setNodes(nodes);
    expect(set).toHaveBeenCalledWith({ nodes });

    slice.setEdges(edges);
    expect(set).toHaveBeenCalledWith({ edges });
  });

  it('should validate edge', () => {
    get.mockReturnValue({
      nodes: [
        { id: '1', type: 'Internet' },
        { id: '2', type: 'Ingress' },
        { id: '3', type: 'Namespace' }
      ]
    });

    const slice = createFlowSlice(set, get, {} as any);

    // Valid connection (Internet -> Ingress)
    const edge1 = { source: '1', target: '2' } as Edge;
    const validated1 = slice.validateEdge(edge1);
    expect(validated1.data?.validationError).toBeNull();

    // Invalid connection (Internet -> Namespace)
    const edge2 = { source: '1', target: '3' } as Edge;
    const validated2 = slice.validateEdge(edge2);
    expect(validated2.data?.validationError).toBeDefined();
  });

  it('should handle onNodesChange', () => {
    const nodes = [{ id: '1', position: { x: 0, y: 0 }, data: {} }];
    get.mockReturnValue({ nodes });
    const slice = createFlowSlice(set, get, {} as any);

    slice.onNodesChange([{ id: '1', type: 'position', position: { x: 10, y: 10 } }]);
    expect(set).toHaveBeenCalled();
  });

  it('should handle onConnect and update node data for HPA', () => {
    const updateNodeData = vi.fn();
    get.mockReturnValue({
      nodes: [
        { id: 'hpa1', type: 'HPA', data: { id: 'hpa1' } },
        { id: 'dep1', type: 'Deployment', data: { id: 'dep1' } }
      ],
      updateNodeData,
      validateEdge: (e: Edge) => e,
      edges: []
    });

    const slice = createFlowSlice(set, get, {} as any);
    slice.onConnect({ source: 'hpa1', target: 'dep1' });

    expect(updateNodeData).toHaveBeenCalledWith('dep1', {
      cpuRequest: '100m',
      memoryRequest: '128Mi'
    });
    expect(set).toHaveBeenCalled();
  });

  it('should handle onQuickConnect', () => {
    const onConnect = vi.fn();
    get.mockReturnValue({
      nodes: [
        { id: '1', position: { x: 0, y: 0 }, width: 100, height: 100, type: 'Pod' },
        { id: '2', position: { x: 200, y: 0 }, width: 100, height: 100, type: 'Service' },
        { id: '3', position: { x: -200, y: 0 }, width: 100, height: 100, type: 'Pod' },
        { id: '4', position: { x: 0, y: 200 }, width: 100, height: 100, type: 'Pod' },
        { id: '5', position: { x: 0, y: -200 }, width: 100, height: 100, type: 'Pod' }
      ],
      onConnect
    });

    const slice = createFlowSlice(set, get, {} as any);

    // Test all directions
    slice.onQuickConnect('1', 'right');
    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({ target: '2' }));

    slice.onQuickConnect('1', 'left');
    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({ target: '3' }));

    slice.onQuickConnect('1', 'bottom');
    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({ target: '4' }));

    slice.onQuickConnect('1', 'top');
    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({ target: '5' }));
  });

  it('should handle autoLayout', () => {
    get.mockReturnValue({
      nodes: [
        { id: '1', position: { x: 0, y: 0 }, width: 100, height: 100 },
        { id: '2', position: { x: 0, y: 0 }, width: 100, height: 100 }
      ],
      edges: [{ id: 'e1', source: '1', target: '2' }]
    });

    const slice = createFlowSlice(set, get, {} as any);
    slice.autoLayout('LR');

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      nodes: expect.any(Array)
    }));

    slice.autoLayout('TB');
    expect(set).toHaveBeenCalled();
  });

  it('should handle onReconnect', () => {
    get.mockReturnValue({
        edges: [{ id: 'e1', source: '1', target: '2' }],
        validateEdge: (e: Edge) => e
    });
    const slice = createFlowSlice(set, get, {} as any);

    slice.onReconnect({ id: 'e1' } as Edge, { source: '1', target: '3' });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
        edges: expect.any(Array)
    }));
  });

  it('should move group members together in onNodesChange', () => {
    const nodes = [
        { id: '1', position: { x: 0, y: 0 }, data: { groupId: 'g1' } },
        { id: '2', position: { x: 50, y: 50 }, data: { groupId: 'g1' } }
    ];
    get.mockReturnValue({ nodes });
    const slice = createFlowSlice(set, get, {} as any);

    slice.onNodesChange([{ id: '1', type: 'position', position: { x: 10, y: 10 } }]);
    expect(set).toHaveBeenCalled();
  });
});
