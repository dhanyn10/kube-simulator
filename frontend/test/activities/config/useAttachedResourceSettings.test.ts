import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAttachedResourceSettings } from '@/activities/config/useAttachedResourceSettings';
import { useFlowStore } from '@/store';

describe('useAttachedResourceSettings', () => {
  it('manages attached items state, edit, add, save, and delete actions for non-configMap resources', () => {
    useFlowStore.setState({
      colorMode: 'dark',
      updateNodeData: (id, updates) => {
        const storeNodes = useFlowStore.getState().nodes;
        useFlowStore.setState({
          nodes: storeNodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...updates } } : n)),
        });
      },
      nodes: [
        {
          id: 'node-1',
          data: {
            label: 'Test Node',
            secrets: [{ id: 'sec-1', name: 'my-secret' }],
          },
        },
      ],
    });

    const data = useFlowStore.getState().nodes[0].data;

    const { result } = renderHook(() =>
      useAttachedResourceSettings(data, 'node-1', 'secrets', 'Secret')
    );

    expect(result.current.colorMode).toBe('dark');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.targetNodeLabel).toBe('Test Node');

    act(() => {
      result.current.handleOpenEdit({ id: 'sec-1', name: 'my-secret' });
    });
    expect(result.current.editingItem).toEqual({ id: 'sec-1', name: 'my-secret' });
    expect(result.current.isEditModalOpen).toBe(true);

    act(() => {
      result.current.handleAddNew();
    });
    expect(result.current.editingItem).toBeNull();
    expect(result.current.isEditModalOpen).toBe(true);

    // 1. Add new item (existingIndex < 0)
    act(() => {
      result.current.handleSaveItem({ id: 'sec-2', name: 'new-secret' });
    });
    expect(result.current.isEditModalOpen).toBe(false);

    // 2. Update existing item (existingIndex >= 0)
    act(() => {
      result.current.handleSaveItem({ id: 'sec-1', name: 'updated-secret' });
    });
    expect(result.current.isEditModalOpen).toBe(false);

    act(() => {
      result.current.handleDeleteItem('sec-1', 'my-secret');
    });
  });

  it('saves attached ConfigMap when resourceName includes this node', () => {
    useFlowStore.setState({
      colorMode: 'light',
      updateNodeData: (id, updates) => {
        const storeNodes = useFlowStore.getState().nodes;
        useFlowStore.setState({
          nodes: storeNodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...updates } } : n)),
        });
      },
      addLog: () => {},
      nodes: [
        {
          id: 'node-cm',
          data: {
            label: 'CM Node',
            configMaps: [{ id: 'cm-1', name: 'my-cm', resourceName: 'CM Node' }],
          },
        },
      ],
    });

    const data = useFlowStore.getState().nodes[0].data;
    const { result } = renderHook(() =>
      useAttachedResourceSettings(data, 'node-cm', 'configMaps', 'ConfigMap')
    );

    act(() => {
      result.current.handleSaveItem({
        id: 'cm-1',
        name: 'my-cm-updated',
        resourceName: 'CM Node',
      } as any);
    });

    expect(result.current.isEditModalOpen).toBe(false);
    const updatedNode = useFlowStore.getState().nodes.find((n) => n.id === 'node-cm');
    expect(updatedNode?.data.configMaps?.[0].name).toBe('my-cm-updated');
  });

  it('removes ConfigMap from node when resourceName does not include this node', () => {
    const updateNodeDataMock = (id: string, updates: any) => {
      const storeNodes = useFlowStore.getState().nodes;
      useFlowStore.setState({
        nodes: storeNodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...updates } } : n)),
      });
    };

    useFlowStore.setState({
      colorMode: 'light',
      updateNodeData: updateNodeDataMock,
      addLog: () => {},
      nodes: [
        {
          id: 'node-2',
          data: {
            label: 'Node Two',
            configMaps: [{ id: 'cm-target', name: 'target-cm', resourceName: 'Node Two' }],
          },
        },
      ],
    });

    const data = useFlowStore.getState().nodes[0].data;
    const { result } = renderHook(() =>
      useAttachedResourceSettings(data, 'node-2', 'configMaps', 'ConfigMap')
    );

    act(() => {
      result.current.handleSaveItem({
        id: 'cm-target',
        name: 'target-cm',
        resourceName: 'Other Node',
      } as any);
    });

    expect(result.current.isEditModalOpen).toBe(false);
    const updatedNode = useFlowStore.getState().nodes.find((n) => n.id === 'node-2');
    expect(updatedNode?.data.configMaps).toHaveLength(0);
  });
});
