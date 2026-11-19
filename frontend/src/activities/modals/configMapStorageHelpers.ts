import { K8sConfigMapItem } from '@/types';
import {
  saveResourcesToStorage,
  loadResourcesFromStorage,
  persistResourceItem,
  removeResourceFromStorage,
  ResourceStorageConfig,
} from './resourceStorageHelpers';

export const CONFIG_MAPS_STORAGE_KEY = 'kube_simulator_configmaps';
export const CONFIG_MAPS_SETTING_KEY = 'kube_configmaps_data';

const configMapStorageConfig: ResourceStorageConfig = {
  localStorageKey: CONFIG_MAPS_STORAGE_KEY,
  settingKey: CONFIG_MAPS_SETTING_KEY,
  logTag: 'ConfigMapStorage',
};

/**
 * Persists an array of ConfigMaps into local storage (localStorage and App.SaveSetting).
 */
export const saveConfigMapsToLocal = (configMaps: K8sConfigMapItem[]): Promise<boolean> =>
  saveResourcesToStorage(configMapStorageConfig, configMaps);

/**
 * Loads saved ConfigMaps from local storage (App.GetSetting or localStorage fallback).
 */
export const loadConfigMapsFromLocal = (): Promise<K8sConfigMapItem[]> =>
  loadResourcesFromStorage<K8sConfigMapItem>(configMapStorageConfig);

/**
 * Merges a ConfigMap item into the locally persisted list and returns the updated list.
 */
export const persistConfigMapItem = (cmItem: K8sConfigMapItem): Promise<K8sConfigMapItem[]> =>
  persistResourceItem(configMapStorageConfig, cmItem);

/**
 * Removes a ConfigMap item by ID or name from local storage.
 */
export const removeConfigMapFromLocal = (idOrName: string): Promise<K8sConfigMapItem[]> =>
  removeResourceFromStorage<K8sConfigMapItem>(configMapStorageConfig, idOrName);
