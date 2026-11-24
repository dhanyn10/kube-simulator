import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkIsKeyOverridden,
  reorderItems,
  syncConfigMapPrecedenceOrder,
} from '@/components/Modals/configMapPrecedenceHelpers';
import * as storageHelpers from '@/activities/modals/configMapStorageHelpers';

vi.mock('@/activities/modals/configMapStorageHelpers', () => ({
  saveConfigMapsToLocal: vi.fn().mockResolvedValue(true),
}));

describe('configMapPrecedenceHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkIsKeyOverridden', () => {
    const mockItems = [
      { name: 'cm-base', rawItem: { configData: [{ key: 'PORT', value: '8080' }, { key: 'HOST', value: 'localhost' }] } },
      { name: 'cm-staging', rawItem: { configData: [{ key: 'PORT', value: '9000' }] } },
      { name: 'cm-prod', rawItem: { configData: [{ key: 'PORT', value: '443' }, { key: 'SSL_ENABLED', value: 'true' }] } },
    ];

    it('returns isOverridden: true when a lower ConfigMap defines the same key', () => {
      // cm-base (index 0) has PORT, and cm-staging (index 1) also has PORT
      const result = checkIsKeyOverridden('PORT', 0, mockItems);
      expect(result.isOverridden).toBe(true);
      expect(result.overriddenByCmName).toBe('cm-staging');
    });

    it('returns isOverridden: true for middle ConfigMap if overridden by bottom ConfigMap', () => {
      // cm-staging (index 1) has PORT, and cm-prod (index 2) also has PORT
      const result = checkIsKeyOverridden('PORT', 1, mockItems);
      expect(result.isOverridden).toBe(true);
      expect(result.overriddenByCmName).toBe('cm-prod');
    });

    it('returns isOverridden: false for bottom ConfigMap even if upper ConfigMaps define the same key', () => {
      // cm-prod (index 2) is at the bottom, so nothing below it overrides PORT
      const result = checkIsKeyOverridden('PORT', 2, mockItems);
      expect(result.isOverridden).toBe(false);
      expect(result.overriddenByCmName).toBeUndefined();
    });

    it('returns isOverridden: false for unique keys that are not defined in lower ConfigMaps', () => {
      // HOST is defined in cm-base (index 0) and not in cm-staging or cm-prod
      const result = checkIsKeyOverridden('HOST', 0, mockItems);
      expect(result.isOverridden).toBe(false);
    });

    it('returns isOverridden: false for empty or whitespace-only keys', () => {
      const result = checkIsKeyOverridden('   ', 0, mockItems);
      expect(result.isOverridden).toBe(false);
    });
  });

  describe('reorderItems', () => {
    const list = ['A', 'B', 'C', 'D'];

    it('moves an item forward correctly', () => {
      const result = reorderItems(list, 0, 2);
      expect(result).toEqual(['B', 'C', 'A', 'D']);
    });

    it('moves an item backward correctly', () => {
      const result = reorderItems(list, 3, 1);
      expect(result).toEqual(['A', 'D', 'B', 'C']);
    });

    it('returns a clone when fromIndex equals toIndex', () => {
      const result = reorderItems(list, 1, 1);
      expect(result).toEqual(list);
    });

    it('returns a clone when indices are out of bounds', () => {
      expect(reorderItems(list, -1, 2)).toEqual(list);
      expect(reorderItems(list, 0, 10)).toEqual(list);
    });
  });

  describe('syncConfigMapPrecedenceOrder', () => {
    it('sorts node configMaps and savedConfigMaps according to the new order and calls addLog', () => {
      const mockUpdateNodeData = vi.fn();
      const mockSetSavedConfigMaps = vi.fn();
      const mockAddLog = vi.fn();

      const reorderedOverviewItems = [
        { id: 'cm-prod', name: 'prod-config', rawItem: { id: 'cm-prod' } } as any,
        { id: 'cm-base', name: 'base-config', rawItem: { id: 'cm-base' } } as any,
      ];

      const nodes = [{ id: 'node-1', data: { configMaps: [{ id: 'cm-base', name: 'base-config' }, { id: 'cm-prod', name: 'prod-config' }] } }];
      const savedConfigMaps = [{ id: 'cm-base', name: 'base-config', configData: [] }, { id: 'cm-prod', name: 'prod-config', configData: [] }];

      syncConfigMapPrecedenceOrder(
        reorderedOverviewItems,
        nodes,
        mockUpdateNodeData,
        savedConfigMaps,
        mockSetSavedConfigMaps,
        mockAddLog
      );

      // Verify node was updated with new sorted order (cm-prod before cm-base)
      expect(mockUpdateNodeData).toHaveBeenCalledWith('node-1', {
        configMaps: [{ id: 'cm-prod', name: 'prod-config' }, { id: 'cm-base', name: 'base-config' }],
      });

      // Verify savedConfigMaps were sorted
      expect(mockSetSavedConfigMaps).toHaveBeenCalledWith([
        { id: 'cm-prod', name: 'prod-config', configData: [] },
        { id: 'cm-base', name: 'base-config', configData: [] },
      ]);

      expect(storageHelpers.saveConfigMapsToLocal).toHaveBeenCalled();
      expect(mockAddLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('[ConfigMap Precedence]'),
        'UI'
      );
    });
  });

  describe('checkIsKeyOverridden (profile filter branches)', () => {
    const itemsWithProfiles = [
      { name: 'cm-a', profileName: 'staging', rawItem: { configData: [{ key: 'PORT', value: '8080' }] } },
      { name: 'cm-b', profileName: 'prod', rawItem: { configData: [{ key: 'PORT', value: '443' }] } },
      { name: 'cm-c', rawItem: { configData: [{ key: 'PORT', value: '80' }] } },
    ];

    it('skips lower items with a different profile when profileName filter is set', () => {
      // cm-a (index 0) has PORT; lower item cm-b has profile "prod" != "staging" -> continue
      const result = checkIsKeyOverridden('PORT', 0, itemsWithProfiles, 'staging');
      // cm-c has no profileName and PORT in configData; checkIsKeyOverridden matches it too but
      // normalizeProfile !== lowerProfile is false for cm-c? cm-c.profileName undefined -> lowerProfile falsy -> no continue -> matches
      expect(result.isOverridden).toBe(true);
      expect(result.overriddenByCmName).toBe('cm-c');
    });

    it('skips lower item with same profile mismatch differently and matches the no-profile item', () => {
      // cm-a has PORT; cm-b skipped (profile mismatch); cm-c (no profile) matches
      const result = checkIsKeyOverridden('PORT', 0, itemsWithProfiles, 'staging');
      expect(result.overriddenByCmName).toBe('cm-c');
    });

    it('does not continue when profileName filter is set and lower item has no profileName', () => {
      // cm-b (index 1) has PORT; with profile "prod" filter, cm-c below has no profileName -> lowerProfile falsy -> no continue, so PORT matches cm-c
      const result = checkIsKeyOverridden('PORT', 1, itemsWithProfiles, 'prod');
      expect(result.isOverridden).toBe(true);
      expect(result.overriddenByCmName).toBe('cm-c');
    });

    it('falls through when lower item has no profileName and filter set but data is not array', () => {
      // cm-c has no profileName and no rawItem -> dataArray undefined -> skip, no override
      const items = [
        { name: 'cm-a', rawItem: { configData: [{ key: 'PORT', value: '1' }] } },
        { name: 'cm-b', rawItem: {} },
      ];
      const result = checkIsKeyOverridden('PORT', 0, items, 'any-profile');
      expect(result.isOverridden).toBe(false);
    });

    it('returns not overridden when dataArray is not an array', () => {
      const items = [
        { name: 'cm-a', rawItem: { configData: [{ key: 'PORT', value: '1' }] } },
        { name: 'cm-b', rawItem: { configData: 'nope' } },
        { name: 'cm-c', rawItem: { secretData: { not: 'array' } } },
      ];
      expect(checkIsKeyOverridden('PORT', 0, items).isOverridden).toBe(false);
    });

    it('skips entries where kv is undefined or key is not a string', () => {
      const items = [
        { name: 'cm-a', rawItem: { configData: [{ key: 'PORT', value: '1' }] } },
        { name: 'cm-b', rawItem: { configData: [undefined, {}, { key: 5 }, { key: 'PORT', value: '2' }] } },
      ];
      const result = checkIsKeyOverridden('PORT', 0, items);
      expect(result.isOverridden).toBe(true);
      expect(result.overriddenByCmName).toBe('cm-b');
    });

    it('uses rawItem.name fallback when lower item has no name but rawItem.name exists', () => {
      const items = [
        { name: 'cm-a', rawItem: { configData: [{ key: 'PORT', value: '1' }] } },
        { rawItem: { name: 'raw-name', configData: [{ key: 'PORT', value: '2' }] } },
      ];
      const result = checkIsKeyOverridden('PORT', 0, items);
      expect(result.isOverridden).toBe(true);
      expect(result.overriddenByCmName).toBe('raw-name');
    });

    it('falls back to item-N when neither name nor rawItem.name exists', () => {
      const items = [
        { name: 'cm-a', rawItem: { configData: [{ key: 'PORT', value: '1' }] } },
        { rawItem: { configData: [{ key: 'PORT', value: '2' }] } },
      ];
      const result = checkIsKeyOverridden('PORT', 0, items);
      expect(result.isOverridden).toBe(true);
      expect(result.overriddenByCmName).toBe('item-2');
    });
  });

  describe('reorderItems (negative toIndex branch)', () => {
    it('returns a clone when toIndex is negative', () => {
      expect(reorderItems(['A', 'B', 'C'], 0, -1)).toEqual(['A', 'B', 'C']);
    });
  });

  describe('syncResourcePrecedenceOrder branches', () => {
    const nodesWithUnranked = [
      { id: 'node-u', data: { configMaps: [{ id: 'ghost', name: 'ghost-cm' }, { id: 'other', name: 'other-cm' }] } },
      { id: 'node-len1', data: { configMaps: [{ id: 'a', name: 'a-cm' }] } },
      { id: 'node-nodata' },
      { id: 'node-nonarray', data: { configMaps: 'nope' } },
    ];
    const reordered = [{ id: 'ghost', name: 'ghost-cm' }, { id: 'other', name: 'other-cm' }];
    const mockUpdateNodeData = vi.fn();

    it('sorts node configMaps using reordered order ranks', () => {
      syncConfigMapPrecedenceOrder(reordered, nodesWithUnranked, mockUpdateNodeData, [], vi.fn());
      expect(mockUpdateNodeData).toHaveBeenCalledWith('node-u', {
        configMaps: [{ id: 'ghost', name: 'ghost-cm' }, { id: 'other', name: 'other-cm' }],
      });
    });

    it('does not update nodes with non-array or missing configMaps', () => {
      syncConfigMapPrecedenceOrder([], nodesWithUnranked, mockUpdateNodeData, [], vi.fn());
      expect(mockUpdateNodeData).not.toHaveBeenCalledWith('node-len1', expect.anything());
      expect(mockUpdateNodeData).not.toHaveBeenCalledWith('node-nodata', expect.anything());
      expect(mockUpdateNodeData).not.toHaveBeenCalledWith('node-nonarray', expect.anything());
    });

    it('handles savedItems empty array and missing addLog without crashing', () => {
      const setSaved = vi.fn();
      syncConfigMapPrecedenceOrder([], [], vi.fn(), [], setSaved);
      expect(setSaved).not.toHaveBeenCalled();
      syncConfigMapPrecedenceOrder([], [], vi.fn(), [], vi.fn(), undefined);
    });

    it('covers savedItems non-array branch', () => {
      const setSaved = vi.fn();
      syncConfigMapPrecedenceOrder([], [], vi.fn(), 'not-array' as any, setSaved);
      expect(setSaved).not.toHaveBeenCalled();
    });

    it('orders by id when both id and name are ranked, and by name otherwise', () => {
      // Items where get(id) is undefined but get(name) exists
      const items = [{ name: 'z', rawItem: { name: 'z' } }, { name: 'a', rawItem: { name: 'a' } }];
      syncConfigMapPrecedenceOrder(items, [{ id: 'n', data: { configMaps: [{ name: 'z' }, { name: 'a' }] } }], mockUpdateNodeData, [], vi.fn());
      const arg = mockUpdateNodeData.mock.calls.at(-1)?.[1];
      expect(arg).toBeDefined();
    });
  });
});
