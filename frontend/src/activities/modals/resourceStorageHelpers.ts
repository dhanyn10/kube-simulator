import { logger } from '@/lib/logger';
import { getBackendGateway, IBackendGateway } from '@/gateway';

export interface StorageResourceItem {
  id?: string;
  name: string;
  [key: string]: any;
}

export interface ResourceStorageConfig {
  localStorageKey: string;
  settingKey: string;
  logTag: string;
}

/**
 * Persists an array of resource items into storage (localStorage and App.SaveSetting via Gateway).
 */
export const saveResourcesToStorage = async <T extends StorageResourceItem>(
  config: ResourceStorageConfig,
  items: T[],
  gateway: IBackendGateway = getBackendGateway()
): Promise<boolean> => {
  try {
    const json = JSON.stringify(items);
    if (globalThis.localStorage !== undefined) {
      globalThis.localStorage.setItem(config.localStorageKey, json);
    }
    await gateway.saveSetting(config.settingKey, json);
    return true;
  } catch (err) {
    logger.error(`[${config.logTag}] Failed to save resources locally:`, err);
    return false;
  }
};

/**
 * Loads saved resource items from storage (Gateway.getSetting or localStorage fallback).
 */
export const loadResourcesFromStorage = async <T extends StorageResourceItem>(
  config: ResourceStorageConfig,
  gateway: IBackendGateway = getBackendGateway()
): Promise<T[]> => {
  try {
    let dataStr = await gateway.getSetting(config.settingKey);
    if (!dataStr && globalThis.localStorage !== undefined) {
      dataStr = globalThis.localStorage.getItem(config.localStorageKey) || '';
    }
    if (!dataStr) return [];

    const parsed = JSON.parse(dataStr);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    logger.error(`[${config.logTag}] Failed to load resources locally:`, err);
    return [];
  }
};

/**
 * Merges a resource item into the persisted list and returns the updated list.
 */
export const persistResourceItem = async <T extends StorageResourceItem>(
  config: ResourceStorageConfig,
  item: T,
  gateway: IBackendGateway = getBackendGateway()
): Promise<T[]> => {
  const current = await loadResourcesFromStorage<T>(config, gateway);
  const idx = current.findIndex((c) => (item.id && c.id === item.id) || c.name === item.name);
  let updated: T[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = item;
  } else {
    updated = [...current, item];
  }
  await saveResourcesToStorage<T>(config, updated, gateway);
  return updated;
};

/**
 * Removes a resource item by ID or name from storage.
 */
export const removeResourceFromStorage = async <T extends StorageResourceItem>(
  config: ResourceStorageConfig,
  idOrName: string,
  gateway: IBackendGateway = getBackendGateway()
): Promise<T[]> => {
  const current = await loadResourcesFromStorage<T>(config, gateway);
  const updated = current.filter((c) => c.id !== idOrName && c.name !== idOrName);
  await saveResourcesToStorage<T>(config, updated, gateway);
  return updated;
};
