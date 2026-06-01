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
});
