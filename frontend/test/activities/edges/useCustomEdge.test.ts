import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  checkNodeUnready,
  checkDownstreamErrorState,
  findDownstreamUnreadyNode,
  getTargetLoggableNode,
  useCustomEdge,
} from '@/activities/edges/useCustomEdge';
import { useFlowStore } from '@/store';

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setEdges: vi.fn((cb) => {
      if (typeof cb === 'function') {
        cb([{ id: 'edge-1' }, { id: 'edge-2' }]);
      }
    }),
  }),
  getBezierPath: () => ['M 0 0 L 10 10', 5, 5],
}));

describe('useCustomEdge & edge helpers', () => {
  it('checkNodeUnready returns true for unready workload or child pod', () => {
    expect(checkNodeUnready(null, [])).toBe(false);

    const podUnready = { type: 'Pod', data: { status: 'pending' } };
    expect(checkNodeUnready(podUnready, [])).toBe(true);

    const podReady = { type: 'Pod', data: { status: 'ready' } };
    expect(checkNodeUnready(podReady, [])).toBe(false);

    const deployWithUnreadyChild = { id: 'd1', type: 'Deployment', data: { status: 'ready' } };
    const childPod = { parentId: 'd1', type: 'Pod', data: { status: 'pending' } };
    expect(checkNodeUnready(deployWithUnreadyChild, [deployWithUnreadyChild, childPod])).toBe(true);
  });

  it('checkDownstreamErrorState evaluates recursively', () => {
    const nodes = [
      { id: 'node-1', type: 'Pod', data: { status: 'ready' } },
      { id: 'node-2', type: 'Pod', data: { status: 'pending' } },
    ];
    const edges = [{ id: 'e1', source: 'node-1', target: 'node-2' }];

    expect(checkDownstreamErrorState(false, null, 'node-1', nodes, edges, ['e1'])).toBe(false);
    expect(checkDownstreamErrorState(true, 'some error', 'node-1', nodes, edges, ['e1'])).toBe(false);
    expect(checkDownstreamErrorState(true, null, 'node-1', nodes, edges, ['e1'])).toBe(true);
  });

  it('findDownstreamUnreadyNode and getTargetLoggableNode return correct target', () => {
    const nodes = [
      { id: 'node-1', type: 'Service' },
      { id: 'node-2', type: 'Pod', data: { status: 'pending' } },
    ];
    const edges = [{ id: 'e1', source: 'node-1', target: 'node-2' }];

    const unready = findDownstreamUnreadyNode('node-1', nodes, edges, ['e1']);
    expect(unready?.id).toBe('node-2');

    const loggable = getTargetLoggableNode('node-1', true, nodes, edges, ['e1']);
    expect(loggable?.id).toBe('node-2');
  });

  it('useCustomEdge returns proper path, width, and action handlers', () => {
    useFlowStore.setState({
      configuringEdgeId: 'e1',
      activeSimulationEdges: ['e1'],
      nodes: [
        { id: 'n1', type: 'Pod', data: { label: 'SourcePod', status: 'ready' } },
        { id: 'n2', type: 'Pod', data: { label: 'TargetPod', status: 'pending' } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      globalEdgeColor: '#ccc',
      globalEdgeErrorColor: '#f00',
    });

    const { result } = renderHook(() =>
      useCustomEdge({
        id: 'e1',
        source: 'n1',
        target: 'n2',
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 10,
        sourcePosition: 'right',
        targetPosition: 'left',
        data: { width: 3 },
      })
    );

    expect(result.current.isConfiguring).toBe(true);
    expect(result.current.isSimulating).toBe(true);
    expect(result.current.edgeWidth).toBe(3);
    expect(result.current.hasAlert).toBe(true);
    expect(result.current.getStrokeColor()).toBe('#f00');

    const mockEvent = { stopPropagation: vi.fn() } as any;

    act(() => {
      result.current.onSettings(mockEvent);
    });
    expect(mockEvent.stopPropagation).toHaveBeenCalled();

    act(() => {
      result.current.onRemove(mockEvent);
    });

    act(() => {
      result.current.onAlertClick(mockEvent);
    });
  });
});
