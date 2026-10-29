import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfigMapModal } from '@/activities/modals/useConfigMapModal';
import { useFlowStore } from '@/store';
import {
  findActiveKeyInfo,
  filterKeysByQuery,
  filterValuesByQuery,
} from '@/activities/modals/configMapModalHelpers';

describe('configMapModalHelpers direct logic', () => {
  it('findActiveKeyInfo, filterKeysByQuery, filterValuesByQuery edge cases', () => {
    // 1. findActiveKeyInfo with leading/trailing spaces and lower case
    expect(findActiveKeyInfo('  port  ')?.key).toBe('PORT');

    // 2. filterKeysByQuery with empty string returns all predefined keys
    const allKeys = filterKeysByQuery('');
    expect(allKeys.length).toBeGreaterThan(0);

    // 3. filterValuesByQuery with undefined keyInfo returns []
    expect(filterValuesByQuery(undefined, 'anything')).toEqual([]);

    // 4. filterValuesByQuery matching description
    const portInfo = findActiveKeyInfo('PORT');
    const matchedDesc = filterValuesByQuery(portInfo, 'secure');
    expect(matchedDesc.some((opt) => opt.value === '8443')).toBe(true);

    // 5. filterValuesByQuery matching value
    const matchedVal = filterValuesByQuery(portInfo, '80');
    expect(matchedVal.some((opt) => opt.value === '8080')).toBe(true);

    // 6. filterValuesByQuery with unmatched search returns []
    const emptyMatches = filterValuesByQuery(portInfo, 'non-existent-search-term');
    expect(emptyMatches).toEqual([]);
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

  it('initializes with default generated id and empty name when initialConfigMap is null', () => {
    const { result } = renderHook(() => useConfigMapModal(defaultProps));

    expect(result.current.isDark).toBe(true);
    expect(result.current.cmId).toMatch(/^cm-/);
    expect(result.current.cmName).toBe('');
    expect(result.current.rows).toEqual([]);
  });

  it('loads initialConfigMap rows when provided and falls back to id when name is empty', () => {
    const { result, rerender } = renderHook((props) => useConfigMapModal(props), {
      initialProps: {
        ...defaultProps,
        initialConfigMap: {
          id: 'cm-1',
          name: 'existing-cm',
          configData: [{ key: 'PORT', value: '8080' }],
        },
      },
    });

    expect(result.current.cmName).toBe('existing-cm');
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].key).toBe('PORT');
    expect(result.current.rows[0].value).toBe('8080');

    // Test when initialConfigMap.name is empty string -> fallback to id
    rerender({
      ...defaultProps,
      initialConfigMap: {
        id: 'cm-empty-name',
        name: '',
        configData: [{ key: 'LOG_LEVEL', value: 'debug' }],
      },
    });

    expect(result.current.cmName).toBe('cm-empty-name');
  });

  it('skips initialization effect when isOpen is false', () => {
    useFlowStore.setState({ colorMode: 'light' });
    const { result } = renderHook(() =>
      useConfigMapModal({
        ...defaultProps,
        isOpen: false,
      })
    );

    expect(result.current.isDark).toBe(false);
  });

  it('loads initialConfigMap with name only and empty configData', () => {
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

  it('uses cmId when initialConfigMap is provided without name', () => {
    const { result } = renderHook(() =>
      useConfigMapModal({
        ...defaultProps,
        isOpen: true,
        initialConfigMap: { id: 'cm-no-name' } as any,
      })
    );

    expect(result.current.cmId).toBe('cm-no-name');
    expect(result.current.cmName).toBe('cm-no-name');
  });

  it('handles handleInputFocusOrChange callback', () => {
    const { result } = renderHook(() => useConfigMapModal(defaultProps));

    act(() => {
      result.current.handleAddRow();
    });

    const rowId = result.current.rows[0].id;
    const mockInput = document.createElement('input');
    vi.spyOn(mockInput, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20, x: 50, y: 100, toJSON: () => {},
    });

    act(() => {
      result.current.handleInputFocusOrChange(mockInput, rowId, 'key', 'POR');
    });

    expect(result.current.activeDropdown).toEqual({ rowId, field: 'key' });
    expect(result.current.rows[0].key).toBe('POR');
  });

  it('handles handleRemoveRow and closes activeDropdown if active row was removed', () => {
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

    expect(result.current.rows).toHaveLength(0);
    expect(result.current.activeDropdown).toBeNull();
  });

  it('calculates filteredKeys and filteredValues when activeDropdown is open on key or value', () => {
    const { result } = renderHook(() => useConfigMapModal(defaultProps));

    act(() => {
      result.current.handleAddRow();
    });
    const rowId = result.current.rows[0].id;

    // Active on key
    act(() => {
      result.current.handleRowChange(rowId, 'key', 'POR');
      result.current.setActiveDropdown({ rowId, field: 'key' });
    });
    expect(result.current.filteredKeys.some((k) => k.key === 'PORT')).toBe(true);

    // Active on value
    act(() => {
      result.current.handleRowChange(rowId, 'key', 'PORT');
      result.current.handleRowChange(rowId, 'value', '80');
      result.current.setActiveDropdown({ rowId, field: 'value' });
    });
    expect(result.current.filteredValues.some((v) => v.value === '8080')).toBe(true);

    // When no active row is found (e.g. invalid rowId)
    act(() => {
      result.current.setActiveDropdown({ rowId: 'non-existent-row', field: 'key' });
    });
    expect(result.current.filteredKeys).toEqual([]);
    expect(result.current.filteredValues).toEqual([]);

    // Removing a non-active row ID preserves activeDropdown
    act(() => {
      result.current.setActiveDropdown({ rowId: 'row-99', field: 'value' });
    });
    act(() => {
      result.current.handleRemoveRow('non-existent-row-id');
    });
    expect(result.current.activeDropdown).toEqual({ rowId: 'row-99', field: 'value' });
  });

  it('handleSave builds ConfigMap item and calls onSave and onClose with initialConfigMap id', () => {
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

  it('handleSave defaults name to id when cmName is empty string', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    const { result } = renderHook(() =>
      useConfigMapModal({
        ...defaultProps,
        onClose,
        onSave,
        initialConfigMap: { id: 'cm-auto-fallback', name: '' },
      })
    );

    act(() => {
      result.current.setCmName('');
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith({
      id: 'cm-auto-fallback',
      name: 'cm-auto-fallback',
      configData: [],
    });
  });
});
