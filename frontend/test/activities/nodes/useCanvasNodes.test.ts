import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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
    useFlowStore.setState({ activeIdentity: 'system:admin' });
    rerender();

    const secNodeAdmin = result.current.find((n) => n.id === 'sec-1');
    expect(secNodeAdmin?.draggable).toBe(true);
  });
});
