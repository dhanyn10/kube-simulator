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

  it('handles onNodeClick with autofocus enabled and renderer element present', () => {
    const onNodeClickStore = vi.fn();
    const node: Node = {
      id: 'n1',
      position: { x: 100, y: 100 },
      width: 200,
      height: 100,
      data: {},
    };

    // Create container element in DOM
    const rendererEl = document.createElement('div');
    rendererEl.className = 'react-flow__renderer';
    Object.defineProperty(rendererEl, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 600 }),
    });
    document.body.appendChild(rendererEl);

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

    document.body.removeChild(rendererEl);
  });

  it('handles onEdgeClick with sidebar toggle and autofocus bounds fitting', () => {
    const setConfiguringEdgeId = vi.fn();
    const setRightSidebarVisible = vi.fn();

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
      setRightSidebarVisible,
      setConfiguringEdgeId,
      isAutofocusEnabled: true,
    });

    const { result } = renderHook(() => useCanvasHandlers());

    const mockEvent = {} as any;
    act(() => {
      result.current.onEdgeClick(mockEvent, edge);
    });

    expect(setRightSidebarVisible).toHaveBeenCalledWith(true);
    expect(setConfiguringEdgeId).toHaveBeenCalledWith('e1');
    expect(mockFitBounds).toHaveBeenCalledWith(
      { x: 0, y: 0, width: 400, height: 350 },
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
