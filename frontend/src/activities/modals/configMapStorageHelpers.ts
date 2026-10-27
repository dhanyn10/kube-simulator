import { K8sConfigMapItem } from '@/types';
import { logger } from '@/lib/logger';

export const CONFIG_MAPS_STORAGE_KEY = 'kube_simulator_configmaps';
export const CONFIG_MAPS_SETTING_KEY = 'kube_configmaps_data';

/**
 * Persists an array of ConfigMaps into local storage (localStorage and App.SaveSetting).
 *
 * @param configMaps - Array of ConfigMap items to persist.
 * @returns Boolean indicating whether save succeeded.
 */
export const saveConfigMapsToLocal = async (configMaps: K8sConfigMapItem[]): Promise<boolean> => {
  try {
    const json = JSON.stringify(configMaps);
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.setItem(CONFIG_MAPS_STORAGE_KEY, json);
    }
    if (globalThis.go?.main?.App?.SaveSetting) {
      await globalThis.go.main.App.SaveSetting(CONFIG_MAPS_SETTING_KEY, json);
    }
    return true;
  } catch (err) {
    logger.error('[ConfigMapStorage] Failed to save ConfigMaps locally:', err);
    return false;
  }
};

/**
 * Loads saved ConfigMaps from local storage (App.GetSetting or localStorage fallback).
 *
 * @returns Array of saved ConfigMap items.
 */
export const loadConfigMapsFromLocal = async (): Promise<K8sConfigMapItem[]> => {
  try {
    let dataStr = '';
    if (globalThis.go?.main?.App?.GetSetting) {
      dataStr = await globalThis.go.main.App.GetSetting(CONFIG_MAPS_SETTING_KEY);
    }
    if (!dataStr && typeof globalThis.localStorage !== 'undefined') {
      dataStr = globalThis.localStorage.getItem(CONFIG_MAPS_STORAGE_KEY) || '';
    }
    if (!dataStr) return [];

    const parsed = JSON.parse(dataStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.error('[ConfigMapStorage] Failed to load ConfigMaps locally:', err);
    return [];
  }
};

/**
 * Merges a ConfigMap item into the locally persisted list and returns the updated list.
 *
 * @param cmItem - ConfigMap item to add or update.
 * @returns Updated array of ConfigMap items.
 */
export const persistConfigMapItem = async (cmItem: K8sConfigMapItem): Promise<K8sConfigMapItem[]> => {
  const current = await loadConfigMapsFromLocal();
  const idx = current.findIndex((c) => c.id === cmItem.id || c.name === cmItem.name);
  let updated: K8sConfigMapItem[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = cmItem;
  } else {
    updated = [...current, cmItem];
  }
  await saveConfigMapsToLocal(updated);
  return updated;
};

/**
 * Removes a ConfigMap item by ID or name from local storage.
 *
 * @param idOrName - Identifier or name of the ConfigMap to remove.
 * @returns Updated array of ConfigMap items.
 */
export const removeConfigMapFromLocal = async (idOrName: string): Promise<K8sConfigMapItem[]> => {
  const current = await loadConfigMapsFromLocal();
  const updated = current.filter((c) => c.id !== idOrName && c.name !== idOrName);
  await saveConfigMapsToLocal(updated);
  return updated;
};
