import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasHandlers } from '@/hooks/useCanvasHandlers';
import { useFlowStore } from '@/store';
import { Node, Edge } from '@xyflow/react';

const mockSetCenter = vi.fn();
const mockFitBounds = vi.fn();

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useReactFlow: () => ({
      setCenter: mockSetCenter,
      fitBounds: mockFitBounds,
    }),
  };
});

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    generateYaml: vi.fn().mockResolvedValue('apiVersion: v1\nkind: Pod'),
  };
});

describe('useCanvasHandlers hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      isAutofocusEnabled: false,
      isRightSidebarVisible: true,
      setConfiguringEdgeId: vi.fn(),
      setRightSidebarVisible: (val: boolean) => useFlowStore.setState({ isRightSidebarVisible: val }),
      onNodeClick: vi.fn(),
    });
  });

  it('handles onNodeContextMenu and onPaneContextMenu', () => {
    const node: Node = { id: 'n1', selected: false, position: { x: 0, y: 0 }, data: {} };
    useFlowStore.setState({ nodes: [node] });

    const { result } = renderHook(() => useCanvasHandlers());

    const mockEvent = {
      preventDefault: vi.fn(),
      clientX: 120,
      clientY: 180,
    } as any;

    act(() => {
      result.current.onNodeContextMenu(mockEvent, node);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({ x: 120, y: 180 });
    expect(useFlowStore.getState().nodes[0].selected).toBe(true);

    // Context menu on an already selected node
    const selectedNode: Node = { id: 'n1', selected: true, position: { x: 0, y: 0 }, data: {} };
    act(() => {
      result.current.onNodeContextMenu(mockEvent, selectedNode);
    });
    expect(result.current.contextMenu).toEqual({ x: 120, y: 180 });

    // Pane context menu
    const paneEvent = {
      preventDefault: vi.fn(),
      clientX: 200,
      clientY: 300,
    } as any;

    act(() => {
      result.current.onPaneContextMenu(paneEvent);
    });

    expect(paneEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({ x: 200, y: 300 });

    // Window contextmenu closes context menu
    act(() => {
      window.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    });
    expect(result.current.contextMenu).toBeNull();

    // Re-open context menu and test window click closing context menu
    act(() => {
      result.current.onPaneContextMenu(paneEvent);
    });
    expect(result.current.contextMenu).toEqual({ x: 200, y: 300 });

    act(() => {
      window.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(result.current.contextMenu).toBeNull();
  });

  it('handles onNodeClick with autofocus enabled when container element is missing vs present, and autofocus disabled', () => {
    const onNodeClickStore = vi.fn();
    const node: Node = {
      id: 'n1',
      position: { x: 100, y: 100 },
      width: 200,
      height: 100,
      data: {},
    };

    useFlowStore.setState({
      nodes: [node],
      onNodeClick: onNodeClickStore,
      isAutofocusEnabled: false,
    });

    const { result: disabledResult } = renderHook(() => useCanvasHandlers());

    const mockEventDisabled = {} as any;
    act(() => {
      disabledResult.current.onNodeClick(mockEventDisabled, node);
    });

    expect(onNodeClickStore).toHaveBeenCalledWith(mockEventDisabled, node);
    expect(mockSetCenter).not.toHaveBeenCalled();

    useFlowStore.setState({
      nodes: [node],
      onNodeClick: onNodeClickStore,
      isAutofocusEnabled: true,
    });

    const { result } = renderHook(() => useCanvasHandlers());

    const mockEvent = {} as any;
    act(() => {
      result.current.onNodeClick(mockEvent, node);
    });

    expect(onNodeClickStore).toHaveBeenCalledWith(mockEvent, node);
    expect(mockSetCenter).toHaveBeenCalledWith(200, 150, expect.objectContaining({ duration: 800 }));

    // Now test with DOM container element present
    mockSetCenter.mockClear();
    const rendererEl = document.createElement('div');
    rendererEl.className = 'react-flow__renderer';
    Object.defineProperty(rendererEl, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 600 }),
    });
    document.body.appendChild(rendererEl);

    act(() => {
      result.current.onNodeClick(mockEvent, node);
    });

    expect(mockSetCenter).toHaveBeenCalledWith(200, 150, expect.objectContaining({ duration: 800 }));
    document.body.removeChild(rendererEl);
  });

  it('handles onEdgeClick with sidebar toggle, missing nodes, and autofocus bounds fitting', () => {
    const setConfiguringEdgeId = vi.fn();

    const sourceNode: Node = {
      id: 'n1',
      position: { x: 0, y: 0 },
      measured: { width: 100, height: 50 },
      data: {},
    };
    const targetNode: Node = {
      id: 'n2',
      position: { x: 300, y: 300 },
      measured: { width: 100, height: 50 },
      data: {},
    };
    const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' };

    useFlowStore.setState({
      nodes: [sourceNode, targetNode],
      edges: [edge],
      isRightSidebarVisible: false,
      setConfiguringEdgeId,
      isAutofocusEnabled: true,
    });

    const { result } = renderHook(() => useCanvasHandlers());

    const mockEvent = {} as any;
    act(() => {
      result.current.onEdgeClick(mockEvent, edge);
    });

    expect(useFlowStore.getState().isRightSidebarVisible).toBe(true);
    expect(setConfiguringEdgeId).toHaveBeenCalledWith('e1');
    expect(mockFitBounds).toHaveBeenCalledWith(
      { x: 0, y: 0, width: 400, height: 350 },
      { padding: 0.2, duration: 800 }
    );

    // Edge click when right sidebar is already visible
    mockFitBounds.mockClear();
    useFlowStore.setState({ isRightSidebarVisible: true });
    act(() => {
      result.current.onEdgeClick(mockEvent, edge);
    });
    expect(useFlowStore.getState().isRightSidebarVisible).toBe(true);

    // Edge click when isAutofocusEnabled is false
    mockFitBounds.mockClear();
    useFlowStore.setState({ isAutofocusEnabled: false });
    const { result: noAutofocusResult } = renderHook(() => useCanvasHandlers());
    act(() => {
      noAutofocusResult.current.onEdgeClick(mockEvent, edge);
    });
    expect(mockFitBounds).not.toHaveBeenCalled();

    // Edge click with missing source/target nodes when isAutofocusEnabled is true
    mockFitBounds.mockClear();
    useFlowStore.setState({ isAutofocusEnabled: true, nodes: [sourceNode, targetNode] });
    const { result: autofocusResult } = renderHook(() => useCanvasHandlers());
    const brokenEdge: Edge = { id: 'e-broken', source: 'n-missing-1', target: 'n-missing-2' };
    act(() => {
      autofocusResult.current.onEdgeClick(mockEvent, brokenEdge);
    });
    expect(mockFitBounds).not.toHaveBeenCalled();

    // Edge click where sourceNode exists but targetNode is missing
    mockFitBounds.mockClear();
    const partialEdge: Edge = { id: 'e-partial', source: 'n1', target: 'n-missing-target' };
    act(() => {
      autofocusResult.current.onEdgeClick(mockEvent, partialEdge);
    });
    expect(mockFitBounds).not.toHaveBeenCalled();

    // Edge click where sourceNode is missing but targetNode exists
    mockFitBounds.mockClear();
    const missingSourceEdge: Edge = { id: 'e-missing-source', source: 'n-missing-source', target: 'n2' };
    act(() => {
      autofocusResult.current.onEdgeClick(mockEvent, missingSourceEdge);
    });
    expect(mockFitBounds).not.toHaveBeenCalled();
  });

  it('covers fallback node dimensions, container bounds, forbidden node, and null iamUsers in autofocus', () => {
    // 1. Node without measured or width/height (fallbacks 150/100)
    const nodeNoDimensions: Node = {
      id: 'n-nodim',
      type: 'Pod',
      position: { x: 0, y: 0 },
      data: {},
    };

    // Node with measured object present but width undefined, having explicit node.width
    const nodeWithWidthOnly: Node = {
      id: 'n-widthonly',
      type: 'Pod',
      position: { x: 0, y: 0 },
      width: 250,
      height: 120,
      measured: {} as any,
      data: {},
    };

    // Container with 0 rect width/height (fallbacks 1024/768)
    const zeroRectEl = document.createElement('div');
    zeroRectEl.className = 'react-flow__renderer';
    Object.defineProperty(zeroRectEl, 'getBoundingClientRect', {
      value: () => ({ width: 0, height: 0 }),
    });
    document.body.appendChild(zeroRectEl);

    useFlowStore.setState({
      nodes: [nodeNoDimensions],
      onNodeClick: vi.fn(),
      isAutofocusEnabled: true,
      activeIdentity: 'system:admin',
      iamUsers: undefined,
    });

    const { result } = renderHook(() => useCanvasHandlers());

    const mockEvent = {} as any;
    act(() => {
      result.current.onNodeClick(mockEvent, nodeNoDimensions);
    });

    expect(mockSetCenter).toHaveBeenCalledWith(75, 50, expect.objectContaining({ duration: 800 }));

    // Test nodeWithWidthOnly to cover node.width ?? 150 fallback
    mockSetCenter.mockClear();
    useFlowStore.setState({ nodes: [nodeWithWidthOnly] });
    act(() => {
      result.current.onNodeClick(mockEvent, nodeWithWidthOnly);
    });
    expect(mockSetCenter).toHaveBeenCalledWith(125, 60, expect.objectContaining({ duration: 800 }));

    document.body.removeChild(zeroRectEl);

    // 2. Forbidden node access skips autofocus
    mockSetCenter.mockClear();
    const forbiddenNode: Node = {
      id: 'n-forbidden',
      type: 'Pod',
      position: { x: 0, y: 0 },
      data: { namespace: 'restricted-ns' },
    };

    useFlowStore.setState({
      nodes: [forbiddenNode],
      isAutofocusEnabled: true,
      activeIdentity: 'restricted-user',
      iamUsers: [
        {
          username: 'restricted-user',
          role: 'custom',
          policies: [{ name: 'DenyPodPolicy', resources: ['Pod'], namespaces: ['restricted-ns'], action: 'deny' }],
        },
      ] as any,
    });

    act(() => {
      result.current.onNodeClick(mockEvent, forbiddenNode);
    });

    expect(mockSetCenter).not.toHaveBeenCalled();

    // 3. Edge click with source/target nodes having no measured or width/height (fallbacks 150/100)
    const srcNoDim: Node = { id: 's1', position: { x: 0, y: 0 }, data: {} };
    const tgtNoDim: Node = { id: 't1', position: { x: 200, y: 200 }, data: {} };
    const edgeNoDim: Edge = { id: 'e-nodim', source: 's1', target: 't1' };

    useFlowStore.setState({
      nodes: [srcNoDim, tgtNoDim],
      edges: [edgeNoDim],
      isAutofocusEnabled: true,
      setConfiguringEdgeId: vi.fn(),
    });

    const { result: edgeResult } = renderHook(() => useCanvasHandlers());

    act(() => {
      edgeResult.current.onEdgeClick(mockEvent, edgeNoDim);
    });

    expect(mockFitBounds).toHaveBeenCalledWith(
      { x: 0, y: 0, width: 350, height: 300 },
      { padding: 0.2, duration: 800 }
    );
  });

  it('handles handleExport and generates YAML', async () => {
    const { result } = renderHook(() => useCanvasHandlers());

    await act(async () => {
      await result.current.handleExport();
    });

    expect(result.current.isYamlOpen).toBe(true);
    expect(result.current.yamlContent).toBe('apiVersion: v1\nkind: Pod');
  });

  it('covers uncovered conditions in useCanvasHandlers: computeAutofocusZoom lower bound clamping and onNodeClick dimension fallbacks when measured is an empty object', () => {
    // 1. computeAutofocusZoom with huge node dimensions (e.g. 5000x5000) to trigger Math.max(0.5, ...) lower bound zoom clamping
    const hugeNode: Node = {
      id: 'n-huge',
      type: 'Pod',
      position: { x: 0, y: 0 },
      width: 5000,
      height: 5000,
      measured: { width: 5000, height: 5000 },
      data: {},
    };

    const rendererEl = document.createElement('div');
    rendererEl.className = 'react-flow__renderer';
    Object.defineProperty(rendererEl, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 600 }),
    });
    document.body.appendChild(rendererEl);

    useFlowStore.setState({
      nodes: [hugeNode],
      onNodeClick: vi.fn(),
      isAutofocusEnabled: true,
      activeIdentity: 'system:admin',
      iamUsers: [],
    });

    const { result } = renderHook(() => useCanvasHandlers());

    act(() => {
      result.current.onNodeClick({} as any, hugeNode);
    });

    // Zoom clamped to minimum 0.5
    expect(mockSetCenter).toHaveBeenCalledWith(2500, 2500, expect.objectContaining({ zoom: 0.5 }));

    document.body.removeChild(rendererEl);

    // 2. onNodeClick when node.measured is an empty object ({}) and node.width / node.height are undefined -> triggers ?? 150 and ?? 100 fallbacks
    mockSetCenter.mockClear();
    const nodeEmptyMeasured: Node = {
      id: 'n-empty-measured',
      type: 'Pod',
      position: { x: 0, y: 0 },
      measured: {} as any,
      width: undefined,
      height: undefined,
      data: {},
    };

    useFlowStore.setState({
      nodes: [nodeEmptyMeasured],
      isAutofocusEnabled: true,
    });

    const { result: emptyMeasuredResult } = renderHook(() => useCanvasHandlers());

    act(() => {
      emptyMeasuredResult.current.onNodeClick({} as any, nodeEmptyMeasured);
    });

    // Uses 150 / 2 = 75 and 100 / 2 = 50 for center
    expect(mockSetCenter).toHaveBeenCalledWith(75, 50, expect.objectContaining({ duration: 800 }));

    // 3. computeAutofocusZoom with medium node dimensions (e.g. 800x600) for unclamped zoom (between 0.5 and 1.5)
    mockSetCenter.mockClear();
    const mediumNode: Node = {
      id: 'n-medium',
      type: 'Pod',
      position: { x: 0, y: 0 },
      width: 800,
      height: 600,
      measured: { width: 800, height: 600 },
      data: {},
    };

    const mediumRendererEl = document.createElement('div');
    mediumRendererEl.className = 'react-flow__renderer';
    Object.defineProperty(mediumRendererEl, 'getBoundingClientRect', {
      value: () => ({ width: 1000, height: 800 }),
    });
    document.body.appendChild(mediumRendererEl);

    useFlowStore.setState({
      nodes: [mediumNode],
      isAutofocusEnabled: true,
    });

    const { result: mediumResult } = renderHook(() => useCanvasHandlers());

    act(() => {
      mediumResult.current.onNodeClick({} as any, mediumNode);
    });

    expect(mockSetCenter).toHaveBeenCalledWith(400, 300, expect.objectContaining({ duration: 800 }));
    document.body.removeChild(mediumRendererEl);
  });

  it('covers scaleY < scaleX zoom calculation and edge click with explicit node.width/height fallback', () => {
    // 1. computeAutofocusZoom where scaleY is smaller than scaleX
    const tallNode: Node = {
      id: 'n-tall',
      type: 'Pod',
      position: { x: 0, y: 0 },
      width: 100,
      height: 400,
      measured: { width: 100, height: 400 },
      data: {},
    };

    const containerEl = document.createElement('div');
    containerEl.className = 'react-flow__renderer';
    Object.defineProperty(containerEl, 'getBoundingClientRect', {
      value: () => ({ width: 1000, height: 500 }),
    });
    document.body.appendChild(containerEl);

    useFlowStore.setState({
      nodes: [tallNode],
      onNodeClick: vi.fn(),
      isAutofocusEnabled: true,
      activeIdentity: 'system:admin',
      iamUsers: [],
    });

    const { result } = renderHook(() => useCanvasHandlers());

    act(() => {
      result.current.onNodeClick({} as any, tallNode);
    });

    // scaleY = 500 * 0.84 / 400 = 1.05
    expect(mockSetCenter).toHaveBeenCalledWith(50, 200, expect.objectContaining({ zoom: 1.05 }));
    document.body.removeChild(containerEl);

    // 2. onEdgeClick where source and target have measured: {} (undefined width/height) but explicit node.width and node.height
    const srcWithWidthHeight: Node = {
      id: 's-wh',
      position: { x: 0, y: 0 },
      width: 120,
      height: 80,
      measured: {} as any,
      data: {},
    };
    const tgtWithWidthHeight: Node = {
      id: 't-wh',
      position: { x: 200, y: 200 },
      width: 160,
      height: 90,
      measured: {} as any,
      data: {},
    };
    const edgeWH: Edge = { id: 'e-wh', source: 's-wh', target: 't-wh' };

    useFlowStore.setState({
      nodes: [srcWithWidthHeight, tgtWithWidthHeight],
      edges: [edgeWH],
      isAutofocusEnabled: true,
      isRightSidebarVisible: false,
      setConfiguringEdgeId: vi.fn(),
    });

    const { result: edgeResult } = renderHook(() => useCanvasHandlers());

    act(() => {
      edgeResult.current.onEdgeClick({} as any, edgeWH);
    });

    expect(useFlowStore.getState().isRightSidebarVisible).toBe(true);
    expect(mockFitBounds).toHaveBeenCalledWith(
      { x: 0, y: 0, width: 360, height: 290 },
      { padding: 0.2, duration: 800 }
    );
  });
});
