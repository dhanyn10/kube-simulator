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
  });

  it('handles onNodeClick with autofocus enabled when container element is missing vs present', () => {
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

    // Edge click with missing source/target nodes
    mockFitBounds.mockClear();
    const brokenEdge: Edge = { id: 'e-broken', source: 'n-missing-1', target: 'n-missing-2' };
    act(() => {
      result.current.onEdgeClick(mockEvent, brokenEdge);
    });
    expect(mockFitBounds).not.toHaveBeenCalled();

    // Edge click where sourceNode exists but targetNode is missing
    mockFitBounds.mockClear();
    const partialEdge: Edge = { id: 'e-partial', source: 'n1', target: 'n-missing-target' };
    act(() => {
      result.current.onEdgeClick(mockEvent, partialEdge);
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
});
