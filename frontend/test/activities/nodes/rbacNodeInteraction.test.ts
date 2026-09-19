import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFlowStore } from '@/store';
import { KubeIAMUser } from '@/types';
import { Node } from '@xyflow/react';

describe('RBAC Node Interaction Barriers', () => {
  const devUser: KubeIAMUser = {
    id: 'dev1',
    username: 'dev-user',
    policies: [{ name: 'ContainerDeveloperPolicy', description: 'Dev' }],
    roles: [],
  };

  const podNode: Node = {
    id: 'pod-1',
    type: 'Pod',
    position: { x: 100, y: 100 },
    data: { label: 'My Pod' },
  };

  const svcNode: Node = {
    id: 'svc-1',
    type: 'Service',
    position: { x: 300, y: 100 },
    data: { label: 'My Service' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [podNode, svcNode],
      edges: [],
      iamUsers: [devUser],
      activeIdentity: 'dev-user',
      configuringNodeId: null,
      activeDeploymentId: null,
    });
  });

  it('allows clicking allowed node (Pod) but rejects clicking forbidden node (Service)', () => {
    const { onNodeClick } = useFlowStore.getState();

    // Click allowed Pod node
    onNodeClick({} as any, podNode);
    expect(useFlowStore.getState().configuringNodeId).toBe('pod-1');

    // Reset configuringNodeId
    useFlowStore.setState({ configuringNodeId: null });

    // Click forbidden Service node
    onNodeClick({} as any, svcNode);
    expect(useFlowStore.getState().configuringNodeId).toBeNull();
  });

  it('rejects connection if source or target node is forbidden', () => {
    const { onConnect } = useFlowStore.getState();

    // Attempt connecting allowed Pod to forbidden Service
    onConnect({ source: 'pod-1', target: 'svc-1' });

    expect(useFlowStore.getState().edges).toHaveLength(0);
  });

  it('rejects dragging / position changes for forbidden nodes in onNodesChange', () => {
    const { onNodesChange } = useFlowStore.getState();

    // Attempt moving forbidden Service node
    onNodesChange([{ id: 'svc-1', type: 'position', position: { x: 500, y: 500 } }]);

    const currentSvc = useFlowStore.getState().nodes.find((n) => n.id === 'svc-1');
    expect(currentSvc?.position).toEqual({ x: 300, y: 100 });
  });

  it('aborts drag handlers (onNodeDragStart, onNodeDrag, onNodeDragStop) for forbidden nodes', () => {
    const { onNodeDragStart, onNodeDrag, onNodeDragStop } = useFlowStore.getState();

    onNodeDragStart({} as any, svcNode);
    expect(useFlowStore.getState().draggedNodeId).toBeNull();

    onNodeDrag({} as any, svcNode);
    expect(useFlowStore.getState().draggedNodeId).toBeNull();

    onNodeDragStop({} as any, svcNode);
    expect(useFlowStore.getState().draggedNodeId).toBeNull();
  });

  it('allows connecting nodes when user context is system:admin', () => {
    useFlowStore.setState({ activeIdentity: 'system:admin' });
    const { onConnect } = useFlowStore.getState();

    onConnect({ source: 'pod-1', target: 'svc-1' });
    expect(useFlowStore.getState().edges).toHaveLength(1);
  });
});
