import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfigMapModal } from '@/activities/modals/useConfigMapModal';
import { useAutocompletePortal } from '@/activities/modals/useAutocompletePortal';
import { useFlowStore } from '@/store';

describe('useAutocompletePortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles input focus and position calculation', () => {
    const { result } = renderHook(() => useAutocompletePortal('test-portal'));

    const mockInput = document.createElement('input');
    vi.spyOn(mockInput, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 120,
      left: 50,
      right: 150,
      width: 100,
      height: 20,
      x: 50,
      y: 100,
      toJSON: () => {},
    });

    const onValueChange = vi.fn();

    act(() => {
      result.current.handleInputFocusOrChange(mockInput, 'row-1', 'key', onValueChange, 'PORT');
    });

    expect(onValueChange).toHaveBeenCalledWith('row-1', 'key', 'PORT');
    expect(result.current.activeDropdown).toEqual({ rowId: 'row-1', field: 'key' });
    expect(result.current.dropdownPos).toEqual({
      top: 124,
      left: 50,
      width: 100,
    });
  });
});

describe('useConfigMapModal hook', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    targetNodeId: 'node-1',
    initialConfigMap: null,
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('initializes with default generated name when initialConfigMap is null', () => {
    const { result } = renderHook(() => useConfigMapModal(defaultProps));

    expect(result.current.isDark).toBe(true);
    expect(result.current.cmName).toMatch(/^cm-/);
    expect(result.current.rows).toEqual([]);
  });

  it('loads initialConfigMap rows when provided', () => {
    const { result } = renderHook(() =>
      useConfigMapModal({
        ...defaultProps,
        initialConfigMap: {
          id: 'cm-1',
          name: 'existing-cm',
          configData: [{ key: 'PORT', value: '8080' }],
        },
      })
    );

    expect(result.current.cmName).toBe('existing-cm');
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].key).toBe('PORT');
    expect(result.current.rows[0].value).toBe('8080');
  });

  it('handles row modifications and saving', () => {
    const { result } = renderHook(() => useConfigMapModal(defaultProps));

    act(() => {
      result.current.handleAddRow();
    });

    expect(result.current.rows).toHaveLength(1);

    const rowId = result.current.rows[0].id;

    act(() => {
      result.current.handleRowChange(rowId, 'key', 'MAX_CONNECTIONS');
      result.current.handleRowChange(rowId, 'value', '1000');
      result.current.setCmName('my-prod-config');
    });

    act(() => {
      result.current.handleSave();
    });

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      id: expect.any(String),
      name: 'my-prod-config',
      configData: [{ key: 'MAX_CONNECTIONS', value: '1000' }],
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('clears active dropdown when removing active row', () => {
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

    expect(result.current.activeDropdown).toBeNull();
    expect(result.current.rows).toHaveLength(0);
  });
});
