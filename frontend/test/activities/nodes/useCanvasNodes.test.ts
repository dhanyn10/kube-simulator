import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasNodes } from '@/activities/nodes/useCanvasNodes';
import { useFlowStore } from '@/store';
import { Node } from '@xyflow/react';

describe('useCanvasNodes hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      activeIdentity: 'dev-user',
      iamUsers: [
        {
          id: 'u1',
          name: 'dev-user',
          iamPolicy: 'ContainerDeveloperPolicy',
          createdAt: '2025-01-01',
        },
      ],
      nodes: [
        { id: 'pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod-1' } },
        { id: 'sec-1', type: 'Secret', position: { x: 0, y: 0 }, data: { label: 'sec-1' } },
      ] as Node[],
    });
  });

  it('sets draggable flag according to RBAC node access rules for system:admin vs dev-user', () => {
    // Non-admin user: Secret is forbidden
    const { result, rerender } = renderHook(() => useCanvasNodes());
    const secNodeForbidden = result.current.find((n) => n.id === 'sec-1');
    expect(secNodeForbidden?.draggable).toBe(false);

    // Switch to system:admin: all nodes allowed
    act(() => {
      useFlowStore.setState({ activeIdentity: 'system:admin' });
    });
    rerender();

    const secNodeAdmin = result.current.find((n) => n.id === 'sec-1');
    expect(secNodeAdmin?.draggable).toBe(true);
  });

  it('handles undefined iamUsers gracefully with fallback to empty array', () => {
    act(() => {
      useFlowStore.setState({
        activeIdentity: 'dev-user',
        iamUsers: undefined as any,
      });
    });

    const { result } = renderHook(() => useCanvasNodes());
    const podNode = result.current.find((n) => n.id === 'pod-1');
    expect(podNode).toBeDefined();
  });

  it('propagates parent zIndex to child nodes and handles missing parent gracefully', () => {
    act(() => {
      useFlowStore.setState({
        activeIdentity: 'system:admin',
        nodes: [
          { id: 'ns-1', type: 'Namespace', position: { x: 0, y: 0 }, zIndex: 10, data: { label: 'ns-1' } },
          { id: 'dep-1', type: 'Deployment', parentId: 'ns-1', position: { x: 10, y: 10 }, zIndex: 5, data: { label: 'dep-1' } },
          { id: 'pod-child', type: 'Pod', parentId: 'dep-1', position: { x: 20, y: 20 }, data: { label: 'pod-child' } },
          { id: 'pod-orphan', type: 'Pod', parentId: 'missing-parent', position: { x: 0, y: 0 }, data: { label: 'pod-orphan' } },
        ] as Node[],
      });
    });

    const { result } = renderHook(() => useCanvasNodes());
    const depNode = result.current.find((n) => n.id === 'dep-1');
    const childPod = result.current.find((n) => n.id === 'pod-child');
    const orphanPod = result.current.find((n) => n.id === 'pod-orphan');

    expect(depNode?.zIndex).toBe(10);
    expect(childPod?.zIndex).toBe(10);
    expect(orphanPod?.zIndex).toBeUndefined();
  });
});
