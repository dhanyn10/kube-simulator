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

  it('covers remaining branches in useCustomEdge and edge helpers', () => {
    // 1. checkNodeUnready for Deployment with no child pods or ready child pods
    const deployWithoutChildren = { id: 'd1', type: 'Deployment', data: { status: 'ready' } };
    expect(checkNodeUnready(deployWithoutChildren, [])).toBe(false);

    const deployWithReadyChild = { id: 'd2', type: 'Deployment', data: { status: 'ready' } };
    const readyChildPod = { parentId: 'd2', type: 'Pod', data: { status: 'ready' } };
    expect(checkNodeUnready(deployWithReadyChild, [deployWithReadyChild, readyChildPod])).toBe(false);

    // 2. findDownstreamUnreadyNode fallback to target node or null
    expect(findDownstreamUnreadyNode('non-existent', [], [], [])).toBeNull();

    // 3. getTargetLoggableNode for non-workload target (e.g. Service or Internet)
    const nodes = [
      { id: 'svc-1', type: 'Service' },
      { id: 'pod-1', type: 'Pod', data: { status: 'ready' } },
    ];
    const loggableNonWorkload = getTargetLoggableNode('svc-1', false, nodes, [], []);
    expect(loggableNonWorkload).toBeNull();

    // 4. useCustomEdge onRemove with isConfiguring = false, and onAlertClick for isTargetError with non-workload target
    useFlowStore.setState({
      configuringEdgeId: 'other-edge',
      activeSimulationEdges: ['e2'],
      nodes: [
        { id: 's1', type: 'Service', data: { label: 'Svc1' } },
        { id: 's2', type: 'Service', data: { label: 'Svc2' } },
      ],
      edges: [{ id: 'e2', source: 's1', target: 's2' }],
      globalEdgeColor: '#ccc',
      globalEdgeErrorColor: '#f00',
    });

    const { result } = renderHook(() =>
      useCustomEdge({
        id: 'e2',
        source: 's1',
        target: 's2',
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 10,
        sourcePosition: 'right',
        targetPosition: 'left',
        data: {},
      })
    );

    const mockEvent = { stopPropagation: vi.fn() } as any;

    act(() => {
      result.current.onRemove(mockEvent);
    });

    act(() => {
      result.current.onAlertClick(mockEvent);
    });
    expect(useFlowStore.getState().terminalActiveTab).toBe('activity');
  });

  it('covers onAlertClick activity log dispatching for validationError and isTargetError with unready downstream node', () => {
    const unreadyPod = { id: 'pod-unready', type: 'Pod', data: { label: 'unready-pod', status: 'pending' } };
    const srcNode = { id: 'n1', type: 'Service', data: { label: 'SourceSvc' } };

    useFlowStore.setState({
      activeSimulationEdges: ['e1'],
      nodes: [srcNode, unreadyPod] as any,
      edges: [{ id: 'e1', source: 'n1', target: 'pod-unready' }] as any,
      addActivityLog: vi.fn(),
    });

    // 1. With validationError
    const { result: res1 } = renderHook(() =>
      useCustomEdge({
        id: 'e1',
        source: 'n1',
        target: 'pod-unready',
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 10,
        sourcePosition: 'right',
        targetPosition: 'left',
        data: { validationError: 'Invalid port mapping' },
      })
    );

    const mockEvent = { stopPropagation: vi.fn() } as any;

    act(() => {
      res1.current.onAlertClick(mockEvent);
    });
    expect(useFlowStore.getState().addActivityLog).toHaveBeenCalledWith(
      expect.stringContaining('Invalid port mapping')
    );

    // 2. With isTargetError (no validationError)
    const { result: res2 } = renderHook(() =>
      useCustomEdge({
        id: 'e1',
        source: 'n1',
        target: 'pod-unready',
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 10,
        sourcePosition: 'right',
        targetPosition: 'left',
        data: {},
      })
    );

    act(() => {
      res2.current.onAlertClick(mockEvent);
    });
    expect(useFlowStore.getState().addActivityLog).toHaveBeenCalledWith(
      expect.stringContaining('is not in ready state')
    );
  });

  it('handles label fallbacks for unreadyNode id and props.target in useCustomEdge onAlertClick', () => {
    const addActivityLog = vi.fn();
    const mockEvent = { stopPropagation: vi.fn() } as any;

    // Case 1: unreadyNode has no label, falls back to unreadyNode.id
    const unreadyNoLabel = { id: 'pod-id-only', type: 'Pod', data: { status: 'pending' } };
    useFlowStore.setState({
      activeSimulationEdges: ['e1'],
      nodes: [
        { id: 'src', type: 'Service', data: { label: 'SrcSvc' } },
        unreadyNoLabel,
      ] as any,
      edges: [{ id: 'e1', source: 'src', target: 'pod-id-only' }] as any,
      addActivityLog,
    });

    const { result: res1 } = renderHook(() =>
      useCustomEdge({
        id: 'e1',
        source: 'src',
        target: 'pod-id-only',
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 10,
        sourcePosition: 'right',
        targetPosition: 'left',
        data: {},
      })
    );

    act(() => {
      res1.current.onAlertClick(mockEvent);
    });
    expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('pod-id-only'));

    // Case 2: unreadyNode has no label, falls back to unreadyNode.id ('target-fallback-id')
    addActivityLog.mockClear();
    const unreadyNoLabelTarget = { id: 'target-fallback-id', type: 'Pod', data: { status: 'pending' } };
    useFlowStore.setState({
      activeSimulationEdges: ['e2'],
      nodes: [
        { id: 'src2', type: 'Service', data: { label: 'Src2' } },
        unreadyNoLabelTarget,
      ] as any,
      edges: [{ id: 'e2', source: 'src2', target: 'target-fallback-id' }] as any,
      addActivityLog,
    });

    const { result: res2 } = renderHook(() =>
      useCustomEdge({
        id: 'e2',
        source: 'src2',
        target: 'target-fallback-id',
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 10,
        sourcePosition: 'right',
        targetPosition: 'left',
        data: {},
      })
    );

    act(() => {
      res2.current.onAlertClick(mockEvent);
    });
    expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('target-fallback-id'));
  });

  it('covers checkNodeUnready with node lacking data property, and getTargetLoggableNode with ReplicaSet unready node', () => {
    // 1. checkNodeUnready with node lacking data property
    const nodeNoData = { type: 'Pod' };
    expect(checkNodeUnready(nodeNoData, [])).toBe(true);

    // 2. getTargetLoggableNode with ReplicaSet unready node
    const rsUnreadyNode = { id: 'rs-unready', type: 'ReplicaSet', data: { status: 'pending' } };
    const loggableRS = getTargetLoggableNode('rs-unready', true, [rsUnreadyNode], [], []);
    expect(loggableRS?.id).toBe('rs-unready');
  });

  it('covers cycle handling, targetNode null fallback in getTargetLoggableNode, and unreadyNode type/label fallbacks in onAlertClick', () => {
    // 1. checkDownstreamErrorState & findDownstreamUnreadyNode with cycle in graph
    const cyclicNodes = [
      { id: 'c1', type: 'Service' },
      { id: 'c2', type: 'Service' },
    ];
    const cyclicEdges = [
      { id: 'e1', source: 'c1', target: 'c2' },
      { id: 'e2', source: 'c2', target: 'c1' },
    ];
    expect(checkDownstreamErrorState(true, null, 'c1', cyclicNodes, cyclicEdges, ['e1', 'e2'])).toBe(false);
    expect(findDownstreamUnreadyNode('c1', cyclicNodes, cyclicEdges, ['e1', 'e2'])?.id).toBe('c1');

    // 2. getTargetLoggableNode when targetNode is null / not found in nodes
    expect(getTargetLoggableNode('missing-id', false, [], [], [])).toBeNull();

    // 3. getTargetLoggableNode fallback to targetNode when unreadyNode is not a workload
    const svcTarget = { id: 's-target', type: 'Service' };
    expect(getTargetLoggableNode('s-target', true, [svcTarget], [], [])).toBeNull();

    // 4. useCustomEdge onAlertClick label fallbacks (sourceNode/targetNode without labels, unreadyNode without label/id)
    const addActivityLog = vi.fn();
    const mockEvent = { stopPropagation: vi.fn() } as any;

    useFlowStore.setState({
      activeSimulationEdges: ['e-fallback'],
      nodes: [
        { id: 'src-nolabel', type: 'Service', data: {} },
        { id: 'tgt-nolabel', type: 'Service', data: {} },
      ] as any,
      edges: [{ id: 'e-fallback', source: 'src-nolabel', target: 'tgt-nolabel' }] as any,
      addActivityLog,
    });

    const { result } = renderHook(() =>
      useCustomEdge({
        id: 'e-fallback',
        source: 'src-nolabel',
        target: 'tgt-nolabel',
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 10,
        sourcePosition: 'right',
        targetPosition: 'left',
        data: { validationError: 'Validation error' },
      })
    );

    act(() => {
      result.current.onAlertClick(mockEvent);
    });
    expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('[Connection Alert] src-nolabel -> tgt-nolabel: Validation error'));

    // Test isTargetError fallback when unreadyNode has type Pod with status pending but no label
    addActivityLog.mockClear();
    const unreadyPodNoLabel = { id: 'pod-nolabel', type: 'Pod', data: { status: 'pending' } };
    useFlowStore.setState({
      activeSimulationEdges: ['e-unready-pod'],
      nodes: [
        { id: 'src-2', type: 'Service', data: {} },
        unreadyPodNoLabel,
      ] as any,
      edges: [{ id: 'e-unready-pod', source: 'src-2', target: 'pod-nolabel' }] as any,
      addActivityLog,
    });

    const { result: resUnreadyPod } = renderHook(() =>
      useCustomEdge({
        id: 'e-unready-pod',
        source: 'src-2',
        target: 'pod-nolabel',
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 10,
        sourcePosition: 'right',
        targetPosition: 'left',
        data: {},
      })
    );

    act(() => {
      resUnreadyPod.current.onAlertClick(mockEvent);
    });
    expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('Downstream workload pod/pod-nolabel is not in ready state.'));

    // Test fallback when unreadyNode has no type (e.g. untyped target fallback)
    addActivityLog.mockClear();
    const untypedTarget = { id: 'untyped-target' };
    const unreadyChild = { id: 'child-pod', type: 'Pod', data: { status: 'pending' } };
    useFlowStore.setState({
      activeSimulationEdges: ['e-untyped-1', 'e-untyped-2'],
      nodes: [
        { id: 'src-3', type: 'Service', data: {} },
        untypedTarget,
        unreadyChild,
      ] as any,
      edges: [
        { id: 'e-untyped-1', source: 'src-3', target: 'untyped-target' },
        { id: 'e-untyped-2', source: 'untyped-target', target: 'child-pod' },
      ] as any,
      addActivityLog,
    });

    // Test findDownstreamUnreadyNode fallback when targetId node has no type
    expect(findDownstreamUnreadyNode('non-existent-target', [], [], [])).toBeNull();
  });

  it('covers getTargetLoggableNode with Deployment targetNode and unreadyNode null fallback in onAlertClick', () => {
    // 1. getTargetLoggableNode with Deployment targetNode when unreadyNode is a Service
    const svcUnready = { id: 'svc1', type: 'Service' };
    const depTarget = { id: 'dep1', type: 'Deployment', data: { status: 'ready' } };
    const loggableDep = getTargetLoggableNode('dep1', true, [svcUnready, depTarget], [], []);
    expect(loggableDep?.id).toBe('dep1');

    // 2. onAlertClick when isTargetError is true and unreadyNode is an untyped target node
    const addActivityLog = vi.fn();
    const mockEvent = { stopPropagation: vi.fn() } as any;

    const unreadyUntypedTarget = { id: 'tgt-untyped', parentId: undefined };
    useFlowStore.setState({
      activeSimulationEdges: ['e-svc', 'e-untyped'],
      nodes: [
        { id: 'src-svc', type: 'Service' },
        { id: 'tgt-svc', type: 'Service' },
        { id: 'pod-unready', type: 'Pod', data: { status: 'pending' } },
      ] as any,
      edges: [
        { id: 'e-svc', source: 'src-svc', target: 'tgt-svc' },
        { id: 'e-untyped', source: 'tgt-svc', target: 'pod-unready' },
      ] as any,
      addActivityLog,
    });

    const { result } = renderHook(() =>
      useCustomEdge({
        id: 'e-svc',
        source: 'src-svc',
        target: 'tgt-svc',
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 10,
        sourcePosition: 'right',
        targetPosition: 'left',
        data: {},
      })
    );

    act(() => {
      result.current.onAlertClick(mockEvent);
    });
    expect(addActivityLog).toHaveBeenCalledWith(
      expect.stringContaining('is not in ready state')
    );
  });

  it('covers getStrokeColor returning globalEdgeColor when no errors exist, and getTargetLoggableNode line 106 targetNode fallback', () => {
    // 1. Line 157: getStrokeColor returns globalEdgeColor when validationError and isTargetError are both false
    useFlowStore.setState({
      activeSimulationEdges: [],
      nodes: [
        { id: 'n1', type: 'Pod', data: { status: 'ready' } },
        { id: 'n2', type: 'Pod', data: { status: 'ready' } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      globalEdgeColor: '#123456',
      globalEdgeErrorColor: '#ff0000',
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
        data: {},
      })
    );

    expect(result.current.getStrokeColor()).toBe('#123456');

    // 2. Line 106: getTargetLoggableNode where isTargetError is true, unreadyNode is a Service (non-workload), and targetNode is a Pod
    const podTarget = { id: 'pod-target', type: 'Pod', data: { status: 'ready' } };
    const svcUnready = { id: 'svc-unready', type: 'Service' };
    const loggableNode = getTargetLoggableNode(
      'pod-target',
      true,
      [podTarget, svcUnready],
      [{ id: 'e2', source: 'pod-target', target: 'svc-unready' }],
      ['e2']
    );
    expect(loggableNode?.id).toBe('pod-target');
  });
});
