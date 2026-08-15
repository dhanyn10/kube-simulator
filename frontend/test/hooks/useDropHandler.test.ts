import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDropHandler } from '@/hooks/useDropHandler';
import { useFlowStore } from '@/store';
import { Node } from '@xyflow/react';

describe('useDropHandler', () => {
  const mockScreenToFlowPosition = vi.fn((_pos) => _pos);

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      addNode: vi.fn(),
      setHoveredDeploymentId: vi.fn(),
      draggingSidebarItem: null
    });
  });

  it('onDragOver handles dragging sidebar item', () => {
    const setHoveredDeploymentId = vi.fn();
    useFlowStore.setState({
      draggingSidebarItem: 'Pod' as any,
      setHoveredDeploymentId,
      nodes: [
        { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, width: 100, height: 100, data: {} } as any
      ]
    });

    const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

    const mockEvent = {
      preventDefault: vi.fn(),
      clientX: 50,
      clientY: 50,
      dataTransfer: { dropEffect: '' }
    } as any;

    result.current.onDragOver(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.dataTransfer.dropEffect).toBe('move');
    expect(setHoveredDeploymentId).toHaveBeenCalledWith('d1');

    const updatedNodes = useFlowStore.getState().nodes;
    expect(updatedNodes[0].data.isHovered).toBe(true);
  });

  it('returns early on drop if dataTransfer has no type', () => {
    const addNodeMock = vi.fn();
    useFlowStore.setState({ addNode: addNodeMock });

    const screenToFlow = vi.fn(() => ({ x: 100, y: 100 }));
    const { result } = renderHook(() => useDropHandler(screenToFlow));

    const event = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: () => '' },
      clientX: 100,
      clientY: 100,
    } as any;

    act(() => {
      result.current.onDrop(event);
    });

    expect(addNodeMock).not.toHaveBeenCalled();
  });

  it('onDrop adds node to canvas', () => {
    const addNode = vi.fn();
    useFlowStore.setState({ addNode });

    const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

    const mockEvent = {
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 100,
      dataTransfer: {
        getData: vi.fn().mockReturnValue('Pod')
      }
    } as any;

    result.current.onDrop(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(addNode).toHaveBeenCalled();
    const [type, _pos, parentId] = addNode.mock.calls[0];
    expect(type).toBe('Pod');
    expect(parentId).toBeUndefined();
  });

  it('onDrop adds node to container', () => {
    const addNode = vi.fn();
    useFlowStore.setState({
      addNode,
      nodes: [
        { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, width: 500, height: 500, data: {} } as any
      ]
    });

    const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

    const mockEvent = {
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 100,
      dataTransfer: {
        getData: vi.fn().mockReturnValue('Deployment')
      }
    } as any;

    result.current.onDrop(mockEvent);

    expect(addNode).toHaveBeenCalledWith('Deployment', expect.any(Object), 'ns1');
  });

  it('handles dropping a Service into a Namespace with parentId', () => {
    const nsParent: Node = {
      id: 'ns-p',
      type: 'Namespace',
      position: { x: 50, y: 50 },
      width: 500,
      height: 500,
      data: {},
    };
    const nsChild: Node = {
      id: 'ns-c',
      type: 'Namespace',
      parentId: 'ns-p',
      position: { x: 50, y: 50 },
      width: 400,
      height: 400,
      data: {},
    };

    useFlowStore.setState({ nodes: [nsParent, nsChild] });

    const addNodeMock = vi.fn();
    useFlowStore.setState({ addNode: addNodeMock });

    const screenToFlow = vi.fn(() => ({ x: 150, y: 150 }));
    const { result } = renderHook(() => useDropHandler(screenToFlow));

    const event = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: () => 'Service' },
      clientX: 150,
      clientY: 150,
    } as any;

    act(() => {
      result.current.onDrop(event);
    });

    expect(addNodeMock).toHaveBeenCalledWith('Service', expect.any(Object), 'ns-c');
  });

  it('getTargetContainer finds smallest container', () => {
    const addNode = vi.fn();
    useFlowStore.setState({
      addNode,
      nodes: [
        { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, width: 1000, height: 1000, data: {} } as any,
        { id: 'd1', type: 'Deployment', position: { x: 100, y: 100 }, width: 200, height: 200, data: {} } as any
      ]
    });

    const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

    const mockEvent = {
      preventDefault: vi.fn(),
      clientX: 150,
      clientY: 150,
      dataTransfer: {
        getData: vi.fn().mockReturnValue('Pod')
      }
    } as any;

    result.current.onDrop(mockEvent);

    expect(addNode).toHaveBeenCalledWith('Pod', expect.any(Object), 'd1');
  });
});
