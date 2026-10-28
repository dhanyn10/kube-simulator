import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveConfigMapsToLocal,
  loadConfigMapsFromLocal,
  persistConfigMapItem,
  removeConfigMapFromLocal,
  CONFIG_MAPS_STORAGE_KEY,
  CONFIG_MAPS_SETTING_KEY,
} from '@/activities/modals/configMapStorageHelpers';
import { K8sConfigMapItem } from '@/types';

describe('configMapStorageHelpers', () => {
  const sampleCMs: K8sConfigMapItem[] = [
    {
      id: 'cm-1',
      name: 'app-config',
      configData: [{ key: 'API_URL', value: 'https://api.example.com' }],
    },
    {
      id: 'cm-2',
      name: 'db-config',
      configData: [{ key: 'DB_PORT', value: '5432' }],
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    delete (globalThis as any).go;
  });

  it('saveConfigMapsToLocal saves to localStorage and App.SaveSetting when available', async () => {
    const mockSaveSetting = vi.fn().mockResolvedValue(true);
    (globalThis as any).go = {
      main: {
        App: {
          SaveSetting: mockSaveSetting,
        },
      },
    };

    const result = await saveConfigMapsToLocal(sampleCMs);
    expect(result).toBe(true);

    const localStored = localStorage.getItem(CONFIG_MAPS_STORAGE_KEY);
    expect(localStored).toBe(JSON.stringify(sampleCMs));
    expect(mockSaveSetting).toHaveBeenCalledWith(
      CONFIG_MAPS_SETTING_KEY,
      JSON.stringify(sampleCMs)
    );
  });

  it('saveConfigMapsToLocal handles JSON errors gracefully', async () => {
    const circular: any = {};
    circular.self = circular;

    const result = await saveConfigMapsToLocal(circular as any);
    expect(result).toBe(false);
  });

  it('loadConfigMapsFromLocal loads from App.GetSetting when available', async () => {
    const mockGetSetting = vi.fn().mockResolvedValue(JSON.stringify(sampleCMs));
    (globalThis as any).go = {
      main: {
        App: {
          GetSetting: mockGetSetting,
        },
      },
    };

    const loaded = await loadConfigMapsFromLocal();
    expect(loaded).toEqual(sampleCMs);
    expect(mockGetSetting).toHaveBeenCalledWith(CONFIG_MAPS_SETTING_KEY);
  });

  it('loadConfigMapsFromLocal falls back to localStorage when App.GetSetting is empty or missing', async () => {
    localStorage.setItem(CONFIG_MAPS_STORAGE_KEY, JSON.stringify(sampleCMs));

    const loaded = await loadConfigMapsFromLocal();
    expect(loaded).toEqual(sampleCMs);
  });

  it('loadConfigMapsFromLocal returns empty array if no data or invalid JSON', async () => {
    localStorage.setItem(CONFIG_MAPS_STORAGE_KEY, 'invalid-json{');
    const loaded = await loadConfigMapsFromLocal();
    expect(loaded).toEqual([]);
  });

  it('persistConfigMapItem adds new ConfigMap item and updates existing item', async () => {
    await saveConfigMapsToLocal([sampleCMs[0]]);

    // 1. Add new ConfigMap
    const updatedWithNew = await persistConfigMapItem(sampleCMs[1]);
    expect(updatedWithNew).toHaveLength(2);
    expect(updatedWithNew[1].name).toBe('db-config');

    // 2. Update existing ConfigMap
    const modifiedCm1: K8sConfigMapItem = {
      ...sampleCMs[0],
      configData: [{ key: 'API_URL', value: 'https://new.api.com' }],
    };
    const updatedWithMod = await persistConfigMapItem(modifiedCm1);
    expect(updatedWithMod).toHaveLength(2);
    expect(updatedWithMod[0].configData[0].value).toBe('https://new.api.com');
  });

  it('removeConfigMapFromLocal removes ConfigMap by id or name', async () => {
    await saveConfigMapsToLocal(sampleCMs);

    const afterRemove1 = await removeConfigMapFromLocal('cm-1');
    expect(afterRemove1).toHaveLength(1);
    expect(afterRemove1[0].name).toBe('db-config');

    const afterRemove2 = await removeConfigMapFromLocal('db-config');
    expect(afterRemove2).toHaveLength(0);
  });
});
