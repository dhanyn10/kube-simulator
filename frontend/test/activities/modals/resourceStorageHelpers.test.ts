import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveResourcesToStorage,
  loadResourcesFromStorage,
  persistResourceItem,
  removeResourceFromStorage,
  ResourceStorageConfig,
} from '@/activities/modals/resourceStorageHelpers';

describe('resourceStorageHelpers', () => {
  const testConfig: ResourceStorageConfig = {
    localStorageKey: 'test_generic_storage',
    settingKey: 'test_generic_setting',
    logTag: 'TestGeneric',
  };

  const sampleItems = [
    { id: 'item-1', name: 'alpha', value: 100 },
    { id: 'item-2', name: 'beta', value: 200 },
  ];

  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.clearAllMocks();
  });

  it('saveResourcesToStorage saves to localStorage and Gateway', async () => {
    const mockGateway: any = {
      saveSetting: vi.fn().mockResolvedValue(true),
    };

    const success = await saveResourcesToStorage(testConfig, sampleItems, mockGateway);
    expect(success).toBe(true);
    expect(globalThis.localStorage.getItem(testConfig.localStorageKey)).toBe(JSON.stringify(sampleItems));
    expect(mockGateway.saveSetting).toHaveBeenCalledWith(testConfig.settingKey, JSON.stringify(sampleItems));
  });

  it('saveResourcesToStorage returns false on circular structure or error', async () => {
    const circular: any = {};
    circular.self = circular;

    const mockGateway: any = { saveSetting: vi.fn() };
    const success = await saveResourcesToStorage(testConfig, [circular], mockGateway);
    expect(success).toBe(false);
  });

  it('loadResourcesFromStorage prioritizes gateway setting and falls back to localStorage', async () => {
    const mockGatewayWithData: any = {
      getSetting: vi.fn().mockResolvedValue(JSON.stringify(sampleItems)),
    };

    const loadedFromGateway = await loadResourcesFromStorage(testConfig, mockGatewayWithData);
    expect(loadedFromGateway).toEqual(sampleItems);

    const mockGatewayEmpty: any = {
      getSetting: vi.fn().mockResolvedValue(''),
    };
    globalThis.localStorage.setItem(testConfig.localStorageKey, JSON.stringify(sampleItems));

    const loadedFromStorage = await loadResourcesFromStorage(testConfig, mockGatewayEmpty);
    expect(loadedFromStorage).toEqual(sampleItems);
  });

  it('loadResourcesFromStorage returns empty array for empty, non-array, or invalid JSON data', async () => {
    const mockGatewayEmpty: any = {
      getSetting: vi.fn().mockResolvedValue(''),
    };

    expect(await loadResourcesFromStorage(testConfig, mockGatewayEmpty)).toEqual([]);

    globalThis.localStorage.setItem(testConfig.localStorageKey, 'not-valid-json');
    expect(await loadResourcesFromStorage(testConfig, mockGatewayEmpty)).toEqual([]);

    globalThis.localStorage.setItem(testConfig.localStorageKey, JSON.stringify({ notAn: 'array' }));
    expect(await loadResourcesFromStorage(testConfig, mockGatewayEmpty)).toEqual([]);
  });

  it('persistResourceItem merges new item and updates existing by id or name', async () => {
    let storedData = JSON.stringify([sampleItems[0]]);
    const mockGateway: any = {
      getSetting: vi.fn().mockImplementation(() => Promise.resolve(storedData)),
      saveSetting: vi.fn().mockImplementation((_k: string, v: string) => {
        storedData = v;
        return Promise.resolve(true);
      }),
    };

    // Add new item
    const afterAdd = await persistResourceItem(testConfig, sampleItems[1], mockGateway);
    expect(afterAdd).toHaveLength(2);
    expect(afterAdd[1].name).toBe('beta');

    // Update existing item by id
    const modifiedAlpha = { id: 'item-1', name: 'alpha', value: 999 };
    const afterUpdate = await persistResourceItem(testConfig, modifiedAlpha, mockGateway);
    expect(afterUpdate).toHaveLength(2);
    expect(afterUpdate[0].value).toBe(999);
  });

  it('removeResourceFromStorage deletes item matching id or name', async () => {
    let storedData = JSON.stringify(sampleItems);
    const mockGateway: any = {
      getSetting: vi.fn().mockImplementation(() => Promise.resolve(storedData)),
      saveSetting: vi.fn().mockImplementation((_k: string, v: string) => {
        storedData = v;
        return Promise.resolve(true);
      }),
    };

    const afterRemoveById = await removeResourceFromStorage(testConfig, 'item-1', mockGateway);
    expect(afterRemoveById).toHaveLength(1);
    expect(afterRemoveById[0].name).toBe('beta');

    const afterRemoveByName = await removeResourceFromStorage(testConfig, 'beta', mockGateway);
    expect(afterRemoveByName).toHaveLength(0);
  });
});
