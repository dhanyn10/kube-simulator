import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAttachedResourceSettings } from '../../../src/activity/config/useAttachedResourceSettings';
import { useFlowStore } from '../../../src/store';

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
});
