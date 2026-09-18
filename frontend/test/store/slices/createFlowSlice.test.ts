import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlowStore } from '@/store';
import { createFlowSlice } from '@/store/slices/createFlowSlice';

describe('createFlowSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [
        {
          id: 'role-1',
          type: 'Role',
          position: { x: 0, y: 0 },
          data: { label: 'Role 1', rules: [] },
        },
        {
          id: 'dep-1',
          type: 'Deployment',
          position: { x: 200, y: 0 },
          data: { label: 'Dep 1' },
        },
        {
          id: 'pod-1',
          type: 'Pod',
          parentId: 'dep-1',
          position: { x: 10, y: 10 },
          data: { label: 'Pod 1' },
        },
      ],
      edges: [],
    });
  });

  it('reroutes connect from Role to child Pod inside Deployment to parent Deployment', () => {
    const { onConnect } = useFlowStore.getState();

    act(() => {
      onConnect({
        source: 'role-1',
        target: 'pod-1',
        sourceHandle: null,
        targetHandle: null,
      });
    });

    const edges = useFlowStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('role-1');
    expect(edges[0].target).toBe('dep-1');
  });

  it('reroutes connect from child Pod inside Deployment to Role to parent Deployment', () => {
    const { onConnect } = useFlowStore.getState();

    act(() => {
      onConnect({
        source: 'pod-1',
        target: 'role-1',
        sourceHandle: null,
        targetHandle: null,
      });
    });

    const edges = useFlowStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('dep-1');
    expect(edges[0].target).toBe('role-1');
  });

  it('handles group drag with zero dx and dy offset without creating extra changes', () => {
    useFlowStore.setState({
      nodes: [
        {
          id: 'node-1',
          type: 'Pod',
          position: { x: 100, y: 100 },
          data: { groupId: 'group-a' },
        },
        {
          id: 'node-2',
          type: 'Pod',
          position: { x: 200, y: 200 },
          data: { groupId: 'group-a' },
        },
      ],
    });

    const { onNodesChange } = useFlowStore.getState();

    act(() => {
      onNodesChange([
        {
          id: 'node-1',
          type: 'position',
          position: { x: 100, y: 100 }, // zero delta
        },
      ]);
    });

    const nodes = useFlowStore.getState().nodes;
    expect(nodes.find((n) => n.id === 'node-2')?.position).toEqual({ x: 200, y: 200 });
  });
});
