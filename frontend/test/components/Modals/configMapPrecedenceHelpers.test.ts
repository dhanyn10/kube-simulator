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
});
