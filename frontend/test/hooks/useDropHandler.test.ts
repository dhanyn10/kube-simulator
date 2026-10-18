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

  it('onDragOver returns early when draggingSidebarItem is null', () => {
    const setHoveredDeploymentId = vi.fn();
    useFlowStore.setState({ draggingSidebarItem: null, setHoveredDeploymentId });

    const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

    const mockEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: '' },
      clientX: 50,
      clientY: 50
    } as any;

    act(() => {
      result.current.onDragOver(mockEvent);
    });

    expect(setHoveredDeploymentId).not.toHaveBeenCalled();
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

    act(() => {
      result.current.onDragOver(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.dataTransfer.dropEffect).toBe('move');
    expect(setHoveredDeploymentId).toHaveBeenCalledWith('d1');

    const updatedNodes = useFlowStore.getState().nodes;
    expect(updatedNodes[0].data.isHovered).toBe(true);
  });

  it('onDragOver handles dragging non-attachment item over empty area (no container target)', () => {
    const setHoveredDeploymentId = vi.fn();
    useFlowStore.setState({
      draggingSidebarItem: 'Pod' as any,
      setHoveredDeploymentId,
      nodes: []
    });

    const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

    const mockEvent = {
      preventDefault: vi.fn(),
      clientX: 500,
      clientY: 500,
      dataTransfer: { dropEffect: '' }
    } as any;

    act(() => {
      result.current.onDragOver(mockEvent);
    });

    expect(setHoveredDeploymentId).toHaveBeenCalledWith(null);
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

    act(() => {
      result.current.onDrop(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(addNode).toHaveBeenCalled();
    const [type, _pos, parentId] = addNode.mock.calls[0];
    expect(type).toBe('Pod');
    expect(parentId).toBeUndefined();
  });

  it('onDrop adds node to container and handles disallowed container types like PVC in Namespace', () => {
    const addNode = vi.fn();
    useFlowStore.setState({
      addNode,
      nodes: [
        { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, width: 500, height: 500, data: {} } as any
      ]
    });

    const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

    // PVC is not allowed inside a Namespace container
    const mockPvcEvent = {
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 100,
      dataTransfer: {
        getData: vi.fn().mockReturnValue('PVC')
      }
    } as any;

    act(() => {
      result.current.onDrop(mockPvcEvent);
    });

    expect(addNode).toHaveBeenCalledWith('PVC', expect.any(Object), undefined);

    // Deployment is allowed inside a Namespace container
    const mockDepEvent = {
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 100,
      dataTransfer: {
        getData: vi.fn().mockReturnValue('Deployment')
      }
    } as any;

    act(() => {
      result.current.onDrop(mockDepEvent);
    });

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

  it('handles computeFinalDropPosition when targetContainer has parentId present in nodes', () => {
    const parentContainer: Node = {
      id: 'p1',
      type: 'Namespace',
      position: { x: 100, y: 100 },
      width: 600,
      height: 400,
      data: {},
    };
    const childContainer: Node = {
      id: 'c1',
      type: 'Deployment',
      parentId: 'p1',
      position: { x: 20, y: 20 },
      width: 300,
      height: 200,
      data: {},
    };

    useFlowStore.setState({ nodes: [parentContainer, childContainer] });

    const addNodeMock = vi.fn();
    useFlowStore.setState({ addNode: addNodeMock });

    const screenToFlow = vi.fn(() => ({ x: 150, y: 150 }));
    const { result } = renderHook(() => useDropHandler(screenToFlow));

    const event = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: () => 'Pod' },
      clientX: 150,
      clientY: 150,
    } as any;

    act(() => {
      result.current.onDrop(event);
    });

    expect(addNodeMock).toHaveBeenCalled();
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

    act(() => {
      result.current.onDrop(mockEvent);
    });

    expect(addNode).toHaveBeenCalledWith('Pod', expect.any(Object), 'd1');
  });

  describe('Role & ConfigMap drag and drop handlers', () => {
    it('onDragOver handles dragging Role, ConfigMap, and Secret items over cards', () => {
      const setHoveredDeploymentId = vi.fn();
      const depNode = {
        id: 'dep1',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        width: 320,
        height: 160,
        data: {}
      };

      for (const itemType of ['Role', 'ConfigMap', 'Secret', 'HPA'] as const) {
        useFlowStore.setState({
          draggingSidebarItem: itemType as any,
          setHoveredDeploymentId,
          nodes: [depNode] as any
        });

        const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

        const mockEvent = {
          preventDefault: vi.fn(),
          clientX: 20,
          clientY: 20,
          dataTransfer: { dropEffect: '' }
        } as any;

        act(() => {
          result.current.onDragOver(mockEvent);
        });

        expect(setHoveredDeploymentId).toHaveBeenCalledWith('dep1');
      }
    });

    it('onDrop handles dropping a Role onto a target workload and onto empty canvas', () => {
      const depNode = {
        id: 'dep1',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        width: 320,
        height: 160,
        data: { label: 'My Deployment' }
      };

      useFlowStore.setState({
        nodes: [depNode] as any
      });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 50,
        clientY: 50,
        dataTransfer: {
          getData: vi.fn().mockReturnValue('Role')
        }
      } as any;

      act(() => {
        result.current.onDrop(mockEvent);
      });

      expect(useFlowStore.getState().roleModalTargetNode).toEqual({
        id: 'dep1',
        label: 'My Deployment'
      });

      // Role dropped on empty canvas
      const addLogSpy = vi.fn();
      useFlowStore.setState({
        nodes: [],
        addLog: addLogSpy
      });

      const emptyEvent = {
        preventDefault: vi.fn(),
        clientX: 500,
        clientY: 500,
        dataTransfer: {
          getData: vi.fn().mockReturnValue('Role')
        }
      } as any;

      act(() => {
        result.current.onDrop(emptyEvent);
      });

      expect(addLogSpy).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('Role must be dropped onto an existing card'),
        'UI'
      );
    });

    it('onDrop handles dropping a ConfigMap onto a target workload', () => {
      const depNode = {
        id: 'dep1',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        width: 320,
        height: 160,
        data: { label: 'My Deployment' }
      };

      useFlowStore.setState({
        nodes: [depNode] as any
      });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 50,
        clientY: 50,
        dataTransfer: {
          getData: vi.fn().mockReturnValue('ConfigMap')
        }
      } as any;

      act(() => {
        result.current.onDrop(mockEvent);
      });

      expect(useFlowStore.getState().configMapModalTargetNode).toEqual({
        id: 'dep1',
        label: 'My Deployment'
      });
    });

    it('onDrop handles dropping a Secret onto a target workload and onto empty canvas', () => {
      const depNode = {
        id: 'dep1',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        width: 320,
        height: 160,
        data: { label: 'My Deployment' }
      };

      useFlowStore.setState({
        nodes: [depNode] as any
      });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 50,
        clientY: 50,
        dataTransfer: {
          getData: vi.fn().mockReturnValue('Secret')
        }
      } as any;

      act(() => {
        result.current.onDrop(mockEvent);
      });

      expect(useFlowStore.getState().secretModalTargetNode).toEqual({
        id: 'dep1',
        label: 'My Deployment'
      });

      // Drop on empty canvas space
      const addLogSpy = vi.fn();
      useFlowStore.setState({
        nodes: [],
        addLog: addLogSpy
      });

      const emptyEvent = {
        preventDefault: vi.fn(),
        clientX: 500,
        clientY: 500,
        dataTransfer: {
          getData: vi.fn().mockReturnValue('Secret')
        }
      } as any;

      act(() => {
        result.current.onDrop(emptyEvent);
      });

      expect(addLogSpy).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('Secret must be dropped onto an existing card'),
        'UI'
      );
    });

    it('onDrop handles dropping a ResourceLimit onto a target workload card', () => {
      const depNode = {
        id: 'dep1',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        width: 320,
        height: 160,
        data: { label: 'My Deployment' }
      };

      useFlowStore.setState({
        nodes: [depNode] as any
      });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 50,
        clientY: 50,
        dataTransfer: {
          getData: vi.fn().mockReturnValue('ResourceLimit')
        }
      } as any;

      act(() => {
        result.current.onDrop(mockEvent);
      });

      expect(useFlowStore.getState().resourceLimitModalTargetNode).toEqual({
        id: 'dep1',
        label: 'My Deployment'
      });
    });

    it('onDrop checks HPA prerequisite and blocks attach when Resource Limit is missing vs allows when attached', () => {
      const depNodeNoLimit = {
        id: 'dep1',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        width: 320,
        height: 160,
        data: { label: 'Dep Without Limit' }
      };
      const addLogSpy = vi.fn();

      useFlowStore.setState({
        nodes: [depNodeNoLimit] as any,
        edges: [],
        addLog: addLogSpy
      });

      const { result: resultNoLimit } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 50,
        clientY: 50,
        dataTransfer: {
          getData: vi.fn().mockReturnValue('HPA')
        }
      } as any;

      act(() => {
        resultNoLimit.current.onDrop(mockEvent);
      });

      expect(addLogSpy).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Resource Limit is required on target workload before attaching HPA.'),
        'UI'
      );

      // Now with attached Resource Limit
      const depNodeWithLimit = {
        ...depNodeNoLimit,
        data: { label: 'Dep With Limit', resourceLimits: ['rl1'] }
      };

      useFlowStore.setState({
        nodes: [depNodeWithLimit] as any,
        edges: []
      });

      const { result: resultWithLimit } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      act(() => {
        resultWithLimit.current.onDrop(mockEvent);
      });

      expect(useFlowStore.getState().hpaModalTargetNode).toEqual({
        id: 'dep1',
        label: 'Dep With Limit'
      });
    });

    it('onDrop handles dropping an HPA onto empty canvas and logs HPA-specific warning', () => {
      const addLogSpy = vi.fn();
      useFlowStore.setState({
        nodes: [],
        addLog: addLogSpy
      });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const emptyEvent = {
        preventDefault: vi.fn(),
        clientX: 500,
        clientY: 500,
        dataTransfer: {
          getData: vi.fn().mockReturnValue('HPA')
        }
      } as any;

      act(() => {
        result.current.onDrop(emptyEvent);
      });

      expect(addLogSpy).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('HPA must be dropped onto an existing card (e.g. Deployment or ReplicaSet)'),
        'UI'
      );
    });

    it('handles target node label fallback to node id when label is missing for Pods', () => {
      const rsParent = {
        id: 'rs1',
        type: 'ReplicaSet',
        position: { x: 0, y: 0 },
        width: 300,
        height: 200,
        data: { resourceLimits: ['rl1'] }
      };
      const podChild = {
        id: 'pod1',
        type: 'Pod',
        parentId: 'rs1',
        position: { x: 10, y: 10 },
        width: 100,
        height: 50,
        data: { resourceLimits: ['rl1'] }
      };

      useFlowStore.setState({
        nodes: [rsParent, podChild] as any
      });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 20,
        clientY: 20,
        dataTransfer: {
          getData: vi.fn().mockReturnValue('HPA')
        }
      } as any;

      act(() => {
        result.current.onDrop(mockEvent);
      });

      expect(useFlowStore.getState().hpaModalTargetNode).toEqual({
        id: 'pod1',
        label: 'pod1'
      });
    });

    it('handles pod with non-Deployment/non-ReplicaSet parent in findRoleTargetNode', () => {
      const svcParent = {
        id: 'svc1',
        type: 'Service',
        position: { x: 0, y: 0 },
        width: 300,
        height: 200,
        data: { label: 'My Service' }
      };
      const podChild = {
        id: 'pod1',
        type: 'Pod',
        parentId: 'svc1',
        position: { x: 10, y: 10 },
        width: 100,
        height: 50,
        data: { label: 'Child Pod' }
      };

      useFlowStore.setState({
        nodes: [svcParent, podChild] as any
      });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 20,
        clientY: 20,
        dataTransfer: {
          getData: vi.fn().mockReturnValue('Role')
        }
      } as any;

      act(() => {
        result.current.onDrop(mockEvent);
      });

      expect(useFlowStore.getState().roleModalTargetNode).toEqual({
        id: 'pod1',
        label: 'Child Pod'
      });
    });

    it('isChildTypeAllowed covers all child and node container combinations', () => {
      const nsNode = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, width: 600, height: 400, data: {} } as any;
      const depNode = { id: 'd1', type: 'Deployment', position: { x: 10, y: 10 }, width: 320, height: 160, data: {} } as any;
      useFlowStore.setState({ nodes: [nsNode, depNode] });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      // Pod allowed in Deployment or Namespace
      const dropPod = { preventDefault: vi.fn(), clientX: 20, clientY: 20, dataTransfer: { getData: () => 'Pod' } } as any;
      act(() => { result.current.onDrop(dropPod); });
      expect(useFlowStore.getState().addNode).toHaveBeenCalledWith('Pod', expect.any(Object), 'd1');

      // Allowed child types in Namespace: 'Deployment', 'Service', 'Internet', 'Ingress', 'HPA', 'Role', 'ConfigMap', 'Secret'
      const dropSvc = { preventDefault: vi.fn(), clientX: 200, clientY: 200, dataTransfer: { getData: () => 'Service' } } as any;
      act(() => { result.current.onDrop(dropSvc); });
      expect(useFlowStore.getState().addNode).toHaveBeenCalledWith('Service', expect.any(Object), 'ns1');

      // Unallowed child types return false in isChildTypeAllowed
      const dropUnallowed = { preventDefault: vi.fn(), clientX: 200, clientY: 200, dataTransfer: { getData: () => 'PVC' } } as any;
      act(() => { result.current.onDrop(dropUnallowed); });
      expect(useFlowStore.getState().addNode).toHaveBeenCalledWith('PVC', expect.any(Object), undefined);
    });

    it('isPositionInsideNode calculates absolute positions for nested parent containers', () => {
      const parentNs = { id: 'ns1', type: 'Namespace', position: { x: 100, y: 100 }, width: 600, height: 400, data: {} } as any;
      const childDep = { id: 'd1', parentId: 'ns1', type: 'Deployment', position: { x: 50, y: 50 }, width: 300, height: 200, data: {} } as any;
      useFlowStore.setState({ nodes: [parentNs, childDep] });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      // Dragging a Role onto childDep at absolute pos (100+50+10, 100+50+10) = (160, 160)
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 160,
        clientY: 160,
        dataTransfer: { getData: () => 'Role' }
      } as any;

      act(() => { result.current.onDrop(mockEvent); });
      expect(useFlowStore.getState().roleModalTargetNode?.id).toBe('d1');
    });

    it('isPositionInsideNode falls back to default 320x160 for Deployment and 600x400 for non-Deployment when dimensions are missing', () => {
      const depWithoutDim = {
        id: 'dep-nodim',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: {}
      };
      const svcWithoutDim = {
        id: 'svc-nodim',
        type: 'Service',
        position: { x: 500, y: 0 },
        data: {}
      };

      useFlowStore.setState({
        nodes: [depWithoutDim, svcWithoutDim] as any
      });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      // Point (300, 100) is inside depWithoutDim (default 320x160)
      const depDropEvent = {
        preventDefault: vi.fn(),
        clientX: 300,
        clientY: 100,
        dataTransfer: { getData: () => 'Role' }
      } as any;

      act(() => {
        result.current.onDrop(depDropEvent);
      });

      expect(useFlowStore.getState().roleModalTargetNode?.id).toBe('dep-nodim');

      // Point (800, 300) is inside svcWithoutDim (default 600x400 starting at x=500 -> 500 to 1100)
      const svcDropEvent = {
        preventDefault: vi.fn(),
        clientX: 800,
        clientY: 300,
        dataTransfer: { getData: () => 'Role' }
      } as any;

      act(() => {
        result.current.onDrop(svcDropEvent);
      });

      expect(useFlowStore.getState().roleModalTargetNode?.id).toBe('svc-nodim');
    });

    it('onDrop handles unknown type using default CENTER_OFFSETS fallback', () => {
      const addNode = vi.fn();
      useFlowStore.setState({ addNode, nodes: [] });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        dataTransfer: {
          getData: vi.fn().mockReturnValue('CustomUnknownType' as any)
        }
      } as any;

      act(() => {
        result.current.onDrop(mockEvent);
      });

      expect(addNode).toHaveBeenCalledWith('CustomUnknownType', { x: 100, y: 100 }, undefined);
    });

    it('onDragLeave does not clear hover state if relatedTarget is inside currentTarget', () => {
      const setHoveredDeploymentId = vi.fn();
      useFlowStore.setState({
        setHoveredDeploymentId,
        nodes: [
          { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { isHovered: true } } as any
        ]
      });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const mockContainer = { contains: vi.fn().mockReturnValue(true) };
      const mockEvent = {
        currentTarget: mockContainer,
        relatedTarget: {}
      } as any;

      act(() => {
        result.current.onDragLeave(mockEvent);
      });

      expect(setHoveredDeploymentId).not.toHaveBeenCalled();
    });

    it('onDragLeave clears hovered deployment and node hovered state when leaving target container', () => {
      const setHoveredDeploymentId = vi.fn();
      useFlowStore.setState({
        setHoveredDeploymentId,
        nodes: [
          { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { isHovered: true } } as any
        ]
      });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const mockContainer = { contains: vi.fn().mockReturnValue(false) };
      const mockEvent = {
        currentTarget: mockContainer,
        relatedTarget: {}
      } as any;

      act(() => {
        result.current.onDragLeave(mockEvent);
      });

      expect(setHoveredDeploymentId).toHaveBeenCalledWith(null);
      expect(useFlowStore.getState().nodes[0].data.isHovered).toBe(false);

      // Null currentTarget
      const nullTargetEvent = {
        currentTarget: null,
        relatedTarget: {}
      } as any;

      act(() => {
        result.current.onDragLeave(nullTargetEvent);
      });
    });

    it('covers all remaining uncovered branches in useDropHandler', () => {
      // 1. onDragLeave: node with isHovered: false covers line 221 : n branch
      const setHoveredDeploymentId = vi.fn();
      const unhoveredNode = { id: 'unhovered', type: 'Deployment', position: { x: 0, y: 0 }, data: { isHovered: false } } as any;
      const hoveredNode = { id: 'hovered', type: 'Deployment', position: { x: 0, y: 0 }, data: { isHovered: true } } as any;
      useFlowStore.setState({
        setHoveredDeploymentId,
        nodes: [unhoveredNode, hoveredNode]
      });

      const { result } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const mockLeaveEvent = {
        currentTarget: { contains: vi.fn().mockReturnValue(false) },
        relatedTarget: {}
      } as any;

      act(() => {
        result.current.onDragLeave(mockLeaveEvent);
      });
      expect(useFlowStore.getState().nodes[0].data.isHovered).toBe(false);

      // 2. onDragOver with draggingSidebarItem === 'Role' over empty canvas covers line 117 || null branch
      useFlowStore.setState({
        draggingSidebarItem: 'Role',
        nodes: []
      });
      const emptyOverEvent = {
        preventDefault: vi.fn(),
        clientX: 999,
        clientY: 999,
        dataTransfer: { dropEffect: '' }
      } as any;
      act(() => {
        result.current.onDragOver(emptyOverEvent);
      });
      expect(setHoveredDeploymentId).toHaveBeenCalledWith(null);

      // 3. onDrop for ConfigMap, Secret, ResourceLimit, and HPA on node without label (falls back to targetNode.id)
      const bareNode = {
        id: 'bare-target',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        width: 300,
        height: 150,
        data: {}
      } as any;

      useFlowStore.setState({
        nodes: [bareNode],
        edges: []
      });

      const { result: dropHook } = renderHook(() => useDropHandler(mockScreenToFlowPosition));

      const dropEvent = (type: string) => ({
        preventDefault: vi.fn(),
        clientX: 50,
        clientY: 50,
        dataTransfer: { getData: vi.fn().mockReturnValue(type) }
      } as any);

      // ConfigMap without label
      act(() => {
        dropHook.current.onDrop(dropEvent('ConfigMap'));
      });
      expect(useFlowStore.getState().configMapModalTargetNode).toEqual({ id: 'bare-target', label: 'bare-target' });

      // Secret without label
      act(() => {
        dropHook.current.onDrop(dropEvent('Secret'));
      });
      expect(useFlowStore.getState().secretModalTargetNode).toEqual({ id: 'bare-target', label: 'bare-target' });

      // ResourceLimit without label
      act(() => {
        dropHook.current.onDrop(dropEvent('ResourceLimit'));
      });
      expect(useFlowStore.getState().resourceLimitModalTargetNode).toEqual({ id: 'bare-target', label: 'bare-target' });

      // HPA without label and without limit (logs error with bare-target id)
      const addLogSpy = vi.fn();
      useFlowStore.setState({ addLog: addLogSpy });
      act(() => {
        dropHook.current.onDrop(dropEvent('HPA'));
      });
      expect(addLogSpy).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Cannot attach HPA to bare-target'),
        'UI'
      );

      // 4. onDragOver with draggingSidebarItem: 'Role' but targetNode is undefined (covers line 117 targetNode?.id || null)
      useFlowStore.setState({
        nodes: [],
        draggingSidebarItem: 'Role'
      });
      const { result: roleEmptyHook } = renderHook(() => useDropHandler(mockScreenToFlowPosition));
      act(() => {
        roleEmptyHook.current.onDragOver(dropEvent('Role'));
      });
      expect(useFlowStore.getState().hoveredDeploymentId).toBeNull();

      // 5. findRoleTargetNode with HPA and candidate without type (covers line 55 n.type || '')
      // and multiple candidates sorted by area with fallback dimensions (covers lines 61-62 areaB 200 / 100 fallback)
      const candNoType = {
        id: 'cand-no-type',
        type: undefined as any,
        position: { x: 0, y: 0 },
        width: 300,
        height: 200,
        data: {}
      } as any;
      const candDep1 = {
        id: 'cand-dep-1',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        width: undefined,
        height: undefined,
        measured: undefined,
        data: {}
      } as any;
      const candDep2 = {
        id: 'cand-dep-2',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        width: undefined,
        height: undefined,
        measured: undefined,
        data: {}
      } as any;
      useFlowStore.setState({
        nodes: [candNoType, candDep1, candDep2],
        draggingSidebarItem: 'HPA'
      });
      const { result: hpaHook } = renderHook(() => useDropHandler(mockScreenToFlowPosition));
      act(() => {
        hpaHook.current.onDragOver(dropEvent('HPA'));
      });

      // 6. getTargetContainer with candidates having undefined dimensions (covers line 98 (a.width || 0) * (a.height || 0))
      const nsA = {
        id: 'ns-a',
        type: 'Namespace',
        position: { x: 0, y: 0 },
        width: undefined,
        height: undefined,
        data: {}
      } as any;
      const nsB = {
        id: 'ns-b',
        type: 'Namespace',
        position: { x: 0, y: 0 },
        width: undefined,
        height: undefined,
        data: {}
      } as any;
      useFlowStore.setState({
        nodes: [nsA, nsB],
        draggingSidebarItem: 'Deployment'
      });
      const { result: depHook } = renderHook(() => useDropHandler(mockScreenToFlowPosition));
      act(() => {
        depHook.current.onDragOver(dropEvent('Deployment'));
      });
    });
  });
});
