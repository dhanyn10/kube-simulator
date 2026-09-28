import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfigMapModal } from '@/activities/modals/useConfigMapModal';
import { useFlowStore } from '@/store';

describe('useConfigMapModal extra uncovered conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'light' });
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    targetNodeId: 'node-1',
    onSave: vi.fn(),
  };

  it('skips initialization effect when isOpen is false', () => {
    const { result } = renderHook(() =>
      useConfigMapModal({
        ...defaultProps,
        isOpen: false,
        initialConfigMap: { id: 'cm-1', name: 'my-cm', configData: [{ key: 'k1', value: 'v1' }] },
      })
    );

    expect(result.current.isDark).toBe(false);
    expect(result.current.rows).toEqual([]);
  });

  it('initializes name without configData when initialConfigMap has name only', () => {
    const { result } = renderHook(() =>
      useConfigMapModal({
        ...defaultProps,
        isOpen: true,
        initialConfigMap: { id: 'cm-2', name: 'name-only-cm' },
      })
    );

    expect(result.current.cmName).toBe('name-only-cm');
    expect(result.current.rows).toEqual([]);
  });

  it('handleRemoveRow closes active dropdown when removed row matches activeDropdown.rowId', () => {
    const { result } = renderHook(() => useConfigMapModal(defaultProps));

    act(() => {
      result.current.handleAddRow();
    });
    const rowId = result.current.rows[0].id;

    act(() => {
      result.current.setActiveDropdown({ rowId, field: 'key' });
    });
    expect(result.current.activeDropdown).toEqual({ rowId, field: 'key' });

    act(() => {
      result.current.handleRemoveRow(rowId);
    });
    expect(result.current.rows).toEqual([]);
    expect(result.current.activeDropdown).toBeNull();
  });

  it('handleSave builds ConfigMap item and calls onSave and onClose', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    const { result } = renderHook(() =>
      useConfigMapModal({
        ...defaultProps,
        onClose,
        onSave,
        initialConfigMap: { id: 'cm-10', name: 'custom-cm-name' },
      })
    );

    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith({
      id: 'cm-10',
      name: 'custom-cm-name',
      configData: [],
    });
    expect(onClose).toHaveBeenCalled();
  });
});
