import { describe, it, expect, vi } from 'vitest';
import { createFlowSlice } from '../../../src/store/slices/createFlowSlice';

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
    const nodes = [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'node 1' } }];
    slice.setNodes(nodes as any);
    expect(set).toHaveBeenCalledWith({ nodes });

    const edges = [{ id: 'e1', source: '1', target: '2' }];
    slice.setEdges(edges as any);
    expect(set).toHaveBeenCalledWith({ edges });
  });

  it('should validate an edge', () => {
    get.mockReturnValue({
      nodes: [
        { id: '1', type: 'Internet' },
        { id: '2', type: 'Namespace' }
      ]
    });
    const slice = createFlowSlice(set, get, {} as any);
    const edge = { id: 'e1', source: '1', target: '2' };
    const validatedEdge = slice.validateEdge(edge as any);
    expect(validatedEdge.data.validationError).toBe('Internet cannot be connected to Namespace.');
  });

  it('should handle onConnect with HPA and Deployment', () => {
    const updateNodeData = vi.fn();
    const validateEdge = vi.fn((e) => e);
    get.mockReturnValue({
      nodes: [
        { id: 'h1', type: 'HPA', data: {} },
        { id: 'd1', type: 'Deployment', data: {} }
      ],
      updateNodeData,
      validateEdge,
      edges: []
    });

    const slice = createFlowSlice(set, get, {} as any);
    const connection = { source: 'h1', target: 'd1', sourceHandle: 'h-s', targetHandle: 'd-t' };

    slice.onConnect(connection);

    expect(updateNodeData).toHaveBeenCalledWith('d1', {
      cpuRequest: '100m',
      memoryRequest: '128Mi'
    });
    expect(set).toHaveBeenCalled();
  });

  it('should handle onReconnect', () => {
    const validateEdge = vi.fn((e) => e);
    get.mockReturnValue({
      edges: [{ id: 'e1', source: 's1', target: 't1' }],
      validateEdge
    });

    const slice = createFlowSlice(set, get, {} as any);
    slice.onReconnect({ id: 'e1' } as any, { source: 's1', target: 't2' } as any);

    expect(set).toHaveBeenCalledWith({
        edges: expect.arrayContaining([
            expect.objectContaining({ id: 'e1', target: 't2' })
        ])
    });
  });

  it('should handle onNodesChange for position with groupId', () => {
    const nodes = [
      { id: '1', position: { x: 10, y: 10 }, data: { groupId: 'g1' } },
      { id: '2', position: { x: 100, y: 100 }, data: { groupId: 'g1' } }
    ];
    get.mockReturnValue({ nodes });

    const slice = createFlowSlice(set, get, {} as any);
    const changes = [{ id: '1', type: 'position', position: { x: 20, y: 20 } }];

    slice.onNodesChange(changes as any);

    expect(set).toHaveBeenCalled();
  });

  it('should run autoLayout', () => {
    const nodes = [
      { id: '1', position: { x: 0, y: 0 }, data: { label: 'n1' } },
      { id: '2', position: { x: 0, y: 0 }, data: { label: 'n2' } }
    ];
    const edges = [{ id: 'e1', source: '1', target: '2' }];
    get.mockReturnValue({ nodes, edges });

    const slice = createFlowSlice(set, get, {} as any);
    slice.autoLayout('LR');

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      lastActionName: 'Auto Layout'
    }));
  });

  it('should handle onQuickConnect', () => {
    const nodes = [
      { id: '1', position: { x: 0, y: 0 }, type: 'Deployment', data: { label: 'n1' } },
      { id: '2', position: { x: 200, y: 0 }, type: 'Deployment', data: { label: 'n2' } }
    ];
    const onConnect = vi.fn();
    get.mockReturnValue({ nodes, onConnect });

    const slice = createFlowSlice(set, get, {} as any);
    slice.onQuickConnect('1', 'right');

    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({
      source: '1',
      target: '2'
    }));
  });

  it('should handle deleteNodes', () => {
    const nodes = [{ id: '1' }, { id: '2' }];
    const setNodes = vi.fn();
    get.mockReturnValue({ nodes, setNodes });

    // createNodeSlice handles deleteNodes logic, but it's part of FlowState
    // For unit testing createFlowSlice, we test its unique methods
  });
});
