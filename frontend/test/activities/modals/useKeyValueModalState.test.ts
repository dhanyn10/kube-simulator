import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyValueModalState } from '@/activities/modals/useKeyValueModalState';

describe('useKeyValueModalState', () => {
  it('initializes with default key-value pairs', () => {
    const defaults = [
      { key: 'ENV', value: 'production' },
      { key: 'PORT', value: '8080' },
    ];
    const { result } = renderHook(() => useKeyValueModalState('test', defaults));

    expect(result.current.dataItems).toHaveLength(2);
    expect(result.current.dataItems[0].key).toBe('ENV');
    expect(result.current.dataItems[0].value).toBe('production');
    expect(result.current.dataItems[0].id).toBe('test-kv-1');
  });

  it('adds a new empty field with unique ID', () => {
    const { result } = renderHook(() => useKeyValueModalState('custom', []));

    expect(result.current.dataItems).toHaveLength(0);

    act(() => {
      result.current.handleAddField();
    });

    expect(result.current.dataItems).toHaveLength(1);
    expect(result.current.dataItems[0].key).toBe('');
    expect(result.current.dataItems[0].value).toBe('');
    expect(result.current.dataItems[0].id).toContain('custom-kv-');
  });

  it('updates key and value fields independently', () => {
    const { result } = renderHook(() =>
      useKeyValueModalState('test', [{ key: 'ORIGINAL_KEY', value: 'ORIGINAL_VAL' }])
    );

    const itemId = result.current.dataItems[0].id;

    act(() => {
      result.current.handleUpdateField(itemId, 'key', 'NEW_KEY');
    });
    expect(result.current.dataItems[0].key).toBe('NEW_KEY');
    expect(result.current.dataItems[0].value).toBe('ORIGINAL_VAL');

    act(() => {
      result.current.handleUpdateField(itemId, 'value', 'NEW_VAL');
    });
    expect(result.current.dataItems[0].value).toBe('NEW_VAL');

    // Updating a non-matching ID leaves items unchanged
    act(() => {
      result.current.handleUpdateField('unknown-id', 'key', 'IGNORED');
    });
    expect(result.current.dataItems[0].key).toBe('NEW_KEY');
  });

  it('removes field by ID', () => {
    const { result } = renderHook(() =>
      useKeyValueModalState('test', [
        { key: 'KEEP', value: 'yes' },
        { key: 'REMOVE', value: 'no' },
      ])
    );

    const removeId = result.current.dataItems[1].id;

    act(() => {
      result.current.handleRemoveField(removeId);
    });

    expect(result.current.dataItems).toHaveLength(1);
    expect(result.current.dataItems[0].key).toBe('KEEP');
  });

  it('getValidData ignores items with whitespace or empty keys', () => {
    const { result } = renderHook(() =>
      useKeyValueModalState('test', [
        { key: 'VALID_KEY', value: '123' },
        { key: '   ', value: 'empty-key' },
        { key: '', value: 'also-empty' },
        { key: 'ANOTHER_VALID', value: '456' },
      ])
    );

    const valid = result.current.getValidData();
    expect(valid).toEqual([
      { key: 'VALID_KEY', value: '123' },
      { key: 'ANOTHER_VALID', value: '456' },
    ]);
  });
});
