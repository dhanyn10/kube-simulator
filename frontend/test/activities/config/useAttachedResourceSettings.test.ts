import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAttachedResourceSettings } from '@/activities/config/useAttachedResourceSettings';
import { useFlowStore } from '@/store';

describe('useAttachedResourceSettings', () => {
  it('manages attached items state, edit, add, save, and delete actions', () => {
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
            configMaps: [{ id: 'cm-1', name: 'my-config' }],
          },
        },
      ],
    });

    const data = useFlowStore.getState().nodes[0].data;

    const { result } = renderHook(() =>
      useAttachedResourceSettings(data, 'node-1', 'configMaps', 'ConfigMap')
    );

    expect(result.current.colorMode).toBe('dark');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.targetNodeLabel).toBe('Test Node');

    act(() => {
      result.current.handleOpenEdit({ id: 'cm-1', name: 'my-config' });
    });
    expect(result.current.editingItem).toEqual({ id: 'cm-1', name: 'my-config' });
    expect(result.current.isEditModalOpen).toBe(true);

    act(() => {
      result.current.handleAddNew();
    });
    expect(result.current.editingItem).toBeNull();
    expect(result.current.isEditModalOpen).toBe(true);

    act(() => {
      result.current.handleSaveItem({ id: 'cm-2', name: 'new-config' });
    });
    expect(result.current.isEditModalOpen).toBe(false);

    act(() => {
      result.current.handleDeleteItem('cm-1', 'my-config');
    });
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
